type SignupConfig = { appId: string; configId: string; version: string };
type MetaClient = { init: (config: { appId: string; version: string; xfbml: boolean; cookie: boolean }) => void;
  login: (callback: (response: { authResponse?: { code?: string } }) => void, options: object) => void };
declare global { interface Window { FB?: MetaClient } }

// Asset IDs from the browser are hints. The server verifies the actual grant.
export function signupAssets(origin: string, value: unknown): { wabaId: string; phoneNumberId: string } | null {
  if (!['https://www.facebook.com','https://web.facebook.com'].includes(origin)) return null;
  let data: unknown = value;
  try { if (typeof value === 'string') data = JSON.parse(value); } catch { return null; }
  const message = data as { type?: string; event?: string; data?: { waba_id?: string; phone_number_id?: string } } | null;
  if (message?.type !== 'WA_EMBEDDED_SIGNUP' || message.event !== 'FINISH') return null;
  const wabaId = message.data?.waba_id, phoneNumberId = message.data?.phone_number_id;
  return typeof wabaId === 'string' && /^\d{1,64}$/.test(wabaId) && typeof phoneNumberId === 'string' && /^\d{1,64}$/.test(phoneNumberId) ? { wabaId, phoneNumberId } : null;
}

export async function loadMetaSignup(config: SignupConfig): Promise<MetaClient> {
  if (!window.FB) await new Promise<void>((resolve,reject) => {
    const existing = document.getElementById('huella-meta-sdk');
    if (existing) { reject(new Error('Recarga la página para reintentar la conexión.')); return; }
    const script = document.createElement('script'); script.id = 'huella-meta-sdk'; script.async = true;
    script.src = 'https://connect.facebook.net/es_LA/sdk.js'; script.referrerPolicy = 'strict-origin';
    const timeout = window.setTimeout(() => { script.remove(); reject(new Error('Meta no respondió. Recarga antes de reintentar.')); },15000);
    script.onload = () => { window.clearTimeout(timeout); resolve(); };
    script.onerror = () => { window.clearTimeout(timeout); script.remove(); reject(new Error('No se pudo abrir Meta.')); };
    document.head.appendChild(script);
  });
  if (!window.FB) throw new Error('Meta no está disponible.');
  window.FB.init({ appId: config.appId, version: config.version, xfbml: false, cookie: false });
  return window.FB;
}

export function runMetaSignup(client: MetaClient, config: SignupConfig, signal: AbortSignal): Promise<{ code: string; wabaId: string; phoneNumberId: string }> {
  return new Promise((resolve,reject) => {
    let assets: ReturnType<typeof signupAssets> = null, code: string | null = null;
    const finish = (error?: Error) => {
      if (!error && (!assets || !code)) return;
      window.clearTimeout(timeout); window.removeEventListener('message',message); signal.removeEventListener('abort',abort);
      if (error) reject(error); else resolve({ ...assets!, code: code! });
    };
    const message = (event: MessageEvent) => { if (!event.source || event.source === window) return; const value = signupAssets(event.origin,event.data); if (value) { assets = value; finish(); } };
    const abort = () => finish(new Error('Conexión interrumpida. Consulta el estado antes de repetir.'));
    const timeout = window.setTimeout(() => finish(new Error('No se completó el alta estándar de Meta. No se modificó la conexión local.')),120000);
    window.addEventListener('message',message); signal.addEventListener('abort',abort,{ once: true });
    if (signal.aborted) { abort(); return; }
    try {
      client.login(response => { const result = response.authResponse?.code; if (!result) { finish(new Error('Conexión cancelada en Meta.')); return; } code = result; finish(); },
        { config_id: config.configId, response_type: 'code', override_default_response_type: true, extras: { setup: {}, sessionInfoVersion: '3' } });
    } catch { finish(new Error('No se pudo abrir la ventana de Meta.')); }
  });
}
