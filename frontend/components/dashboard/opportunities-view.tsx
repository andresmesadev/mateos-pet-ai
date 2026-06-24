"use client";

import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/dashboard/empty-state";
import { proxyUrl } from "@/lib/api";
import { getPetEmoji, NEXT_ACTION_TYPES } from "@/lib/pets";
import { type OpportunitiesData } from "@/app/dashboard/opportunities/page";

// ── helpers ──────────────────────────────────────────────────

function whatsappUrl(phone: string, message: string): string {
  const digits = phone.replace(/\D/g, "");
  const e164 = digits.startsWith("57") ? digits : `57${digits}`;
  return `https://wa.me/${e164}?text=${encodeURIComponent(message)}`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("es-CO", {
    timeZone: "America/Bogota",
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

// ── Action row ────────────────────────────────────────────────

type ActionEntry = {
  actionId: string;
  petId: string;
  petName: string;
  petType: string;
  ownerName: string | null;
  ownerPhone: string | null;
  dueAt: string;
  notes: string | null;
  isOverdue: boolean;
};

function actionWhatsApp(entry: ActionEntry, typeLabel: string): string {
  const pet = entry.petName;
  const owner = entry.ownerName ?? "cliente";
  return `Hola ${owner}, te recordamos que ${pet} tiene pendiente un ${typeLabel.toLowerCase()}. ¿Cuándo te queda bien?`;
}

function ActionRow({
  entry,
  typeLabel,
  onDismiss,
}: {
  entry: ActionEntry;
  typeLabel: string;
  onDismiss: (id: string) => void;
}) {
  const [dismissing, setDismissing] = useState(false);

  async function handleDismiss() {
    setDismissing(true);
    try {
      await fetch(proxyUrl(`/api/dashboard/medical-records/${entry.actionId}/dismiss`), {
        method: "PATCH",
      });
      onDismiss(entry.actionId);
    } catch {
      setDismissing(false);
    }
  }

  return (
    <li className={`flex flex-wrap items-center gap-3 py-3 text-sm border-l-2 pl-3 -ml-px transition-colors hover:bg-muted/30 ${entry.isOverdue ? "border-l-red-500/60" : "border-l-transparent"}`}>
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted/60 text-base">
        {getPetEmoji(entry.petType)}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-medium">{entry.petName}</span>
          {entry.ownerName && (
            <span className="text-muted-foreground text-xs">· {entry.ownerName}</span>
          )}
          {entry.isOverdue && (
            <span className="rounded-full bg-red-500/10 px-2 py-0.5 text-[11px] font-medium text-red-400">Vencido</span>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-0.5">
          <span className={`text-xs ${entry.isOverdue ? "text-red-400 font-medium" : "text-muted-foreground"}`}>
            {formatDate(entry.dueAt)}
          </span>
          {entry.notes && (
            <span className="text-xs text-muted-foreground">· {entry.notes}</span>
          )}
        </div>
      </div>
      <div className="flex gap-1.5 shrink-0">
        {entry.ownerPhone && (
          <Button asChild size="sm" variant="outline" className="h-7 px-2.5 text-xs gap-1.5 text-green-700 border-green-200 hover:bg-green-50 dark:text-green-400 dark:border-green-900 dark:hover:bg-green-950">
            <a
              href={whatsappUrl(entry.ownerPhone, actionWhatsApp(entry, typeLabel))}
              target="_blank"
              rel="noopener noreferrer"
            >
              💬 WhatsApp
            </a>
          </Button>
        )}
        <Button
          size="sm"
          variant="ghost"
          className="h-7 px-2 text-xs text-muted-foreground"
          disabled={dismissing}
          onClick={handleDismiss}
        >
          Descartar
        </Button>
      </div>
    </li>
  );
}

// ── Bulk send state ───────────────────────────────────────────

type BulkState = "idle" | "sending" | "done" | "error";

// ── Section per action type ───────────────────────────────────

function ActionSection({
  type,
  entries: initial,
}: {
  type: string;
  entries: ActionEntry[];
}) {
  const [entries, setEntries] = useState(initial);
  const [bulkState, setBulkState] = useState<BulkState>("idle");
  const [bulkResult, setBulkResult] = useState<{ sent: number; noPhone: number } | null>(null);

  const meta = NEXT_ACTION_TYPES.find((t) => t.value === type);
  const icon = meta?.icon ?? "📋";
  const label = meta?.label ?? type;

  const overdueCount = entries.filter((e) => e.isOverdue).length;
  const withPhone = entries.filter((e) => e.ownerPhone).length;

  async function handleBulkSend() {
    if (!window.confirm(`¿Enviar recordatorio WhatsApp a ${withPhone} contacto${withPhone === 1 ? "" : "s"} con acciones de tipo "${label}"?`)) return;
    setBulkState("sending");
    setBulkResult(null);
    try {
      const res = await fetch(proxyUrl("/api/dashboard/campaigns/next-actions"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Error al enviar");
      setBulkResult({ sent: data.sent, noPhone: data.noPhone });
      setBulkState("done");
    } catch {
      setBulkState("error");
    }
  }

  if (entries.length === 0) return null;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 flex-wrap text-base">
          <span className="flex items-center gap-2">
            {icon} {label}
            <Badge variant="outline" className="ml-1">
              {entries.length}
            </Badge>
            {overdueCount > 0 && (
              <Badge className="border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-400">
                {overdueCount} vencida{overdueCount === 1 ? "" : "s"}
              </Badge>
            )}
          </span>
          <span className="ml-auto flex items-center gap-2">
            {bulkState === "done" && bulkResult && (
              <span className="text-xs font-normal text-green-700 dark:text-green-400">
                ✓ {bulkResult.sent} enviado{bulkResult.sent === 1 ? "" : "s"}
                {bulkResult.noPhone > 0 && `, ${bulkResult.noPhone} sin teléfono`}
              </span>
            )}
            {bulkState === "error" && (
              <span className="text-xs font-normal text-destructive">Error al enviar</span>
            )}
            {withPhone > 0 && bulkState !== "done" && (
              <Button
                size="sm"
                variant="outline"
                className="h-7 px-2.5 text-xs gap-1"
                disabled={bulkState === "sending"}
                onClick={handleBulkSend}
              >
                {bulkState === "sending" ? "Enviando…" : `📤 Enviar a todos (${withPhone})`}
              </Button>
            )}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="divide-y">
          {entries.map((e) => (
            <ActionRow
              key={e.actionId}
              entry={e}
              typeLabel={label}
              onDismiss={(id) => setEntries((prev) => prev.filter((x) => x.actionId !== id))}
            />
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

// ── Main view ─────────────────────────────────────────────────

const TYPE_ORDER = ["control", "vaccine", "treatment", "exam", "grooming", "other"];

export function OpportunitiesView({ data }: { data: OpportunitiesData }) {
  const shown = Object.values(data.byType).reduce((s, arr) => s + arr.length, 0);
  const total = data.total ?? shown;

  if (total === 0) {
    return (
      <EmptyState
        icon="🎉"
        title="Sin acciones pendientes"
        description="El agente no ha detectado recordatorios pendientes todavía."
      />
    );
  }

  const orderedTypes = [
    ...TYPE_ORDER.filter((t) => data.byType[t]?.length),
    ...Object.keys(data.byType).filter((t) => !TYPE_ORDER.includes(t) && data.byType[t]?.length),
  ];

  return (
    <div className="space-y-4">
      {total > shown && (
        <p className="text-xs text-muted-foreground">
          Mostrando las <strong>{shown}</strong> acciones más urgentes de <strong>{total}</strong> en total.
        </p>
      )}
      {orderedTypes.map((type) => (
        <ActionSection key={type} type={type} entries={data.byType[type] ?? []} />
      ))}
    </div>
  );
}
