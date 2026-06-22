"use client";

import { useRef, useState } from "react";
import { Upload, FileText, CheckCircle2, AlertCircle, RefreshCcw, Users, PawPrint, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { proxyUrl } from "@/lib/api";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";

// ── Tipos ───────────────────────────────────────────────────────────────────────

type RawPet = {
  name: string;
  breed: string;
  price: string;
  last_visit: string;
  visit_history: string;
};

type RawContact = {
  owner_name: string;
  phone: string;
  phones_alt: string;
  address: string;
  notes: string;
  pets: RawPet[];
};

type ImportSummaryFull = {
  ownersCreated: number;
  ownersUpdated: number;
  petsCreated: number;
  recordsCreated: number;
  invalid: number;
  errors: { name: string; reason: string }[];
};

// ── Parser CSV ──────────────────────────────────────────────────────────────────

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') { inQuotes = !inQuotes; continue; }
    if (ch === "," && !inQuotes) { result.push(current.trim()); current = ""; continue; }
    current += ch;
  }
  result.push(current.trim());
  return result;
}

function colIdx(headers: string[], name: string): number {
  return headers.findIndex((h) => h.toLowerCase().trim() === name.toLowerCase());
}

function parseFullCSV(text: string): RawContact[] {
  // Strip UTF-8 BOM if present
  const clean = text.startsWith("﻿") ? text.slice(1) : text;
  const lines = clean.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return [];

  const headers = parseCSVLine(lines[0]);

  // Solo acepta el formato completo de Mateos (tiene columna pet_1_name)
  const isFullFormat = headers.some((h) => h.toLowerCase().trim() === "pet_1_name");
  if (!isFullFormat) return [];

  const i = {
    owner_name: colIdx(headers, "owner_name"),
    phone:      colIdx(headers, "phone"),
    phones_alt: colIdx(headers, "phones_alt"),
    address:    colIdx(headers, "address"),
    notes:      colIdx(headers, "notes"),
  };

  // Índices de mascotas (hasta 5)
  const petCols = Array.from({ length: 5 }, (_, n) => ({
    name:          colIdx(headers, `pet_${n + 1}_name`),
    breed:         colIdx(headers, `pet_${n + 1}_breed`),
    price:         colIdx(headers, `pet_${n + 1}_price`),
    last_visit:    colIdx(headers, `pet_${n + 1}_last_visit`),
    visit_history: colIdx(headers, `pet_${n + 1}_visit_history`),
  }));

  return lines.slice(1).map((line) => {
    const cols = parseCSVLine(line);
    const get = (idx: number) => (idx !== -1 ? (cols[idx] ?? "") : "");

    const pets: RawPet[] = petCols
      .map((pc) => ({
        name:          get(pc.name),
        breed:         get(pc.breed),
        price:         get(pc.price),
        last_visit:    get(pc.last_visit),
        visit_history: get(pc.visit_history),
      }))
      .filter((p) => p.name.trim() !== "");

    return {
      owner_name: get(i.owner_name),
      phone:      get(i.phone),
      phones_alt: get(i.phones_alt),
      address:    get(i.address),
      notes:      get(i.notes),
      pets,
    };
  }).filter((c) => c.owner_name.trim() || c.phone.trim() || c.pets.length > 0);
}

// ── Componente ──────────────────────────────────────────────────────────────────

export function ContactsImporter() {
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);

  const [contacts, setContacts]   = useState<RawContact[]>([]);
  const [fileName, setFileName]   = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [summary, setSummary]     = useState<ImportSummaryFull | null>(null);
  const [dragOver, setDragOver]   = useState(false);

  function handleFile(file: File) {
    if (!file.name.endsWith(".csv")) {
      toast("Solo se aceptan archivos .csv", "error");
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const parsed = parseFullCSV(text);
      if (parsed.length === 0) {
        toast("No se detectó el formato de Mateos Pet (columnas pet_1_name requeridas). Verifica que el archivo sea el exportado por Claude AI.", "error");
        return;
      }
      setContacts(parsed);
      setFileName(file.name);
      setSummary(null);
    };
    reader.readAsText(file, "utf-8");
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }

  async function handleImport() {
    if (!contacts.length) return;
    setImporting(true);
    try {
      const res = await fetch(proxyUrl("/api/dashboard/clients/import/full"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contacts }),
      });
      if (!res.ok) {
        const payload = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(payload.error ?? "Error al importar");
      }
      const data: ImportSummaryFull = await res.json();
      setSummary(data);
      setContacts([]);
      setFileName(null);
    } catch (err) {
      toast(err instanceof Error ? err.message : "Error al importar", "error");
    } finally {
      setImporting(false);
    }
  }

  function reset() {
    setContacts([]);
    setFileName(null);
    setSummary(null);
    if (fileRef.current) fileRef.current.value = "";
  }

  // ── Vista: resultado ────────────────────────────────────────────────────────
  if (summary) {
    return (
      <div className="max-w-xl space-y-4">
        <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-5">
          <div className="mb-4 flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-emerald-400" />
            <p className="font-semibold text-emerald-400">Importación completada</p>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {([
              { label: "Propietarios nuevos",       value: summary.ownersCreated,  color: "text-emerald-400", icon: "👤" },
              { label: "Propietarios actualizados", value: summary.ownersUpdated,  color: "text-sky-400",     icon: "✏️" },
              { label: "Mascotas creadas",          value: summary.petsCreated,    color: "text-violet-400",  icon: "🐾" },
              { label: "Visitas registradas",       value: summary.recordsCreated, color: "text-amber-400",   icon: "📅" },
            ] as const).map(({ label, value, color, icon }) => (
              <div key={label} className="rounded-lg border border-white/[0.06] bg-card p-3 text-center">
                <p className="text-lg">{icon}</p>
                <p className={cn("text-2xl font-bold tabular-nums", color)}>{value}</p>
                <p className="mt-0.5 text-xs text-muted-foreground leading-tight">{label}</p>
              </div>
            ))}
          </div>
          {summary.invalid > 0 && (
            <p className="mt-3 text-xs text-rose-400">{summary.invalid} registros no importados</p>
          )}
        </div>

        {summary.errors.length > 0 && (
          <div className="rounded-xl border border-rose-500/20 bg-rose-500/5 p-4">
            <div className="mb-2 flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-rose-400" />
              <p className="text-sm font-semibold text-rose-400">No importados</p>
            </div>
            <ul className="space-y-1">
              {summary.errors.slice(0, 20).map((e, i) => (
                <li key={i} className="text-xs text-muted-foreground">
                  <span className="font-medium text-foreground">{e.name || "Sin nombre"}</span>
                  {" — "}{e.reason}
                </li>
              ))}
              {summary.errors.length > 20 && (
                <li className="text-xs text-muted-foreground">… y {summary.errors.length - 20} más</li>
              )}
            </ul>
          </div>
        )}

        <Button variant="outline" onClick={reset} className="gap-2">
          <RefreshCcw className="h-4 w-4" /> Importar otro archivo
        </Button>
      </div>
    );
  }

  // ── Vista: preview ──────────────────────────────────────────────────────────
  if (contacts.length > 0) {
    const totalPets   = contacts.reduce((sum, c) => sum + c.pets.length, 0);
    const withVisits  = contacts.reduce((sum, c) => sum + c.pets.filter((p) => p.last_visit || p.visit_history).length, 0);
    const withAddress = contacts.filter((c) => c.address).length;

    return (
      <div className="max-w-xl space-y-4">
        <div className="rounded-xl border border-white/[0.06] bg-card p-4">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-muted-foreground" />
              <p className="text-sm font-medium">{fileName}</p>
            </div>
            <span className="text-xs text-muted-foreground">{contacts.length} propietarios</span>
          </div>

          <div className="mb-3 flex flex-wrap gap-3">
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <PawPrint className="h-3 w-3 text-violet-400" />
              {totalPets} mascotas
            </div>
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Calendar className="h-3 w-3 text-amber-400" />
              {withVisits} con historial de visitas
            </div>
            {withAddress > 0 && (
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                📍 {withAddress} con dirección
              </div>
            )}
          </div>

          <div className="max-h-64 divide-y divide-white/[0.04] overflow-y-auto rounded-lg border border-white/[0.06]">
            {contacts.slice(0, 50).map((c, i) => (
              <div key={i} className="px-3 py-2.5 text-sm">
                <div className="flex items-center gap-2">
                  <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-violet-500/15 text-xs font-bold text-violet-400">
                    {(c.owner_name?.[0] ?? "#").toUpperCase()}
                  </div>
                  <span className="font-medium truncate">{c.owner_name || <span className="italic text-muted-foreground">Sin nombre</span>}</span>
                  <span className="ml-auto text-xs text-muted-foreground shrink-0">{c.phone || "—"}</span>
                </div>
                {c.pets.length > 0 && (
                  <div className="mt-1 ml-8 flex flex-wrap gap-1">
                    {c.pets.map((p, pi) => (
                      <span key={pi} className="inline-flex items-center gap-1 rounded-md bg-amber-500/10 px-1.5 py-0.5 text-xs text-amber-400">
                        🐾 {p.name}{p.breed ? ` · ${p.breed}` : ""}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
            {contacts.length > 50 && (
              <p className="px-3 py-2 text-xs text-muted-foreground">
                … y {contacts.length - 50} propietarios más
              </p>
            )}
          </div>
        </div>

        <div className="flex gap-2">
          <Button onClick={handleImport} disabled={importing} className="gap-2">
            <Users className="h-4 w-4" />
            {importing
              ? "Importando… esto puede tardar unos minutos"
              : `Importar ${contacts.length} propietarios y ${totalPets} mascotas`}
          </Button>
          <Button variant="outline" onClick={reset} disabled={importing}>Cancelar</Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Si el propietario ya existe no se duplica. Las mascotas y visitas nuevas se agregan automáticamente.
        </p>
      </div>
    );
  }

  // ── Vista: drop zone ────────────────────────────────────────────────────────
  return (
    <div className="max-w-xl space-y-4">
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => fileRef.current?.click()}
        className={cn(
          "flex cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed px-6 py-12 transition-all",
          dragOver
            ? "border-primary/60 bg-primary/5"
            : "border-white/[0.1] hover:border-primary/40 hover:bg-accent/20"
        )}
      >
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 ring-1 ring-primary/20">
          <Upload className="h-5 w-5 text-primary" />
        </div>
        <div className="text-center">
          <p className="font-medium">Arrastra el CSV de Mateos Pet aquí</p>
          <p className="mt-0.5 text-sm text-muted-foreground">o haz clic para seleccionar</p>
        </div>
        <span className="rounded border border-white/[0.06] px-2 py-0.5 text-xs text-muted-foreground/60">
          contactos_limpios.csv — formato unificado Outlook + Google
        </span>
      </div>

      <input
        ref={fileRef}
        type="file"
        accept=".csv"
        className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
      />

      <div className="rounded-xl border border-white/[0.06] bg-card p-4 space-y-3">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Qué se importa</p>
        <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
          {[
            { icon: "👤", label: "Nombre del propietario" },
            { icon: "📱", label: "Teléfono WhatsApp" },
            { icon: "📍", label: "Dirección domicilio" },
            { icon: "🐾", label: "Mascotas y razas" },
            { icon: "💰", label: "Precio del servicio" },
            { icon: "📅", label: "Historial de visitas peluquería" },
          ].map(({ icon, label }) => (
            <div key={label} className="flex items-center gap-2">
              <span>{icon}</span>{label}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
