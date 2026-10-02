import Link from "next/link";
import { auth } from "@/auth";
import { apiUrl, makeServerHeaders } from "@/lib/api";
import { ROLE_NAMES, type DashboardAccess } from "@/lib/dashboard-access";
import { formatColombiaDateTime, formatStatus } from "@/lib/appointments";
import { type TodayAppointment } from "@/lib/appointments";
export async function OperationalHome({ access, tenant }: { access: DashboardAccess; tenant?: string }) {
  const session = await auth();
  const response = await fetch(apiUrl("/api/dashboard/workspace"), { headers: makeServerHeaders(session, tenant), cache: "no-store" });
  if (!response.ok) return <p role="alert">No se pudo cargar tu jornada. Actualiza la página para reintentar.</p>;
  const data: { counts: { waiting: number; inProgress: number; completed: number; scheduled: number }; appointments: TodayAppointment[] } = await response.json();
  const tasks = [
    ...(access.capabilities.schedule ? [{ href: "/dashboard/calendar?new=1", label: "Crear cita" }] : []),
    ...(access.capabilities.clinical ? [{ href: "/dashboard/consultas", label: "Atender consultas" }] : []),
    ...(access.capabilities.grooming ? [{ href: "/dashboard/peluqueria", label: "Atender peluquería" }] : []),
    ...(access.capabilities.contacts ? [{ href: "/dashboard/contacto", label: "Clientes y mascotas" }] : []),
    ...(access.capabilities.cash ? [{ href: "/dashboard/pos", label: "Cobrar" }] : []),
    { href: "/dashboard/conversations", label: "Abrir WhatsApp" },
  ];
  return <div className="mx-auto max-w-[1400px] space-y-6">
    <header><p className="text-sm font-semibold text-teal-700">{ROLE_NAMES[access.role]}</p><h1 className="mt-1 text-3xl font-bold">Tu jornada de hoy</h1><p className="mt-2 text-muted-foreground">Acciones y atenciones para tu trabajo diario.</p></header>
    <div className="flex flex-wrap gap-3">{tasks.map(task => <Link key={task.href} href={task.href} className="rounded-xl bg-teal-700 px-5 py-3 font-semibold text-white hover:bg-teal-800">{task.label}</Link>)}</div>
    {access.capabilities.agenda && <><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{[["Por recibir", data.counts.scheduled], ["En espera", data.counts.waiting], ["En atención", data.counts.inProgress], ["Terminadas", data.counts.completed]].map(([label, value]) => <div key={label} className="rounded-2xl border bg-white p-5"><p className="text-sm text-muted-foreground">{label}</p><p className="mt-3 text-3xl font-bold">{value}</p></div>)}</div>
    <section className="rounded-2xl border bg-white p-6"><h2 className="mb-4 text-lg font-bold">Atenciones de hoy</h2>{data.appointments.length ? <div className="divide-y">{data.appointments.map(appointment => <div key={appointment.id} className="flex flex-wrap items-center justify-between gap-3 py-4"><div><p className="font-semibold">{appointment.petName} <span className="font-normal text-muted-foreground">· {appointment.clientName}</span></p><p className="mt-1 text-sm text-muted-foreground">{appointment.serviceName ?? appointment.serviceType} · {formatColombiaDateTime(appointment.date)}</p></div><span className="rounded-full bg-slate-100 px-3 py-1 text-sm">{formatStatus(appointment.status)}</span></div>)}</div> : <p className="text-muted-foreground">No hay citas para hoy.</p>}</section></>}
    {!access.capabilities.agenda && <section className="rounded-2xl border bg-white p-6"><h2 className="font-bold">Ventas y atención al cliente</h2><p className="mt-2 text-muted-foreground">Usa Caja para registrar productos y WhatsApp para atender a los propietarios.</p></section>}
  </div>;
}
