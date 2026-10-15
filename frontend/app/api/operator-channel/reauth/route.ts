import { auth } from "@/auth";
import { verifyAdminCredential } from "@/lib/operator-channel/admin-auth";
import { recentOperatorProof } from "@/lib/operator-channel/authority";
import { principal } from "@/lib/operator-channel/protocol.cjs";
import type { NextRequest } from "next/server";
export const runtime = "nodejs";
const failures = new Map<string, { count: number; expires: number }>();
export async function POST(req: NextRequest) {
  const response = (body: unknown, status = 200) => Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
  const session = await auth();
  if (!session?.user?.email) return response({ error: "Inicia sesión de nuevo." }, 401);
  let expectedOrigin;
  try { expectedOrigin = new URL(process.env.AUTH_URL || process.env.NEXTAUTH_URL || req.nextUrl.origin).origin; } catch { return response({ error: "Origen no disponible." }, 503); }
  if (req.headers.get("origin") !== expectedOrigin || req.headers.get("sec-fetch-site") === "cross-site") return response({ error: "Origen no permitido." }, 403);
  const key = session.user.staffId || principal(session.user.email);
  for (const [k,v] of failures) if (v.expires <= Date.now()) failures.delete(k);
  const attempts = failures.get(key) || { count: 0, expires: Date.now() + 600000 };
  if (attempts.count >= 5) return response({ error: "Espera unos minutos antes de volver a verificar." }, 429);
  try {
    const raw = await req.text(); if (raw.length > 8192) throw Error();
    const body = JSON.parse(raw);
    if (!body || Object.keys(body).some(k => !["purpose","binding","password","tenantId"].includes(k)) || typeof body.password !== "string" || body.password.length > 1024 || !["link_start","link_activate","link_renew"].includes(body.purpose)) throw Error();
    const field = body.purpose === "link_start" ? "phone" : body.purpose === "link_activate" ? "challengeId" : "linkId";
    if (!body.binding || Object.keys(body.binding).join(",") !== field || typeof body.binding[field] !== "string" || body.binding[field].length > 100) throw Error();
    const tenantId = session.user.isSuperAdmin ? body.tenantId || session.user.tenantId : session.user.tenantId;
    if (typeof tenantId !== "string" || !tenantId || tenantId.length > 100) return response({ error: "Selecciona un establecimiento." }, 400);
    attempts.count++; failures.set(key, attempts);
    let version: number | undefined;
    if (session.user.staffId) {
      const base = (process.env.API_URL || process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000").replace(/\/$/, "");
      const verified = await fetch(`${base}/api/internal/staff-login`, { method: "POST", headers: { "Content-Type": "application/json", "X-Internal-Token": process.env.INTERNAL_API_SECRET || "" },
        body: JSON.stringify({ email: session.user.email, password: body.password }), cache: "no-store", redirect: "error", signal: AbortSignal.timeout(2000) });
      if (!verified.ok) return response({ error: "No se pudo verificar tu identidad." }, 403);
      const staff = await verified.json();
      if (staff.staffId !== session.user.staffId || staff.tenantId !== tenantId || staff.sessionVersion !== session.user.sessionVersion) return response({ error: "Inicia sesión de nuevo." }, 403);
      version = staff.sessionVersion;
    } else if (!session.user.isSuperAdmin || !verifyAdminCredential(session.user.email, body.password)) return response({ error: "No se pudo verificar tu identidad." }, 403);
    const proof = await recentOperatorProof({ tenantId, principalKey: session.user.staffId ? `staff:${session.user.staffId}` : principal(session.user.email), purpose: body.purpose, binding: body.binding, sessionVersion: version });
    failures.delete(key); return response({ proof });
  } catch { return response({ error: "No se pudo verificar tu identidad. Revisa la sesión y vuelve a intentarlo." }, 503); }
}
