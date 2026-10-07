"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { Building2, Check, MapPin, Save } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTenant, tenantQuery } from "@/lib/use-tenant";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { proxyUrl } from "@/lib/api";
import { useToast } from "@/components/ui/toast";
import { type TenantProfile } from "@/app/dashboard/settings/page";
import { BusinessHoursSection } from "@/components/dashboard/business-hours-section";

// ── Constants ─────────────────────────────────────────────────

// ── Shared save helper ─────────────────────────────────────────

async function saveTenantProfile(tenant: string | null, data: Record<string, unknown>) {
  return fetch(proxyUrl(`/api/dashboard/tenant/profile${tenantQuery(tenant)}`), {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
}

// ── 1. Información general ────────────────────────────────────

export function GeneralInfoSection({ profile, onDirtyChange, onSavingChange }: { profile: TenantProfile | null; onDirtyChange?: (dirty: boolean) => void; onSavingChange?: (saving: boolean) => void }) {
  const router = useRouter();
  const { toast } = useToast();
  const tenant = useTenant();

  const [fields, setFields] = useState({ name: profile?.name ?? "", phone: profile?.phone ?? "", contactPhone: profile?.contactPhone ?? "", email: profile?.email ?? "", description: profile?.description ?? "", address: profile?.address ?? "" });
  const [saved, setSaved] = useState(fields);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [justSaved, setJustSaved] = useState(false);
  const savingRef = useRef(false);
  const dirty = (Object.keys(fields) as Array<keyof typeof fields>).some((key) => fields[key] !== saved[key]);
  useEffect(() => { onDirtyChange?.(dirty); }, [dirty, onDirtyChange]);
  useEffect(() => { onSavingChange?.(saving); }, [saving, onSavingChange]);

  function change(key: keyof typeof fields, value: string) {
    setFields((previous) => ({ ...previous, [key]: value }));
    setError(null);
    setJustSaved(false);
  }

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (savingRef.current || !dirty) return;
    if (!fields.name.trim()) { setError("Escribe el nombre del negocio."); return; }
    savingRef.current = true;
    setSaving(true);
    setError(null);
    try {
      const res = await saveTenantProfile(tenant, { name: fields.name.trim(), contactPhone: fields.contactPhone.trim() || null, email: fields.email.trim() || null, description: fields.description.trim() || null, address: fields.address.trim() || null });
      const payload = await res.json().catch(() => null) as TenantProfile & { error?: string } | null;
      if (!res.ok) throw new Error(payload?.error ?? "No se pudieron guardar los datos del negocio. Intenta de nuevo.");
      if (!payload?.id) throw new Error("No se pudo confirmar el guardado. Recarga y revisa los datos antes de volver a guardar.");
      const confirmed = { name: payload.name, phone: payload.phone, contactPhone: payload.contactPhone ?? "", email: payload.email ?? "", description: payload.description ?? "", address: payload.address ?? "" };
      setFields(confirmed);
      setSaved(confirmed);
      setJustSaved(true);
      toast("Datos del negocio guardados.", "success");
      router.refresh();
    } catch (err) {
      const message = err instanceof Error ? err.message : "No se pudieron guardar los datos del negocio.";
      setError(message);
      toast(message, "error");
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }

  return (
    <form onSubmit={(event) => void handleSave(event)} className="max-w-4xl overflow-hidden rounded-2xl border border-border bg-card shadow-sm" aria-label="Datos del negocio" aria-busy={saving}>
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-border p-6 sm:p-8">
        <div className="flex items-start gap-3"><div className="rounded-xl bg-teal-50 p-3 text-primary"><Building2 aria-hidden="true" className="h-5 w-5" /></div><div><h2 className="text-xl font-bold">Datos del negocio</h2><p className="mt-1 max-w-lg text-sm text-muted-foreground">Mantén actualizados el nombre, el teléfono, el correo y la dirección de tu establecimiento.</p></div></div>
        <Badge variant="outline" className="capitalize">Plan {profile?.plan ?? "free"}</Badge>
      </div>
      <fieldset disabled={saving} className="min-w-0 space-y-8 p-6 sm:p-8">
        <legend className="sr-only">Información del establecimiento</legend>
        <section aria-labelledby="business-identity" className="space-y-4">
          <div><h3 id="business-identity" className="font-semibold">Identificación del negocio</h3><p className="mt-1 text-sm text-muted-foreground">El nombre con el que tus clientes reconocen el establecimiento.</p></div>
          <div className="space-y-1.5"><label htmlFor="business-name" className="text-sm font-semibold">Nombre del negocio <span className="font-normal text-muted-foreground">(obligatorio)</span></label><Input id="business-name" name="name" autoComplete="organization" required maxLength={160} value={fields.name} onChange={(e) => change("name", e.target.value)} placeholder="Ej. Mateos Pet" /></div>
          <div className="space-y-1.5"><label htmlFor="business-description" className="text-sm font-semibold">Descripción <span className="font-normal text-muted-foreground">(opcional)</span></label><textarea id="business-description" name="description" value={fields.description} onChange={(e) => change("description", e.target.value)} placeholder="Ej. Atención veterinaria, baño y corte para mascotas." rows={3} maxLength={2000} className="w-full resize-y rounded-lg border border-input bg-white px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50" /></div>
        </section>
        <section aria-labelledby="business-contact" className="space-y-4 border-t border-border pt-6">
          <div><h3 id="business-contact" className="font-semibold">Datos de contacto</h3><p className="mt-1 text-sm text-muted-foreground">Dónde pueden comunicarse tus clientes.</p></div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5"><label htmlFor="business-contact-phone" className="text-sm font-semibold">Teléfono de contacto <span className="font-normal text-muted-foreground">(opcional)</span></label><Input id="business-contact-phone" name="contactPhone" type="tel" autoComplete="tel" maxLength={40} value={fields.contactPhone} onChange={(e) => change("contactPhone", e.target.value)} placeholder="Ej. +57 300 123 4567" aria-describedby="business-contact-phone-help" /><p id="business-contact-phone-help" className="text-xs text-muted-foreground">El número donde tus clientes pueden llamar. Incluye el código de país si corresponde. Cambiarlo no modifica la conexión de WhatsApp.</p></div>
            <div className="space-y-1.5"><label htmlFor="business-email" className="text-sm font-semibold">Correo electrónico <span className="font-normal text-muted-foreground">(opcional)</span></label><Input id="business-email" name="email" type="email" autoComplete="email" maxLength={254} value={fields.email} onChange={(e) => change("email", e.target.value)} placeholder="Ej. contacto@tunegocio.com" /></div>
          </div>
          <details className="rounded-lg border border-border bg-muted/20 p-3 text-sm"><summary className="cursor-pointer font-medium text-muted-foreground">Información del canal de WhatsApp</summary><div className="mt-3 space-y-1.5"><label htmlFor="business-channel" className="text-sm font-semibold">Identificador del canal <span className="font-normal text-muted-foreground">(solo lectura)</span></label><Input id="business-channel" readOnly value={fields.phone} className="bg-muted/30" aria-describedby="business-channel-help" /><p id="business-channel-help" className="text-xs text-muted-foreground">Este identificador técnico se usa para recibir mensajes y se conserva al guardar los datos del negocio.</p></div></details>
        </section>
        <section aria-labelledby="business-location" className="space-y-4 border-t border-border pt-6">
          <div className="flex items-center gap-2"><MapPin aria-hidden="true" className="h-4 w-4 text-primary" /><h3 id="business-location" className="font-semibold">Ubicación</h3></div>
          <div className="space-y-1.5"><label htmlFor="business-address" className="text-sm font-semibold">Dirección del establecimiento <span className="font-normal text-muted-foreground">(opcional)</span></label><Input id="business-address" name="address" autoComplete="street-address" maxLength={500} value={fields.address} onChange={(e) => change("address", e.target.value)} placeholder="Ej. Calle 123 # 45-67, Bogotá" /><p className="text-xs text-muted-foreground">Incluye ciudad y las indicaciones necesarias para encontrar el local.</p></div>
        </section>
      </fieldset>
      <div className="border-t border-border bg-muted/20 p-6 sm:px-8">
        {error && <p role="alert" className="mb-4 rounded-lg border border-destructive/20 bg-destructive/5 p-3 text-sm text-destructive">{error}</p>}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <p role="status" className="flex items-center gap-2 text-sm text-muted-foreground">{justSaved && <Check aria-hidden="true" className="h-4 w-4 text-primary" />}{saving ? "Guardando los datos…" : dirty ? "Tienes cambios sin guardar." : justSaved ? "Datos guardados." : "No hay cambios pendientes."}</p>
          <Button type="submit" disabled={saving || !dirty}><Save aria-hidden="true" className="h-4 w-4" />{saving ? "Guardando…" : "Guardar datos del negocio"}</Button>
        </div>
      </div>
    </form>
  );
}

// The catalog has its own editor and pending-change lifecycle.
export { ServiceCatalog as LocationServicesSection } from "@/components/dashboard/service-catalog";

// ── 3. Agenda y disponibilidad ─────────────────────────────────

export { BusinessHoursSection as ScheduleSection } from "@/components/dashboard/business-hours-section";

// ── 4. Perfil fiscal ───────────────────────────────────────────

export function FiscalSection({ profile }: { profile: TenantProfile | null }) {
  return (
    <div className="max-w-xl space-y-4">
      <Card className="border border-black/[0.10] border-t-2 border-t-slate-400/50">
        <CardHeader className="pb-3 border-b border-black/[0.06]"><CardTitle className="text-sm">Datos fiscales</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-lg border border-dashed border-muted-foreground/30 bg-muted/20 p-4 text-center">
            <p className="text-sm font-medium">Perfil fiscal</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Próximamente podrás configurar NIT, régimen IVA y responsabilidades fiscales para facturación electrónica.
            </p>
          </div>
          <div className="space-y-2 text-sm text-muted-foreground">
            <div className="flex justify-between border-b border-black/[0.06] py-1.5">
              <span>Nombre</span><span className="font-medium text-foreground">{profile?.name ?? "—"}</span>
            </div>
            <div className="flex justify-between border-b border-black/[0.06] py-1.5">
              <span>Teléfono</span><span className="font-medium text-foreground">{profile?.phone ?? "—"}</span>
            </div>
            <div className="flex justify-between border-b border-black/[0.06] py-1.5">
              <span>Email</span><span className="font-medium text-foreground">{profile?.email ?? "—"}</span>
            </div>
            <div className="flex justify-between py-1.5">
              <span>Plan</span><span className="font-medium capitalize text-foreground">{profile?.plan ?? "free"}</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ── Legacy export (kept for backward compat) ──────────────────
export { ServiceCatalog as ServicesSection } from "@/components/dashboard/service-catalog";
export function SettingsView({ profile }: { profile: TenantProfile | null }) {
  return <BusinessHoursSection profile={profile} />;
}
