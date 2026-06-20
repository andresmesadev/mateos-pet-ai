"use client";

import { useRef, useState } from "react";
import { Upload, FileText, CheckCircle2, AlertCircle, RefreshCcw, Users, MapPin, StickyNote } from "lucide-react";
import { Button } from "@/components/ui/button";
import { proxyUrl } from "@/lib/api";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";

// ── CSV parser ─────────────────────────────────────────────────────────────────

type RawContact = { name: string; phone: string; address: string; notes: string };

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

function detectFormat(headers: string[]): "outlook" | "google" | "generic" {
  const h = headers.map((x) => x.toLowerCase());
  if (h.some((x) => x.includes("first name") || x.includes("last name"))) return "outlook";
  if (h.some((x) => x.includes("given name") || x.includes("family name"))) return "google";
  return "generic";
}

function findCol(headers: string[], candidates: string[]): number {
  const h = headers.map((x) => x.toLowerCase().trim());
  for (const c of candidates) {
    const idx = h.findIndex((x) => x.includes(c.toLowerCase()));
    if (idx !== -1) return idx;
  }
  return -1;
}

/** Combina partes de dirección de Outlook en una sola línea. */
function buildAddress(cols: string[], ...idxs: number[]): string {
  return idxs
    .filter((i) => i !== -1)
    .map((i) => cols[i]?.trim() ?? "")
    .filter(Boolean)
    .join(", ");
}

function parseCSV(text: string): RawContact[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return [];

  const headers = parseCSVLine(lines[0]);
  const fmt = detectFormat(headers);

  // ── Outlook ──────────────────────────────────────────────────────────────────
  if (fmt === "outlook") {
    const first      = findCol(headers, ["first name"]);
    const last       = findCol(headers, ["last name"]);
    const phoneIdx   = findCol(headers, ["mobile phone", "home phone", "business phone", "phone"]);
    // dirección: Outlook exporta en columnas separadas
    const streetIdx  = findCol(headers, ["home street", "business street", "other street"]);
    const cityIdx    = findCol(headers, ["home city", "business city", "other city"]);
    const stateIdx   = findCol(headers, ["home state", "business state"]);
    const notesIdx   = findCol(headers, ["notes"]);

    return lines.slice(1).map((line) => {
      const cols = parseCSVLine(line);
      const firstName = first !== -1 ? (cols[first]?.trim() ?? "") : "";
      const lastName  = last  !== -1 ? (cols[last]?.trim()  ?? "") : "";
      return {
        name:    [firstName, lastName].filter(Boolean).join(" "),
        phone:   phoneIdx !== -1 ? (cols[phoneIdx]?.trim() ?? "") : "",
        address: buildAddress(cols, streetIdx, cityIdx, stateIdx),
        notes:   notesIdx !== -1 ? (cols[notesIdx]?.trim() ?? "") : "",
      };
    }).filter((c) => c.name || c.phone);
  }

  // ── Google Contacts ───────────────────────────────────────────────────────────
  if (fmt === "google") {
    const given      = findCol(headers, ["given name"]);
    const family     = findCol(headers, ["family name"]);
    const phoneIdx   = findCol(headers, ["phone 1 - value", "mobile", "phone"]);
    const streetIdx  = findCol(headers, ["address 1 - street", "address 1 - formatted"]);
    const cityIdx    = findCol(headers, ["address 1 - city"]);
    const notesIdx   = findCol(headers, ["notes"]);

    return lines.slice(1).map((line) => {
      const cols = parseCSVLine(line);
      const g = given  !== -1 ? (cols[given]?.trim()  ?? "") : "";
      const f = family !== -1 ? (cols[family]?.trim() ?? "") : "";
      return {
        name:    [g, f].filter(Boolean).join(" "),
        phone:   phoneIdx !== -1 ? (cols[phoneIdx]?.trim() ?? "") : "",
        address: buildAddress(cols, streetIdx, cityIdx),
        notes:   notesIdx !== -1 ? (cols[notesIdx]?.trim() ?? "") : "",
      };
    }).filter((c) => c.name || c.phone);
  }

  // ── Genérico ──────────────────────────────────────────────────────────────────
  const nameIdx    = findCol(headers, ["nombre", "name", "cliente", "propietario"]);
  const phoneIdx   = findCol(headers, ["telefono", "teléfono", "phone", "celular", "movil", "móvil"]);
  const addressIdx = findCol(headers, ["direccion", "dirección", "address", "domicilio"]);
  const notesIdx   = findCol(headers, ["notas", "notes", "observaciones"]);

  return lines.slice(1).map((line) => {
    const cols = parseCSVLine(line);
    return {
      name:    nameIdx    !== -1 ? (cols[nameIdx]?.trim()    ?? "") : "",
      phone:   phoneIdx   !== -1 ? (cols[phoneIdx]?.trim()   ?? "") : "",
      address: addressIdx !== -1 ? (cols[addressIdx]?.trim() ?? "") : "",
      notes:   notesIdx   !== -1 ? (cols[notesIdx]?.trim()   ?? "") : "",
    };
  }).filter((c) => c.name || c.phone);
}

// ── Types ──────────────────────────────────────────────────────────────────────

type ImportResult = {
  name: string;
  phone: string | null;
  status: "created" | "updated" | "invalid";
  reason?: string;
};

type ImportSummary = {
  created: number;
  updated: number;
  invalid: number;
  results: ImportResult[];
};

// ── Component ──────────────────────────────────────────────────────────────────

export function ContactsImporter() {
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);

  const [contacts, setContacts]   = useState<RawContact[]>([]);
  const [fileName, setFileName]   = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [summary, setSummary]     = useState<ImportSummary | null>(null);
  const [dragOver, setDragOver]   = useState(false);

  function handleFile(file: File) {
    if (!file.name.endsWith(".csv")) {
      toast("Solo se aceptan archivos .csv", "error");
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const parsed = parseCSV(text);
      if (parsed.length === 0) {
        toast("No se detectaron contactos. Verifica el formato del archivo.", "error");
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
      const res = await fetch(proxyUrl("/api/dashboard/clients/import"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contacts }),
      });
      if (!res.ok) {
        const payload = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(payload.error ?? "Error al importar");
      }
      const data: ImportSummary = await res.json();
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

  // ── Vista: resultado ───────────────────────────────────────────────────────
  if (summary) {
    return (
      <div className="max-w-xl space-y-4">
        <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-5">
          <div className="mb-3 flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-emerald-400" />
            <p className="font-semibold text-emerald-400">Importación completada</p>
          </div>
          <div className="grid grid-cols-3 gap-3">
            {([
              { label: "Creados",      value: summary.created, color: "text-emerald-400" },
              { label: "Actualizados", value: summary.updated, color: "text-sky-400" },
              { label: "Inválidos",    value: summary.invalid, color: "text-rose-400" },
            ] as const).map(({ label, value, color }) => (
              <div key={label} className="rounded-lg border border-white/[0.06] bg-card p-3 text-center">
                <p className={cn("text-2xl font-bold tabular-nums", color)}>{value}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">{label}</p>
              </div>
            ))}
          </div>
        </div>

        {summary.invalid > 0 && (
          <div className="rounded-xl border border-rose-500/20 bg-rose-500/5 p-4">
            <div className="mb-2 flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-rose-400" />
              <p className="text-sm font-semibold text-rose-400">No importados</p>
            </div>
            <ul className="space-y-1">
              {summary.results.filter((r) => r.status === "invalid").map((r, i) => (
                <li key={i} className="text-xs text-muted-foreground">
                  <span className="font-medium text-foreground">{r.name || "Sin nombre"}</span>
                  {" — "}{r.reason}
                </li>
              ))}
            </ul>
          </div>
        )}

        <Button variant="outline" onClick={reset} className="gap-2">
          <RefreshCcw className="h-4 w-4" /> Importar otro archivo
        </Button>
      </div>
    );
  }

  // ── Vista: preview ─────────────────────────────────────────────────────────
  if (contacts.length > 0) {
    const withAddress = contacts.filter((c) => c.address).length;
    const withNotes   = contacts.filter((c) => c.notes).length;

    return (
      <div className="max-w-xl space-y-4">
        <div className="rounded-xl border border-white/[0.06] bg-card p-4">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-muted-foreground" />
              <p className="text-sm font-medium">{fileName}</p>
            </div>
            <span className="text-xs text-muted-foreground">{contacts.length} contactos</span>
          </div>

          {/* Mini stats */}
          <div className="mb-3 flex gap-3">
            {withAddress > 0 && (
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <MapPin className="h-3 w-3 text-sky-400" />
                {withAddress} con dirección
              </div>
            )}
            {withNotes > 0 && (
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <StickyNote className="h-3 w-3 text-amber-400" />
                {withNotes} con notas
              </div>
            )}
          </div>

          <div className="max-h-56 divide-y divide-white/[0.04] overflow-y-auto rounded-lg border border-white/[0.06]">
            {contacts.slice(0, 50).map((c, i) => (
              <div key={i} className="flex items-start gap-3 px-3 py-2.5 text-sm">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-violet-500/15 text-xs font-semibold text-violet-400 mt-0.5">
                  {(c.name?.[0] ?? "#").toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{c.name || <span className="italic text-muted-foreground">Sin nombre</span>}</p>
                  <p className="truncate text-xs text-muted-foreground">{c.phone || "Sin teléfono"}</p>
                  {c.address && (
                    <p className="truncate text-xs text-sky-400/80 mt-0.5">📍 {c.address}</p>
                  )}
                  {c.notes && (
                    <p className="truncate text-xs text-amber-400/80">📝 {c.notes}</p>
                  )}
                </div>
              </div>
            ))}
            {contacts.length > 50 && (
              <p className="px-3 py-2 text-xs text-muted-foreground">
                … y {contacts.length - 50} contactos más
              </p>
            )}
          </div>
        </div>

        <div className="flex gap-2">
          <Button onClick={handleImport} disabled={importing} className="gap-2">
            <Users className="h-4 w-4" />
            {importing ? "Importando…" : `Importar ${contacts.length} contactos`}
          </Button>
          <Button variant="outline" onClick={reset} disabled={importing}>Cancelar</Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Si el número ya existe no se duplica — solo se completan dirección y notas si estaban vacías.
        </p>
      </div>
    );
  }

  // ── Vista: drop zone ───────────────────────────────────────────────────────
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
          <p className="font-medium">Arrastra tu CSV aquí</p>
          <p className="mt-0.5 text-sm text-muted-foreground">o haz clic para seleccionar</p>
        </div>
        <div className="flex flex-wrap justify-center gap-2 text-xs text-muted-foreground/60">
          <span className="rounded border border-white/[0.06] px-2 py-0.5">Outlook .csv</span>
          <span className="rounded border border-white/[0.06] px-2 py-0.5">Google Contacts .csv</span>
          <span className="rounded border border-white/[0.06] px-2 py-0.5">Genérico .csv</span>
        </div>
      </div>

      <input
        ref={fileRef}
        type="file"
        accept=".csv"
        className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
      />

      <div className="rounded-xl border border-white/[0.06] bg-card p-4 space-y-3 text-sm">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Campos que se importan</p>
        <div className="grid grid-cols-2 gap-2 text-xs">
          {[
            { icon: "👤", label: "Nombre completo" },
            { icon: "📱", label: "Teléfono (WhatsApp)" },
            { icon: "📍", label: "Dirección / Domicilio" },
            { icon: "📝", label: "Notas (historial peluquería)" },
          ].map(({ icon, label }) => (
            <div key={label} className="flex items-center gap-2 text-muted-foreground">
              <span>{icon}</span>{label}
            </div>
          ))}
        </div>
        <div className="border-t border-white/[0.06] pt-3 space-y-1.5 text-muted-foreground text-xs">
          <p className="font-medium text-foreground text-xs uppercase tracking-wider">Cómo exportar</p>
          <p><span className="font-medium text-foreground">Outlook:</span> Personas → Administrar → Exportar contactos → CSV</p>
          <p><span className="font-medium text-foreground">Google:</span> contacts.google.com → Exportar → Google CSV</p>
          <p><span className="font-medium text-foreground">iPhone:</span> icloud.com/contacts → Seleccionar todos → Exportar vCard → convertir a CSV</p>
        </div>
      </div>
    </div>
  );
}
