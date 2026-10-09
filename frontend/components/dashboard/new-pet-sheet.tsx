"use client";

import { useEffect, useState } from "react";
import { PawPrint } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";
import { ProtectedDialog, useDialogEditGuard } from "@/components/dashboard/protected-dialog";
import { proxyUrl } from "@/lib/api";
import { FieldError, FormSubmissionError, useFormFeedback } from "@/components/dashboard/form-feedback";
import { submissionErrorMessage } from "@/lib/form-feedback";
import { FormDialogContent, FormDialogHeader, FormDialogBody, FormDialogFooter, FormSection } from "./form-layout";

export type CreatedPet = { id: string; name: string; type: string; userId?: string };

import { useTenant, tenantQuery } from "@/lib/use-tenant";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (pet: CreatedPet) => void;
  defaultOwnerPhone?: string;
  defaultOwnerName?: string;
  lockOwner?: boolean;
};

const PET_TYPES = [
  { value: "dog",   label: "🐶 Perro" },
  { value: "cat",   label: "🐱 Gato" },
  { value: "bird",  label: "🐦 Ave" },
  { value: "rabbit",label: "🐰 Conejo" },
  { value: "other", label: "🐾 Otro" },
];

function NewPetContent({ open, onOpenChange, onCreated, defaultOwnerPhone, defaultOwnerName = "", lockOwner = false }: Props) {
  const { toast } = useToast();
  const tenant = useTenant();
  const [name, setName] = useState("");
  const [type, setType] = useState("dog");
  const [ownerPhone, setOwnerPhone] = useState(defaultOwnerPhone ?? "");
  const [ownerName, setOwnerName] = useState(defaultOwnerName);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (open) { setOwnerPhone(defaultOwnerPhone ?? ""); setOwnerName(defaultOwnerName); }
  }, [open, defaultOwnerPhone, defaultOwnerName]);
  const [breed, setBreed] = useState("");
  const [saving, setSaving] = useState(false);
  const feedback = useFormFeedback();
  const discard = useDialogEditGuard(Boolean(name || breed || type !== "dog" || ownerPhone !== (defaultOwnerPhone ?? "") || ownerName !== defaultOwnerName), saving);

  function reset() {
    setName("");
    setType("dog");
    setOwnerPhone("");
    setOwnerName("");
    setBreed("");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (saving || !feedback.validate(e.currentTarget as HTMLFormElement, {
      "np-name": "El nombre de la mascota es requerido.",
      "np-owner-phone": "El teléfono del dueño es requerido.",
    })) return;
    setSaving(true);
    try {
      const res = await fetch(proxyUrl(`/api/dashboard/pets${tenantQuery(tenant)}`), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, type, ownerPhone, ownerName, breed }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "No se pudo crear la mascota");
      }
      const created = await res.json() as CreatedPet;
      toast("Mascota creada.", "success");
      reset();
      onOpenChange(false);
      onCreated(created);
    } catch (err) {
      feedback.setSubmitError(submissionErrorMessage(err, "No se pudo crear la mascota."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <FormDialogContent className="max-w-xl">
        <FormDialogHeader>
          <div className="mb-1 flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500/15 ring-1 ring-amber-500/25">
              <PawPrint className="h-4 w-4 text-amber-700" />
            </div>
            <div className="min-w-0">
              <DialogTitle>Nueva mascota</DialogTitle>
              <DialogDescription>
                {lockOwner ? "Se vinculará al cliente seleccionado." : "Si el dueño no existe se crea automáticamente."}
              </DialogDescription>
            </div>
          </div>
        </FormDialogHeader>

        <form id="new-pet-form" className="flex min-h-0 flex-1 flex-col" onSubmit={handleSubmit} noValidate aria-busy={saving}>
          <FormDialogBody>
          <fieldset disabled={saving} className="min-w-0 space-y-6">
            <FormSubmissionError message={feedback.submitError} />
            <FormSection title="Datos de la mascota">
            {/* Nombre */}
            <div className="space-y-1.5">
              <label htmlFor="np-name" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Nombre de la mascota *
              </label>
              <Input
                id="np-name"
                value={name}
                onChange={(e) => { setName(e.target.value); feedback.clearField("np-name"); }}
                aria-required="true"
                aria-invalid={Boolean(feedback.errors["np-name"])}
                aria-describedby={feedback.errors["np-name"] ? "np-name-error" : undefined}
                placeholder="Ej. Max"
                autoFocus
              />
              <FieldError id="np-name" message={feedback.errors["np-name"]} />
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
                    aria-pressed={type === pt.value}
                    onClick={() => setType(pt.value)}
                    className={`flex flex-col items-center gap-1 rounded-xl border py-2.5 text-xs font-medium transition-all duration-150 ${
                      type === pt.value
                        ? "border-amber-500/40 bg-amber-500/10 text-amber-800"
                        : "border-black/[0.06] text-muted-foreground hover:border-black/15 hover:bg-accent"
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
            </FormSection>
            <FormSection title="Propietario" description={lockOwner ? "Los datos corresponden al cliente seleccionado." : "Usa el teléfono del propietario para vincular la mascota."}>
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <label htmlFor="np-owner-phone" className="text-xs font-medium text-muted-foreground">
                    Teléfono *
                  </label>
                  <Input
                    id="np-owner-phone"
                    readOnly={lockOwner}
                    value={ownerPhone}
                    onChange={(e) => { setOwnerPhone(e.target.value); feedback.clearField("np-owner-phone"); }}
                    aria-required="true"
                    aria-invalid={Boolean(feedback.errors["np-owner-phone"])}
                    aria-describedby={feedback.errors["np-owner-phone"] ? "np-owner-phone-error" : undefined}
                    placeholder="573001234567"
                    inputMode="tel"
                  />
                  <FieldError id="np-owner-phone" message={feedback.errors["np-owner-phone"]} />
                </div>
                <div className="space-y-1.5">
                  <label htmlFor="np-owner-name" className="text-xs font-medium text-muted-foreground">
                    Nombre <span className="font-normal text-muted-foreground/60">(opcional)</span>
                  </label>
                  <Input
                    id="np-owner-name"
                    readOnly={lockOwner}
                    value={ownerName}
                    onChange={(e) => setOwnerName(e.target.value)}
                    placeholder="ej. Ana García"
                  />
                </div>
              </div>
            </FormSection>
          </fieldset>
          </FormDialogBody>
        </form>

        <FormDialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => discard(() => onOpenChange(false))}
            disabled={saving}
          >
            Cancelar
          </Button>
          <Button type="submit" form="new-pet-form" disabled={saving}>
            {saving ? "Guardando…" : "Crear mascota"}
          </Button>
        </FormDialogFooter>
      </FormDialogContent>
    </>
  );
}

export function NewPetSheet(props: Props) {
  return <ProtectedDialog open={props.open} onOpenChange={props.onOpenChange}>{props.open && <NewPetContent {...props} />}</ProtectedDialog>;
}
