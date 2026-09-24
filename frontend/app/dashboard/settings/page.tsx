import { Settings } from "lucide-react";
import Link from "next/link";

import { auth } from "@/auth";
import { apiUrl, makeServerHeaders } from "@/lib/api";
import { PageHeader } from "@/components/dashboard/page-header";
import { SettingsTabs } from "@/components/dashboard/settings-tabs";

export type DayHours = { open: string; close: string; active: boolean };
export type BusinessHourDay = "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun";

export type BusinessHours = Partial<Record<BusinessHourDay, DayHours>> & {
  services?: Partial<Record<"vet" | "grooming", Partial<Record<BusinessHourDay, DayHours>>>>;
};

export type TenantProfile = {
  id: string;
  name: string;
  slug: string;
  phone: string;
  email: string | null;
  description: string | null;
  address: string | null;
  logoUrl: string | null;
  businessHours: BusinessHours | null;
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

  let profile: TenantProfile | null = null;
  let services: ServiceRow[] | null = null;
  try {
    const [profileRes, servicesRes] = await Promise.all([
      fetch(apiUrl("/api/dashboard/tenant/profile"), { cache: "no-store", headers }),
      fetch(apiUrl("/api/dashboard/services"), { cache: "no-store", headers }),
    ]);
    if (profileRes.ok && servicesRes.ok) {
      profile = await profileRes.json() as TenantProfile;
      services = await servicesRes.json() as ServiceRow[];
    }
  } catch {
    // La conexión puede fallar antes de recibir una respuesta HTTP.
  }

  const retryUrl = tenant
    ? `/dashboard/settings?tenant=${encodeURIComponent(tenant)}`
    : "/dashboard/settings";

  return (
    <div className="space-y-6">
      <PageHeader
        title="Administración"
        description="Información del negocio, servicios, horarios y equipo"
        icon={Settings}
        tint="bg-slate-100 text-slate-700"
      />
      {profile && services ? (
        <SettingsTabs profile={profile} services={services} />
      ) : (
        <div role="alert" className="max-w-2xl rounded-2xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-950">
          <h2 className="font-semibold">No se pudo cargar la administración</h2>
          <p className="mt-1">El servidor de datos no está disponible. Intenta de nuevo cuando vuelva la conexión.</p>
          <Link href={retryUrl} className="mt-4 inline-flex min-h-10 items-center rounded-lg border border-amber-300 bg-white px-4 font-semibold transition-colors hover:bg-amber-100">
            Reintentar
          </Link>
        </div>
      )}
    </div>
  );
}
