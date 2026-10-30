export type PaidPlanId = "basic" | "pro";

export function billingPlanRequest(planId: PaidPlanId, hasSubscription: boolean, origin: string) {
  if (planId !== "basic" && planId !== "pro") {
    throw new Error("Selecciona un plan de suscripción válido.");
  }
  if (hasSubscription) return { action: "change-plan", planId };
  return {
    action: "checkout",
    planId,
    successUrl: `${origin}/dashboard/billing?success=1`,
    cancelUrl: `${origin}/dashboard/billing?canceled=1`,
  };
}
