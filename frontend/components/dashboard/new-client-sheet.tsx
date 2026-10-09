"use client";

import { useState } from "react";
import { UserPlus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";
import { proxyUrl } from "@/lib/api";
import { ProtectedDialog, useDialogEditGuard } from "@/components/dashboard/protected-dialog";
import { FieldError, FormSubmissionError, useFormFeedback } from "@/components/dashboard/form-feedback";
import { submissionErrorMessage } from "@/lib/form-feedback";
import { FormDialogContent, FormDialogHeader, FormDialogBody, FormDialogFooter, FormSection, FormAdditional } from "./form-layout";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
};

function NewClientContent({ onOpenChange, onCreated }: Props) {
  const { toast } = useToast();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const feedback = useFormFeedback();
  const discard = useDialogEditGuard(Boolean(name || phone || email || notes), saving);

  function reset() {
    setName("");
    setPhone("");
    setEmail("");
    setNotes("");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (saving || !feedback.validate(e.currentTarget as HTMLFormElement, { "nc-phone": "El teléfono es requerido." })) return;
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
      feedback.setSubmitError(submissionErrorMessage(err, "No se pudo crear el cliente."));
    } finally {
      setSaving(false);
    }
  }

  return (
      <FormDialogContent className="max-w-xl">
        <FormDialogHeader>
          <div className="mb-1 flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-500/15 ring-1 ring-violet-500/25">
              <UserPlus className="h-4 w-4 text-violet-700" />
            </div>
            <div className="min-w-0">
              <DialogTitle>Nuevo cliente</DialogTitle>
              <DialogDescription>
                Normalmente se registran solos por WhatsApp.
              </DialogDescription>
            </div>
          </div>
        </FormDialogHeader>

        <form id="new-client-form" className="flex min-h-0 flex-1 flex-col" onSubmit={handleSubmit} noValidate aria-busy={saving}>
          <FormDialogBody>
          <fieldset disabled={saving} className="min-w-0 space-y-4">
            <FormSubmissionError message={feedback.submitError} />
            <FormSection title="Contacto principal">
            <div className="space-y-1.5">
              <label htmlFor="nc-phone" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Teléfono *
              </label>
              <Input
                id="nc-phone"
                value={phone}
                onChange={(e) => { setPhone(e.target.value); feedback.clearField("nc-phone"); }}
                aria-required="true"
                aria-invalid={Boolean(feedback.errors["nc-phone"])}
                aria-describedby={feedback.errors["nc-phone"] ? "nc-phone-error" : undefined}
                placeholder="573001234567"
                inputMode="tel"
                autoFocus
              />
              <FieldError id="nc-phone" message={feedback.errors["nc-phone"]} />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="nc-name" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Nombre (opcional)
              </label>
              <Input
                id="nc-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Nombre completo"
              />
            </div>
            </FormSection>
            <FormAdditional>
            <div className="space-y-1.5">
              <label htmlFor="nc-email" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Correo electrónico (opcional)
              </label>
              <Input
                id="nc-email"
                value={email}
                onChange={(e) => { setEmail(e.target.value); feedback.clearField("nc-email"); }}
                aria-invalid={Boolean(feedback.errors["nc-email"])}
                aria-describedby={feedback.errors["nc-email"] ? "nc-email-error" : undefined}
                placeholder="email@ejemplo.com"
                type="email"
              />
              <FieldError id="nc-email" message={feedback.errors["nc-email"]} />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="nc-notes" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Notas (opcional)
              </label>
              <Input
                id="nc-notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Observaciones opcionales"
              />
            </div>
            </FormAdditional>
          </fieldset>
          </FormDialogBody>
        </form>

        <FormDialogFooter>
          <Button type="button" variant="outline" onClick={() => discard(() => onOpenChange(false))} disabled={saving}>
            Cancelar
          </Button>
          <Button type="submit" form="new-client-form" disabled={saving}>
            {saving ? "Guardando…" : "Crear cliente"}
          </Button>
        </FormDialogFooter>
      </FormDialogContent>
  );
}

export function NewClientSheet(props: Props) {
  return <ProtectedDialog open={props.open} onOpenChange={props.onOpenChange}>{props.open && <NewClientContent {...props} />}</ProtectedDialog>;
}
