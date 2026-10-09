"use client";

import { useEffect, useRef, useState } from "react";
import { useWorkspaceIdentity } from "./use-list-continuity";
import { DRAFT_TTL, ensureWorkspaceOwner, readWorkspaceValue, validDrafts, workspaceKey, workspaceStorage, writeWorkspaceValue, type DraftEntry } from "./workspace-session";

export function useWhatsAppDrafts() {
  const { owner, tenant } = useWorkspaceIdentity();
  const key = owner ? workspaceKey(owner, tenant, "whatsapp-drafts") : null;
  const current = useRef<{ key: string | null; entries: Record<string, DraftEntry> }>({ key: null, entries: {} });
  const [state, setState] = useState<{ key: string | null; entries: Record<string, DraftEntry>; recovered: Record<string, boolean> }>({ key: null, entries: {}, recovered: {} });
  const [storageFailed, setStorageFailed] = useState(false);
  useEffect(() => {
    if (!key || !owner) return;
    ensureWorkspaceOwner(workspaceStorage(), owner);
    const entries = validDrafts(readWorkspaceValue(workspaceStorage(), key, DRAFT_TTL));
    current.current = { key, entries };
    // Recovery waits for the authenticated owner; the pane also verifies chat access.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setState({ key, entries, recovered: Object.fromEntries(Object.keys(entries).map(id => [id, true])) });
    const sync = (event: Event) => {
      if ((event as CustomEvent<string>).detail !== key) return;
      const entries = validDrafts(readWorkspaceValue(workspaceStorage(), key, DRAFT_TTL));
      current.current = { key, entries };
      setState(previous => ({ ...previous, entries }));
    };
    window.addEventListener("mateos:drafts-changed", sync);
    const timer = setInterval(() => {
      const entries = validDrafts(current.current.entries);
      if (Object.keys(entries).length === Object.keys(current.current.entries).length) return;
      current.current = { key, entries }; writeWorkspaceValue(workspaceStorage(), key, entries);
      setState(previous => ({ ...previous, entries }));
    }, 30_000);
    return () => { clearInterval(timer); window.removeEventListener("mateos:drafts-changed", sync); };
  }, [key, owner]);
  const entries = state.key === key ? validDrafts(state.entries) : {};
  function onDraft(id: string, text: string, expected?: string) {
    if (!key || current.current.key !== key || !/^[^:\s]{1,120}:[^:\s]{1,120}$/.test(id)) return;
    const storage = workspaceStorage();
    try { if (expected !== undefined && storage && storage.getItem("mateos:workspace:v1:owner") !== owner) return; } catch { /* Continue with the in-memory draft when storage is unavailable. */ }
    const entries = validDrafts(expected !== undefined && storage ? readWorkspaceValue(storage, key, DRAFT_TTL) : current.current.entries);
    if (expected !== undefined && entries[id]?.text.trim() !== expected) return;
    if (text.trim()) entries[id] = { text: text.slice(0, 4096), savedAt: Date.now() }; else delete entries[id];
    const bounded = validDrafts(entries);
    current.current = { key, entries: bounded };
    setStorageFailed(!writeWorkspaceValue(storage, key, bounded));
    window.dispatchEvent(new CustomEvent("mateos:drafts-changed", { detail: key }));
    setState(previous => ({ key, entries: bounded, recovered: { ...previous.recovered, [id]: false } }));
  }
  return { drafts: Object.fromEntries(Object.entries(entries).map(([id, entry]) => [id, entry.text])), recovered: state.key === key ? state.recovered : {}, onDraft, storageFailed };
}
