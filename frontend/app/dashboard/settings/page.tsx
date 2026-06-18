import { Settings } from "lucide-react";

import { auth } from "@/auth";
import { apiUrl, makeServerHeaders } from "@/lib/api";
import { PageHeader } from "@/components/dashboard/page-header";
import { SettingsView } from "@/components/dashboard/settings-view";

export type TenantProfile = {
  id: string;
  name: string;
  slug: string;
  phone: string;
  email: string | null;
  description: string | null;
  address: string | null;
  logoUrl: string | null;
  businessHours: Record<string, { open: string; close: string; active: boolean }> | null;
  plan: string;
};

export type ServiceRow = {
  id: string;
  name: string;
  category: string;
  duration: number;
  basePrice: number | null;
  requiresAppointment: boolean;
  active: boolean;
};

type PageProps = {
  searchParams: Promise<{ tenant?: string }>;
};

export default async function SettingsPage({ searchParams }: PageProps) {
  const { tenant } = await searchParams;
  const session = await auth();
  const headers = makeServerHeaders(session, tenant);

  const [profileRes, servicesRes] = await Promise.all([
    fetch(apiUrl("/api/dashboard/tenant/profile"), { cache: "no-store", headers }),
    fetch(apiUrl("/api/dashboard/services"), { cache: "no-store", headers }),
  ]);

  const profile: TenantProfile | null = profileRes.ok ? await profileRes.json() : null;
  const services: ServiceRow[] = servicesRes.ok ? await servicesRes.json() : [];

  return (
    <div>
      <PageHeader
        title="Configuración"
        description="Perfil del negocio, horarios y catálogo de servicios"
        icon={Settings}
        tint="bg-slate-500/15 text-slate-300"
      />
      <SettingsView profile={profile} services={services} />
    </div>
  );
}
