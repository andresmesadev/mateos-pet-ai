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

export function NewPetSheet({ open, onOpenChange, onCreated }: Props) {
  const { toast } = useToast();
  const [name, setName] = useState("");
  const [type, setType] = useState("dog");
  const [ownerPhone, setOwnerPhone] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [breed, setBreed] = useState("");
  const [saving, setSaving] = useState(false);

  function reset() {
    setName("");
    setType("dog");
    setOwnerPhone("");
    setOwnerName("");
    setBreed("");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      toast("El nombre de la mascota es requerido.", "error");
      return;
    }
    if (!ownerPhone.trim()) {
      toast("El teléfono del dueño es requerido.", "error");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(proxyUrl("/api/dashboard/pets"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, type, ownerPhone, ownerName, breed }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "No se pudo crear la mascota");
      }
      toast("Mascota creada.", "success");
      reset();
      onOpenChange(false);
      onCreated();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Error al crear mascota", "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Nueva mascota</SheetTitle>
          <SheetDescription>
            Si el dueño no existe, se crea automáticamente con su teléfono.
          </SheetDescription>
        </SheetHeader>

        <form onSubmit={handleSubmit} className="space-y-4 px-4 pb-6">
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Nombre de la mascota *</label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej. Max" autoFocus />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Especie *</label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value)}
              className="h-9 w-full rounded-lg border border-input bg-background px-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="dog">Perro</option>
              <option value="cat">Gato</option>
              <option value="other">Otro</option>
            </select>
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Raza</label>
            <Input value={breed} onChange={(e) => setBreed(e.target.value)} placeholder="opcional" />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Teléfono del dueño *</label>
            <Input
              value={ownerPhone}
              onChange={(e) => setOwnerPhone(e.target.value)}
              placeholder="573001234567"
              inputMode="tel"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Nombre del dueño</label>
            <Input
              value={ownerName}
              onChange={(e) => setOwnerName(e.target.value)}
              placeholder="opcional (si es cliente nuevo)"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
              Cancelar
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Guardando…" : "Crear mascota"}
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}
