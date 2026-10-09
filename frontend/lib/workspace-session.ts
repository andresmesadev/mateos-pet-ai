/** Temporary state for one browser tab. Never stores credentials or server data. */
export const WORKSPACE_PREFIX = "mateos:workspace:v1:";
export const FILTER_TTL = 12 * 60 * 60 * 1000;
export const DRAFT_TTL = 2 * 60 * 60 * 1000;
export type TabStorage = Pick<Storage, "getItem" | "setItem" | "removeItem" | "key" | "length">;
export function workspaceStorage(): TabStorage | null { try { return typeof window === "undefined" ? null : window.sessionStorage; } catch { return null; } }

export function clearWorkspaceSession(storage: TabStorage | null) {
  if (!storage) return;
  try {
    const keys: string[] = [];
    for (let i = 0; i < storage.length; i++) { const key = storage.key(i); if (key?.startsWith(WORKSPACE_PREFIX)) keys.push(key); }
    keys.forEach(key => storage.removeItem(key));
  } catch { /* Storage may be disabled; navigation and sign-out remain available. */ }
}
export function ensureWorkspaceOwner(storage: TabStorage | null, owner: string | null) {
  if (!storage) return;
  try {
    const key = WORKSPACE_PREFIX + "owner";
    if (!owner || storage.getItem(key) !== owner) {
      clearWorkspaceSession(storage);
      if (owner) storage.setItem(key, owner);
    }
  } catch { /* The UI continues without persisted continuity. */ }
}
export function workspaceKey(owner: string, tenant: string, module: string) {
  return WORKSPACE_PREFIX + [owner, tenant, module].map(encodeURIComponent).join(":");
}
export function readWorkspaceValue(storage: TabStorage | null, key: string, ttl: number, now = Date.now()): unknown {
  if (!storage) return null;
  try {
    const raw = storage.getItem(key);
    if (!raw) return null;
    const value = JSON.parse(raw);
    if (value?.version !== 1 || !Number.isFinite(value.savedAt) || value.savedAt > now || now - value.savedAt >= ttl) { storage.removeItem(key); return null; }
    return value.data;
  } catch { try { storage.removeItem(key); } catch {} return null; }
}
export function writeWorkspaceValue(storage: TabStorage | null, key: string, data: unknown, now = Date.now()) {
  if (!storage) return false;
  try { storage.setItem(key, JSON.stringify({ version: 1, savedAt: now, data })); return true; }
  catch { return false; }
}
export type DraftEntry = { text: string; savedAt: number };
export function validDrafts(raw: unknown, now = Date.now()): Record<string, DraftEntry> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const entries = Object.entries(raw).filter(([key, value]) => {
    const item = value as Partial<DraftEntry> | null;
    return /^[^:\s]{1,120}:[^:\s]{1,120}$/.test(key) && item && typeof item.text === "string" && item.text.trim() && item.text.length <= 4096 && Number.isFinite(item.savedAt) && item.savedAt! <= now && now - item.savedAt! < DRAFT_TTL;
  }).sort((a, b) => (b[1] as DraftEntry).savedAt - (a[1] as DraftEntry).savedAt).slice(0, 30);
  return Object.fromEntries(entries);
}
