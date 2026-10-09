// Cover both headers and the response body; abandoning a wait does not undo a write.
export async function dashboardRequest(url: string, init: RequestInit = {}, timeout = 20_000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    const signal = init.signal ? AbortSignal.any([init.signal, controller.signal]) : controller.signal;
    const response = await fetch(url, { ...init, signal });
    const payload: unknown = await response.json().catch(() => null);
    if (signal.aborted) throw new Error("Se agotó el tiempo de espera. Comprueba el resultado antes de repetir el guardado.");
    return { response, payload };
  } finally { clearTimeout(timer); }
}
