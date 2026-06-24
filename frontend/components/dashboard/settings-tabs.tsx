"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { StaffManager } from "@/components/dashboard/staff-manager";
import { ContactsImporter } from "@/components/dashboard/contacts-importer";
import {
  GeneralInfoSection,
  LocationServicesSection,
  ScheduleSection,
  FiscalSection,
} from "@/components/dashboard/settings-view";
import { type ServiceRow, type TenantProfile } from "@/app/dashboard/settings/page";

type Props = {
  profile: TenantProfile | null;
  services: ServiceRow[];
};

export function SettingsTabs({ profile, services }: Props) {
  return (
    <Tabs defaultValue="general" className="space-y-4">
      <TabsList className="flex-wrap h-auto gap-1">
        <TabsTrigger value="general">Información general</TabsTrigger>
        <TabsTrigger value="localizacion">Localización y servicios</TabsTrigger>
        <TabsTrigger value="agenda">Agenda y disponibilidad</TabsTrigger>
        <TabsTrigger value="fiscal">Perfil fiscal</TabsTrigger>
        <TabsTrigger value="usuarios">Gestión de usuarios</TabsTrigger>
        <TabsTrigger value="importar">Importar contactos</TabsTrigger>
      </TabsList>

      <TabsContent value="general">
        <GeneralInfoSection profile={profile} />
      </TabsContent>

      <TabsContent value="localizacion">
        <LocationServicesSection profile={profile} services={services} />
      </TabsContent>

      <TabsContent value="agenda">
        <ScheduleSection profile={profile} />
      </TabsContent>

      <TabsContent value="fiscal">
        <FiscalSection profile={profile} />
      </TabsContent>

      <TabsContent value="usuarios">
        <StaffManager />
      </TabsContent>

      <TabsContent value="importar">
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
      </TabsContent>
    </Tabs>
  );
}
