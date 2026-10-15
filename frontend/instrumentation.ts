export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs" && process.env.OPERATOR_WHATSAPP_ENABLED === "true") {
    try { await (await import("./lib/operator-channel/authority")).ensureOperatorAuthority(); }
    catch { console.error("[OperatorAuthority] Private channel unavailable; registration required before use."); }
  }
}
