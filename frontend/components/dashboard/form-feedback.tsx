"use client";

import { useEffect, useRef, useState } from "react";
import { AlertCircle } from "lucide-react";
import { collectFormErrors, type FieldErrors } from "@/lib/form-feedback";

export function useFormFeedback() {
  const [errors, setErrors] = useState<FieldErrors>({});
  const [submitError, setSubmitError] = useState("");
  function validate(form: HTMLFormElement, required: FieldErrors, customErrors: FieldErrors = {}) {
    const next = { ...collectFormErrors(form, required), ...customErrors };
    setErrors(next);
    setSubmitError("");
    const controls = Array.from(form.querySelectorAll<HTMLElement>("[id]"));
    const first = controls.find(element => next[element.id])?.id ?? Object.keys(next)[0];
    if (first) {
      const control = controls.find(element => element.id === first);
      if (control instanceof HTMLElement) {
        let ancestor = control.parentElement;
        while (ancestor) {
          if (ancestor instanceof HTMLDetailsElement) ancestor.open = true;
          ancestor = ancestor.parentElement;
        }
        requestAnimationFrame(() => { if (control.isConnected) control.focus(); });
      }
    }
    return !first;
  }
  function clearField(id: string) {
    setErrors(previous => {
      if (!previous[id]) return previous;
      const next = { ...previous }; delete next[id]; return next;
    });
  }
  function fieldProps(id: string, hasHint = false) {
    return { "aria-invalid": Boolean(errors[id]), "aria-describedby": [hasHint ? `${id}-hint` : "", errors[id] ? `${id}-error` : ""].filter(Boolean).join(" ") || undefined };
  }
  function clear() { setErrors({}); setSubmitError(""); }
  return { errors, submitError, setSubmitError, validate, clearField, fieldProps, clear };
}

export function FieldError({ id, message }: { id: string; message?: string }) {
  return message ? <p id={`${id}-error`} className="text-sm text-red-700">{message}</p> : null;
}

export function FormSubmissionError({ message }: { message: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => { if (message) ref.current?.focus(); }, [message]);
  return message ? <div ref={ref} role="alert" tabIndex={-1} className="flex gap-3 rounded-xl border border-destructive/25 bg-destructive/5 p-4 text-sm text-red-800 outline-none focus-visible:ring-2 focus-visible:ring-destructive/30">
    <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
    <div><p className="font-semibold">No se pudo guardar</p><p className="mt-1 break-words">{message}</p><p className="mt-2">Revisa los datos y vuelve a intentar. El formulario conserva lo que escribiste.</p></div>
  </div> : null;
}
