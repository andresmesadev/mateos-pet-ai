"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { usePathname, useSearchParams } from "next/navigation";
import { ensureWorkspaceOwner, FILTER_TTL, readWorkspaceValue, workspaceKey, workspaceStorage, writeWorkspaceValue } from "./workspace-session";
import type { ListFilters } from "./list-continuity";

export function useWorkspaceIdentity() {
  const { data: session, status } = useSession();
  const tenant = useSearchParams().get("tenant") ?? session?.user?.tenantId ?? "current";
  const user = session?.user;
  const owner = status === "authenticated" && user?.email ? `${user.email.toLowerCase()}:${user.staffId ?? "admin"}:${user.sessionVersion ?? "current"}` : null;
  return { owner, tenant };
}

/** URL is authoritative on explicit entry; otherwise restore this user's last filters. */
export function useListContinuity(module: string, defaults: ListFilters, normalize: (raw: ListFilters) => ListFilters, entryFallback?: ListFilters) {
  const pathname = usePathname(), params = useSearchParams(), { owner, tenant } = useWorkspaceIdentity();
  const key = owner ? workspaceKey(owner, tenant, "filters:" + module) : null;
  const defaultJSON = JSON.stringify(defaults);
  const entryJSON = JSON.stringify(entryFallback ?? null);
  const fields = Object.keys(defaults), querySignature = JSON.stringify(fields.map(field => [field, params.getAll(field)]));
  const normalizedDefaults = normalize(defaults);
  const policySignature = JSON.stringify(normalizedDefaults);
  const normalizer = useRef(normalize);
  const defaultsRef = useRef(defaults);
  const entryRef = useRef(entryFallback);
  useLayoutEffect(() => { normalizer.current = normalize; defaultsRef.current = defaults; entryRef.current = entryFallback; }, [normalize, defaults, entryFallback]);
  const current = useRef<{ key: string | null; values: ListFilters }>({ key: null, values: defaults });
  const [state, setState] = useState<{ key: string | null; values: ListFilters; ready: boolean }>({ key: null, values: defaults, ready: false });
  const values = state.key === key && state.ready ? normalize(state.values) : normalizedDefaults;
  const valuesSignature = JSON.stringify(values);

  function publish(next: ListFilters, mode: "push" | "replace") {
    const url = new URL(window.location.href);
    if (url.pathname !== pathname) return;
    for (const [field, value] of Object.entries(next)) url.searchParams.set(field, value);
    if (url.href !== window.location.href) window.history[mode === "push" ? "pushState" : "replaceState"](null, "", url.pathname + url.search + url.hash);
  }

  useEffect(() => {
    if (!key || !owner) return;
    if (window.location.pathname !== pathname) return;
    ensureWorkspaceOwner(workspaceStorage(), owner);
    const url = new URL(window.location.href);
    const fields = Object.keys(defaultsRef.current);
    const ownEntry = fields.some(field => url.searchParams.has(field));
    const raw: ListFilters = ownEntry ? {} : entryRef.current ?? {};
    const explicit = ownEntry || entryRef.current !== undefined;
    if (ownEntry) fields.forEach(field => { if (url.searchParams.getAll(field).length === 1) raw[field] = url.searchParams.get(field)!; });
    const stored = explicit ? null : readWorkspaceValue(workspaceStorage(), key, FILTER_TTL);
    const source = stored && typeof stored === "object" && !Array.isArray(stored) ? stored as ListFilters : explicit ? raw : defaultsRef.current;
    const next = normalizer.current(source);
    current.current = { key, values: next };
    writeWorkspaceValue(workspaceStorage(), key, next);
    // Synchronize URL restoration without adding an extra history entry.
    for (const [field, value] of Object.entries(next)) url.searchParams.set(field, value);
    if (url.href !== window.location.href) window.history.replaceState(null, "", url.pathname + url.search + url.hash);
    // Browser preferences are loaded after hydration; no server data is cached.
    setState({ key, values: next, ready: true });
  }, [key, owner, querySignature, defaultJSON, policySignature, entryJSON, pathname]);

  // Normalize stored values again when live permission/team options change.
  useEffect(() => {
    if (!key || !state.ready || state.key !== key) return;
    if (window.location.pathname !== pathname) return;
    const next = normalizer.current(state.values);
    if (JSON.stringify(next) === JSON.stringify(state.values)) return;
    current.current = { key, values: next }; writeWorkspaceValue(workspaceStorage(), key, next);
    const url = new URL(window.location.href);
    Object.entries(next).forEach(([field, value]) => url.searchParams.set(field, value));
    window.history.replaceState(null, "", url.pathname + url.search + url.hash);
    setState({ key, values: next, ready: true });
  }, [key, state, valuesSignature, pathname]);

  function update(patch: Partial<ListFilters>, mode: "push" | "replace" = "push") {
    if (!key || current.current.key !== key) return;
    const next = normalizer.current({ ...current.current.values, ...patch } as ListFilters);
    current.current = { key, values: next }; writeWorkspaceValue(workspaceStorage(), key, next);
    setState({ key, values: next, ready: true }); publish(next, mode);
  }
  return { filters: values, ready: state.ready && state.key === key, update, clear: () => update(normalizer.current(defaultsRef.current)) };
}
