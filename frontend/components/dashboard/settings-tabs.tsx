"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Building2, CalendarClock, FileUp, Layers3, ListChecks, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { BusinessModules } from "@/components/dashboard/business-modules";
import { StaffManager } from "@/components/dashboard/staff-manager";
import { ContactsImporter } from "@/components/dashboard/contacts-importer";
import { GeneralInfoSection, LocationServicesSection, ScheduleSection } from "@/components/dashboard/settings-view";
import { type ServiceRow, type TenantProfile } from "@/app/dashboard/settings/page";

const TABS = [
  { id: "general", label: "Datos del negocio", icon: Building2 },
  { id: "areas", label: "Áreas del negocio", icon: Layers3 },
  { id: "localizacion", label: "Servicios y precios", icon: ListChecks },
  { id: "agenda", label: "Horarios y disponibilidad", icon: CalendarClock },
  { id: "usuarios", label: "Equipo y accesos", icon: Users },
] as const;
type Tab = (typeof TABS)[number]["id"] | "importar";
function resolveTab(value: string | null): Tab {
  return value === "importar" || TABS.some((tab) => tab.id === value) ? value as Tab : "general";
}

type Props = { profile: TenantProfile | null; services: ServiceRow[]; initialTab?: string };
type Navigation = { tab: Tab } | { href: string };

export function SettingsTabs({ profile, services, initialTab }: Props) {
  const router = useRouter();
  const [active, setActive] = useState<Tab>(resolveTab(initialTab ?? null));
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [pending, setPending] = useState<Navigation | null>(null);
  const reportDirty = useCallback((value: boolean) => setDirty(value), []);
  const reportSaving = useCallback((value: boolean) => setSaving(value), []);
  const sectionName = TABS.find((tab) => tab.id === active)?.label ?? "Administración";

  function navigate(target: Navigation) {
    setDirty(false);
    setPending(null);
    if ("href" in target) {
      const destination = new URL(target.href, window.location.href);
      if (destination.origin === window.location.origin) router.push(destination.pathname + destination.search + destination.hash);
      else window.location.assign(destination.href);
      return;
    }
    const url = new URL(window.location.href);
    url.searchParams.set("tab", target.tab);
    // A section is a selection within Administration, not a new page in the history.
    window.history.replaceState(null, "", url.pathname + url.search + url.hash);
    setActive(target.tab);
  }

  function select(tab: Tab) {
    if (saving || tab === active) return;
    if (dirty) setPending({ tab }); else navigate({ tab });
  }

  useEffect(() => {
    if (!dirty && !saving) return;
    const unload = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    const intercept = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const anchor = event.target instanceof Element ? event.target.closest("a[href]") as HTMLAnchorElement | null : null;
      if (!anchor || anchor.hasAttribute("download") || (anchor.target && anchor.target !== "_self")) return;
      const destination = new URL(anchor.href, window.location.href);
      if (!["http:", "https:", "mailto:", "tel:"].includes(destination.protocol)) return;
      if (destination.href === window.location.href || (destination.pathname === window.location.pathname && destination.search === window.location.search)) return;
      event.preventDefault();
      event.stopPropagation();
      if (!saving) setPending({ href: destination.href });
    };
    window.addEventListener("beforeunload", unload);
    document.addEventListener("click", intercept, true);
    return () => { window.removeEventListener("beforeunload", unload); document.removeEventListener("click", intercept, true); };
  }, [dirty, saving]);

  useEffect(() => {
    const previousUrl = window.location.href;
    const onPopState = () => {
      if ((dirty || saving) && (saving || !window.confirm(`Hay cambios sin guardar en ${sectionName}. ¿Salir y descartarlos?`))) {
        window.history.pushState(null, "", previousUrl);
        return;
      }
      if (window.location.pathname === "/dashboard/settings") {
        setDirty(false);
        setActive(resolveTab(new URL(window.location.href).searchParams.get("tab")));
      }
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [active, dirty, saving, sectionName]);

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-border bg-card p-1.5 shadow-sm">
        <div role="tablist" aria-label="Secciones de Administración" className="flex flex-wrap gap-1">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button key={id} id={`settings-tab-${id}`} role="tab" aria-selected={active === id} aria-controls={`settings-panel-${id}`} tabIndex={active === id || (active === "importar" && id === "general") ? 0 : -1}
              type="button" disabled={saving} onClick={() => select(id)}
              onKeyDown={(event) => {
                if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
                event.preventDefault();
                const index = TABS.findIndex((tab) => tab.id === id);
                const next = event.key === "Home" ? 0 : event.key === "End" ? TABS.length - 1 : (index + (event.key === "ArrowRight" ? 1 : -1) + TABS.length) % TABS.length;
                document.getElementById(`settings-tab-${TABS[next].id}`)?.focus();
              }}
              className={cn("inline-flex min-h-11 items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50", active === id ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent hover:text-foreground")}
            ><Icon aria-hidden="true" className="h-4 w-4 shrink-0" />{label}</button>
          ))}
        </div>
        <div className="mt-1 flex flex-wrap items-center justify-between gap-2 border-t border-border px-3 py-2">
          <p className="text-xs text-muted-foreground">Configura tu establecimiento y los accesos de tu equipo.</p>
          <Button id="settings-import-tool" variant={active === "importar" ? "secondary" : "ghost"} size="sm" disabled={saving} aria-expanded={active === "importar"} aria-controls="settings-panel-importar" onClick={() => select("importar")}><FileUp aria-hidden="true" className="h-4 w-4" />Importar clientes y mascotas</Button>
        </div>
      </div>

      <div id={`settings-panel-${active}`} role={active === "importar" ? "region" : "tabpanel"} aria-labelledby={active === "importar" ? "settings-import-tool" : `settings-tab-${active}`} tabIndex={0} className="rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
        {active === "general" && <GeneralInfoSection key={profile?.id} profile={profile} onDirtyChange={reportDirty} onSavingChange={reportSaving} />}
        {active === "areas" && <BusinessModules initial={profile?.activeModules ?? []} onDirtyChange={reportDirty} onSavingChange={reportSaving} />}
        {active === "localizacion" && <LocationServicesSection profile={profile} services={services} onDirtyChange={reportDirty} onSavingChange={reportSaving} />}
        {active === "agenda" && <ScheduleSection profile={profile} onDirtyChange={reportDirty} onSavingChange={reportSaving} onOpenTeam={() => select("usuarios")} />}
        {active === "usuarios" && <StaffManager profile={profile} onDirtyChange={reportDirty} onSavingChange={reportSaving} />}
        {active === "importar" && <div className="max-w-2xl space-y-4">
          <div><h2 className="text-xl font-bold">Importar clientes y mascotas</h2><p className="mt-2 text-sm text-muted-foreground">Carga un CSV en el formato de Mateos Pet y revisa sus datos antes de importar. Los contactos existentes se actualizan por su número de WhatsApp.</p></div>
          <ContactsImporter />
        </div>}
      </div>

      <Dialog open={pending !== null} onOpenChange={(open) => { if (!open) setPending(null); }}>
        <DialogContent className="w-[calc(100%-2rem)] max-w-md">
          <DialogHeader><DialogTitle>Cambios sin guardar</DialogTitle><DialogDescription>Tienes cambios en {sectionName}. Puedes volver para guardarlos o salir y descartarlos.</DialogDescription></DialogHeader>
          <DialogFooter className="flex-wrap"><Button variant="outline" onClick={() => setPending(null)}>Seguir editando</Button><Button variant="destructive" onClick={() => { if (pending) navigate(pending); }}>Descartar y salir</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
