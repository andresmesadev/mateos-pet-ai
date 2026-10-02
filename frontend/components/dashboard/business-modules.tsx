"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { proxyUrl } from "@/lib/api";
import { tenantQuery, useTenant } from "@/lib/use-tenant";
const MODULES = [
  { id: "veterinary", name: "Veterinaria", detail: "Agenda, consultas e historia clínica." },
  { id: "grooming", name: "Peluquería", detail: "Agenda, baño, corte y notas de cada visita." },
  { id: "retail", name: "Pet shop", detail: "Venta de productos desde Caja." },
];
export function BusinessModules({ initial }: { initial: string[] }) {
  const [selected, setSelected] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const tenant = useTenant(), router = useRouter();
  async function save() {
    setSaving(true); setMessage("");
    try {
      const response = await fetch(proxyUrl("/api/dashboard/tenant/config" + tenantQuery(tenant)), { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ activeModules: selected }) });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "No se pudo guardar");
      setMessage("Áreas del negocio actualizadas."); router.refresh(); window.dispatchEvent(new Event("focus"));
    } catch (error) { setMessage(error instanceof Error ? error.message : "No se pudo guardar"); }
    finally { setSaving(false); }
  }
  return <section className="max-w-3xl space-y-5 rounded-2xl border bg-white p-6">
    <div><h2 className="text-xl font-bold">Áreas de tu negocio</h2><p className="mt-2 text-sm text-muted-foreground">Activa las áreas que ofreces. Caja está disponible para cobrar servicios y, al activar Pet shop, también productos.</p></div>
    <div className="grid gap-3 sm:grid-cols-3">{MODULES.map(module => <label key={module.id} className={"cursor-pointer rounded-xl border p-4 " + (selected.includes(module.id) ? "border-teal-500 bg-teal-50" : "")}>
      <input type="checkbox" disabled={saving} checked={selected.includes(module.id)} onChange={event => setSelected(values => event.target.checked ? [...values, module.id] : values.filter(value => value !== module.id))} className="accent-teal-700" />
      <span className="ml-2 font-semibold">{module.name}</span><p className="mt-2 text-sm text-muted-foreground">{module.detail}</p>
    </label>)}</div>
    <p className="text-sm text-muted-foreground">Al desactivar un área se bloquean nuevas operaciones; sus registros históricos se conservan. Una tienda sola no necesita Agenda.</p>
    {message && <p role="status" className="text-sm">{message}</p>}
    <Button disabled={saving || selected.length === 0} onClick={() => void save()}>{saving ? "Guardando…" : "Guardar áreas"}</Button>
  </section>;
}
