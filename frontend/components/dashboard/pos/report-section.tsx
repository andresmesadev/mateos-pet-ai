"use client";

import { useEffect, useState, type ReactNode } from "react";
import { RotateCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { proxyUrl } from "@/lib/api";
import { useTenant } from "@/lib/use-tenant";

export function useReportData<T>(path: string, parse: (value: unknown) => T) {
  const tenant = useTenant();
  const [revision, setRevision] = useState(0);
  const params = new URLSearchParams(path.split("?")[1]);
  if (tenant) params.set("tenantId", tenant);
  const url = proxyUrl(`/api/dashboard/${path.split("?")[0]}?${params}`);
  const key = `${url}:${revision}`;
  const [state, setState] = useState<{ key: string; data?: T; error?: boolean }>({ key: "" });
  useEffect(() => {
    const controller = new AbortController();
    void (async () => {
      try {
        const response = await fetch(url, { cache: "no-store", signal: AbortSignal.any([controller.signal, AbortSignal.timeout(20_000)]) });
        if (!response.ok) throw new Error();
        const data = parse(await response.json());
        if (!controller.signal.aborted) setState({ key, data });
      } catch {
        if (!controller.signal.aborted) setState({ key, error: true });
      }
    })();
    return () => controller.abort();
  }, [url, key, parse]);
  // A new request never renders the previous period's figures, even before its effect runs.
  return { data: state.key === key ? state.data : undefined, error: state.key === key && !!state.error, loading: state.key !== key || (!state.data && !state.error), retry: () => setRevision(value => value + 1) };
}

export function ReportSection<T>({ title, description, result, children }: {
  title: string; description: string; result: ReturnType<typeof useReportData<T>>; children: (data: T) => ReactNode;
}) {
  return <section aria-label={title} className="min-w-0 overflow-hidden rounded-2xl border bg-white shadow-sm">
    <header className="border-b p-5 sm:p-6"><h3 className="text-lg font-semibold">{title}</h3><p className="mt-1 text-sm text-muted-foreground">{description}</p></header>
    <div className="p-5 sm:p-6">
      {result.loading ? <div role="status" aria-label={`Cargando ${title}`} className="space-y-3"><Skeleton className="h-8 w-2/3" /><Skeleton className="h-24 w-full" /><span className="sr-only">Cargando {title}…</span></div>
        : result.error ? <div role="alert" className="space-y-3 rounded-xl border border-amber-200 bg-amber-50 p-4"><p className="font-medium">No se pudo cargar {title.toLocaleLowerCase("es")}.</p><p className="text-sm">Intenta de nuevo para consultar las cifras.</p><Button variant="outline" onClick={result.retry}><RotateCw />Reintentar</Button></div>
          : result.data !== undefined ? children(result.data) : null}
    </div>
  </section>;
}
