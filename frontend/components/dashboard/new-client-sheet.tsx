"use client";

import { useState } from "react";
import { UserPlus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";
import { proxyUrl } from "@/lib/api";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
};

export function NewClientSheet({ open, onOpenChange, onCreated }: Props) {
  const { toast } = useToast();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  function reset() {
    setName("");
    setPhone("");
    setEmail("");
    setNotes("");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!phone.trim()) {
      toast("El teléfono es requerido.", "error");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(proxyUrl("/api/dashboard/clients"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, phone, email, notes }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "No se pudo crear el cliente");
      }
      toast("Cliente creado.", "success");
      reset();
      onOpenChange(false);
      onCreated();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Error al crear cliente", "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!saving) onOpenChange(v); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="mb-1 flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-500/15 ring-1 ring-violet-500/25">
              <UserPlus className="h-4 w-4 text-violet-400" />
            </div>
            <div>
              <DialogTitle>Nuevo cliente</DialogTitle>
              <DialogDescription>
                Normalmente se registran solos por WhatsApp.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form id="new-client-form" onSubmit={handleSubmit}>
          <div className="space-y-4 px-6 py-5">
            <div className="space-y-1.5">
              <label htmlFor="nc-phone" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Teléfono *
              </label>
              <Input
                id="nc-phone"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="573001234567"
                inputMode="tel"
                autoFocus
              />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="nc-name" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Nombre
              </label>
              <Input
                id="nc-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Nombre completo"
              />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="nc-email" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Email
              </label>
              <Input
                id="nc-email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="email@ejemplo.com"
                type="email"
              />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="nc-notes" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Notas
              </label>
              <Input
                id="nc-notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Observaciones opcionales"
              />
            </div>
          </div>
        </form>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button type="submit" form="new-client-form" disabled={saving}>
            {saving ? "Guardando…" : "Crear cliente"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
