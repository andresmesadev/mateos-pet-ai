"use client";
import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ageLabel, homeDataIsStale, HOME_REFRESH_COOLDOWN_MS } from "@/lib/home-adaptability";

export function RefreshHome({ consultedAt, partial = false }: { consultedAt?: string; partial?: boolean } = {}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [now, setNow] = useState<number | null>(null);
  const [online, setOnline] = useState(true);
  const [deferred, setDeferred] = useState(false);
  const requested = useRef(false), lastAttempt = useRef(0);
  const manualRefresh = useRef<() => void>(() => {});
  useEffect(() => {
    const editing = () => !!document.querySelector('[role="dialog"][data-state="open"], [role="alertdialog"], [aria-modal="true"]') ||
      (document.activeElement instanceof HTMLElement && document.activeElement.matches('input:not([readonly]):not([disabled]), textarea:not([readonly]):not([disabled]), select:not([disabled]), [contenteditable="true"]'));
    function refresh(force = false, manual = false) {
      if (pending || (!force && !homeDataIsStale(consultedAt, Date.now()))) return;
      if (!navigator.onLine || document.visibilityState === "hidden" || editing()) {
        requested.current = true; setDeferred(true); return;
      }
      if (!manual && Date.now() - lastAttempt.current < HOME_REFRESH_COOLDOWN_MS) return;
      lastAttempt.current = Date.now(); requested.current = false; setDeferred(false);
      startTransition(() => router.refresh());
    }
    manualRefresh.current = () => refresh(true, true);
    function syncConnection() { setOnline(navigator.onLine); }
    function returned() { if (consultedAt) refresh(requested.current); }
    function connected() {
      syncConnection();
      if (consultedAt) {
        requested.current = true;
        refresh(true);
      }
    }
    function tick() { setNow(Date.now()); if (requested.current) refresh(true); }
    let editTimer: ReturnType<typeof setTimeout>;
    function finishedEditing() {
      clearTimeout(editTimer);
      editTimer = setTimeout(() => { if (requested.current) refresh(true); }, 100);
    }
    // Browser connectivity and relative time are initialized after hydration.
    syncConnection();
    const initialTick = setTimeout(tick, 0);
    const timer = setInterval(tick, 30_000);
    window.addEventListener("online", connected); window.addEventListener("offline", syncConnection);
    window.addEventListener("focus", returned); document.addEventListener("visibilitychange", returned);
    document.addEventListener("focusout", finishedEditing);
    let mutationTimer: ReturnType<typeof setTimeout>;
    const observer = new MutationObserver(() => { clearTimeout(mutationTimer); mutationTimer = setTimeout(() => { if (requested.current) refresh(true); }, 100); });
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["data-state", "aria-modal"] });
    return () => {
      clearTimeout(initialTick); clearInterval(timer); clearTimeout(mutationTimer); clearTimeout(editTimer); observer.disconnect();
      window.removeEventListener("online", connected); window.removeEventListener("offline", syncConnection);
      window.removeEventListener("focus", returned); document.removeEventListener("visibilitychange", returned); document.removeEventListener("focusout", finishedEditing);
    };
  }, [consultedAt, router, pending, startTransition]);
  return <div className="flex flex-wrap items-center gap-3">
    {consultedAt && <div className="text-xs text-muted-foreground">
      <time dateTime={consultedAt}>Consultado a las {new Intl.DateTimeFormat("es-CO", { timeZone: "America/Bogota", hour: "numeric", minute: "2-digit" }).format(new Date(consultedAt))} · hora de Colombia</time>
      {now !== null && <p className="mt-1">{partial ? "Consulta realizada" : "Actualizado"} {ageLabel(consultedAt, now)}</p>}
      {partial && <p role="status" className="mt-1 font-medium text-amber-900">Actualización parcial · algunas lecturas no están disponibles.</p>}
    </div>}
    {!online && <p role="status" className="text-xs font-medium text-amber-900">Sin conexión. La consulta se reintentará al regresar.</p>}
    {deferred && online && <p role="status" className="text-xs text-muted-foreground">Actualización pendiente; se realizará al cerrar la ficha o terminar la edición.</p>}
    <Button variant="outline" disabled={pending || !online} onClick={() => manualRefresh.current()}><RefreshCw className={`size-4 ${pending ? "motion-safe:animate-spin" : ""}`} aria-hidden="true" />{pending ? "Actualizando…" : "Actualizar Inicio"}</Button>
  </div>;
}
