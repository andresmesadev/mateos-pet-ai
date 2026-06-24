"use client";

import { useState } from "react";
import { Plus, Trash2, Users } from "lucide-react";

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
import { useTenant, tenantQuery } from "@/lib/use-tenant";

type PetDraft = {
  uid: number;
  name: string;
  type: string;
  breed: string;
  gender: string;
  weight: string;
  notes: string;
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
};

let uidCounter = 1;

function emptyPet(): PetDraft {
  return { uid: uidCounter++, name: "", type: "dog", breed: "", gender: "", weight: "", notes: "" };
}

const SELECT_CLASS =
  "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm transition-colors focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50";

const TEXTAREA_CLASS =
  "w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring resize-none disabled:cursor-not-allowed disabled:opacity-50";

export function NewOwnerPetsSheet({ open, onOpenChange, onCreated }: Props) {
  const { toast } = useToast();
  const tenant = useTenant();

  const [ownerName, setOwnerName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");
  const [notes, setNotes] = useState("");
  const [pets, setPets] = useState<PetDraft[]>(() => [emptyPet()]);
  const [saving, setSaving] = useState(false);

  function reset() {
    setOwnerName("");
    setPhone("");
    setEmail("");
    setAddress("");
    setNotes("");
    setPets([emptyPet()]);
  }

  function addPet() { setPets((prev) => [...prev, emptyPet()]); }
  function removePet(uid: number) { setPets((prev) => prev.filter((p) => p.uid !== uid)); }
  function updatePet(uid: number, field: keyof Omit<PetDraft, "uid">, value: string) {
    setPets((prev) => prev.map((p) => (p.uid === uid ? { ...p, [field]: value } : p)));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!ownerName.trim()) { toast("El nombre del propietario es requerido.", "error"); return; }
    if (!phone.trim()) { toast("El teléfono es requerido.", "error"); return; }
    for (let i = 0; i < pets.length; i++) {
      if (!pets[i].name.trim()) { toast(`Mascota ${i + 1}: el nombre es requerido.`, "error"); return; }
    }

    setSaving(true);
    try {
      const res = await fetch(
        proxyUrl(`/api/dashboard/clients/with-pets${tenantQuery(tenant)}`),
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: ownerName, phone,
            email: email || null, address, notes,
            pets: pets.map(({ name, type, breed, gender, weight, notes: petNotes }) => ({
              name, type,
              breed: breed || null,
              gender: gender || null,
              weight: weight ? parseFloat(weight) : null,
              notes: petNotes || null,
            })),
          }),
        }
      );
      if (!res.ok) {
        const data = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(data.error ?? "No se pudo crear el propietario");
      }
      toast("Propietario y mascota(s) creados.", "success");
      reset();
      onOpenChange(false);
      onCreated();
      window.dispatchEvent(new CustomEvent("pets:refresh"));
    } catch (err) {
      toast(err instanceof Error ? err.message : "Error al crear", "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!saving) onOpenChange(v); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <div className="mb-1 flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-sky-500/15 ring-1 ring-sky-500/25">
              <Users className="h-4 w-4 text-sky-400" />
            </div>
            <div>
              <DialogTitle>Nuevo propietario + mascota(s)</DialogTitle>
              <DialogDescription>
                Registra al propietario y sus mascotas en un solo paso.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form id="new-owner-pets-form" onSubmit={handleSubmit}>
          {/* Scroll interno para contenido largo */}
          <div className="max-h-[60vh] overflow-y-auto px-6 py-5">
            <div className="space-y-6">
              {/* ── Propietario ── */}
              <div className="space-y-3">
                <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Propietario</p>
                <div className="space-y-1.5">
                  <label htmlFor="op-name" className="text-xs font-medium text-muted-foreground">Nombre *</label>
                  <Input id="op-name" value={ownerName} onChange={(e) => setOwnerName(e.target.value)} placeholder="Nombre completo" autoFocus disabled={saving} />
                </div>
                <div className="space-y-1.5">
                  <label htmlFor="op-phone" className="text-xs font-medium text-muted-foreground">Teléfono *</label>
                  <Input id="op-phone" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="573001234567" inputMode="tel" disabled={saving} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label htmlFor="op-email" className="text-xs font-medium text-muted-foreground">Email</label>
                    <Input id="op-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="opcional" disabled={saving} />
                  </div>
                  <div className="space-y-1.5">
                    <label htmlFor="op-address" className="text-xs font-medium text-muted-foreground">Dirección</label>
                    <Input id="op-address" value={address} onChange={(e) => setAddress(e.target.value)} placeholder="opcional" disabled={saving} />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label htmlFor="op-notes" className="text-xs font-medium text-muted-foreground">Notas</label>
                  <textarea id="op-notes" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Observaciones opcionales" disabled={saving} className={TEXTAREA_CLASS} />
                </div>
              </div>

              {/* ── Mascotas ── */}
              <div className="space-y-3">
                <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                  Mascota{pets.length > 1 ? "s" : ""}
                </p>
                {pets.map((pet, index) => (
                  <div key={pet.uid} className="space-y-3 rounded-xl border border-white/[0.06] bg-accent/20 p-4">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Mascota {index + 1}</span>
                      {pets.length > 1 && (
                        <button type="button" onClick={() => removePet(pet.uid)} disabled={saving} className="rounded-lg p-1 text-muted-foreground/50 transition-colors hover:bg-destructive/10 hover:text-destructive">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>

                    <div className="space-y-1.5">
                      <label htmlFor={`pet-name-${pet.uid}`} className="text-xs font-medium text-muted-foreground">Nombre *</label>
                      <Input id={`pet-name-${pet.uid}`} value={pet.name} onChange={(e) => updatePet(pet.uid, "name", e.target.value)} placeholder="ej. Max" disabled={saving} />
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1.5">
                        <label htmlFor={`pet-type-${pet.uid}`} className="text-xs font-medium text-muted-foreground">Especie *</label>
                        <select id={`pet-type-${pet.uid}`} value={pet.type} onChange={(e) => updatePet(pet.uid, "type", e.target.value)} className={SELECT_CLASS} disabled={saving}>
                          <option value="dog">Perro</option>
                          <option value="cat">Gato</option>
                          <option value="bird">Ave</option>
                          <option value="rabbit">Conejo</option>
                          <option value="other">Otro</option>
                        </select>
                      </div>
                      <div className="space-y-1.5">
                        <label htmlFor={`pet-breed-${pet.uid}`} className="text-xs font-medium text-muted-foreground">Raza</label>
                        <Input id={`pet-breed-${pet.uid}`} value={pet.breed} onChange={(e) => updatePet(pet.uid, "breed", e.target.value)} placeholder="opcional" disabled={saving} />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1.5">
                        <label htmlFor={`pet-gender-${pet.uid}`} className="text-xs font-medium text-muted-foreground">Género</label>
                        <select id={`pet-gender-${pet.uid}`} value={pet.gender} onChange={(e) => updatePet(pet.uid, "gender", e.target.value)} className={SELECT_CLASS} disabled={saving}>
                          <option value="">Sin especificar</option>
                          <option value="male">Macho</option>
                          <option value="female">Hembra</option>
                        </select>
                      </div>
                      <div className="space-y-1.5">
                        <label htmlFor={`pet-weight-${pet.uid}`} className="text-xs font-medium text-muted-foreground">Peso (kg)</label>
                        <Input id={`pet-weight-${pet.uid}`} type="number" step="0.1" min="0" value={pet.weight} onChange={(e) => updatePet(pet.uid, "weight", e.target.value)} placeholder="ej. 12.5" disabled={saving} />
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label htmlFor={`pet-notes-${pet.uid}`} className="text-xs font-medium text-muted-foreground">Notas</label>
                      <textarea id={`pet-notes-${pet.uid}`} rows={2} value={pet.notes} onChange={(e) => updatePet(pet.uid, "notes", e.target.value)} placeholder="Alergias, comportamiento… (opcional)" disabled={saving} className={TEXTAREA_CLASS} />
                    </div>
                  </div>
                ))}

                <button
                  type="button"
                  onClick={addPet}
                  disabled={saving}
                  className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-white/[0.1] py-2.5 text-xs font-medium text-muted-foreground transition-colors hover:border-primary/40 hover:text-primary"
                >
                  <Plus className="h-3.5 w-3.5" /> Agregar otra mascota
                </button>
              </div>
            </div>
          </div>
        </form>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button type="submit" form="new-owner-pets-form" disabled={saving}>
            {saving ? "Creando…" : "Crear propietario + mascota(s)"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
