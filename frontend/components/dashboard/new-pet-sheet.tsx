"use client";

import { useEffect, useState } from "react";
import { PawPrint } from "lucide-react";

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
  defaultOwnerPhone?: string;
};

const PET_TYPES = [
  { value: "dog",   label: "🐶 Perro" },
  { value: "cat",   label: "🐱 Gato" },
  { value: "bird",  label: "🐦 Ave" },
  { value: "rabbit",label: "🐰 Conejo" },
  { value: "other", label: "🐾 Otro" },
];

export function NewPetSheet({ open, onOpenChange, onCreated, defaultOwnerPhone }: Props) {
  const { toast } = useToast();
  const [name, setName] = useState("");
  const [type, setType] = useState("dog");
  const [ownerPhone, setOwnerPhone] = useState(defaultOwnerPhone ?? "");
  const [ownerName, setOwnerName] = useState("");

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (open) setOwnerPhone(defaultOwnerPhone ?? "");
  }, [open, defaultOwnerPhone]);
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
    <Dialog open={open} onOpenChange={(v) => { if (!saving) onOpenChange(v); }}>
      <DialogContent className="max-h-[92vh] w-full max-w-xl overflow-y-auto">
        <DialogHeader>
          <div className="mb-1 flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500/15 ring-1 ring-amber-500/25">
              <PawPrint className="h-4 w-4 text-amber-400" />
            </div>
            <div>
              <DialogTitle>Nueva mascota</DialogTitle>
              <DialogDescription>
                Si el dueño no existe se crea automáticamente.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form id="new-pet-form" onSubmit={handleSubmit}>
          <div className="space-y-4 px-6 py-5">
            {/* Nombre */}
            <div className="space-y-1.5">
              <label htmlFor="np-name" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Nombre de la mascota *
              </label>
              <Input
                id="np-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ej. Max"
                autoFocus
              />
            </div>

            {/* Especie */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Especie *
              </label>
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
                {PET_TYPES.map((pt) => (
                  <button
                    key={pt.value}
                    type="button"
                    onClick={() => setType(pt.value)}
                    className={`flex flex-col items-center gap-1 rounded-xl border py-2.5 text-xs font-medium transition-all duration-150 ${
                      type === pt.value
                        ? "border-amber-500/40 bg-amber-500/10 text-amber-300"
                        : "border-white/[0.06] text-muted-foreground hover:border-white/15 hover:bg-accent"
                    }`}
                  >
                    <span className="text-base">{pt.label.split(" ")[0]}</span>
                    <span>{pt.label.split(" ")[1]}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Raza */}
            <div className="space-y-1.5">
              <label htmlFor="np-breed" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Raza <span className="normal-case font-normal text-muted-foreground/60">(opcional)</span>
              </label>
              <Input
                id="np-breed"
                value={breed}
                onChange={(e) => setBreed(e.target.value)}
                placeholder="ej. Golden Retriever"
              />
            </div>

            {/* Separador dueño */}
            <div className="border-t border-white/[0.06] pt-1">
              <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Dueño
              </p>
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <label htmlFor="np-owner-phone" className="text-xs font-medium text-muted-foreground">
                    Teléfono *
                  </label>
                  <Input
                    id="np-owner-phone"
                    value={ownerPhone}
                    onChange={(e) => setOwnerPhone(e.target.value)}
                    placeholder="573001234567"
                    inputMode="tel"
                  />
                </div>
                <div className="space-y-1.5">
                  <label htmlFor="np-owner-name" className="text-xs font-medium text-muted-foreground">
                    Nombre <span className="font-normal text-muted-foreground/60">(opcional)</span>
                  </label>
                  <Input
                    id="np-owner-name"
                    value={ownerName}
                    onChange={(e) => setOwnerName(e.target.value)}
                    placeholder="ej. Ana García"
                  />
                </div>
              </div>
            </div>
          </div>
        </form>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={saving}
          >
            Cancelar
          </Button>
          <Button type="submit" form="new-pet-form" disabled={saving}>
            {saving ? "Guardando…" : "Crear mascota"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
