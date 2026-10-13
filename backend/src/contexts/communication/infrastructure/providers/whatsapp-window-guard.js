// Channel restriction, not an Agenda rule. No history content is read or logged.
const WINDOW_MS = 24 * 60 * 60 * 1000;
const SAFETY_MARGIN_MS = 60 * 1000;

function createWhatsAppWindowGuard({ messageRepository, now = () => new Date() }) {
  return async (input, deliver) => {
    if (input.channelType !== "whatsapp" || input.origin !== "sistema" || input.purpose !== "reminder") return deliver();
    if (!input.tenantId || !input.userId) {
      return { message: null, skipped: true, reason: "whatsapp_window_unverified" };
    }
    const last = await messageRepository.findLatestIncomingAt(input.userId, input.tenantId);
    const timestamp = last ? new Date(last).getTime() : NaN;
    const age = new Date(now()).getTime() - timestamp;
    if (!Number.isFinite(age) || age < 0 || age >= WINDOW_MS - SAFETY_MARGIN_MS) {
      return { message: null, skipped: true, reason: "whatsapp_window_closed" };
    }
    return deliver();
  };
}

module.exports = { createWhatsAppWindowGuard };
