"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { CalendarClock, KeyRound, Pencil, Plus, RefreshCw, Search, ShieldCheck, UserRound } from "lucide-react";
import type { TenantProfile } from "@/app/dashboard/settings/page";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";
import { TeamPermissions } from "@/components/dashboard/team-permissions";
import { TeamServicesEditor } from "@/components/dashboard/team-services-editor";
import { TeamAvailability } from "@/components/dashboard/team-availability";
import { MemberEditor, StaffAccessEditor, StaffScheduleEditor, teamRequest } from "@/components/dashboard/team-member-editor";
import { TEAM_ROLES, teamText, type StaffMember } from "@/lib/team-editor";
import { proxyUrl } from "@/lib/api";
import { tenantQuery, useTenant } from "@/lib/use-tenant";

type Panel = { kind: "new" } | { kind: "edit" | "schedule" | "access" | "permissions" | "availability" | "services"; member: StaffMember };
type Confirmation = { kind: "close" } | { kind: "active" | "revoke"; member: StaffMember };
type Props = { profile?: TenantProfile | null; onDirtyChange?: (dirty: boolean) => void; onSavingChange?: (saving: boolean) => void };
export function StaffManager({ profile, onDirtyChange, onSavingChange }: Props) {
  const { data: session } = useSession(), tenant = useTenant(), { toast } = useToast();
  const [members, setMembers] = useState<StaffMember[]>([]), [loading, setLoading] = useState(true), [loadError, setLoadError] = useState("");
  const [query, setQuery] = useState(""), [role, setRole] = useState("all"), [status, setStatus] = useState("active");
  const [panel, setPanel] = useState<Panel | null>(null), [confirmation, setConfirmation] = useState<Confirmation | null>(null);
  const [dirty, setDirty] = useState(false), [saving, setSaving] = useState(false), [canSaveSchedule, setCanSaveSchedule] = useState(false), [actionError, setActionError] = useState("");
  const actionLock = useRef(false), signals = { onDirtyChange: useCallback((value: boolean) => setDirty(value), []), onSavingChange: useCallback((value: boolean) => setSaving(value), []), onCanSaveChange: useCallback((value: boolean) => setCanSaveSchedule(value), []) };
  const [reloadKey, setReloadKey] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    void Promise.resolve().then(() => {
      if (controller.signal.aborted) return null;
      setLoading(true); setLoadError("");
      return fetch(proxyUrl("/api/dashboard/staff" + tenantQuery(tenant)), { cache: "no-store", signal: controller.signal });
    }).then(async response => {
      if (!response || controller.signal.aborted) return;
      const data = await response.json().catch(() => null);
      if (!response.ok || !Array.isArray(data)) throw new Error("No se pudo cargar el equipo. Revisa la conexión y vuelve a intentar.");
      if (!controller.signal.aborted) setMembers(data);
    }).catch(cause => { if (!controller.signal.aborted) setLoadError(cause instanceof Error ? cause.message : "No se pudo cargar el equipo."); }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [tenant, reloadKey]);
  useEffect(() => { onDirtyChange?.(dirty); return () => onDirtyChange?.(false); }, [dirty, onDirtyChange]);
  useEffect(() => { onSavingChange?.(saving); return () => onSavingChange?.(false); }, [saving, onSavingChange]);
  const adminEmail = session?.user?.role === "admin" ? session.user.email?.trim().toLowerCase() : null;
  const usesAdminAccess = (m: StaffMember) => Boolean(adminEmail && m.email?.trim().toLowerCase() === adminEmail);
  const accessLabel = (m: StaffMember) => usesAdminAccess(m) ? (m.active ? "Usa tu cuenta administradora" : "Ficha inactiva · tu cuenta administradora sigue activa") : !m.active ? "Ingreso bloqueado · integrante inactivo" : m.credential?.active ? "Acceso habilitado" : "Sin acceso individual";
  const visible = members.filter(m => (status === "all" || m.active === (status === "active")) && (role === "all" || m.role === role) && teamText([m.name, m.email, m.phone, m.credential?.email].filter(Boolean).join(" ")).includes(teamText(query)));
  const counts = { active: members.filter(m => m.active).length, inactive: members.filter(m => !m.active).length, all: members.length };
  const title = !panel ? "" : panel.kind === "new" ? "Nuevo integrante" : ({ edit: "Ficha", schedule: "Horario", access: "Acceso", permissions: "Perfil y permisos", availability: "Ausencias y citas", services: "Servicios que atiende" })[panel.kind] + " de " + panel.member.name;
  function close() { if (saving) return; if (dirty) setConfirmation({ kind: "close" }); else { setPanel(null); setDirty(false); } }
  function saved(member: StaffMember) {
    setMembers(prev => prev.some(m => m.id === member.id) ? prev.map(m => m.id === member.id ? { ...m, ...member } : m) : [...prev, member]);
    setDirty(false); setPanel((panel?.kind === "schedule" || panel?.kind === "services") ? { kind: "availability", member } : null); toast("Cambios del equipo guardados.", "success");
  }
  async function confirmAction() {
    if (!confirmation || confirmation.kind === "close" || actionLock.current) return;
    const current = confirmation; actionLock.current = true; setSaving(true); setActionError("");
    try {
      if (current.kind === "active") {
        const result = await teamRequest("/api/dashboard/staff/" + current.member.id, tenant, "PATCH", { active: !current.member.active });
        if (!result?.id) throw new Error("No se confirmó el cambio de estado.");
        setMembers(prev => prev.map(m => m.id === result.id ? { ...m, ...result } : m));
        if (current.member.active) setPanel({ kind: "availability", member: { ...current.member, ...result } });
      } else {
        await teamRequest(`/api/dashboard/staff/${current.member.id}/credential`, tenant, "DELETE");
        setMembers(prev => prev.map(m => m.id === current.member.id ? { ...m, credential: m.credential ? { ...m.credential, active: false } : null } : m));
        setPanel(null); setDirty(false);
      }
      setConfirmation(null); toast(current.kind === "revoke" ? "Acceso revocado." : "Estado del integrante actualizado.", "success");
    } catch (cause) { setActionError(cause instanceof Error ? cause.message : "No se pudo completar la acción."); }
    finally { actionLock.current = false; setSaving(false); }
  }
  return <section className="space-y-5" aria-label="Gestión del equipo">
    <header className="flex flex-wrap items-start justify-between gap-4"><div><h2 className="text-xl font-bold">Tu equipo</h2><p className="mt-1 text-sm text-muted-foreground">Organiza a tus integrantes y revisa cómo pueden trabajar en el establecimiento.</p></div><div className="flex flex-wrap gap-2"><Button variant="outline" disabled={loading || saving || !!panel} onClick={() => setReloadKey(key => key + 1)}><RefreshCw aria-hidden="true" />Actualizar</Button><Button disabled={loading || !!loadError || saving || !!panel} onClick={() => setPanel({ kind: "new" })}><Plus aria-hidden="true" />Nuevo integrante</Button></div></header>
    <div className="rounded-xl border bg-muted/30 p-4 text-sm"><p className="font-semibold">Una cuenta también puede administrar y atender</p><p className="mt-1 text-muted-foreground">Vincula el correo de tu cuenta administradora a tu ficha para identificarte en las atenciones. Recepción incluye Caja; los demás profesionales pueden recibir permisos adicionales.</p></div>
    <div className="space-y-4 rounded-2xl border bg-card p-4 sm:p-5"><div className="grid gap-4 sm:grid-cols-[1fr_220px]"><label className="space-y-1.5 text-sm font-semibold">Buscar integrante<div className="relative"><Search aria-hidden="true" className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-muted-foreground" /><Input className="pl-10" placeholder="Nombre, correo o teléfono" value={query} onChange={e => setQuery(e.target.value)} /></div></label><label className="space-y-1.5 text-sm font-semibold">Perfil del equipo<select value={role} onChange={e => setRole(e.target.value)} className="h-11 w-full rounded-xl border border-input bg-background px-3 font-normal"><option value="all">Todos los perfiles</option>{TEAM_ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}</select></label></div><div role="group" aria-label="Estado del equipo" className="flex flex-wrap gap-2">{[{ key: "active", label: "Activos" }, { key: "inactive", label: "Inactivos" }, { key: "all", label: "Todo el equipo" }].map(filter => <Button key={filter.key} variant={status === filter.key ? "default" : "outline"} aria-pressed={status === filter.key} disabled={loading || !!loadError} onClick={() => setStatus(filter.key)}>{filter.label} {counts[filter.key as keyof typeof counts]}</Button>)}</div></div>
    {loadError ? <div role="alert" className="space-y-3 rounded-xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-950"><p className="font-semibold">No se pudo cargar el equipo</p><p>{loadError}</p><Button variant="outline" onClick={() => setReloadKey(key => key + 1)}>Reintentar</Button></div> : loading ? <p role="status" className="p-6 text-sm text-muted-foreground">Cargando equipo…</p> : visible.length === 0 ? <div className="rounded-2xl border bg-card p-8 text-center"><UserRound aria-hidden="true" className="mx-auto mb-3 h-7 w-7 text-primary" /><h3 className="font-semibold">{members.length ? "Sin integrantes con estos filtros" : "Agrega a tu primer integrante"}</h3><p className="mt-2 text-sm text-muted-foreground">{members.length ? "Prueba otro nombre, perfil o estado." : "Crea su ficha y configura el perfil, el horario y el acceso que necesita."}</p>{members.length > 0 && <Button className="mt-4" variant="outline" onClick={() => { setQuery(""); setRole("all"); setStatus("all"); }}>Limpiar filtros</Button>}</div> : TEAM_ROLES.map(group => {
      const items = visible.filter(m => m.role === group.value); if (!items.length) return null;
      return <section key={group.value} className="overflow-hidden rounded-2xl border bg-card" aria-label={group.label}><header className="flex flex-wrap items-center justify-between gap-2 border-b p-4 sm:px-5"><h3 className="font-semibold">{group.label}</h3><span className="text-sm text-muted-foreground">{items.length} {items.length === 1 ? "integrante" : "integrantes"}</span></header><ul className="divide-y">{items.map(member => {
        const area = member.role === "vet" ? "veterinary" : member.role === "groomer" ? "grooming" : null, areaOff = !!area && !!profile && !profile.activeModules?.includes(area);
        return <li key={member.id} className="space-y-4 p-4 sm:px-5"><div className="flex items-start gap-3"><span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 font-semibold text-primary" aria-hidden="true">{member.name.trim().split(/\s+/).slice(0,2).map(part => part[0]).join("")}</span><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h4 className="break-words font-semibold">{member.name}</h4>{!member.active && <Badge variant="secondary">Inactivo</Badge>}{areaOff && <Badge variant="secondary">Área deshabilitada</Badge>}</div><p className="mt-1 break-all text-sm text-muted-foreground">{member.email || "Sin correo de contacto"}{member.phone ? ` · ${member.phone}` : ""}</p><p className="mt-1 break-all text-sm text-primary">{accessLabel(member)}{member.active && member.credential?.active && !usesAdminAccess(member) ? `: ${member.credential.email}` : ""}</p><p className="mt-1 text-xs text-muted-foreground">{member.availability ? "Horario semanal personalizado" : "Sin restricción semanal individual"}</p></div></div><div className="flex flex-wrap gap-2"><Button variant="outline" size="sm" onClick={() => setPanel({ kind: "edit", member })}><Pencil aria-hidden="true" />Editar ficha</Button><Button variant="outline" size="sm" onClick={() => setPanel({ kind: "permissions", member })}><ShieldCheck aria-hidden="true" />Perfil y permisos</Button>{["vet", "groomer", "admin"].includes(member.role) && <Button variant="outline" size="sm" onClick={() => setPanel({ kind: "services", member })}>Servicios que atiende</Button>}<Button variant="outline" size="sm" onClick={() => setPanel({ kind: "schedule", member })}><CalendarClock aria-hidden="true" />Horario</Button><Button variant="outline" size="sm" onClick={() => setPanel({ kind: "availability", member })}><CalendarClock aria-hidden="true" />Ausencias y citas</Button>{!usesAdminAccess(member) && <Button variant="outline" size="sm" onClick={() => setPanel({ kind: "access", member })}><KeyRound aria-hidden="true" />Acceso</Button>}<Button variant="ghost" size="sm" disabled={saving} onClick={() => { setActionError(""); setConfirmation({ kind: "active", member }); }}>{member.active ? "Desactivar" : "Activar"}</Button></div></li>;
      })}</ul></section>;
    })}
    <Dialog open={panel !== null} onOpenChange={open => { if (!open) close(); }}><DialogContent className="flex max-h-[90dvh] w-[calc(100%-2rem)] max-w-3xl flex-col overflow-hidden" showClose={!saving}><DialogHeader className="pr-14"><DialogTitle>{title}</DialogTitle><DialogDescription>{panel?.kind === "new" ? "Crea la ficha antes de habilitar una cuenta de ingreso." : "Los cambios se aplican al integrante de este establecimiento."}</DialogDescription></DialogHeader><div className="overflow-y-auto p-5 sm:p-6">
      {panel?.kind === "new" && <MemberEditor key="new" {...signals} onSaved={saved} />}
      {panel?.kind === "services" && <TeamServicesEditor key={panel.member.id + "services"} {...signals} member={panel.member} onSaved={saved} />}
      {panel?.kind === "availability" && <TeamAvailability key={panel.member.id} {...signals} member={panel.member} />}
      {panel?.kind === "schedule" && <div className="mb-5"><TeamAvailability key={`preview-${panel.member.id}`} member={panel.member} preview /></div>}
      {panel?.kind === "edit" && <MemberEditor key={panel.member.id + "edit"} {...signals} member={panel.member} onSaved={saved} />}
      {panel?.kind === "schedule" && <StaffScheduleEditor key={panel.member.id + "schedule"} {...signals} member={panel.member} businessHours={profile?.businessHours} onSaved={saved} />}
      {panel?.kind === "access" && <StaffAccessEditor key={panel.member.id + "access"} {...signals} member={panel.member} onSaved={saved} onRevoke={() => { setActionError(""); setConfirmation({ kind: "revoke", member: panel.member }); }} />}
      {panel?.kind === "permissions" && <div className="space-y-4"><p className="text-sm text-muted-foreground">{TEAM_ROLES.find(r => r.value === panel.member.role)?.description}</p><p className="text-sm">Áreas habilitadas: {(profile?.activeModules ?? []).map(module => ({ veterinary: "Veterinaria", grooming: "Peluquería", retail: "Tienda" })[module as "veterinary" | "grooming" | "retail"]).join(", ") || "Sin áreas operativas"}.</p><TeamPermissions key={panel.member.id} {...signals} member={panel.member} activeModules={profile?.activeModules} onSaved={async permissions => { saved({ ...panel.member, accessPermissions: permissions }); }} /></div>}
    </div><DialogFooter className="flex-wrap"><p role="status" className="mr-auto text-xs text-muted-foreground">{saving ? "Guardando…" : dirty ? "Tienes cambios sin guardar." : ""}</p><Button variant="outline" disabled={saving} onClick={close}>Cerrar</Button>{panel?.kind === "schedule" && <Button type="submit" form={`staff-schedule-${panel.member.id}`} disabled={saving || !canSaveSchedule}>{saving ? "Guardando…" : "Guardar horario"}</Button>}</DialogFooter></DialogContent></Dialog>
    <Dialog open={confirmation !== null} onOpenChange={open => { if (!open && !saving) setConfirmation(null); }}>
      <DialogContent className="w-[calc(100%-2rem)] max-w-md" showClose={!saving}>
        <DialogHeader>
          <DialogTitle>{confirmation?.kind === "close" ? "Cambios sin guardar" : confirmation?.kind === "revoke" ? "Revocar acceso" : confirmation?.member.active ? "Desactivar integrante" : confirmation ? "Activar integrante" : "Confirmar acción"}</DialogTitle>
          <DialogDescription>{confirmation?.kind === "close" ? "Puedes volver a editar o descartar este borrador." : confirmation?.kind === "revoke" ? `Se bloqueará el ingreso individual de ${confirmation.member.name}. Su ficha y su historial se conservan.` : confirmation?.member.active ? `${confirmation.member.name} dejará de aparecer como integrante activo. Sus citas y registros se conservan. ${usesAdminAccess(confirmation.member) ? "Tu cuenta administradora conserva su acceso." : "Su ingreso individual quedará bloqueado."}` : confirmation ? `Se activará a ${confirmation.member.name}. Si conserva una cuenta habilitada podrá volver a ingresar.` : ""}</DialogDescription>
        </DialogHeader>
        {actionError && <p role="alert" className="px-6 text-sm text-red-800">{actionError}</p>}
        <DialogFooter className="flex-wrap">
          <Button variant="outline" disabled={saving} onClick={() => setConfirmation(null)}>{confirmation?.kind === "close" ? "Seguir editando" : "Cancelar"}</Button>
          <Button variant={confirmation?.kind === "close" || confirmation?.kind === "revoke" || (confirmation?.kind === "active" && confirmation.member.active) ? "destructive" : "default"} disabled={saving} onClick={() => { if (confirmation?.kind === "close") { setConfirmation(null); setPanel(null); setDirty(false); } else void confirmAction(); }}>{saving ? "Guardando…" : confirmation?.kind === "close" ? "Descartar cambios" : confirmation?.kind === "revoke" ? "Revocar acceso" : confirmation?.member.active ? "Desactivar integrante" : "Activar integrante"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </section>;
}
