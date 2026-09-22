const cron = require("node-cron");
const { processIncomingMessage } = require("../contexts/receptionist");
const { sendMessage } = require("../contexts/communication");
const {
  claimNextInboundJob, markInboundJobDone, markInboundJobFailed,
  checkpointInboundJob, renewInboundJobLease, recoverExpiredInboundJobs,
  getNextInboundAttemptAt, InboundLeaseLostError, HEARTBEAT_MS,
} = require("../services/inbound-job.service");
const { getOperationalSchedules } = require("../config/operational-schedule");

// El webhook dispara el drenado inmediatamente. El cron queda como red de
// recuperación para reinicios, señales perdidas y concesiones vencidas, sin
// mantener un compute serverless despierto con consultas vacías cada 5 s.
// Los otros barridos operativos comparten la misma ventana configurable.
// Este corre 30 segundos después para reutilizar el compute ya despierto,
// evitar competir por el pool y no extender otra ventana facturable de Neon.
const MAX_SEND_ATTEMPTS = 3;
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Persist only the public Communication command, not sessions, analysis or
// arbitrary engine objects. Preserve the existing order of replies in a batch.
const prepareReplies = (result) => {
  if (!result?.processed || !result?.from) return [];
  const replies = [...(Array.isArray(result.additionalReplies) ? result.additionalReplies : []), result];
  return replies.flatMap(({ from, reply, user, conversation }) => {
    if (!from || !reply) return [];
    if (!user?.id) {
      console.error("[InboundMessageJob] Reply omitted: unresolved user");
      return [];
    }
    return [{ tenantId: user.tenantId ?? null, userId: user.id,
      conversationId: conversation?.id ?? null, phone: from, content: reply, origin: "agente" }];
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
      if (attempt === MAX_SEND_ATTEMPTS) throw error;
      await delay(1000 * attempt);
    }
  }
};

const processOneJob = async () => {
  let job = await claimNextInboundJob();
  if (!job) return false;
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
      const result = await processIncomingMessage(job.payload);
      const replies = prepareReplies(result);
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
        await sendOneReply(job.replies[job.replyCursor], assertLease);
        const replyCursor = job.replyCursor + 1;
        job = await checkpointInboundJob(job, replyCursor === job.replies.length ? "complete" : "ready", { replyCursor });
      }
      if (job.phase === "ready") job = await checkpointInboundJob(job, "complete");
    }
    await markInboundJobDone(job);
  } catch (error) {
    console.error("[InboundMessageJob] Job interrupted:", job.id, error.message);
    if (!(error instanceof InboundLeaseLostError)) {
      await markInboundJobFailed(job, error).catch((markError) =>
        console.error("[InboundMessageJob] Could not record failure:", job.id, markError.message));
    }
  } finally {
    clearInterval(heartbeat);
  }
  return true;
};

let draining = null;
let rerunRequested = false;
let followUpTimer = null;
let followUpAt = null;

const drainInboundJobs = () => {
  if (draining) return draining;
  draining = (async () => {
    await recoverExpiredInboundJobs();
    let processed = 0;
    while (processed < 50 && await processOneJob()) processed += 1;
    return processed;
  })().finally(() => { draining = null; });
  return draining;
};

const scheduleFollowUp = (nextAttemptAt) => {
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
  if (draining) {
    rerunRequested = true;
    return draining;
  }

  const run = drainInboundJobs();
  run.then(async () => {
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
  const schedules = getOperationalSchedules();
  cron.schedule(schedules.inboundRecovery, requestInboundDrain);
  requestInboundDrain();
  console.log(`[InboundMessageJob] Event-driven with recovery sweep (${schedules.mode}: ${schedules.inboundRecovery})`);
};

module.exports = { startInboundMessageJob, requestInboundDrain, drainInboundJobs, processOneJob };
