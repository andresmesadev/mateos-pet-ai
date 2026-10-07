"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { Archive, Clock3, Info, Pencil, Plus, RotateCcw, Save, Search, Scissors, Stethoscope, Tags, Trash2 } from "lucide-react";
import { type ServiceRow, type TenantProfile } from "@/app/dashboard/settings/page";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { proxyUrl } from "@/lib/api";
import { formatCOP } from "@/lib/transactions";
import { tenantQuery, useTenant } from "@/lib/use-tenant";

const CATEGORIES = [
  { id: "grooming", label: "Peluquería", icon: Scissors },
  { id: "veterinary", label: "Veterinaria", icon: Stethoscope },
  { id: "other", label: "Otros servicios", icon: Tags },
];
const selectClass = "h-11 w-full rounded-lg border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60";
type Draft = { name: string; category: string; duration: string; basePrice: string };
type Editor = { service: ServiceRow | null; original: Draft };
type Props = { profile: TenantProfile | null; services: ServiceRow[]; onDirtyChange?: (dirty: boolean) => void; onSavingChange?: (saving: boolean) => void };

function fold(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("es").trim();
}
function normalizeService(row: ServiceRow): ServiceRow {
  return { ...row, basePrice: row.basePrice == null ? null : Number(row.basePrice) };
}
function formatServicePrice(price: number) {
  return Number.isInteger(price) ? formatCOP(price) : new Intl.NumberFormat("es-CO", {
    style: "currency", currency: "COP", minimumFractionDigits: 2, maximumFractionDigits: 2,
  }).format(price);
}
function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}
async function responseError(response: Response, fallback: string, deletion = false) {
  const payload = await response.json().catch(() => null) as { error?: string } | null;
  const message = payload?.error;
  if (response.status === 409) return deletion ? message ?? fallback : "Ya existe un servicio con ese nombre. Busca también en Retirados para reactivarlo.";
  if (response.status === 401 || response.status === 403) return "Tu sesión no permite esta acción. Revisa tu acceso antes de volver a intentar.";
  if (response.status >= 500) return fallback;
  return message && message !== "Service not found" ? message.replace("este tenant", "tu establecimiento") : fallback;
}

export function ServiceCatalog({ profile, services: initial, onDirtyChange, onSavingChange }: Props) {
  const tenant = useTenant();
  const { toast } = useToast();
  const [services, setServices] = useState(() => initial.map(normalizeService));
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [showRetired, setShowRetired] = useState(false);
  const [editor, setEditor] = useState<Editor | null>(null);
  const [draft, setDraft] = useState<Draft>({ name: "", category: "veterinary", duration: "", basePrice: "" });
  const [discarding, setDiscarding] = useState(false);
  const [retiring, setRetiring] = useState<ServiceRow | null>(null);
  const [deleting, setDeleting] = useState<ServiceRow | null>(null);
  const [confirmName, setConfirmName] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const requestRef = useRef(false);
  const dirty = !!editor && Object.keys(draft).some((key) => draft[key as keyof Draft] !== editor.original[key as keyof Draft]);
  const enabledCategories = CATEGORIES.filter((item) => item.id === "other" || profile?.activeModules.includes(item.id));
  const activeCount = services.filter((service) => service.active).length;
  const retiredCount = services.length - activeCount;
  const filtered = services.filter((service) => service.active !== showRetired && (category === "all" || service.category === category) && fold(service.name).includes(fold(search)))
    .sort((left, right) => left.name.localeCompare(right.name, "es", { sensitivity: "base" }));
  const groups = CATEGORIES.map((item) => ({ ...item, rows: filtered.filter((service) =>
    item.id === "other" ? !["grooming", "veterinary"].includes(service.category) : service.category === item.id),
  })).filter((group) => group.rows.length);

  useEffect(() => { onDirtyChange?.(dirty); }, [dirty, onDirtyChange]);
  useEffect(() => { onSavingChange?.(saving); }, [saving, onSavingChange]);

  function change(field: keyof Draft, value: string) {
    setDraft((previous) => ({ ...previous, [field]: value }));
    setError(null);
    setDiscarding(false);
  }
  function begin(service: ServiceRow | null) {
    if (requestRef.current) return;
    const original = service ? { name: service.name, category: service.category, duration: String(service.duration), basePrice: service.basePrice == null ? "" : String(service.basePrice) }
      : { name: "", category: enabledCategories[0]?.id ?? "other", duration: "", basePrice: "" };
    setDraft(original);
    setEditor({ service, original });
    setDiscarding(false);
    setError(null);
  }
  function closeEditor() {
    if (requestRef.current) return;
    if (dirty) setDiscarding(true); else setEditor(null);
  }
  function upsert(row: ServiceRow) {
    const normalized = normalizeService(row);
    setServices((previous) => previous.some((service) => service.id === row.id) ? previous.map((service) => service.id === row.id ? normalized : service) : [...previous, normalized]);
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (requestRef.current || !editor || !dirty) return;
    const name = draft.name.trim();
    const duration = Number(draft.duration);
    const price = Number(draft.basePrice);
    if (!name || name.length > 100) { setError("Escribe un nombre de entre 1 y 100 caracteres."); return; }
    if (!draft.duration.trim() || !Number.isInteger(duration) || duration <= 0) { setError("Escribe una duración en minutos enteros, mayor que cero."); return; }
    if (!draft.basePrice.trim() || !Number.isFinite(price) || price < 0) { setError("Indica el precio base en COP. Si el servicio es gratuito, escribe 0."); return; }
    const service = editor.service;
    const changes: Record<string, string | number> = {};
    if (!service || name !== service.name) changes.name = name;
    if (!service || duration !== service.duration) changes.duration = duration;
    if (!service || price !== service.basePrice) changes.basePrice = price;
    if (!service) changes.category = draft.category;
    if (!Object.keys(changes).length) { setEditor(null); return; }
    requestRef.current = true;
    setSaving(true);
    setError(null);
    try {
      const response = await fetch(proxyUrl(`/api/dashboard/services${service ? `/${encodeURIComponent(service.id)}` : ""}${tenantQuery(tenant)}`), {
        method: service ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(changes),
      });
      if (!response.ok) throw new Error(await responseError(response, "No se pudo guardar el servicio. Tus cambios siguen aquí; intenta de nuevo."));
      const row = await response.json() as ServiceRow;
      upsert(row);
      setEditor(null);
      setShowRetired(!row.active);
      setSearch("");
      setCategory("all");
      const message = service ? `Cambios de ${row.name} guardados.` : `${row.name} creado en el catálogo.`;
      setNotice(message);
      toast(message, "success");
    } catch (err) { setError(errorMessage(err, "No se pudo guardar el servicio. Intenta de nuevo.")); }
    finally { requestRef.current = false; setSaving(false); }
  }

  async function setAvailability(service: ServiceRow, active: boolean) {
    if (requestRef.current) return;
    requestRef.current = true;
    setSaving(true);
    setActionError(null);
    try {
      const response = await fetch(proxyUrl(`/api/dashboard/services/${encodeURIComponent(service.id)}${tenantQuery(tenant)}`), active
        ? { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ active: true }) }
        : { method: "DELETE" });
      if (!response.ok) throw new Error(await responseError(response, active ? "No se pudo reactivar el servicio. Intenta de nuevo." : "No se pudo retirar el servicio. Intenta de nuevo."));
      if (active) upsert(await response.json() as ServiceRow);
      else upsert({ ...service, active: false });
      setRetiring(null);
      const message = active ? `${service.name} reactivado. Disponible en Activos.` : `${service.name} retirado. Puedes recuperarlo en Retirados.`;
      setNotice(message);
      toast(message, "success");
    } catch (err) { setActionError(errorMessage(err, "No se pudo actualizar el servicio.")); }
    finally { requestRef.current = false; setSaving(false); }
  }

  async function deletePermanently() {
    if (requestRef.current || !deleting || confirmName !== deleting.name) return;
    requestRef.current = true;
    setSaving(true);
    setActionError(null);
    try {
      const response = await fetch(proxyUrl(`/api/dashboard/services/${encodeURIComponent(deleting.id)}/permanent${tenantQuery(tenant)}`), {
        method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ confirmName }),
      });
      if (!response.ok) throw new Error(await responseError(response, "No se pudo eliminar el servicio. Intenta de nuevo.", true));
      setServices((previous) => previous.filter((service) => service.id !== deleting.id));
      const message = `${deleting.name} eliminado definitivamente.`;
      setDeleting(null);
      setNotice(message);
      toast(message, "success");
    } catch (err) { setActionError(errorMessage(err, "No se pudo eliminar el servicio.")); }
    finally { requestRef.current = false; setSaving(false); }
  }

  return (
    <section aria-labelledby="service-catalog-title" className="max-w-5xl overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
      <header className="flex flex-wrap items-start justify-between gap-4 border-b border-border p-5 sm:p-7">
        <div className="flex items-start gap-3">
          <div className="rounded-xl bg-teal-50 p-3 text-primary"><Tags aria-hidden="true" className="h-5 w-5" /></div>
          <div><h2 id="service-catalog-title" className="text-xl font-bold">Servicios y precios</h2><p className="mt-1 max-w-xl text-sm text-muted-foreground">Organiza los servicios que ofreces, su duración y su precio base.</p></div>
        </div>
        <Button type="button" onClick={() => begin(null)} disabled={saving}><Plus aria-hidden="true" />Nuevo servicio</Button>
      </header>
      <div className="space-y-5 p-5 sm:p-7">
        <div className="flex gap-3 rounded-xl bg-muted/50 p-4 text-sm text-muted-foreground"><Info aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-primary" /><p>El precio base es la referencia del catálogo. Las tarifas acordadas por mascota se conservan y se consultan al preparar la cita o el cobro. Los productos se gestionan en Inventario.</p></div>
        <div className="grid items-end gap-3 sm:grid-cols-[minmax(0,1fr)_220px]">
          <label className="space-y-2 text-sm font-semibold"><span>Buscar servicio</span><div className="relative"><Search aria-hidden="true" className="pointer-events-none absolute left-3 top-3 h-5 w-5 text-muted-foreground" /><Input className="h-11 pl-10" type="search" placeholder="Ej. Baño o consulta" value={search} onChange={(event) => setSearch(event.target.value)} /></div></label>
          <label className="space-y-2 text-sm font-semibold"><span>Categoría</span><select className={selectClass} value={category} onChange={(event) => setCategory(event.target.value)}><option value="all">Todas las categorías</option>{CATEGORIES.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div role="group" aria-label="Estado del catálogo" className="flex gap-2"><Button variant={showRetired ? "ghost" : "default"} aria-pressed={!showRetired} onClick={() => setShowRetired(false)}>Activos ({activeCount})</Button><Button variant={showRetired ? "default" : "ghost"} aria-pressed={showRetired} onClick={() => setShowRetired(true)}>Retirados ({retiredCount})</Button></div>
          <p role="status" className="text-sm text-muted-foreground">{filtered.length} {filtered.length === 1 ? "servicio" : "servicios"}{search || category !== "all" ? " encontrados" : " en esta lista"}</p>
        </div>
        {notice && <p role="status" className="rounded-lg bg-teal-50 px-4 py-3 text-sm font-medium text-teal-800">{notice}</p>}
        {actionError && !retiring && !deleting && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{actionError}</p>}
        {showRetired && <p className="text-sm text-muted-foreground">Estos servicios están fuera del catálogo activo. Su historial permanece guardado; puedes reactivarlos cuando vuelvas a ofrecerlos.</p>}
        {filtered.length ? <div className="space-y-6" aria-label={showRetired ? "Servicios retirados" : "Servicios activos"}>
          {groups.map((group) => <section key={group.id} aria-labelledby={`service-group-${group.id}`} className="overflow-hidden rounded-xl border border-border">
            <header className="flex items-center gap-3 border-b border-border bg-muted/40 px-4 py-4 sm:px-5"><group.icon aria-hidden="true" className="h-5 w-5 text-primary" /><h3 id={`service-group-${group.id}`} className="font-semibold">{group.label}</h3><Badge variant="outline">{group.rows.length} {group.rows.length === 1 ? "servicio" : "servicios"}</Badge></header>
            <ul aria-label={`Servicios de ${group.label.toLocaleLowerCase("es")}`} className="divide-y divide-border">
          {group.rows.map((service) => {
            const item = CATEGORIES.find((candidate) => candidate.id === service.category);
            const Icon = item?.icon ?? Tags;
            const areaOff = service.category !== "other" && !profile?.activeModules.includes(service.category);
            return <li key={service.id} className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
              <div className="flex min-w-0 items-start gap-3"><div className="rounded-lg bg-muted p-2.5 text-primary"><Icon aria-hidden="true" className="h-5 w-5" /></div><div className="min-w-0"><h4 className="break-words font-semibold">{service.name}</h4><div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-2 text-sm text-muted-foreground"><span>{item?.label ?? service.category ?? "Sin categoría"}</span><span className="inline-flex items-center gap-1"><Clock3 aria-hidden="true" className="h-3.5 w-3.5" />{service.duration} minutos</span>{areaOff && <Badge variant="outline">Área desactivada</Badge>}</div></div></div>
              <div className="flex flex-wrap items-center justify-between gap-3 sm:justify-end sm:gap-5"><div className="sm:text-right"><p className="text-xs text-muted-foreground">Precio base · COP</p><p className="mt-1 font-semibold tabular-nums">{service.basePrice == null ? "Sin precio base" : formatServicePrice(service.basePrice)}</p></div><div className="flex flex-wrap gap-2"><Button variant="outline" size="sm" disabled={saving} aria-label={`Editar ${service.name}`} onClick={() => begin(service)}><Pencil aria-hidden="true" />Editar</Button>{service.active ? <Button variant="destructive" size="sm" disabled={saving} aria-label={`Retirar ${service.name}`} onClick={() => { setRetiring(service); setActionError(null); }}><Archive aria-hidden="true" />Retirar</Button> : <><Button variant="outline" size="sm" disabled={saving} aria-label={`Reactivar ${service.name}`} onClick={() => void setAvailability(service, true)}><RotateCcw aria-hidden="true" />Reactivar</Button><Button variant="destructive" size="sm" disabled={saving} aria-label={`Eliminar definitivamente ${service.name}`} onClick={() => { setDeleting(service); setConfirmName(""); setActionError(null); }}><Trash2 aria-hidden="true" />Eliminar</Button></>}</div></div>
            </li>;
          })}
        </ul></section>)}</div> : <div className="rounded-xl border border-dashed border-border px-5 py-10 text-center"><h3 className="font-semibold">{search || category !== "all" ? "No encontramos servicios con esos filtros" : showRetired ? "No hay servicios retirados" : "Crea tu primer servicio"}</h3><p className="mt-2 text-sm text-muted-foreground">{search || category !== "all" ? "Prueba otro nombre o consulta todas las categorías." : showRetired ? "Los servicios que retires se conservarán aquí." : "Agrega el nombre, la duración en minutos y el precio base."}</p>{search || category !== "all" ? <Button className="mt-4" variant="outline" onClick={() => { setSearch(""); setCategory("all"); }}>Limpiar filtros</Button> : !showRetired && <Button className="mt-4" onClick={() => begin(null)} disabled={saving}><Plus aria-hidden="true" />Nuevo servicio</Button>}</div>}
      </div>

      <Dialog open={editor !== null} onOpenChange={(open) => { if (!open) closeEditor(); }}>
        <DialogContent showClose={!saving} className="max-h-[90dvh] w-[calc(100%-2rem)] max-w-2xl overflow-y-auto">
          <DialogHeader><DialogTitle>{editor?.service ? "Editar servicio" : "Nuevo servicio"}</DialogTitle><DialogDescription>{editor?.service ? `Actualiza ${editor.service.name}. Las tarifas acordadas por mascota se mantienen.` : "Define la información que verá tu equipo al agendar y cobrar este servicio."}</DialogDescription></DialogHeader>
          <form onSubmit={save} className="space-y-5 px-6 pb-5">
            <fieldset disabled={saving} className="grid gap-4 sm:grid-cols-2">
              <label className="space-y-2 text-sm font-semibold sm:col-span-2"><span>Nombre del servicio (obligatorio)</span><Input required maxLength={100} value={draft.name} onChange={(event) => change("name", event.target.value)} placeholder="Ej. Baño básico" /></label>
              {editor?.service ? <div className="space-y-2 text-sm"><p className="font-semibold">Categoría</p><p className="rounded-lg bg-muted px-3 py-2.5">{CATEGORIES.find((item) => item.id === draft.category)?.label ?? draft.category}</p></div> : <label className="space-y-2 text-sm font-semibold"><span>Categoría</span><select className={selectClass} value={draft.category} onChange={(event) => change("category", event.target.value)}>{enabledCategories.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label>}
              <label className="space-y-2 text-sm font-semibold"><span>Duración (minutos)</span><Input required aria-label="Duración (minutos)" aria-describedby="service-duration-help" type="number" inputMode="numeric" min="1" step="1" value={draft.duration} onChange={(event) => change("duration", event.target.value)} placeholder="Ej. 30" /><span id="service-duration-help" className="block text-xs font-normal text-muted-foreground">Tiempo habitual de atención. Ejemplo: 30 minutos.</span></label>
              <label className="space-y-2 text-sm font-semibold sm:col-span-2"><span>Precio base (COP)</span><Input required aria-label="Precio base (COP)" type="number" inputMode="decimal" min="0" max="99999999.99" step="0.01" value={draft.basePrice} onChange={(event) => change("basePrice", event.target.value)} placeholder="Ej. 55000" aria-describedby="service-price-help" /><span id="service-price-help" className="block text-xs font-normal text-muted-foreground">Escribe el valor en pesos, sin separadores de miles. Si es gratuito, escribe 0.</span></label>
            </fieldset>
            {draft.basePrice.trim() !== "" && Number.isFinite(Number(draft.basePrice)) && Number(draft.basePrice) >= 0 && <p className="rounded-lg bg-muted/50 p-3 text-sm">Precio base: <strong>{formatServicePrice(Number(draft.basePrice))}</strong>{Number(draft.basePrice) === 0 && <span className="mt-1 block text-amber-800">El precio base será $0. Revisa el valor antes de guardar.</span>}</p>}
            {error && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</p>}
            {discarding ? <div role="alert" className="space-y-3 rounded-xl border border-amber-200 bg-amber-50 p-4"><p className="text-sm font-medium text-amber-950">Tienes cambios sin guardar. ¿Quieres descartarlos?</p><div className="flex flex-wrap gap-2"><Button type="button" variant="outline" onClick={() => setDiscarding(false)}>Seguir editando</Button><Button type="button" variant="destructive" onClick={() => { setEditor(null); setDiscarding(false); }}>Descartar cambios</Button></div></div> : <DialogFooter className="flex-wrap px-0 pb-0"><Button type="button" variant="outline" disabled={saving} onClick={closeEditor}>Cancelar</Button><Button type="submit" disabled={saving || !dirty}><Save aria-hidden="true" />{saving ? "Guardando…" : editor?.service ? "Guardar cambios" : "Crear servicio"}</Button></DialogFooter>}
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={deleting !== null} onOpenChange={(open) => { if (!open && !requestRef.current) setDeleting(null); }}>
        <DialogContent showClose={!saving} className="w-[calc(100%-2rem)] max-w-lg">
          <DialogHeader><DialogTitle>Eliminar servicio definitivamente</DialogTitle><DialogDescription>Esta acción no se puede deshacer. Solo se eliminará si no tiene citas, tarifas acordadas ni vínculos con el equipo. Su auditoría se conserva.</DialogDescription></DialogHeader>
          <div className="space-y-4 px-6 pb-4"><p className="break-words rounded-lg bg-muted p-3 font-semibold">{deleting?.name}</p><label className="block space-y-2 text-sm"><span>Escribe el nombre exacto del servicio para confirmar</span><Input aria-label="Nombre para confirmar eliminación" value={confirmName} disabled={saving} autoComplete="off" onChange={(event) => setConfirmName(event.target.value)} /></label>{actionError && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{actionError}</p>}</div>
          <DialogFooter><Button variant="outline" disabled={saving} onClick={() => setDeleting(null)}>Cancelar</Button><Button variant="destructive" disabled={saving || confirmName !== deleting?.name} onClick={() => void deletePermanently()}><Trash2 aria-hidden="true" />{saving ? "Eliminando…" : "Eliminar definitivamente"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={retiring !== null} onOpenChange={(open) => { if (!open && !requestRef.current) setRetiring(null); }}>
        <DialogContent showClose={!saving} className="w-[calc(100%-2rem)] max-w-md">
          <DialogHeader><DialogTitle>Retirar servicio del catálogo</DialogTitle><DialogDescription>¿Dejar de ofrecer {retiring?.name}? No aparecerá para nuevas operaciones. Las citas y el historial se conservan; podrás recuperarlo desde Retirados.</DialogDescription></DialogHeader>
          {actionError && <p role="alert" className="px-6 text-sm text-red-800">{actionError}</p>}
          <DialogFooter><Button variant="outline" disabled={saving} onClick={() => setRetiring(null)}>Cancelar</Button><Button variant="destructive" disabled={saving} onClick={() => { if (retiring) void setAvailability(retiring, false); }}><Archive aria-hidden="true" />{saving ? "Retirando…" : "Retirar servicio"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
