const DEFAULT_INTERVAL_MS = 15 * 60 * 1000;
const STALE_GRACE_MS = 10 * 60 * 1000;
const STALLED_RUN_MS = 10 * 60 * 1000;

const initialState = () => ({
  startedAt: null,
  runningSince: null,
  lastSuccessAt: null,
  lastFailureAt: null,
  consecutiveFailures: 0,
  lastProcessedCount: 0,
  expectedIntervalMs: DEFAULT_INTERVAL_MS,
});

let inboundWorker = initialState();

const toIso = (value) => value ? new Date(value).toISOString() : null;

const startInboundWorkerHealth = ({ expectedIntervalMs = DEFAULT_INTERVAL_MS } = {}) => {
  const now = Date.now();
  inboundWorker = {
    ...initialState(),
    startedAt: now,
    expectedIntervalMs,
  };
};

const markInboundRunStarted = () => {
  inboundWorker.runningSince = Date.now();
};

const markInboundRunSucceeded = (processedCount = 0) => {
  inboundWorker.runningSince = null;
  inboundWorker.lastSuccessAt = Date.now();
  inboundWorker.consecutiveFailures = 0;
  inboundWorker.lastProcessedCount = processedCount;
};

const markInboundRunFailed = () => {
  inboundWorker.runningSince = null;
  inboundWorker.lastFailureAt = Date.now();
  inboundWorker.consecutiveFailures += 1;
};

const getInboundWorkerHealth = ({ now = Date.now() } = {}) => {
  let status = "ok";
  let healthy = true;

  if (!inboundWorker.startedAt) {
    status = "not_started";
    healthy = false;
  } else if (inboundWorker.runningSince && now - inboundWorker.runningSince > STALLED_RUN_MS) {
    status = "stalled";
    healthy = false;
  } else if (inboundWorker.consecutiveFailures > 0) {
    status = "error";
    healthy = false;
  } else if (!inboundWorker.lastSuccessAt) {
    status = "starting";
  } else if (now - inboundWorker.lastSuccessAt > inboundWorker.expectedIntervalMs + STALE_GRACE_MS) {
    status = "stale";
    healthy = false;
  }

  return {
    status,
    healthy,
    startedAt: toIso(inboundWorker.startedAt),
    runningSince: toIso(inboundWorker.runningSince),
    lastSuccessAt: toIso(inboundWorker.lastSuccessAt),
    lastFailureAt: toIso(inboundWorker.lastFailureAt),
    consecutiveFailures: inboundWorker.consecutiveFailures,
    lastProcessedCount: inboundWorker.lastProcessedCount,
  };
};

const resetOperationalHealthForTests = () => {
  inboundWorker = initialState();
};

module.exports = {
  startInboundWorkerHealth,
  markInboundRunStarted,
  markInboundRunSucceeded,
  markInboundRunFailed,
  getInboundWorkerHealth,
  resetOperationalHealthForTests,
};
