const cron = require("node-cron");
const { isWhatsAppEnabled } = require("../lib/whatsapp-runtime");
const { outbound } = require('../services/whatsapp-route.service');
const { runProviderScope } = require('../lib/provider-execution');
const { processIncomingMessage } = require("../contexts/receptionist");
const { sendMessage } = require("../contexts/communication");
const operatorChannel = () => require('../contexts').operatorChannel;
const {
  claimNextInboundJob, markInboundJobDone, markInboundJobFailed,
  checkpointInboundJob, renewInboundJobLease, recoverExpiredInboundJobs,
  getNextInboundAttemptAt, InboundLeaseLostError, HEARTBEAT_MS,
} = require("../services/inbound-job.service");
const { getOperationalSchedules } = require("../config/operational-schedule");
const {
  startInboundWorkerHealth, markInboundRunStarted,
  markInboundRunSucceeded, markInboundRunFailed,
} = require("../services/operational-health.service");

// El webhook dispara el drenado inmediatamente. El cron queda como red de
// recuperación para reinicios, señales perdidas y concesiones vencidas, sin
// hacer consultas vacías cada 5 s. Los otros barridos operativos comparten
// la ventana de 15 minutos; este corre 30 segundos después para no competir
// por el pool.
const MAX_SEND_ATTEMPTS = 3;
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Persist only the public Communication command, not sessions, analysis or
// arbitrary engine objects. Preserve the existing order of replies in a batch.
const prepareReplies = (result, preparedAt) => {
  if (!result) return [];
  const replies = [...(Array.isArray(result.additionalReplies) ? result.additionalReplies : []), ...(result.processed ? [result] : [])];
  return replies.flatMap(({ from, reply, user, conversation }) => {
    if (!from || !reply) return [];
    if (!user?.id) {
      console.error("[InboundMessageJob] Reply omitted: unresolved user");
      return [];
    }
    return [{ tenantId: user.tenantId ?? null, userId: user.id,
      conversationId: conversation?.id ?? null, phone: from, content: reply, origin: "agente", preparedAt }];
  });
};

// Keep 8.4's bounded live delivery retries. A crash during sending is ambiguous
// and NEVER automatically replays this call (ADR 011). Exhaustion is not done.
const sendOneReply = async (reply, assertLease) => {
  for (let attempt = 1; attempt <= MAX_SEND_ATTEMPTS; attempt += 1) {
    await assertLease();
    try {
      await sendMessage(reply);
      return;
    } catch (error) {
      if (error.deliveryAccepted || error.deliveryUncertain) throw error;
      if (attempt === MAX_SEND_ATTEMPTS) throw error;
      await delay(1000 * attempt);
    }
  }
};

const processOneJob = async () => {
  if (!isWhatsAppEnabled()) return false;
  let job = await claimNextInboundJob();
  if (!job) return false;
  if (process.env.WHATSAPP_MULTITENANT_ENABLED === 'true' && !job.providerRoute) {
    // A pre-migration job has no proven credential revision. Do not adopt a
    // new grant, even when the business still uses the same phone number.
    await markInboundJobFailed(job, Object.assign(new Error('PROVIDER_ROUTE_CHANGED'), { code: 'PROVIDER_ROUTE_CHANGED' }));
    return true;
  }
  if (job.providerRoute) {
    try {
      const route = await outbound(job.providerRoute.tenantId, job.providerRoute);
      if (!route) throw Object.assign(new Error('PROVIDER_ROUTE_CHANGED'), { code: 'PROVIDER_ROUTE_CHANGED' });
      return await runProviderScope({ tenantId: route.tenantId, whatsapp: route }, () => processClaimedJob(job));
    } catch (error) { await markInboundJobFailed(job, error); return true; }
  }
  return processClaimedJob(job);
};

const processClaimedJob = async (initialJob) => {
  let job = initialJob;
  const startedAt = Date.now();
  let leaseError = null;
  let renewing = false;
  const assertLease = async () => {
    if (leaseError) throw leaseError;
    // Check ownership in the database immediately before every new effect.
    await renewInboundJobLease(job);
  };
  const heartbeat = setInterval(async () => {
    if (renewing || leaseError) return;
    renewing = true;
    try { await renewInboundJobLease(job); }
    catch (error) { leaseError = error; }
    finally { renewing = false; }
  }, HEARTBEAT_MS);
  heartbeat.unref?.();

  try {
    if (job.phase === "pending") {
      job = await checkpointInboundJob(job, "processing");
      await assertLease();
      const preparedAt = new Date().toISOString();
      let replies;
      if (job.envelopeVersion === 2) {
        const routed = await operatorChannel().process(job); job = routed.job;
        replies = routed.replies || (routed.customerPayload ? prepareReplies(await processIncomingMessage(routed.customerPayload), preparedAt) : []);
      } else replies = prepareReplies(await processIncomingMessage(job.payload), preparedAt);
      job = await checkpointInboundJob(job, replies.length ? "ready" : "complete", { replies, replyCursor: 0 });
    }
    if (job.phase === "ready") {
      if (!Array.isArray(job.replies) || !Number.isInteger(job.replyCursor) ||
          job.replyCursor < 0 || job.replyCursor > job.replies.length) {
        job = await checkpointInboundJob(job, "processing");
        throw new Error("Invalid inbound reply checkpoint");
      }
      while (job.replyCursor < job.replies.length) {
        job = await checkpointInboundJob(job, "sending");
        const reply = job.replies[job.replyCursor];
        if (job.envelopeVersion === 2 && reply.deliveryId) {
          let result;
          for (let i = 0; i < 4; i++) { await assertLease(); result = await operatorChannel().delivery.send(reply.deliveryId); if (result.state !== 'rejected') break; }
          if (!['accepted','blocked'].includes(result?.state)) throw new Error('OPERATOR_DELIVERY_REQUIRES_REVIEW');
        } else if (job.envelopeVersion === 2 || process.env.OPERATOR_WHATSAPP_ENABLED === 'true') {
          await operatorChannel().guardCustomerReply(job, reply, () => sendOneReply(reply, assertLease));
        } else await sendOneReply(reply, assertLease);
        const replyCursor = job.replyCursor + 1;
        job = await checkpointInboundJob(job, replyCursor === job.replies.length ? "complete" : "ready", { replyCursor });
      }
      if (job.phase === "ready") job = await checkpointInboundJob(job, "complete");
    }
    await markInboundJobDone(job);
  } catch (error) {
    console.error("[InboundMessageJob] Job interrupted:", job.id, job.envelopeVersion === 2 ? 'OPERATOR_JOB_INTERRUPTED' : error.message);
    if (!(error instanceof InboundLeaseLostError)) {
      await markInboundJobFailed(job, error).catch((markError) =>
        console.error("[InboundMessageJob] Could not record failure:", job.id, job.envelopeVersion === 2 ? 'OPERATOR_FAILURE_NOT_RECORDED' : markError.message));
    }
  } finally {
    clearInterval(heartbeat);
    console.info("[InboundMessageJob] Turn timing:", { jobId: job.id, elapsedMs: Date.now() - startedAt, phase: job.phase });
  }
  return true;
};

let draining = null;
let rerunRequested = false;
let followUpTimer = null;
let followUpAt = null;
let stopped = false;
let cronTask = null;

const drainInboundJobs = () => {
  if (draining) return draining;
  draining = (async () => {
    markInboundRunStarted();
    try {
      await recoverExpiredInboundJobs();
      if (process.env.OPERATOR_WHATSAPP_ENABLED === 'true') await operatorChannel().maintain();
      let processed = 0;
      while (!stopped && processed < 50 && await processOneJob()) processed += 1;
      markInboundRunSucceeded(processed);
      return processed;
    } catch (error) {
      markInboundRunFailed();
      throw error;
    }
  })().finally(() => { draining = null; });
  return draining;
};

const scheduleFollowUp = (nextAttemptAt) => {
  if (stopped) return;
  if (!nextAttemptAt) {
    if (followUpTimer) clearTimeout(followUpTimer);
    followUpTimer = null;
    followUpAt = null;
    return;
  }

  const target = new Date(nextAttemptAt).getTime();
  if (!Number.isFinite(target)) return;
  if (followUpTimer && followUpAt <= target) return;
  if (followUpTimer) clearTimeout(followUpTimer);
  followUpAt = target;
  followUpTimer = setTimeout(() => {
    followUpTimer = null;
    followUpAt = null;
    requestInboundDrain();
  }, Math.max(0, target - Date.now()));
  followUpTimer.unref?.();
};

const requestInboundDrain = () => {
  if (stopped) return Promise.resolve(0);
  if (draining) {
    rerunRequested = true;
    return draining;
  }

  const run = drainInboundJobs();
  run.then(async () => {
    if (stopped) return;
    if (rerunRequested) {
      rerunRequested = false;
      requestInboundDrain();
      return;
    }
    scheduleFollowUp(await getNextInboundAttemptAt());
  }).catch((error) => {
    console.error("[InboundMessageJob] Unhandled error:", error.message);
  });
  return run;
};

const startInboundMessageJob = () => {
  stopped = false;
  const schedules = getOperationalSchedules();
  startInboundWorkerHealth({
    expectedIntervalMs: 15 * 60 * 1000,
  });
  cronTask = cron.schedule(schedules.inboundRecovery, requestInboundDrain);
  requestInboundDrain();
  console.log(`[InboundMessageJob] Event-driven with recovery sweep (${schedules.mode}: ${schedules.inboundRecovery})`);
};

const stopInboundMessageJob = async () => {
  stopped = true; rerunRequested = false;
  if (followUpTimer) clearTimeout(followUpTimer);
  followUpTimer = null; followUpAt = null; cronTask?.stop(); cronTask = null;
  if (draining) await draining;
};
module.exports = { startInboundMessageJob, stopInboundMessageJob, requestInboundDrain, drainInboundJobs, processOneJob };
