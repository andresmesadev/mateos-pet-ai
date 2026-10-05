"use client";

import { useEffect, useState } from "react";
import { proxyUrl } from "@/lib/api";
import { isHistoryPage, type HistoryPage } from "@/lib/financial-history-page";

export function useFinancialHistory<T>(endpoint: string, params: URLSearchParams, revision: number, isRow: (row: unknown) => row is T) {
  const url = proxyUrl(`/api/dashboard/${endpoint}?${params}`);
  const key = `${url}:${revision}`;
  const [result, setResult] = useState<{ key: string; data?: HistoryPage<T>; error?: boolean }>({ key: "" });
  useEffect(() => {
    const controller = new AbortController();
    let current = true;
    // Invalidate immediately via the key above; debounce rapid search keystrokes.
    const timer = setTimeout(async () => {
      try {
        const response = await fetch(url, { cache: "no-store", signal: AbortSignal.any([controller.signal, AbortSignal.timeout(20_000)]) });
        const data: unknown = await response.json();
        if (!response.ok || !isHistoryPage(data, isRow)) throw new Error();
        if (current) setResult({ key, data });
      } catch { if (current) setResult({ key, error: true }); }
    }, 250);
    return () => { current = false; clearTimeout(timer); controller.abort(); };
  }, [url, key, isRow]);
  const loading = result.key !== key;
  return { loading, error: !loading && !!result.error, data: !loading ? result.data : undefined };
}
