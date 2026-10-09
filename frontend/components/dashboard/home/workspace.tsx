import Link from "next/link";
import { ArrowRight, CheckCircle2, ClipboardList, MessageCircle, Package, Scissors, Stethoscope, Wallet } from "lucide-react";
import { apiUrl } from "@/lib/api";
import type { DashboardAccess } from "@/lib/dashboard-access";
import type { TodayAppointment } from "@/lib/appointments";
import type { ConversationsResponse } from "@/lib/conversations";
import { groomingStage, type GroomingVisit } from "@/lib/grooming";
import type { InventoryProduct } from "@/lib/inventory";
import { clinicalPending, financialDay, homeAppointments, homeHasMissingSources, homeHref, homeSources, orderHomeTasks, pendingLabel, type HomeTaskKind } from "@/lib/home-workspace";
import { followupTiming } from "@/lib/home-adaptability";
import { formatPosMoney } from "@/lib/pos-checkout";
import type { UpcomingReminder } from "./fetchers";
import { HomeJourney } from "./journey";
import { RefreshHome } from "./refresh-home";
import { AttentionList } from "./attention-list";

type Cash = { toReview: string[]; hasMore: boolean; pendingCount?: number };
type Finances = { transactions: { total: number }[]; expenses: { amount: number }[] };
type InventoryPage = { data: InventoryProduct[]; nextCursor: string | null };
type Task = { kind: HomeTaskKind; title: string; detail: string; href: string; badge?: string; icon: typeof Wallet; examples?: { label: string; href: string; timing?: ReturnType<typeof followupTiming> }[]; unavailable?: boolean };

async function read<T>(path: string | null, headers: Record<string, string>, valid: (value: T) => boolean): Promise<T | null> {
  if (!path) return null;
  try {
    const response = await fetch(apiUrl(path), { headers, cache: "no-store", signal: AbortSignal.timeout(8000) });
    if (!response.ok) return null;
    const payload: T = await response.json();
    return payload && valid(payload) ? payload : null;
  } catch { return null; }
}

export async function HomeWorkspace({ access, headers, tenant, date, review }: {
  access: DashboardAccess; headers: Record<string, string>; tenant?: string; date: string; review: boolean;
}) {
  const c = access.capabilities;
  const paths = homeSources(access, date);
  const [profile, appointments, clinical, grooming, conversations, cash, low, expired, expiring, followups, finances] = await Promise.all([
    read<{ name: string }>(paths.profile, headers, p => typeof p.name === "string"),
    read<TodayAppointment[]>(paths.appointments, headers, Array.isArray),
    read<{ appointments: TodayAppointment[] }>(paths.clinical, headers, p => Array.isArray(p.appointments)),
    read<{ appointments: GroomingVisit[]; hasMore: boolean }>(paths.grooming, headers, p => Array.isArray(p.appointments)),
    read<ConversationsResponse>(paths.conversations, headers, p => Array.isArray(p.data) && Number.isInteger(p.pagination?.total)),
    read<Cash>(paths.cash, headers, p => Array.isArray(p.toReview)),
    read<InventoryPage>(paths.low, headers, p => Array.isArray(p.data)),
    read<InventoryPage>(paths.expired, headers, p => Array.isArray(p.data)),
    read<InventoryPage>(paths.expiring, headers, p => Array.isArray(p.data)),
    read<UpcomingReminder[]>(paths.followups, headers, Array.isArray),
    read<Finances>(paths.finances, headers, p => Array.isArray(p.transactions) && Array.isArray(p.expenses)),
  ]);
  const consultedAt = new Date().toISOString();
  const partial = homeHasMissingSources(paths, { profile, appointments, clinical, grooming, conversations, cash, low, expired, expiring, followups, finances });
  const href = (path: string) => homeHref(path, tenant);
  const tasks: Task[] = [];
  const checked: string[] = [];
  function add(task: Task, loaded: boolean, count: number) {
    if (!loaded) tasks.push({ ...task, unavailable: true, badge: undefined, examples: undefined, detail: "No disponible. Actualiza Inicio para comprobar este pendiente." });
    else if (count > 0) tasks.push(task);
    else checked.push(task.title);
  }
  if (c.chat) add({ kind: "chat", title: "WhatsApp necesita al equipo", icon: MessageCircle, href: href("/dashboard/conversations?attention=human"), badge: String(conversations?.pagination.total ?? 0), detail: "Conversaciones que esperan atención humana.", examples: conversations?.data.map(row => ({ label: row.name || row.phone || "Abrir conversación", href: href(`/dashboard/conversations?conversation=${encodeURIComponent(row.id)}`) })) }, conversations !== null, conversations?.pagination.total ?? 0);
  if (c.clinical) {
    const rows = clinicalPending(clinical?.appointments ?? [], date, access.role === "vet" ? access.staffId : null);
    add({ kind: "clinical", title: "Historias clínicas de hoy", icon: Stethoscope, href: href(`/dashboard/consultas?date=${date}&scope=day&care=pending-record`), badge: String(rows.length), detail: "Atenciones iniciadas o terminadas con historia pendiente.", examples: rows.slice(0, 2).map(row => ({ label: `${row.petName} · ${row.clientName || row.clientPhone}`, href: href(`/dashboard/consultas?date=${date}&appointment=${encodeURIComponent(row.id)}`) })) }, clinical !== null, rows.length);
  }
  if (c.grooming) {
    const rows = (grooming?.appointments ?? []).filter(row => !access.staffId || access.role !== "groomer" || !row.staffId || row.staffId === access.staffId);
    const ready = rows.filter(row => groomingStage(row, date) === "Listas para entrega");
    add({ kind: "grooming", title: "Entregas de peluquería", icon: Scissors, href: href("/dashboard/peluqueria?stage=ready"), badge: pendingLabel(ready.length, !!grooming?.hasMore), detail: grooming?.hasMore ? "Lista parcial del día. Abre Peluquería para revisar el alcance." : "Mascotas con servicio terminado y entrega pendiente.", examples: ready.slice(0, 2).map(row => ({ label: row.petName, href: href("/dashboard/peluqueria?stage=ready") })) }, grooming !== null, ready.length);
    if (grooming?.hasMore && !ready.length) tasks.push({ kind: "grooming", title: "Revisar peluquería", icon: Scissors, href: href("/dashboard/peluqueria"), detail: "El listado del día está limitado. Puede haber más entregas por revisar." });
  }
  if (c.cash) {
    const count = cash?.pendingCount ?? cash?.toReview.length ?? 0;
    add({ kind: "cash", title: "Confirmar métodos de pago", icon: Wallet, href: href("/dashboard/pos?tab=caja&review=1"), badge: pendingLabel(count, cash?.pendingCount === undefined && !!cash?.hasMore), detail: "Incluye pendientes de días anteriores. El servicio ya tiene un cobro registrado; confirma su método." }, cash !== null, count);
  }
  if (c.inventory_read) {
    for (const [data, status, title, detail] of [
      [expired, "expired", "Unidades vencidas", "Revisa los lotes antes de vender o utilizar productos."],
      [low, "low", "Productos por reponer", "Hay existencias disponibles iguales o inferiores al mínimo, incluidos productos sin stock."],
      [expiring, "expiring", "Vencimientos próximos", "Hay lotes con unidades que vencen en los próximos 30 días."],
    ] as const) add({ kind: status, title, detail, icon: Package, href: href(`/dashboard/inventory?status=${status}`), examples: data?.data.slice(0, 1).map(row => ({ label: row.name, href: href(`/dashboard/inventory?status=${status}`) })) }, data !== null, data?.data.length ?? 0);
  }
  if (paths.followups) {
    const types = new Set(["other", ...(c.clinical ? ["control", "vaccine", "exam", "treatment"] : []), ...(c.grooming ? ["grooming"] : [])]);
    const due = (followups ?? []).filter(row => { const timing = followupTiming(row.dueAt, date); return types.has(row.type) && (timing.date === null || timing.date <= date); });
    add({ kind: "followups", title: "Seguimientos por revisar", icon: ClipboardList, href: href("/dashboard/recuperacion?tab=oportunidades"), detail: "Primeros seguimientos pendientes con fecha de hoy o anterior; consulta el módulo para ver todos.", examples: due.slice(0, 2).map(row => ({ label: row.petName, href: href(`/dashboard/contacto?pet=${encodeURIComponent(row.petId)}`), timing: followupTiming(row.dueAt, date) })) }, followups !== null, due.length);
    if (followups?.length === 6 && !due.length) tasks.push({ kind: "followups", title: "Revisar seguimientos", icon: ClipboardList, href: href("/dashboard/recuperacion?tab=oportunidades"), detail: "La vista breve no cubre todos los seguimientos de las áreas habilitadas." });
  }
  const visibleAppointments = appointments ? homeAppointments(appointments, access) : null;
  const money = finances ? financialDay(finances) : null;
  const orderedTasks = orderHomeTasks(tasks, access.role);
  const attention = (
      <section aria-labelledby="home-attention" className="flex min-h-0 flex-col overflow-hidden rounded-2xl border bg-white @min-[880px]:h-[var(--home-agenda-height)]">
        <header className="shrink-0 border-b p-5"><h2 id="home-attention" className="text-lg font-bold">Necesita atención</h2><p className="mt-1 text-sm text-muted-foreground">Prioridades de tus módulos. Abre cada caso para resolverlo.</p></header>
        <AttentionList items={orderedTasks.map(task => ({ id: task.title, unavailable: !!task.unavailable, content:
          <div className="flex items-start gap-3"><task.icon className={`mt-0.5 size-5 shrink-0 ${task.unavailable ? "text-amber-800" : "text-primary"}`} aria-hidden="true" /><div className="min-w-0 flex-1"><Link prefetch={false} href={task.href} className="flex items-center justify-between gap-3 rounded-sm text-sm font-semibold hover:text-primary focus-visible:outline-2 focus-visible:outline-primary"><span>{task.title}</span><span className="flex shrink-0 items-center gap-2">{task.badge && <span className="rounded-full bg-secondary px-2 py-0.5 tabular-nums">{task.badge}</span>}<ArrowRight className="size-4" aria-hidden="true" /></span></Link><p className="mt-1 text-xs leading-relaxed text-muted-foreground" role={task.unavailable ? "status" : undefined}>{task.detail}</p>{task.examples?.map(example => <Link prefetch={false} key={example.href + example.label} href={example.href} className="mt-2 block min-h-8 rounded-sm text-sm text-primary underline decoration-primary/30 underline-offset-4 hover:decoration-primary focus-visible:outline-2 focus-visible:outline-primary">{example.label}{example.timing && <span className={`mt-1 block text-xs ${example.timing.date ? "text-muted-foreground" : "font-medium text-amber-800"}`}>{example.timing.label}{example.timing.date && <> · Fecha prevista: <time dateTime={example.timing.date}>{example.timing.dateLabel}</time></>}</span>}</Link>)}</div></div>
        }))} />
        {!tasks.length && <div className="flex gap-3 p-5"><CheckCircle2 className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden="true" /><div><h3 className="text-sm font-semibold">Sin pendientes en esta consulta</h3><p className="mt-1 text-xs text-muted-foreground">Las revisiones del día y las vistas breves consultadas están al día. Los módulos conservan sus listados completos.</p></div></div>}
        {!!checked.length && !!tasks.length && <p className="shrink-0 border-t bg-muted/30 px-5 py-3 text-xs leading-relaxed text-muted-foreground">{checked.length} revisiones sin pendientes en los datos consultados.</p>}
      </section>
  );
  return <div className="space-y-6">
    <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground"><p><span className="font-semibold text-foreground">{profile?.name || "Establecimiento no disponible"}</span> · {access.role === "vet" || access.role === "groomer" ? "Tu área de trabajo" : "Establecimiento actual"}</p><RefreshHome consultedAt={consultedAt} partial={partial} /></div>
    <HomeJourney key={`${tenant ?? headers["x-tenant-id"] ?? "current"}:${access.role}:${access.staffId ?? "admin"}:${access.activeModules.join(",")}`} access={access} tenant={tenant} appointments={visibleAppointments} initialReview={review} attention={attention} />
    {c.finance && <section aria-labelledby="home-finances" className="rounded-2xl border bg-white p-5 sm:p-6"><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs font-semibold text-primary">Solo administración</p><h2 id="home-finances" className="mt-1 text-lg font-bold">Resultados del negocio · hoy</h2></div><Link prefetch={false} href={href("/dashboard/pos?tab=reportes")} className="inline-flex min-h-10 items-center gap-2 text-sm font-semibold text-primary underline underline-offset-4">Ver reportes<ArrowRight className="size-4" aria-hidden="true" /></Link></div>{money ? <><dl className="mt-5 grid gap-4 sm:grid-cols-3">{[["Ingresos registrados", money.income], ["Gastos registrados", money.expenses], ["Diferencia del día", money.difference]].map(([label, value]) => <div key={label} className="min-w-0 border-l-2 border-secondary pl-4"><dt className="text-sm text-muted-foreground">{label}</dt><dd className="mt-2 break-words text-2xl font-bold tabular-nums">{formatPosMoney(Number(value))}</dd></div>)}</dl><p className="mt-5 text-xs leading-relaxed text-muted-foreground">Hechos activos, incluidos servicios terminados con método de pago por confirmar. La diferencia es ingresos menos gastos; no es utilidad ni efectivo físico en caja.</p></> : <p role="alert" className="mt-5 text-sm text-amber-900">Resultados no disponibles. Actualiza Inicio para comprobarlos.</p>}</section>}
  </div>;
}
