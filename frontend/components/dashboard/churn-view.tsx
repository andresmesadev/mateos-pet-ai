"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { CustomerFollowupActions } from "@/components/dashboard/customer-followup-actions";
import type { ChurnClient } from "@/lib/customer-followup";
const LEVELS = { high: "Prioridad alta", medium: "Prioridad media", low: "Prioridad baja" };
export function ChurnView({ clients }: { clients: ChurnClient[] }) {
  const [level, setLevel] = useState("all"); const [search, setSearch] = useState("");
  const visible = clients.filter(c => (level === "all" || c.riskLevel === level) && `${c.name} ${c.petName}`.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()));
  return <section className="overflow-hidden rounded-2xl border bg-white shadow-sm"><div className="space-y-4 border-b p-6"><h3 className="font-semibold">Clientes que tardan más de lo habitual en volver</h3><p className="text-sm text-muted-foreground">Estimación según al menos dos registros de peluquería del último año. Se muestran hasta 50 clientes; no es un diagnóstico ni una predicción de abandono.</p><label className="block space-y-1 text-sm font-medium">Buscar cliente o mascota<Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Nombre del cliente o mascota" /></label><div className="flex flex-wrap gap-2">{["all", "high", "medium", "low"].map(l => <Button key={l} size="sm" variant={level === l ? "default" : "outline"} aria-pressed={level === l} onClick={() => setLevel(l)}>{l === "all" ? "Todos" : LEVELS[l as keyof typeof LEVELS]}</Button>)}</div></div><ul className="divide-y">{visible.map(c => <li key={c.id} className="space-y-3 p-6"><div className="flex flex-wrap items-center gap-2"><h4 className="font-semibold">{c.name}</h4><Badge variant="outline">{LEVELS[c.riskLevel]}</Badge></div><p className="text-sm">{c.petName}</p><p className="text-sm text-muted-foreground">Última visita hace {c.lastVisitDays} días · Frecuencia media: {c.avgIntervalDays} días · {c.totalVisits} registros</p><p className="text-sm text-amber-800">Ha transcurrido {c.overdueRatio} veces su intervalo habitual.</p><CustomerFollowupActions ownerId={c.id} category="grooming" /></li>)}</ul>{!visible.length && <div className="p-10 text-center"><h4 className="font-semibold">No hay clientes para este criterio</h4><p className="mt-2 text-sm text-muted-foreground">Revisa los filtros o registra las visitas para disponer de una frecuencia histórica.</p></div>}</section>;
}
