import "server-only";
import { randomUUID } from "node:crypto";
import * as p from "./protocol.cjs";
import { canonicalAdminEmail } from "./admin-auth";

type Registered = { authorityId: string; epoch: string; credentialEpoch: string };
type Boot = { id: string; registration?: p.Envelope; pending?: Promise<Registered>; registered?: Registered };
const globalAuthority = globalThis as typeof globalThis & { __mateosOperatorBoot?: Boot };
const boot = globalAuthority.__mateosOperatorBoot ||= { id: randomUUID() };
function current() {
  const settings = p.config();
  if (!settings.enabled) throw new Error("OPERATOR_CHANNEL_DISABLED");
  const email = canonicalAdminEmail(process.env.ADMIN_EMAIL || "unavailable@invalid");
  const state = process.env.ADMIN_EMAIL && process.env.ADMIN_PASSWORD && process.env.OPERATOR_ADMIN_AUTHORITY_ENABLED !== "false" ? "active" : "disabled";
  return { ...settings, email, principalKey: p.principal(email), state,
    credentialGeneration: p.mac(settings.key, "admin-credential", { email, password: process.env.ADMIN_PASSWORD || "", state }) };
}
async function backend(method: "state" | "register", envelope: p.Envelope) {
  const base = process.env.API_URL || process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";
  const secret = process.env.INTERNAL_API_SECRET;
  if (!secret) throw Error("OPERATOR_AUTHORITY_UNAVAILABLE");
  const response = await fetch(`${base.replace(/\/$/, "")}/api/internal/operator-authority/${method}`, { method: "POST", headers: { "Content-Type": "application/json", "X-Internal-Token": secret },
    body: JSON.stringify(envelope), cache: "no-store", redirect: "error", signal: AbortSignal.timeout(2000) });
  if (!response.ok) throw Error("OPERATOR_AUTHORITY_UNAVAILABLE");
  return response.json();
}
export async function ensureOperatorAuthority(): Promise<Registered> {
  const c = current();
  if (boot.registered) return boot.registered;
  if (boot.pending) return boot.pending;
  boot.pending = (async () => {
    if (!boot.registration) {
      const query = p.sign(c.key, c.keyVersion, "issuer_state", { method: "POST", path: "/api/internal/operator-authority/state" });
      const state = p.verify(c.key, c.keyVersion, await backend("state", query), "issuer_state_reply");
      if (state.body.requestHash !== p.digest(query)) throw Error("INVALID_AUTHORITY_REPLY");
      boot.registration = p.sign(c.key, c.keyVersion, "register_issuer", { bootId: boot.id, expectedEpoch: state.body.epoch, principalKey: c.principalKey, credentialGeneration: c.credentialGeneration, state: c.state });
    } else {
      // Renew freshness, never the registration's identity or expected epoch.
      // A lost response recovers the same receipt; an old boot cannot take over.
      boot.registration = p.sign(c.key, c.keyVersion, "register_issuer", boot.registration.body, 30000, new Date(), boot.registration.operationId);
    }
    const reply = p.verify(c.key, c.keyVersion, await backend("register", boot.registration), "register_issuer_reply");
    if (reply.body.requestHash !== p.digest(boot.registration)) throw Error("INVALID_AUTHORITY_REPLY");
    const { authorityId, epoch, credentialEpoch } = reply.body;
    if (typeof authorityId !== "string" || typeof epoch !== "string" || typeof credentialEpoch !== "string") throw Error("INVALID_AUTHORITY_REPLY");
    return boot.registered = { authorityId, epoch, credentialEpoch };
  })().finally(() => { boot.pending = undefined; });
  return boot.pending;
}
export async function liveOperatorReply(envelope: unknown, path: string) {
  const c = current();
  const claim = p.verify(c.key, c.keyVersion, envelope, "live_request");
  const b = claim.body;
  if (b.method !== "POST" || b.path !== path || b.principalKey !== c.principalKey || c.state !== "active" ||
      typeof b.tenantId !== "string" || !["access","read","prepare","revise","confirm","recover","deliver"].includes(String(b.purpose)) ||
      (b.sessionId !== null && typeof b.sessionId !== "string")) throw Error("INVALID_AUTHORITY_REQUEST");
  const registered = await ensureOperatorAuthority();
  return p.sign(c.key, c.keyVersion, String(b.purpose), { ...registered, bootId: boot.id, credentialGeneration: c.credentialGeneration, state: c.state,
    tenantId: b.tenantId, principalKey: c.principalKey, sessionId: b.sessionId, requestHash: p.digest(envelope) });
}
export async function recentOperatorProof({ tenantId, principalKey, purpose, binding, sessionVersion }: { tenantId: string; principalKey: string; purpose: string; binding: Record<string, string>; sessionVersion?: number }) {
  const c = current();
  const admin = principalKey.startsWith("admin:");
  if (admin && (principalKey !== c.principalKey || c.state !== "active")) throw Error("INVALID_ADMIN_AUTHORITY");
  const registered = admin ? await ensureOperatorAuthority() : {};
  return p.sign(c.key, c.keyVersion, purpose, { ...registered, tenantId, principalKey, bindingHash: p.digest(binding),
    ...(admin ? { credentialGeneration: c.credentialGeneration } : { sessionVersion }) }, 60000);
}
