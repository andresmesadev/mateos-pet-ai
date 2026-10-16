import { apiUrl } from "@/lib/api";
import { canonicalAdminEmail } from "@/lib/operator-channel/admin-auth";

type Context = { params: Promise<{ path: string[] }> };
const reply = (body: object, status: number) => Response.json(body, { status, headers: { "Cache-Control": "no-store" } });

// Public adapter: never forwards cookies or internal authority.
async function forward(request: Request, { params }: Context) {
  const { path } = await params;
  const verify = request.method === "GET" && path.length === 2 && path[0] === "verify" && /^[a-z0-9-]{2,63}$/.test(path[1]);
  const register = request.method === "POST" && path.length === 1 && path[0] === "register";
  if (!verify && !register) return reply({ error: "Ruta no disponible." }, 404);
  try {
    let body: string | undefined;
    if (register) {
      const origin = request.headers.get("origin");
      // Next's internal URL can use localhost behind a reverse proxy. Compare
      // the browser origin to the incoming Host, not that internal URL.
      if (origin) {
        let source: URL;
        try { source = new URL(origin); } catch { return reply({ error: "Solicitud no permitida." }, 403); }
        if (!["http:", "https:"].includes(source.protocol) || source.host !== request.headers.get("host")) return reply({ error: "Solicitud no permitida." }, 403);
      }
      if (!request.headers.get("content-type")?.startsWith("application/json")) return reply({ error: "Formato no admitido." }, 415);
      const raw = await request.text();
      if (raw.length > 8192) return reply({ error: "El formulario es demasiado largo." }, 413);
      let input;
      try { input = JSON.parse(raw); } catch { return reply({ error: "Revisa los datos del formulario." }, 400); }
      if (typeof input?.email === "string" && process.env.ADMIN_EMAIL && canonicalAdminEmail(input.email) === canonicalAdminEmail(process.env.ADMIN_EMAIL)) {
        return reply({ error: "No se pudo crear la cuenta con ese correo o identificador. Si ya tienes una cuenta, inicia sesión." }, 409);
      }
      body = raw;
    }
    const response = await fetch(apiUrl(`/api/onboarding/${path.join("/")}`), {
      method: request.method, body, cache: "no-store", redirect: "error",
      headers: { "Content-Type": "application/json" }, signal: AbortSignal.timeout(20000),
    });
    const data = await response.json().catch(() => ({ error: response.status === 429 ? "Demasiados intentos. Espera unos minutos y vuelve a intentarlo." : "El servicio no está disponible. Vuelve a intentarlo." }));
    return reply(data, response.status);
  } catch {
    return reply({ error: "No pudimos confirmar la operación. Si estabas creando tu cuenta, intenta iniciar sesión antes de repetir el registro." }, 503);
  }
}

export const GET = forward;
export const POST = forward;
