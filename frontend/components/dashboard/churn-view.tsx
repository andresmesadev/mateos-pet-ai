"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { type ChurnClient } from "@/app/dashboard/churn/page";

const RISK_CONFIG = {
  high: {
    label: "Riesgo alto",
    badgeClass: "border-red-300 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-400",
    barClass: "bg-red-500",
  },
  medium: {
    label: "Riesgo medio",
    badgeClass: "border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-400",
    barClass: "bg-amber-500",
  },
  low: {
    label: "Riesgo bajo",
    badgeClass: "border-yellow-300 bg-yellow-50 text-yellow-700 dark:border-yellow-800 dark:bg-yellow-950 dark:text-yellow-400",
    barClass: "bg-yellow-500",
  },
};

function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.startsWith("57") && digits.length >= 11) return digits;
  return `57${digits}`;
}

function buildWhatsAppUrl(phone: string, name: string, petName: string, daysSinceLast: number): string {
  const e164 = normalizePhone(phone);
  const msg = `¡Hola ${name}! 👋 En Mateos Pet queremos saber cómo está ${petName} — hace ${daysSinceLast} días no los vemos. ¿Podemos ayudarles con algo? Agenda tu cita con nuestro asistente.`;
  return `https://wa.me/${e164}?text=${encodeURIComponent(msg)}`;
}

function ChurnRow({ client }: { client: ChurnClient }) {
  const cfg = RISK_CONFIG[client.riskLevel];
  const barWidth = Math.min(100, (client.overdueRatio / 3) * 100);

  return (
    <li className="flex items-center gap-4 px-4 py-3 hover:bg-muted/40 transition-colors">
      <div className="flex-1 min-w-0 space-y-1">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-medium text-sm">{client.name}</span>
          <span className="text-xs text-muted-foreground">· {client.petName}</span>
          <Badge variant="outline" className={`text-xs ${cfg.badgeClass}`}>{cfg.label}</Badge>
        </div>
        <div className="text-xs text-muted-foreground">
          Última visita hace <strong>{client.lastVisitDays} días</strong>
          {" · "}promedio cada <strong>{client.avgIntervalDays} días</strong>
          {" · "}{client.totalVisits} visitas históricas
        </div>
        {/* Barra de riesgo */}
        <div className="h-1.5 rounded-full bg-muted overflow-hidden w-48">
          <div
            className={`h-full rounded-full transition-all ${cfg.barClass}`}
            style={{ width: `${barWidth}%` }}
          />
        </div>
        <div className="text-xs text-muted-foreground">
          {client.overdueRatio}× su ciclo habitual
        </div>
      </div>
      <a
        href={buildWhatsAppUrl(client.phone, client.name, client.petName, client.lastVisitDays)}
        target="_blank"
        rel="noopener noreferrer"
        className="shrink-0"
      >
        <Button size="sm" variant="outline" className="h-8 text-xs gap-1.5 text-green-700 border-green-300 hover:bg-green-50 dark:text-green-400 dark:border-green-800 dark:hover:bg-green-950">
          <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 fill-current" xmlns="http://www.w3.org/2000/svg">
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
          </svg>
          Contactar
        </Button>
      </a>
    </li>
  );
}

const RISK_ORDER: ChurnClient["riskLevel"][] = ["high", "medium", "low"];
const SECTION_LABELS: Record<ChurnClient["riskLevel"], string> = {
  high: "Riesgo alto — llevan más del doble de su ciclo habitual sin visitar",
  medium: "Riesgo medio — llevan 1.3× su ciclo habitual sin visitar",
  low: "Riesgo bajo — acaban de pasar su ventana de visita",
};

export function ChurnView({ clients }: { clients: ChurnClient[] }) {
  const [filter, setFilter] = useState<ChurnClient["riskLevel"] | "all">("all");

  const visible = filter === "all" ? clients : clients.filter((c) => c.riskLevel === filter);

  return (
    <div className="space-y-4">
      {/* Filtro rápido */}
      <div className="flex gap-2 flex-wrap">
        {(["all", "high", "medium", "low"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`rounded-full px-3 py-1 text-xs font-medium border transition-colors
              ${filter === f
                ? "bg-foreground text-background border-foreground"
                : "border-input hover:bg-muted/50"}`}
          >
            {f === "all" ? `Todos (${clients.length})` : `${RISK_CONFIG[f].label} (${clients.filter((c) => c.riskLevel === f).length})`}
          </button>
        ))}
      </div>

      {/* Lista agrupada por riesgo cuando filtro = all */}
      {filter === "all" ? (
        RISK_ORDER.map((level) => {
          const group = clients.filter((c) => c.riskLevel === level);
          if (!group.length) return null;
          return (
            <div key={level} className="rounded-lg border overflow-hidden">
              <div className={`px-4 py-2 text-xs font-medium ${RISK_CONFIG[level].badgeClass}`}>
                {SECTION_LABELS[level]}
              </div>
              <ul className="divide-y">
                {group.map((c) => <ChurnRow key={c.id} client={c} />)}
              </ul>
            </div>
          );
        })
      ) : (
        <div className="rounded-lg border overflow-hidden">
          <ul className="divide-y">
            {visible.map((c) => <ChurnRow key={c.id} client={c} />)}
          </ul>
          {visible.length === 0 && (
            <p className="px-4 py-6 text-center text-sm text-muted-foreground">No hay clientes en esta categoría.</p>
          )}
        </div>
      )}
    </div>
  );
}
