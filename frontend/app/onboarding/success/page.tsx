"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const STEPS = [
  {
    n: 1,
    title: "Conecta tu número de WhatsApp Business",
    body: "En Meta Business Suite ve a WhatsApp → Configuración de API y configura el webhook apuntando a tu instancia de Mateos Pet AI.",
  },
  {
    n: 2,
    title: "Configura el webhook",
    body: "URL del webhook: https://tudominio.com/api/webhook — Token de verificación: el valor de WHATSAPP_VERIFY_TOKEN en tu .env",
  },
  {
    n: 3,
    title: "Envía el primer mensaje",
    body: 'Escribe "Hola" desde cualquier número al tuyo de WhatsApp Business. El bot debería responder en segundos.',
  },
];

function SuccessContent() {
  const params = useSearchParams();
  const tenant = params.get("tenant");

  return (
    <main className="flex min-h-screen items-start justify-center bg-muted/40 p-6 pt-16">
      <div className="w-full max-w-xl space-y-6">
        {/* Header */}
        <div className="text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100 text-3xl">
            🎉
          </div>
          <h1 className="text-3xl font-bold tracking-tight">
            ¡Registro completado!
          </h1>
          {tenant ? (
            <p className="mt-2 text-muted-foreground">
              Tu veterinaria{" "}
              <span className="font-semibold text-foreground">{tenant}</span>{" "}
              está lista para usar Mateos Pet AI.
            </p>
          ) : (
            <p className="mt-2 text-muted-foreground">
              Tu veterinaria está lista para usar Mateos Pet AI.
            </p>
          )}
        </div>

        {/* Next steps */}
        <Card>
          <CardHeader>
            <CardTitle>Próximos pasos</CardTitle>
            <CardDescription>
              Sigue estas instrucciones para conectar tu bot de WhatsApp
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {STEPS.map((s) => (
              <div key={s.n} className="flex gap-4">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold">
                  {s.n}
                </div>
                <div>
                  <p className="font-medium text-sm">{s.title}</p>
                  <p className="mt-0.5 text-sm text-muted-foreground">
                    {s.body}
                  </p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Docs callout */}
        <div className="rounded-xl border bg-muted/40 px-4 py-4 text-sm text-muted-foreground">
          <p>
            <span className="font-medium text-foreground">¿Necesitas ayuda?</span>{" "}
            Consulta la documentación completa o escríbenos a{" "}
            <span className="font-medium text-foreground">
              soporte@mateospetai.com
            </span>
            .
          </p>
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-3 sm:flex-row">
          <Button asChild className="w-full">
            <Link href="/dashboard">Ir al dashboard →</Link>
          </Button>
          <Button asChild variant="outline" className="w-full">
            <Link href="/onboarding">Registrar otra veterinaria</Link>
          </Button>
        </div>
      </div>
    </main>
  );
}

export default function OnboardingSuccessPage() {
  return (
    <Suspense fallback={null}>
      <SuccessContent />
    </Suspense>
  );
}
