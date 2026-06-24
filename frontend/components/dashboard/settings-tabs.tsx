"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { StaffManager } from "@/components/dashboard/staff-manager";
import { ContactsImporter } from "@/components/dashboard/contacts-importer";
import {
  GeneralInfoSection,
  LocationServicesSection,
  ScheduleSection,
  FiscalSection,
} from "@/components/dashboard/settings-view";
import { type ServiceRow, type TenantProfile } from "@/app/dashboard/settings/page";

type Tab = "general" | "localizacion" | "agenda" | "fiscal" | "usuarios" | "importar";

const TABS: { id: Tab; label: string }[] = [
  { id: "general",     label: "Información general" },
  { id: "localizacion",label: "Localización y servicios" },
  { id: "agenda",      label: "Agenda y disponibilidad" },
  { id: "fiscal",      label: "Perfil fiscal" },
  { id: "usuarios",    label: "Gestión de usuarios" },
  { id: "importar",    label: "Importar contactos" },
];

type Props = {
  profile: TenantProfile | null;
  services: ServiceRow[];
};

export function SettingsTabs({ profile, services }: Props) {
  const [active, setActive] = useState<Tab>("general");

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-1 overflow-x-auto rounded-xl border border-white/[0.06] bg-card p-1">
        {TABS.map(({ id, label }) => (
          <button
            key={id}
            type="button"
            onClick={() => setActive(id)}
            className={cn(
              "shrink-0 rounded-lg px-4 py-2 text-sm font-medium transition-all duration-150",
              active === id
                ? "bg-primary/15 text-primary shadow-[0_1px_3px_rgba(0,0,0,0.3)]"
                : "text-muted-foreground hover:bg-accent hover:text-foreground"
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {active === "general" && <GeneralInfoSection profile={profile} />}
      {active === "localizacion" && <LocationServicesSection profile={profile} services={services} />}
      {active === "agenda" && <ScheduleSection profile={profile} />}
      {active === "fiscal" && <FiscalSection profile={profile} />}
      {active === "usuarios" && <StaffManager />}
      {active === "importar" && (
        <div className="max-w-2xl space-y-4">
          <div>
            <p className="text-sm font-semibold">Importar contactos desde CSV</p>
            <p className="text-sm text-muted-foreground mt-1">
              Sube un archivo exportado desde Outlook o Google Contacts. Los contactos que ya existen
              (mismo número de WhatsApp) se actualizan sin duplicar.
            </p>
          </div>
          <ContactsImporter />
        </div>
      )}
    </div>
  );
}
