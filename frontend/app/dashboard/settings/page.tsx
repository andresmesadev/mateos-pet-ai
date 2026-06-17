import { auth } from "@/auth";
import { apiUrl, makeServerHeaders } from "@/lib/api";
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
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Configuración</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Perfil del negocio, horarios y catálogo de servicios.
        </p>
      </div>
      <SettingsView profile={profile} services={services} />
    </div>
  );
}
