import { PRODUCT_SUPPORT_EMAIL } from "./product-brand";

export type OnboardingProvisioning = "ready" | "pending" | "unknown";

export function onboardingProvisioning(value: unknown): OnboardingProvisioning {
  return value === "ready" || value === "pending" ? value : "unknown";
}

export function onboardingNotice(provisioning: OnboardingProvisioning) {
  if (provisioning === "ready") return null;
  return provisioning === "pending"
    ? { title: "La preparación de tus asistentes quedó pendiente", description: "Tu negocio y tu acceso ya están creados. Algunos asistentes necesitan revisión antes de usarlos. Puedes continuar con la configuración y la operación del dashboard." }
    : { title: "No pudimos comprobar la preparación de tus asistentes", description: "Tu cuenta ya está creada. Solicita una revisión antes de usar los asistentes. Puedes continuar con la configuración y la operación del dashboard." };
}

export function onboardingSupportHref(slug: string) {
  const subject = "Revisar preparación del negocio";
  const body = `Necesito revisar la preparación de los asistentes del negocio con identificador: ${slug}. La cuenta ya fue creada.`;
  return `mailto:${PRODUCT_SUPPORT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}
