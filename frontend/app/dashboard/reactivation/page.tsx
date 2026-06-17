import { ReactivationCampaign } from "@/components/dashboard/reactivation-campaign";
import { apiUrl } from "@/lib/api";

type InactiveClient = {
  id: string;
  phone: string;
  name: string | null;
  pets: { name: string; type: string }[];
  lastAppointmentDate: string | null;
};

type PageProps = {
  searchParams: Promise<{ tenant?: string }>;
};

async function fetchInactiveClients(tenantId?: string): Promise<InactiveClient[]> {
  const q = tenantId ? `?tenantId=${encodeURIComponent(tenantId)}` : "";
  try {
    const res = await fetch(apiUrl(`/api/dashboard/clients/inactive${q}`), {
      cache: "no-store",
    });
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

export default async function ReactivationPage({ searchParams }: PageProps) {
  const { tenant } = await searchParams;
  const clients = await fetchInactiveClients(tenant);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Campaña de reactivación</h1>
        <p className="text-muted-foreground">
          Envía un WhatsApp a clientes que llevan más de 60 días sin visitar.
        </p>
      </div>

      <ReactivationCampaign clients={clients} />
    </div>
  );
}
