"use client";

import { useEffect, useRef, useTransition } from "react";
import { CircleAlert, Home, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { homeHref } from "@/lib/home-workspace";

export function WorkspaceError({ onRetry, standalone = false }: { onRetry: () => void; standalone?: boolean }) {
  const heading = useRef<HTMLHeadingElement>(null);
  const [pending, startTransition] = useTransition();
  useEffect(() => { heading.current?.focus(); }, []);

  return <section aria-labelledby="workspace-error-title" className={`mx-auto w-full max-w-2xl rounded-2xl border bg-card p-6 shadow-sm sm:p-10 ${standalone ? "my-8" : ""}`}>
    <div className="mb-5 flex size-12 items-center justify-center rounded-2xl bg-amber-100 text-amber-800"><CircleAlert aria-hidden="true" className="size-6" /></div>
    <h1 ref={heading} tabIndex={-1} id="workspace-error-title" className="text-2xl font-bold tracking-tight outline-none">No pudimos mostrar esta pantalla</h1>
    <p className="mt-3 text-muted-foreground">Ocurrió un error inesperado. Puedes volver a intentarlo o regresar a Inicio. Los datos ya guardados se conservan.</p>
    <div className="mt-6 flex flex-wrap gap-3">
      <Button disabled={pending} aria-busy={pending} onClick={() => startTransition(onRetry)}><RefreshCw aria-hidden="true" className={pending ? "motion-safe:animate-spin" : ""} />{pending ? "Reintentando…" : "Reintentar"}</Button>
      <Button variant="outline" onClick={() => window.location.assign(homeHref("/dashboard", new URLSearchParams(window.location.search).get("tenant")))}><Home aria-hidden="true" />Volver a Inicio</Button>
    </div>
    {pending && <p role="status" className="mt-3 text-sm text-muted-foreground">Volviendo a cargar la pantalla…</p>}
  </section>;
}
