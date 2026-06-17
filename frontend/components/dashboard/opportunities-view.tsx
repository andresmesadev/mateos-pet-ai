"use client";

import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
      await fetch(proxyUrl(`/api/dashboard/next-actions/${entry.actionId}`), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "dismissed" }),
      });
      onDismiss(entry.actionId);
    } catch {
      setDismissing(false);
    }
  }

  return (
    <li className="flex flex-wrap items-center gap-2 py-2.5 text-sm">
      <span className="text-base">{getPetEmoji(entry.petType)}</span>
      <div className="flex-1 min-w-0">
        <span className="font-medium">{entry.petName}</span>
        {entry.ownerName && (
          <span className="text-muted-foreground"> · {entry.ownerName}</span>
        )}
        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-0.5">
          <span className={`text-xs ${entry.isOverdue ? "text-red-500 dark:text-red-400 font-medium" : "text-muted-foreground"}`}>
            {entry.isOverdue ? "⚠️ Venció " : ""}
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

// ── Section per action type ───────────────────────────────────

function ActionSection({
  type,
  entries: initial,
}: {
  type: string;
  entries: ActionEntry[];
}) {
  const [entries, setEntries] = useState(initial);
  const meta = NEXT_ACTION_TYPES.find((t) => t.value === type);
  const icon = meta?.icon ?? "📋";
  const label = meta?.label ?? type;

  const overdueCount = entries.filter((e) => e.isOverdue).length;

  if (entries.length === 0) return null;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          {icon} {label}
          <Badge variant="outline" className="ml-1">
            {entries.length}
          </Badge>
          {overdueCount > 0 && (
            <Badge className="border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-400">
              {overdueCount} vencida{overdueCount === 1 ? "" : "s"}
            </Badge>
          )}
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

// ── Inactive clients section ──────────────────────────────────

type InactiveEntry = {
  ownerId: string;
  ownerName: string | null;
  ownerPhone: string;
  pets: { id: string; name: string; type: string }[];
  lastAppointmentDate: string | null;
  daysSince: number | null;
};

function inactiveWhatsApp(entry: InactiveEntry): string {
  const owner = entry.ownerName ?? "cliente";
  const petNames = entry.pets.map((p) => p.name).join(", ");
  return `Hola ${owner}, te echamos de menos por aquí. ¿Cómo están ${petNames}? ¿Los agendamos pronto?`;
}

function InactiveSection({ entries }: { entries: InactiveEntry[] }) {
  if (entries.length === 0) return null;
  return (
    <Card className="border-2 border-orange-200 dark:border-orange-900">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          😴 Clientes sin cita reciente
          <Badge variant="outline">{entries.length}</Badge>
          <span className="text-xs font-normal text-muted-foreground">+60 días</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="divide-y">
          {entries.map((e) => (
            <li key={e.ownerId} className="flex flex-wrap items-center gap-2 py-2.5 text-sm">
              <div className="flex gap-0.5">
                {e.pets.map((p) => (
                  <span key={p.id}>{getPetEmoji(p.type)}</span>
                ))}
              </div>
              <div className="flex-1 min-w-0">
                <span className="font-medium">{e.ownerName ?? e.ownerPhone}</span>
                <div className="flex gap-x-2 mt-0.5">
                  <span className="text-xs text-muted-foreground">
                    {e.pets.map((p) => p.name).join(", ")}
                  </span>
                  {e.daysSince != null && (
                    <span className="text-xs text-orange-600 dark:text-orange-400">
                      · {e.daysSince} días sin cita
                    </span>
                  )}
                </div>
              </div>
              <Button
                asChild
                size="sm"
                variant="outline"
                className="h-7 px-2.5 text-xs gap-1.5 text-green-700 border-green-200 hover:bg-green-50 dark:text-green-400 dark:border-green-900 dark:hover:bg-green-950 shrink-0"
              >
                <a
                  href={whatsappUrl(e.ownerPhone, inactiveWhatsApp(e))}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  💬 WhatsApp
                </a>
              </Button>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

// ── Main view ─────────────────────────────────────────────────

const TYPE_ORDER = ["control", "vaccine", "treatment", "exam", "grooming", "other"];

export function OpportunitiesView({ data }: { data: OpportunitiesData }) {
  const totalActions = Object.values(data.byType).reduce((s, arr) => s + arr.length, 0);
  const totalInactive = data.inactive.length;
  const total = totalActions + totalInactive;

  if (total === 0) {
    return (
      <div className="rounded-lg border border-dashed px-6 py-16 text-center">
        <p className="text-lg font-medium">¡Todo en orden! 🎉</p>
        <p className="mt-1 text-sm text-muted-foreground">
          No hay acciones pendientes ni clientes inactivos por ahora.
        </p>
      </div>
    );
  }

  // Sort types: defined order first, then any unknown types
  const orderedTypes = [
    ...TYPE_ORDER.filter((t) => data.byType[t]?.length),
    ...Object.keys(data.byType).filter((t) => !TYPE_ORDER.includes(t) && data.byType[t]?.length),
  ];

  return (
    <div className="space-y-4">
      {orderedTypes.map((type) => (
        <ActionSection key={type} type={type} entries={data.byType[type] ?? []} />
      ))}
      <InactiveSection entries={data.inactive} />
    </div>
  );
}
