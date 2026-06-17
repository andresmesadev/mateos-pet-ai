"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { apiUrl } from "@/lib/api";

// ─── Slug helpers ─────────────────────────────────────────────────────────────

function toSlug(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

// ─── Plans ────────────────────────────────────────────────────────────────────

type PlanId = "free" | "basic" | "pro";

const PLANS: {
  id: PlanId;
  name: string;
  price: string;
  features: string[];
  cta: string;
  highlighted?: boolean;
}[] = [
  {
    id: "free",
    name: "Free",
    price: "Gratis",
    features: [
      "Bot WhatsApp básico",
      "Hasta 100 mensajes/mes",
      "Reservas simples",
    ],
    cta: "Comenzar gratis",
  },
  {
    id: "basic",
    name: "Basic",
    price: "$29/mes",
    features: [
      "Bot WhatsApp completo",
      "Historial médico con IA",
      "Dashboard admin",
      "Recordatorios automáticos",
    ],
    cta: "Suscribirse",
    highlighted: true,
  },
  {
    id: "pro",
    name: "Pro",
    price: "$79/mes",
    features: [
      "Todo lo de Basic",
      "Análisis de imágenes",
      "Analíticas avanzadas",
      "Soporte prioritario",
    ],
    cta: "Suscribirse",
  },
];

// ─── Step indicator ───────────────────────────────────────────────────────────

function StepIndicator({ current, total }: { current: number; total: number }) {
  return (
    <div className="flex items-center gap-2 mb-8">
      {Array.from({ length: total }).map((_, i) => {
        const n = i + 1;
        const done = n < current;
        const active = n === current;
        return (
          <div key={n} className="flex items-center gap-2">
            <div
              className={[
                "flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold transition-colors",
                done
                  ? "bg-primary text-primary-foreground"
                  : active
                  ? "border-2 border-primary text-primary"
                  : "border border-muted-foreground/30 text-muted-foreground",
              ].join(" ")}
            >
              {done ? "✓" : n}
            </div>
            {i < total - 1 && (
              <div
                className={[
                  "h-px w-8",
                  done ? "bg-primary" : "bg-muted-foreground/20",
                ].join(" ")}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Main form ────────────────────────────────────────────────────────────────

type FormState = {
  name: string;
  slug: string;
  phone: string;
  email: string;
  ownerName: string;
  plan: PlanId;
};

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [form, setForm] = useState<FormState>({
    name: "",
    slug: "",
    phone: "",
    email: "",
    ownerName: "",
    plan: "free",
  });
  const [slugAvailable, setSlugAvailable] = useState<boolean | null>(null);
  const [slugChecking, setSlugChecking] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const set =
    <K extends keyof FormState>(field: K) =>
    (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm((f) => ({ ...f, [field]: e.target.value }));

  // Auto-generate slug from name (step 1)
  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const name = e.target.value;
    setForm((f) => ({ ...f, name, slug: toSlug(name) }));
  };

  // Debounced slug availability check
  useEffect(() => {
    const slug = form.slug.trim();
    if (!slug || slug.length < 2) {
      return;
    }

    if (debounceRef.current) clearTimeout(debounceRef.current);

    debounceRef.current = setTimeout(async () => {
      setSlugChecking(true);
      setSlugAvailable(null);
      try {
        const res = await fetch(apiUrl(`/api/onboarding/verify/${slug}`));
        const data = await res.json();
        setSlugAvailable(data.available ?? false);
      } catch {
        setSlugAvailable(null);
      } finally {
        setSlugChecking(false);
      }
    }, 400);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [form.slug]);

  const handleSlugChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    setForm((f) => ({ ...f, slug: toSlug(raw) }));
  };

  // When slug is too short, treat availability as unknown (null) without setState in effect
  const effectiveSlugAvailable =
    form.slug.trim().length < 2 ? null : slugAvailable;

  const canGoStep2 =
    form.name.trim().length >= 2 &&
    form.slug.length >= 2 &&
    effectiveSlugAvailable === true;

  const canGoStep3 =
    form.phone.trim().length >= 6 && form.email.trim().includes("@");

  const handleSubmit = async () => {
    setSubmitting(true);
    setSubmitError(null);

    try {
      const res = await fetch(apiUrl("/api/onboarding/register"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data?.error ?? "Error al registrar");
      }

      if (data.checkoutUrl) {
        window.location.href = data.checkoutUrl;
      } else {
        router.push(`/onboarding/success?tenant=${form.slug}`);
      }
    } catch (err) {
      setSubmitError(
        err instanceof Error ? err.message : "Error al registrar"
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="flex min-h-screen items-start justify-center bg-muted/40 p-6 pt-16">
      <div className="w-full max-w-xl">
        <div className="mb-10 text-center">
          <h1 className="text-3xl font-bold tracking-tight">Mateos Pet AI</h1>
          <p className="mt-2 text-muted-foreground">
            Registra tu veterinaria y empieza en minutos
          </p>
        </div>

        <StepIndicator current={step} total={3} />

        {/* ── Paso 1: Datos de la veterinaria ── */}
        {step === 1 && (
          <Card>
            <CardHeader>
              <CardTitle>Datos de la veterinaria</CardTitle>
              <CardDescription>
                El nombre y slug identifican tu cuenta en la plataforma
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1">
                <label className="text-sm font-medium">
                  Nombre de la veterinaria
                </label>
                <Input
                  placeholder="Ej: Clínica Veterinaria San Lucas"
                  value={form.name}
                  onChange={handleNameChange}
                  autoFocus
                />
              </div>

              <div className="space-y-1">
                <label className="text-sm font-medium">
                  Identificador (slug)
                </label>
                <div className="relative">
                  <Input
                    placeholder="ej: clinica-san-lucas"
                    value={form.slug}
                    onChange={handleSlugChange}
                    className={
                      effectiveSlugAvailable === false
                        ? "border-destructive focus-visible:ring-destructive"
                        : effectiveSlugAvailable === true
                        ? "border-green-500 focus-visible:ring-green-500"
                        : ""
                    }
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  Solo letras minúsculas, números y guiones.{" "}
                  {slugChecking ? (
                    <span className="text-muted-foreground">
                      Verificando…
                    </span>
                  ) : effectiveSlugAvailable === true ? (
                    <span className="text-green-600 font-medium">
                      ✓ Disponible
                    </span>
                  ) : effectiveSlugAvailable === false ? (
                    <span className="text-destructive font-medium">
                      ✗ Ya está en uso
                    </span>
                  ) : null}
                </p>
              </div>

              <Button
                className="w-full"
                disabled={!canGoStep2}
                onClick={() => setStep(2)}
              >
                Continuar →
              </Button>
            </CardContent>
          </Card>
        )}

        {/* ── Paso 2: Contacto ── */}
        {step === 2 && (
          <Card>
            <CardHeader>
              <CardTitle>Datos de contacto</CardTitle>
              <CardDescription>
                Con qué número de WhatsApp Business operará tu bot
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1">
                <label className="text-sm font-medium">
                  WhatsApp Business Phone Number ID
                </label>
                <Input
                  placeholder="Ej: 1144686692059417"
                  value={form.phone}
                  onChange={set("phone")}
                  autoFocus
                />
                <p className="text-xs text-muted-foreground">
                  Encuéntralo en Meta Business Suite → WhatsApp → API Setup
                </p>
              </div>

              <div className="space-y-1">
                <label className="text-sm font-medium">Email de contacto</label>
                <Input
                  type="email"
                  placeholder="contacto@tuveterinaria.com"
                  value={form.email}
                  onChange={set("email")}
                />
              </div>

              <div className="space-y-1">
                <label className="text-sm font-medium">
                  Nombre del propietario
                </label>
                <Input
                  placeholder="Ej: Carlos Rodríguez"
                  value={form.ownerName}
                  onChange={set("ownerName")}
                />
              </div>

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => setStep(1)}
                >
                  ← Atrás
                </Button>
                <Button
                  className="w-full"
                  disabled={!canGoStep3}
                  onClick={() => setStep(3)}
                >
                  Continuar →
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* ── Paso 3: Plan ── */}
        {step === 3 && (
          <div className="space-y-4">
            <div>
              <h2 className="text-xl font-semibold">Elige tu plan</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Puedes cambiar de plan en cualquier momento
              </p>
            </div>

            <div className="grid gap-4">
              {PLANS.map((plan) => (
                <button
                  key={plan.id}
                  type="button"
                  onClick={() =>
                    setForm((f) => ({ ...f, plan: plan.id }))
                  }
                  className={[
                    "w-full rounded-xl border p-4 text-left transition-all",
                    form.plan === plan.id
                      ? "border-primary bg-primary/5 ring-2 ring-primary"
                      : "border hover:border-primary/40",
                    plan.highlighted ? "relative" : "",
                  ].join(" ")}
                >
                  {plan.highlighted && (
                    <Badge className="absolute -top-2 left-4 bg-primary text-primary-foreground text-xs">
                      Recomendado
                    </Badge>
                  )}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div
                        className={[
                          "h-4 w-4 rounded-full border-2",
                          form.plan === plan.id
                            ? "border-primary bg-primary"
                            : "border-muted-foreground/40",
                        ].join(" ")}
                      />
                      <span className="font-semibold">{plan.name}</span>
                    </div>
                    <span className="text-sm font-medium text-muted-foreground">
                      {plan.price}
                    </span>
                  </div>
                  <ul className="mt-3 ml-7 space-y-1">
                    {plan.features.map((f) => (
                      <li key={f} className="text-sm text-muted-foreground">
                        · {f}
                      </li>
                    ))}
                  </ul>
                </button>
              ))}
            </div>

            {submitError ? (
              <p className="text-sm text-destructive">{submitError}</p>
            ) : null}

            <div className="flex gap-2">
              <Button
                variant="outline"
                className="w-full"
                onClick={() => setStep(2)}
                disabled={submitting}
              >
                ← Atrás
              </Button>
              <Button
                className="w-full"
                disabled={submitting}
                onClick={handleSubmit}
              >
                {submitting
                  ? "Registrando…"
                  : form.plan === "free"
                  ? "Comenzar gratis"
                  : `Suscribirse — ${PLANS.find((p) => p.id === form.plan)?.price}`}
              </Button>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
