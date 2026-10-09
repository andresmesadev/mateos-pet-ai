import Link from "next/link";
import { connection } from "next/server";
import { canonicalDashboardHref, type DashboardSearchParams } from "@/lib/dashboard-navigation";
import { Users } from "lucide-react";

import { ClientsTable } from "@/components/dashboard/clients-table";
import { PetsTable } from "@/components/dashboard/pets-table";
import { PageHeader } from "@/components/dashboard/page-header";

type ContactoPageProps = {
  searchParams: Promise<DashboardSearchParams>;
};

export default async function ContactoPage({ searchParams }: ContactoPageProps) {
  await connection();
  const query = await searchParams;
  const first = (key: string) => Array.isArray(query[key]) ? query[key][0] : query[key];
  const pet = first("pet"), view = first("view"), newRecord = first("new"), search = first("search");
  const navigationQuery = { ...query, new: undefined };
  const activeView = view === "clientes" ? "clientes" : view === "mascotas" || pet || newRecord === "mascota" ? "mascotas" : "clientes";

  return (
    <section>
      <PageHeader
        title="Clientes y mascotas"
        description="Personas y mascotas, con su información en un solo lugar."
        icon={Users}
        tint="bg-teal-100 text-teal-700"
      />

      <nav aria-label="Ver contactos" className="mb-6 inline-flex gap-1 rounded-xl border border-border bg-white p-1 shadow-sm">
        <Link
          prefetch={false} href={canonicalDashboardHref("/dashboard/contacto", navigationQuery, { view: "clientes" })}
          aria-current={activeView === "clientes" ? "page" : undefined}
          className={`inline-flex min-h-10 items-center rounded-lg px-5 text-sm font-semibold transition-colors ${activeView === "clientes" ? "bg-teal-700 text-white" : "text-muted-foreground hover:bg-muted hover:text-foreground"}`}
        >
          Clientes
        </Link>
        <Link
          href={canonicalDashboardHref("/dashboard/contacto", navigationQuery, { view: "mascotas" })}
          aria-current={activeView === "mascotas" ? "page" : undefined}
          className={`inline-flex min-h-10 items-center rounded-lg px-5 text-sm font-semibold transition-colors ${activeView === "mascotas" ? "bg-teal-700 text-white" : "text-muted-foreground hover:bg-muted hover:text-foreground"}`}
        >
          Mascotas
        </Link>
      </nav>

      {activeView === "mascotas" ? <PetsTable initialPetId={pet ?? null} initialNew={newRecord === "mascota"} initialSearch={search} /> : <ClientsTable />}
    </section>
  );
}
