import { Users } from "lucide-react";
import { connection } from "next/server";

import { ClientsTable } from "@/components/dashboard/clients-table";
import { PetsTable } from "@/components/dashboard/pets-table";
import { PageHeader } from "@/components/dashboard/page-header";

type ContactoPageProps = {
  searchParams: Promise<{ pet?: string }>;
};

export default async function ContactoPage({ searchParams }: ContactoPageProps) {
  await connection();
  const { pet } = await searchParams;

  return (
    <section>
      <PageHeader
        title="Clientes"
        description="Clientes y mascotas registrados"
        icon={Users}
        tint="bg-violet-500/15 text-violet-400"
      />

      <div className="space-y-6">
        <ClientsTable />
        <PetsTable initialPetId={pet ?? null} />
      </div>
    </section>
  );
}
