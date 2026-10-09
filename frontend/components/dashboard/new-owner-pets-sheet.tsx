"use client";

import { useState } from "react";
import { Plus, Trash2, Users } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";
import { useDashboardAccess } from "@/components/dashboard/dashboard-access-provider";
import { ProtectedDialog, useDialogEditGuard } from "@/components/dashboard/protected-dialog";
import { proxyUrl } from "@/lib/api";
import { useTenant, tenantQuery } from "@/lib/use-tenant";
import { FieldError, FormSubmissionError, useFormFeedback } from "@/components/dashboard/form-feedback";
import { submissionErrorMessage } from "@/lib/form-feedback";
import { FormDialogContent, FormDialogHeader, FormDialogBody, FormDialogFooter, FormSection, FormAdditional } from "./form-layout";

type PetDraft = {
  uid: number;
  name: string;
  type: string;
  breed: string;
  gender: string;
  weight: string;
  notes: string;
};

export type CreatedOwnerPets = { owner: { id: string; name: string | null; phone: string }; pets: { id: string; name: string; type: string }[] };

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (created: CreatedOwnerPets) => void;
};

let uidCounter = 1;

function emptyPet(): PetDraft {
  return { uid: uidCounter++, name: "", type: "dog", breed: "", gender: "", weight: "", notes: "" };
}

const SELECT_CLASS =
  "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm transition-colors focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50";

const TEXTAREA_CLASS =
  "w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring resize-none disabled:cursor-not-allowed disabled:opacity-50";

function NewOwnerPetsContent({ onOpenChange, onCreated }: Props) {
  const { toast } = useToast();
  const tenant = useTenant();
  const access = useDashboardAccess();

  const [ownerName, setOwnerName] = useState("");
  const [phone, setPhone] = useState("");
  const [phoneAlt, setPhoneAlt] = useState("");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");
  const [notes, setNotes] = useState("");
  const [pets, setPets] = useState<PetDraft[]>(() => [emptyPet()]);
  const [saving, setSaving] = useState(false);
  const feedback = useFormFeedback();
  const dirty = Boolean(ownerName || phone || phoneAlt || email || address || notes || pets.some(pet => pet.name || pet.breed || pet.gender || pet.weight || pet.notes || pet.type !== "dog"));
  const discard = useDialogEditGuard(dirty, saving);

  function reset() {
    setOwnerName("");
    setPhone("");
    setPhoneAlt("");
    setEmail("");
    setAddress("");
    setNotes("");
    setPets([emptyPet()]);
  }

  function addPet() { setPets((prev) => [...prev, emptyPet()]); }
  function removePet(uid: number) { setPets((prev) => prev.filter((p) => p.uid !== uid)); }
  function updatePet(uid: number, field: keyof Omit<PetDraft, "uid">, value: string) {
    feedback.clearField(`pet-${field}-${uid}`);
    setPets((prev) => prev.map((p) => (p.uid === uid ? { ...p, [field]: value } : p)));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (saving || !feedback.validate(e.currentTarget as HTMLFormElement, {
      "op-name": "El nombre del propietario es requerido.", "op-phone": "El teléfono es requerido.",
      ...Object.fromEntries(pets.map((pet, index) => [`pet-name-${pet.uid}`, `Mascota ${index + 1}: el nombre es requerido.`])),
    })) return;

    setSaving(true);
    try {
      const res = await fetch(
        proxyUrl(`/api/dashboard/clients/with-pets${tenantQuery(tenant)}`),
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: ownerName, phone,
            phoneAlt: phoneAlt || null,
            email: email || null, address, notes: access?.capabilities.administration ? notes : undefined,
            pets: pets.map(({ name, type, breed, gender, weight, notes: petNotes }) => ({
              name, type,
              breed: breed || null,
              gender: gender || null,
              weight: access?.capabilities.administration && weight ? parseFloat(weight) : null,
              notes: access?.capabilities.administration ? petNotes || null : null,
              operationalAlerts: access?.capabilities.administration ? undefined : petNotes || null,
            })),
          }),
        }
      );
      if (!res.ok) {
        const data = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(data.error ?? "No se pudo crear el propietario");
      }
      const created = await res.json() as CreatedOwnerPets;
      toast("Propietario y mascota(s) creados.", "success");
      reset();
      onOpenChange(false);
      onCreated(created);
      window.dispatchEvent(new CustomEvent("pets:refresh"));
    } catch (err) {
      feedback.setSubmitError(submissionErrorMessage(err, "No se pudo crear el propietario y sus mascotas."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <FormDialogContent>
        <FormDialogHeader>
          <div className="mb-1 flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-sky-500/15 ring-1 ring-sky-500/25">
              <Users className="h-4 w-4 text-sky-700" />
            </div>
            <div className="min-w-0">
              <DialogTitle>Nuevo propietario + mascota(s)</DialogTitle>
              <DialogDescription>
                Registra al propietario y sus mascotas en un solo paso.
              </DialogDescription>
            </div>
          </div>
        </FormDialogHeader>

        <form id="new-owner-pets-form" className="flex min-h-0 flex-1 flex-col" onSubmit={handleSubmit} noValidate aria-busy={saving}>
          {/* Scroll interno para contenido largo */}
          <FormDialogBody>
            <div className="space-y-6">
              <FormSubmissionError message={feedback.submitError} />
              {/* ── Propietario ── */}
              <FormSection title="Contacto del propietario">
                <div className="space-y-1.5">
                  <label htmlFor="op-name" className="text-xs font-medium text-muted-foreground">Nombre *</label>
                  <Input id="op-name" value={ownerName} onChange={(e) => { setOwnerName(e.target.value); feedback.clearField("op-name"); }} placeholder="Nombre completo" autoFocus disabled={saving} aria-required="true" aria-invalid={Boolean(feedback.errors["op-name"])} aria-describedby={feedback.errors["op-name"] ? "op-name-error" : undefined} />
                  <FieldError id="op-name" message={feedback.errors["op-name"]} />
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <label htmlFor="op-phone" className="text-xs font-medium text-muted-foreground">Teléfono *</label>
                    <Input id="op-phone" value={phone} onChange={(e) => { setPhone(e.target.value); feedback.clearField("op-phone"); }} placeholder="573001234567" inputMode="tel" disabled={saving} aria-required="true" aria-invalid={Boolean(feedback.errors["op-phone"])} aria-describedby={feedback.errors["op-phone"] ? "op-phone-error" : undefined} />
                    <FieldError id="op-phone" message={feedback.errors["op-phone"]} />
                  </div>
                </div>
              </FormSection>

              {/* ── Mascotas ── */}
              <FormSection title={`Mascota${pets.length > 1 ? "s" : ""}`}>
                {pets.map((pet, index) => (
                  <div key={pet.uid} className="space-y-3 rounded-xl border border-black/[0.06] bg-accent/20 p-4">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Mascota {index + 1}</span>
                      {pets.length > 1 && (
                        <button type="button" aria-label={`Quitar mascota ${index + 1}`} onClick={() => removePet(pet.uid)} disabled={saving} className="inline-flex size-11 shrink-0 items-center justify-center rounded-lg text-muted-foreground/50 transition-colors hover:bg-destructive/10 hover:text-destructive">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>

                    <div className="space-y-1.5">
                      <label htmlFor={`pet-name-${pet.uid}`} className="text-xs font-medium text-muted-foreground">Nombre *</label>
                      <Input id={`pet-name-${pet.uid}`} value={pet.name} onChange={(e) => updatePet(pet.uid, "name", e.target.value)} placeholder="ej. Max" disabled={saving} aria-required="true" aria-invalid={Boolean(feedback.errors[`pet-name-${pet.uid}`])} aria-describedby={feedback.errors[`pet-name-${pet.uid}`] ? `pet-name-${pet.uid}-error` : undefined} />
                      <FieldError id={`pet-name-${pet.uid}`} message={feedback.errors[`pet-name-${pet.uid}`]} />
                    </div>

                    <div className="grid gap-2 sm:grid-cols-2">
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
                        <label htmlFor={`pet-breed-${pet.uid}`} className="text-xs font-medium text-muted-foreground">Raza (opcional)</label>
                        <Input id={`pet-breed-${pet.uid}`} value={pet.breed} onChange={(e) => updatePet(pet.uid, "breed", e.target.value)} placeholder="opcional" disabled={saving} />
                      </div>
                    </div>

                    <div className="grid gap-2 sm:grid-cols-2">
                      <div className="space-y-1.5">
                        <label htmlFor={`pet-gender-${pet.uid}`} className="text-xs font-medium text-muted-foreground">Género (opcional)</label>
                        <select id={`pet-gender-${pet.uid}`} value={pet.gender} onChange={(e) => updatePet(pet.uid, "gender", e.target.value)} className={SELECT_CLASS} disabled={saving}>
                          <option value="">Sin especificar</option>
                          <option value="male">Macho</option>
                          <option value="female">Hembra</option>
                        </select>
                      </div>
                      <div className="space-y-1.5">
                        <label htmlFor={`pet-weight-${pet.uid}`} className="text-xs font-medium text-muted-foreground">Peso (kg) · Profesional (opcional)</label>
                        <Input id={`pet-weight-${pet.uid}`} type="number" step="0.1" min="0" disabled={!access?.capabilities.administration || saving} value={pet.weight} onChange={(e) => updatePet(pet.uid, "weight", e.target.value)} placeholder="ej. 12.5" aria-invalid={Boolean(feedback.errors[`pet-weight-${pet.uid}`])} aria-describedby={feedback.errors[`pet-weight-${pet.uid}`] ? `pet-weight-${pet.uid}-error` : undefined} />
                        <FieldError id={`pet-weight-${pet.uid}`} message={feedback.errors[`pet-weight-${pet.uid}`]} />
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label htmlFor={`pet-notes-${pet.uid}`} className="text-xs font-medium text-muted-foreground">{access?.capabilities.administration ? "Notas" : "Alertas para el manejo"} (opcional)</label>
                      <textarea id={`pet-notes-${pet.uid}`} rows={2} value={pet.notes} onChange={(e) => updatePet(pet.uid, "notes", e.target.value)} placeholder="Alergias, comportamiento… (opcional)" disabled={saving} className={TEXTAREA_CLASS} />
                    </div>
                  </div>
                ))}

                <button
                  type="button"
                  onClick={addPet}
                  disabled={saving}
                  className="flex min-h-11 w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-black/[0.1] py-2.5 text-xs font-medium text-muted-foreground transition-colors hover:border-primary/40 hover:text-primary"
                >
                  <Plus className="h-3.5 w-3.5" /> Agregar otra mascota
                </button>
              </FormSection>
              <FormAdditional>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2"><label htmlFor="op-phone-alt" className="text-sm font-semibold">Teléfono alternativo (opcional)</label><Input id="op-phone-alt" value={phoneAlt} onChange={e => setPhoneAlt(e.target.value)} inputMode="tel" disabled={saving} /></div>
                  <div className="space-y-2"><label htmlFor="op-email" className="text-sm font-semibold">Correo electrónico (opcional)</label><Input id="op-email" type="email" value={email} onChange={e => { setEmail(e.target.value); feedback.clearField("op-email"); }} disabled={saving} {...feedback.fieldProps("op-email")} /><FieldError id="op-email" message={feedback.errors["op-email"]} /></div>
                  <div className="space-y-2 sm:col-span-2"><label htmlFor="op-address" className="text-sm font-semibold">Dirección (opcional)</label><Input id="op-address" value={address} onChange={e => setAddress(e.target.value)} disabled={saving} /></div>
                </div>
                {access?.capabilities.administration && <div className="space-y-2"><label htmlFor="op-notes" className="text-sm font-semibold">Notas del propietario (opcional)</label><textarea id="op-notes" rows={2} value={notes} onChange={e => setNotes(e.target.value)} disabled={saving} className={TEXTAREA_CLASS} /></div>}
              </FormAdditional>
            </div>
          </FormDialogBody>
        </form>

        <FormDialogFooter>
          <Button type="button" variant="outline" onClick={() => discard(() => onOpenChange(false))} disabled={saving}>
            Cancelar
          </Button>
          <Button type="submit" form="new-owner-pets-form" disabled={saving}>
            {saving ? "Creando…" : "Crear propietario + mascota(s)"}
          </Button>
        </FormDialogFooter>
      </FormDialogContent>
    </>
  );
}

export function NewOwnerPetsSheet(props: Props) {
  return <ProtectedDialog open={props.open} onOpenChange={props.onOpenChange}>{props.open && <NewOwnerPetsContent {...props} />}</ProtectedDialog>;
}
