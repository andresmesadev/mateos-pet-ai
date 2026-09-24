import Link from "next/link";
import { connection } from "next/server";
import { Users } from "lucide-react";

import { ClientsTable } from "@/components/dashboard/clients-table";
import { PetsTable } from "@/components/dashboard/pets-table";
import { PageHeader } from "@/components/dashboard/page-header";

type ContactoPageProps = {
  searchParams: Promise<{ pet?: string; view?: string; new?: string }>;
};

export default async function ContactoPage({ searchParams }: ContactoPageProps) {
  await connection();
  const { pet, view, new: newRecord } = await searchParams;
  const activeView = pet || view === "mascotas" || newRecord === "mascota" ? "mascotas" : "clientes";

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
          href="/dashboard/contacto"
          aria-current={activeView === "clientes" ? "page" : undefined}
          className={`inline-flex min-h-10 items-center rounded-lg px-5 text-sm font-semibold transition-colors ${activeView === "clientes" ? "bg-teal-700 text-white" : "text-muted-foreground hover:bg-muted hover:text-foreground"}`}
        >
          Clientes
        </Link>
        <Link
          href="/dashboard/contacto?view=mascotas"
          aria-current={activeView === "mascotas" ? "page" : undefined}
          className={`inline-flex min-h-10 items-center rounded-lg px-5 text-sm font-semibold transition-colors ${activeView === "mascotas" ? "bg-teal-700 text-white" : "text-muted-foreground hover:bg-muted hover:text-foreground"}`}
        >
          Mascotas
        </Link>
      </nav>

      {activeView === "mascotas" ? <PetsTable initialPetId={pet ?? null} initialNew={newRecord === "mascota"} /> : <ClientsTable />}
    </section>
  );
}
