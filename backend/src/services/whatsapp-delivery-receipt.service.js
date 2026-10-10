// Signed provider receipts, stored durably without running the conversation engine.
// InboundJob is the technical webhook journal; receipt rows are already complete.
const prisma = require("../lib/prisma");
const STATUSES = new Set(["sent", "delivered", "read", "failed"]);
const recordDeliveryReceipts = async body => {
  let recorded = 0;
  for (const entry of body?.entry || []) for (const change of entry?.changes || []) {
    const value = change?.value;
    for (const receipt of value?.statuses || []) {
      if (typeof receipt.id !== "string" || !STATUSES.has(receipt.status) || !/^\d+$/.test(String(receipt.timestamp))) continue;
      const provider = "whatsapp_delivery";
      const providerEventId = `${receipt.id}:${receipt.status}:${receipt.timestamp}`;
      const payload = { messageId: receipt.id, status: receipt.status, timestamp: String(receipt.timestamp),
        phoneNumberId: value.metadata?.phone_number_id || null,
        errorCodes: (receipt.errors || []).map(e => e.code).filter(code => Number.isInteger(code)) };
      await prisma.inboundJob.upsert({ where: { provider_providerEventId: { provider, providerEventId } }, update: {},
        create: { provider, providerEventId, payload, status: "done", phase: "complete", finishedAt: new Date() } });
      recorded += 1;
    }
  }
  return recorded;
};
module.exports = { recordDeliveryReceipts };
