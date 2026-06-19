"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
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
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Nuevo cliente</SheetTitle>
          <SheetDescription>
            Registra un cliente manualmente. Normalmente se registran solos por WhatsApp.
          </SheetDescription>
        </SheetHeader>

        <form onSubmit={handleSubmit} className="space-y-4 px-4 pb-6">
          <div className="space-y-1.5">
            <label htmlFor="nc-phone" className="text-sm font-medium">Teléfono *</label>
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
            <label htmlFor="nc-name" className="text-sm font-medium">Nombre</label>
            <Input id="nc-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Nombre del cliente" />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="nc-email" className="text-sm font-medium">Email</label>
            <Input id="nc-email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="opcional" type="email" />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="nc-notes" className="text-sm font-medium">Notas</label>
            <Input id="nc-notes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="opcional" />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
              Cancelar
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Guardando…" : "Crear cliente"}
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}
