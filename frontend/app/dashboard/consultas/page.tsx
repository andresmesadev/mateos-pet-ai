import Link from "next/link";
import { connection } from "next/server";
import { Stethoscope } from "lucide-react";

import { auth } from "@/auth";
import { PageHeader } from "@/components/dashboard/page-header";
import { VetConsultationsView } from "@/components/dashboard/vet-consultations-view";
import { apiUrl, makeServerHeaders } from "@/lib/api";
import { type TodayAppointment } from "@/lib/appointments";
import { previewWeekData } from "@/lib/calendar-preview";

type PageProps = {
  searchParams: Promise<{ preview?: string; tenant?: string }>;
};

function previewConsultations(): TodayAppointment[] {
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "America/Bogota" });
  const times = ["09:00", "10:30", "11:30", "15:00"];
  const statuses = ["confirmed", "arrived", "in_progress", "completed"];

  return previewWeekData().appointments
    .filter((appointment) => appointment.serviceType === "vet")
    .slice(0, 4)
    .map((appointment, index) => ({
      ...appointment,
      id: `consulta-ejemplo-${index}`,
      petId: `mascota-ejemplo-${index}`,
      date: new Date(`${today}T${times[index]}:00-05:00`).toISOString(),
      status: statuses[index],
    }));
}

export default async function ConsultasPage({ searchParams }: PageProps) {
  await connection();
  const { preview, tenant } = await searchParams;
  const isPreview = process.env.NODE_ENV === "development" && preview === "1";
  let appointments: TodayAppointment[] | null = isPreview ? previewConsultations() : null;
  let veterinaryEnabled: boolean | null = null;

  if (!isPreview) {
    const session = await auth();
    const headers = makeServerHeaders(session, tenant);
    try {
      const [appointmentsRes, profileRes] = await Promise.all([
        fetch(apiUrl("/api/dashboard/appointments/week"), { cache: "no-store", headers }),
        fetch(apiUrl("/api/dashboard/tenant/profile"), { cache: "no-store", headers }),
      ]);
      if (appointmentsRes.ok) {
        const payload = await appointmentsRes.json() as { appointments?: TodayAppointment[] };
        if (Array.isArray(payload.appointments)) appointments = payload.appointments;
      }
      if (profileRes.ok) {
        const profile = await profileRes.json() as { activeModules?: string[] };
        if (Array.isArray(profile.activeModules)) {
          veterinaryEnabled = profile.activeModules.includes("veterinary");
        }
      }
    } catch { /* Se muestra el estado de error sin inventar consultas. */ }
  }

  const realParams = new URLSearchParams();
  if (tenant) realParams.set("tenant", tenant);
  const realHref = `/dashboard/consultas${realParams.size ? `?${realParams.toString()}` : ""}`;
  const previewParams = new URLSearchParams(realParams);
  previewParams.set("preview", "1");

  return (
    <div className="mx-auto max-w-[1500px] pb-10">
      <PageHeader
        title="Consultas veterinarias"
        description="Atiende las citas de esta semana y abre la historia de cada mascota."
        icon={Stethoscope}
        tint="bg-teal-100 text-teal-700"
      />

      {isPreview && (
        <div role="status" className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-teal-200 bg-teal-50 px-4 py-3 text-sm text-teal-950">
          <p><strong>Vista de ejemplo.</strong> Los pacientes y las citas son ficticios. El guardado está desactivado.</p>
          <Link href={realHref} className="font-semibold underline underline-offset-2">Volver a las consultas reales</Link>
        </div>
      )}

      {veterinaryEnabled === false ? (
        <div className="rounded-2xl border border-border bg-white p-7">
          <h2 className="text-lg font-semibold">El módulo veterinario no está activo</h2>
          <p className="mt-1 text-sm text-muted-foreground">Esta sección se habilita en establecimientos que prestan atención veterinaria.</p>
        </div>
      ) : appointments ? (
        <VetConsultationsView appointments={appointments} preview={isPreview} />
      ) : (
        <div role="alert" className="max-w-2xl rounded-2xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-950">
          <h2 className="font-semibold">No se pudieron cargar las consultas</h2>
          <p className="mt-1">El servidor de datos no está disponible. Intenta de nuevo para ver las citas veterinarias.</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link href={realHref} className="inline-flex min-h-10 items-center rounded-lg border border-amber-300 bg-white px-4 font-semibold hover:bg-amber-100">Reintentar</Link>
            {process.env.NODE_ENV === "development" && (
              <Link href={`/dashboard/consultas?${previewParams.toString()}`} className="inline-flex min-h-10 items-center rounded-lg border border-amber-300 bg-white px-4 font-semibold hover:bg-amber-100">Ver sección de ejemplo</Link>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
