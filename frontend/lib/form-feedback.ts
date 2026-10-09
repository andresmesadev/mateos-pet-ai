export type FieldErrors = Record<string, string>;

/** Validate the controls in their visual order without changing API contracts. */
export function collectFormErrors(form: HTMLFormElement, required: FieldErrors): FieldErrors {
  const errors: FieldErrors = {};
  for (const control of Array.from(form.elements)) {
    if (!(control instanceof HTMLInputElement || control instanceof HTMLTextAreaElement || control instanceof HTMLSelectElement)) continue;
    if (!control.id || control.disabled) continue;
    if (required[control.id] && !control.value.trim()) errors[control.id] = required[control.id];
    else if (control.willValidate && !control.validity.valid) {
      errors[control.id] = control.validity.typeMismatch && control.type === "email"
        ? "Escribe un correo válido, por ejemplo nombre@correo.com."
        : control.validity.rangeUnderflow ? `El valor debe ser igual o mayor que ${control.getAttribute("min")}.`
        : control.validity.rangeOverflow ? `El valor debe ser igual o menor que ${control.getAttribute("max")}.`
        : control.validity.stepMismatch ? `Usa incrementos de ${control.getAttribute("step")}.`
        : "Revisa el valor de este campo.";
    }
  }
  return errors;
}

export function submissionErrorMessage(error: unknown, fallback: string): string {
  return error instanceof TypeError
    ? "No se pudo conectar con el servidor. Tus datos siguen en el formulario; vuelve a intentar guardar."
    : error instanceof Error && error.message ? error.message : fallback;
}
