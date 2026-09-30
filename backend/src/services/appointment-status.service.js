const VALID_STATUSES = [
  "pending",
  "confirmed",
  "arrived",
  "in_progress",
  "completed",
  "no_show",
  "cancelled",
];
const ARRIVAL_GRACE_MS = 30 * 60 * 1000;

const TRANSITIONS = {
  pending: ["confirmed", "cancelled"],
  confirmed: ["arrived", "cancelled"],
  arrived: ["in_progress", "no_show"],
  in_progress: ["completed"],
  completed: [],
  no_show: [],
  cancelled: [],
};

function isValidStatus(status) {
  return VALID_STATUSES.includes(status);
}

function isAllowedTransition(from, to) {
  return (TRANSITIONS[from] ?? []).includes(to);
}

function autoTimestamps(from, to) {
  const data = {};
  if (to === "in_progress" && from !== "in_progress") data.startedAt = new Date();
  if (to === "completed") data.endedAt = new Date();
  return data;
}

function isArrivalWindowExpired(date, now = new Date()) {
  return new Date(date).getTime() + ARRIVAL_GRACE_MS <= now.getTime();
}

module.exports = { VALID_STATUSES, TRANSITIONS, ARRIVAL_GRACE_MS, isValidStatus, isAllowedTransition, isArrivalWindowExpired, autoTimestamps };
