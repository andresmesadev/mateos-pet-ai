"use client";

import { useRef, useState } from "react";
import { Upload, FileText, CheckCircle2, AlertCircle, RefreshCcw, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { proxyUrl } from "@/lib/api";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";

// ── CSV parsers ────────────────────────────────────────────────────────────────

type RawContact = { name: string; phone: string; email: string };

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

function parseCSV(text: string): RawContact[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return [];

  const headers = parseCSVLine(lines[0]);
  const fmt = detectFormat(headers);

  if (fmt === "outlook") {
    const first    = findCol(headers, ["first name"]);
    const last     = findCol(headers, ["last name"]);
    const phoneIdx = findCol(headers, ["mobile phone", "home phone", "business phone", "phone"]);
    const emailIdx = findCol(headers, ["e-mail address", "email address", "email"]);
    return lines.slice(1).map((line) => {
      const cols = parseCSVLine(line);
      const firstName = first  !== -1 ? (cols[first]?.trim()  ?? "") : "";
      const lastName  = last   !== -1 ? (cols[last]?.trim()   ?? "") : "";
      return {
        name:  [firstName, lastName].filter(Boolean).join(" "),
        phone: phoneIdx !== -1 ? (cols[phoneIdx]?.trim() ?? "") : "",
        email: emailIdx !== -1 ? (cols[emailIdx]?.trim() ?? "") : "",
      };
    }).filter((c) => c.name || c.phone);
  }

  if (fmt === "google") {
    const given    = findCol(headers, ["given name"]);
    const family   = findCol(headers, ["family name"]);
    const phoneIdx = findCol(headers, ["phone 1 - value", "mobile", "phone"]);
    const emailIdx = findCol(headers, ["e-mail 1 - value", "email 1 - value", "email"]);
    return lines.slice(1).map((line) => {
      const cols = parseCSVLine(line);
      const g = given  !== -1 ? (cols[given]?.trim()  ?? "") : "";
      const f = family !== -1 ? (cols[family]?.trim() ?? "") : "";
      return {
        name:  [g, f].filter(Boolean).join(" "),
        phone: phoneIdx !== -1 ? (cols[phoneIdx]?.trim() ?? "") : "",
        email: emailIdx !== -1 ? (cols[emailIdx]?.trim() ?? "") : "",
      };
    }).filter((c) => c.name || c.phone);
  }

  // generic
  const nameIdx  = findCol(headers, ["nombre", "name", "cliente", "propietario"]);
  const phoneIdx = findCol(headers, ["telefono", "teléfono", "phone", "celular", "movil", "móvil"]);
  const emailIdx = findCol(headers, ["email", "correo", "e-mail"]);
  return lines.slice(1).map((line) => {
    const cols = parseCSVLine(line);
    return {
      name:  nameIdx  !== -1 ? (cols[nameIdx]?.trim()  ?? "") : "",
      phone: phoneIdx !== -1 ? (cols[phoneIdx]?.trim() ?? "") : "",
      email: emailIdx !== -1 ? (cols[emailIdx]?.trim() ?? "") : "",
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
        toast("No se detectaron contactos en el archivo. Verifica el formato.", "error");
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
          <div className="max-h-52 divide-y divide-white/[0.04] overflow-y-auto rounded-lg border border-white/[0.06]">
            {contacts.slice(0, 50).map((c, i) => (
              <div key={i} className="flex items-center gap-3 px-3 py-2 text-sm">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-violet-500/15 text-xs font-semibold text-violet-400">
                  {(c.name?.[0] ?? "#").toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{c.name || <span className="text-muted-foreground italic">Sin nombre</span>}</p>
                  <p className="truncate text-xs text-muted-foreground">{c.phone || "Sin teléfono"}</p>
                </div>
                {c.email && (
                  <p className="hidden max-w-32 truncate text-xs text-muted-foreground sm:block">{c.email}</p>
                )}
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
          <Button variant="outline" onClick={reset} disabled={importing}>
            Cancelar
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Si el teléfono ya existe no se crea duplicado — solo se actualiza el nombre si estaba vacío.
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

      <div className="rounded-xl border border-white/[0.06] bg-card p-4 text-sm space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Cómo exportar</p>
        <div className="space-y-1.5 text-muted-foreground">
          <p><span className="font-medium text-foreground">Outlook:</span> Personas → Administrar → Exportar contactos → CSV</p>
          <p><span className="font-medium text-foreground">Google:</span> contacts.google.com → Exportar → Google CSV</p>
          <p><span className="font-medium text-foreground">iPhone:</span> icloud.com/contacts → Seleccionar todos → Exportar vCard → convertir a CSV</p>
        </div>
      </div>
    </div>
  );
}
