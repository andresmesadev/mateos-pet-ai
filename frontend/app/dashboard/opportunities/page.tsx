import { auth } from "@/auth";
import { apiUrl, makeServerHeaders } from "@/lib/api";
import { OpportunitiesView } from "@/components/dashboard/opportunities-view";

type OpportunityEntry = {
  actionId: string;
  petId: string;
  petName: string;
  petType: string;
  ownerId: string | null;
  ownerName: string | null;
  ownerPhone: string | null;
  dueAt: string;
  notes: string | null;
  isOverdue: boolean;
};

type InactiveEntry = {
  ownerId: string;
  ownerName: string | null;
  ownerPhone: string;
  pets: { id: string; name: string; type: string }[];
  lastAppointmentDate: string | null;
  daysSince: number | null;
};

export type OpportunitiesData = {
  byType: Record<string, OpportunityEntry[]>;
  inactive: InactiveEntry[];
};

const EMPTY: OpportunitiesData = { byType: {}, inactive: [] };

type PageProps = {
  searchParams: Promise<{ tenant?: string }>;
};

export default async function OpportunitiesPage({ searchParams }: PageProps) {
  const { tenant } = await searchParams;
  const session = await auth();
  const headers = makeServerHeaders(session, tenant);

  let data: OpportunitiesData = EMPTY;
  try {
    const res = await fetch(apiUrl("/api/dashboard/opportunities"), {
      cache: "no-store",
      headers,
    });
    if (res.ok) data = await res.json();
  } catch { /* fallback to empty */ }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Bandeja de oportunidades</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Mascotas con acciones pendientes y clientes a reactivar.
        </p>
      </div>
      <OpportunitiesView data={data} />
    </div>
  );
}
