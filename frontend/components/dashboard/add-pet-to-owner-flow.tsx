"use client";

import { useState } from "react";
import { ArrowLeft, Search } from "lucide-react";

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
import { useTenant } from "@/lib/use-tenant";
import { formatPhone } from "@/lib/pets";
import { NewOwnerPetsSheet } from "@/components/dashboard/new-owner-pets-sheet";

type Owner = { id: string; name: string | null; phone: string; pets?: { id: string; name: string }[] };

const SELECT_CLASS =
  "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50";

const TEXTAREA_CLASS =
  "w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring resize-none disabled:cursor-not-allowed disabled:opacity-50";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
};

type Step = "search" | "found" | "not-found";

export function AddPetToOwnerFlow({ open, onOpenChange, onCreated }: Props) {
  const { toast } = useToast();
  const tenant = useTenant();

  const [step, setStep] = useState<Step>("search");
  const [phoneQuery, setPhoneQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [owner, setOwner] = useState<Owner | null>(null);
  const [newOwnerOpen, setNewOwnerOpen] = useState(false);

  // Pet form state
  const [petName, setPetName] = useState("");
  const [petType, setPetType] = useState("dog");
  const [petBreed, setPetBreed] = useState("");
  const [petGender, setPetGender] = useState("");
  const [petWeight, setPetWeight] = useState("");
  const [petNotes, setPetNotes] = useState("");
  const [saving, setSaving] = useState(false);

  function resetPetForm() {
    setPetName("");
    setPetType("dog");
    setPetBreed("");
    setPetGender("");
    setPetWeight("");
    setPetNotes("");
  }

  function handleClose() {
    setStep("search");
    setPhoneQuery("");
    setOwner(null);
    resetPetForm();
    onOpenChange(false);
  }

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    const q = phoneQuery.trim();
    if (!q) return;

    setSearching(true);
    try {
      const qs = new URLSearchParams({ search: q, limit: "1" });
      if (tenant) qs.set("tenantId", tenant);
      const url = proxyUrl(`/api/dashboard/clients?${qs.toString()}`);
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) throw new Error();
      const data = await res.json() as Owner[];
      if (Array.isArray(data) && data.length > 0) {
        setOwner(data[0]);
        setStep("found");
      } else {
        setOwner(null);
        setStep("not-found");
      }
    } catch {
      toast("Error al buscar propietario. Intenta de nuevo.", "error");
    } finally {
      setSearching(false);
    }
  }

  async function handleAddPet(e: React.FormEvent) {
    e.preventDefault();
    if (!owner) return;
    if (!petName.trim()) {
      toast("El nombre de la mascota es requerido.", "error");
      return;
    }

    setSaving(true);
    try {
      const petQs = tenant ? `?tenantId=${encodeURIComponent(tenant)}` : "";
      const res = await fetch(proxyUrl(`/api/dashboard/pets${petQs}`), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: petName,
          type: petType,
          ownerPhone: owner.phone,
          ownerName: owner.name ?? undefined,
          breed: petBreed || undefined,
          notes: petNotes || undefined,
        }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(d.error ?? "No se pudo crear la mascota");
      }
      toast("Mascota agregada.", "success");
      handleClose();
      onCreated();
      window.dispatchEvent(new CustomEvent("pets:refresh"));
    } catch (err) {
      toast(err instanceof Error ? err.message : "Error al crear mascota", "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <Sheet open={open} onOpenChange={handleClose}>
        <SheetContent className="overflow-y-auto sm:max-w-md">
          {step === "search" && (
            <>
              <SheetHeader>
                <SheetTitle>Agregar mascota</SheetTitle>
                <SheetDescription>
                  Busca al propietario por teléfono o nombre.
                </SheetDescription>
              </SheetHeader>

              <form onSubmit={handleSearch} className="space-y-4 px-4 pb-6">
                <div className="space-y-1.5">
                  <label htmlFor="apt-phone" className="text-sm font-medium">
                    Teléfono o nombre del propietario
                  </label>
                  <div className="flex gap-2">
                    <Input
                      id="apt-phone"
                      value={phoneQuery}
                      onChange={(e) => setPhoneQuery(e.target.value)}
                      placeholder="573001234567 o Juan Pérez"
                      inputMode="tel"
                      autoFocus
                      disabled={searching}
                    />
                    <Button type="submit" size="icon" disabled={searching || !phoneQuery.trim()}>
                      <Search className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                <div className="flex items-center gap-3 text-sm text-muted-foreground">
                  <div className="h-px flex-1 bg-border" />
                  <span>o</span>
                  <div className="h-px flex-1 bg-border" />
                </div>

                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  onClick={() => {
                    onOpenChange(false);
                    setNewOwnerOpen(true);
                  }}
                >
                  Crear propietario + mascota(s) nuevo
                </Button>
              </form>
            </>
          )}

          {step === "found" && owner && (
            <>
              <SheetHeader>
                <SheetTitle>Nueva mascota</SheetTitle>
                <SheetDescription>
                  Agregando mascota a este propietario.
                </SheetDescription>
              </SheetHeader>

              <div className="px-4 pb-6 space-y-5">
                {/* Tarjeta del propietario */}
                <div className="flex items-center gap-3 rounded-lg border bg-muted/30 p-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-violet-500/15 text-sm font-semibold text-violet-400">
                    {(owner.name?.trim()?.[0] ?? "#").toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-sm">{owner.name ?? formatPhone(owner.phone)}</p>
                    <p className="truncate text-xs text-muted-foreground">{formatPhone(owner.phone)}</p>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="shrink-0 text-xs"
                    onClick={() => { setStep("search"); resetPetForm(); }}
                  >
                    <ArrowLeft className="mr-1 h-3.5 w-3.5" />
                    Cambiar
                  </Button>
                </div>

                {/* Formulario de mascota */}
                <form onSubmit={handleAddPet} className="space-y-3">
                  <div className="space-y-1.5">
                    <label htmlFor="apt-pet-name" className="text-sm font-medium">Nombre *</label>
                    <Input
                      id="apt-pet-name"
                      value={petName}
                      onChange={(e) => setPetName(e.target.value)}
                      placeholder="Ej. Max"
                      autoFocus
                      disabled={saving}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1.5">
                      <label htmlFor="apt-pet-type" className="text-sm font-medium">Especie *</label>
                      <select
                        id="apt-pet-type"
                        value={petType}
                        onChange={(e) => setPetType(e.target.value)}
                        className={SELECT_CLASS}
                        disabled={saving}
                      >
                        <option value="dog">Perro</option>
                        <option value="cat">Gato</option>
                        <option value="other">Otro</option>
                      </select>
                    </div>

                    <div className="space-y-1.5">
                      <label htmlFor="apt-pet-breed" className="text-sm font-medium">Raza</label>
                      <Input
                        id="apt-pet-breed"
                        value={petBreed}
                        onChange={(e) => setPetBreed(e.target.value)}
                        placeholder="Opcional"
                        disabled={saving}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1.5">
                      <label htmlFor="apt-pet-gender" className="text-sm font-medium">Género</label>
                      <select
                        id="apt-pet-gender"
                        value={petGender}
                        onChange={(e) => setPetGender(e.target.value)}
                        className={SELECT_CLASS}
                        disabled={saving}
                      >
                        <option value="">Sin especificar</option>
                        <option value="male">Macho</option>
                        <option value="female">Hembra</option>
                      </select>
                    </div>

                    <div className="space-y-1.5">
                      <label htmlFor="apt-pet-weight" className="text-sm font-medium">Peso (kg)</label>
                      <Input
                        id="apt-pet-weight"
                        type="number"
                        step="0.1"
                        min="0"
                        value={petWeight}
                        onChange={(e) => setPetWeight(e.target.value)}
                        placeholder="Ej. 12.5"
                        disabled={saving}
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label htmlFor="apt-pet-notes" className="text-sm font-medium">Notas</label>
                    <textarea
                      id="apt-pet-notes"
                      rows={2}
                      value={petNotes}
                      onChange={(e) => setPetNotes(e.target.value)}
                      placeholder="Alergias, comportamiento, etc. (opcional)"
                      disabled={saving}
                      className={TEXTAREA_CLASS}
                    />
                  </div>

                  <div className="flex justify-end gap-2 pt-2">
                    <Button type="button" variant="outline" onClick={handleClose} disabled={saving}>
                      Cancelar
                    </Button>
                    <Button type="submit" disabled={saving}>
                      {saving ? "Guardando…" : "Agregar mascota"}
                    </Button>
                  </div>
                </form>
              </div>
            </>
          )}

          {step === "not-found" && (
            <>
              <SheetHeader>
                <SheetTitle>Propietario no encontrado</SheetTitle>
                <SheetDescription>
                  No existe un propietario con &ldquo;{phoneQuery}&rdquo; en este tenant.
                </SheetDescription>
              </SheetHeader>

              <div className="space-y-4 px-4 pb-6">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="gap-1"
                  onClick={() => setStep("search")}
                >
                  <ArrowLeft className="h-4 w-4" />
                  Buscar de nuevo
                </Button>

                <div className="rounded-lg border border-dashed p-4 text-center space-y-3">
                  <p className="text-sm text-muted-foreground">
                    ¿Quieres registrar a este propietario y su(s) mascota(s)?
                  </p>
                  <Button
                    type="button"
                    onClick={() => {
                      onOpenChange(false);
                      setNewOwnerOpen(true);
                    }}
                  >
                    Crear propietario + mascota(s)
                  </Button>
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      <NewOwnerPetsSheet
        open={newOwnerOpen}
        onOpenChange={setNewOwnerOpen}
        onCreated={() => {
          onCreated();
          setStep("search");
          setPhoneQuery("");
        }}
      />
    </>
  );
}
