import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Mateos Pet AI — El Agente de IA para tu Veterinaria",
  description:
    "Agenda citas, recuerda clientes y gestiona tu veterinaria por WhatsApp — automáticamente.",
};

// ─── Data ─────────────────────────────────────────────────────────────────────

const FEATURES = [
  {
    emoji: "🤖",
    title: "IA Conversacional",
    body: "Atiende a tus clientes por WhatsApp las 24 horas, los 7 días de la semana, sin que tengas que estar pendiente.",
  },
  {
    emoji: "📅",
    title: "Agenda Inteligente",
    body: "El bot verifica disponibilidad y confirma citas automáticamente. Sin doble reservas ni errores.",
  },
  {
    emoji: "🐾",
    title: "Historial Médico",
    body: "Recuerda alergias, vacunas y tratamientos de cada mascota. La IA extrae la info de la conversación.",
  },
  {
    emoji: "💉",
    title: "Recordatorios Automáticos",
    body: "Vacunas, desparasitaciones y citas de grooming: el sistema avisa a tus clientes cuando toca.",
  },
  {
    emoji: "📊",
    title: "Dashboard Completo",
    body: "Panel administrativo con clientes, conversaciones, citas y expedientes médicos en tiempo real.",
  },
  {
    emoji: "🔒",
    title: "Datos Seguros",
    body: "Cada veterinaria tiene sus datos 100 % aislados. Cumplimiento de protección de datos.",
  },
];

const HOW_IT_WORKS = [
  {
    n: "01",
    title: "Regístrate en 2 minutos",
    body: "Completa el formulario con el nombre de tu veterinaria, elige un plan y listo.",
  },
  {
    n: "02",
    title: "Conecta tu WhatsApp Business",
    body: "Vincula tu número de WhatsApp Business mediante la API de Meta. Te guiamos paso a paso.",
  },
  {
    n: "03",
    title: "Tu agente de IA trabaja solo",
    body: "Desde ese momento el bot atiende, agenda y recuerda. Tú solo revisas el dashboard.",
  },
];

const PLANS = [
  {
    name: "Free",
    price: "Gratis",
    period: "",
    description: "Para empezar sin compromiso",
    features: [
      "Bot WhatsApp básico",
      "Hasta 100 mensajes/mes",
      "Reservas simples",
      "1 usuario",
    ],
    cta: "Comenzar gratis",
    highlighted: false,
  },
  {
    name: "Basic",
    price: "$29",
    period: "/mes",
    description: "El más popular para veterinarias",
    features: [
      "Bot WhatsApp completo",
      "Historial médico con IA",
      "Dashboard admin",
      "Recordatorios automáticos",
      "3 usuarios",
    ],
    cta: "Suscribirse",
    highlighted: true,
  },
  {
    name: "Pro",
    price: "$79",
    period: "/mes",
    description: "Para clínicas con alto volumen",
    features: [
      "Todo lo de Basic",
      "Análisis de imágenes con IA",
      "Analíticas avanzadas",
      "Multi-agente",
      "Soporte prioritario",
      "Usuarios ilimitados",
    ],
    cta: "Suscribirse",
    highlighted: false,
  },
];

// ─── Shared components ────────────────────────────────────────────────────────

function NavBar() {
  return (
    <header className="sticky top-0 z-40 border-b border-white/10 bg-zinc-950/80 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <span className="text-lg font-bold text-white tracking-tight">
          Mateos Pet <span className="text-white/50">AI</span>
        </span>
        <nav className="flex items-center gap-3">
          <Link
            href="/login"
            className="text-sm text-white/70 hover:text-white transition-colors"
          >
            Iniciar sesión
          </Link>
          <Link
            href="/onboarding"
            className="rounded-lg bg-white px-4 py-1.5 text-sm font-semibold text-zinc-950 transition-colors hover:bg-white/90"
          >
            Comenzar gratis
          </Link>
        </nav>
      </div>
    </header>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-block rounded-full border border-zinc-200 bg-zinc-100 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-zinc-500">
      {children}
    </span>
  );
}

// ─── Sections ─────────────────────────────────────────────────────────────────

function Hero() {
  return (
    <section className="relative overflow-hidden bg-zinc-950 px-6 pb-24 pt-24 text-white">
      {/* subtle grid decoration */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage:
            "linear-gradient(to right,#fff 1px,transparent 1px),linear-gradient(to bottom,#fff 1px,transparent 1px)",
          backgroundSize: "48px 48px",
        }}
      />

      <div className="relative mx-auto max-w-3xl text-center">
        <span className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-4 py-1.5 text-sm text-white/70">
          Usado por Mateos Pet en Colombia 🇨🇴
        </span>

        <h1 className="mt-2 text-5xl font-bold leading-tight tracking-tight sm:text-6xl">
          El Agente de IA para tu Veterinaria
        </h1>

        <p className="mt-6 text-lg leading-relaxed text-white/60 sm:text-xl">
          Agenda citas, recuerda clientes y gestiona tu veterinaria por
          WhatsApp — automáticamente.
        </p>

        <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
          <Link
            href="/onboarding"
            className="inline-flex h-12 items-center justify-center rounded-xl bg-white px-8 text-sm font-semibold text-zinc-950 transition-colors hover:bg-white/90"
          >
            Comenzar gratis →
          </Link>
          <Link
            href="#como-funciona"
            className="inline-flex h-12 items-center justify-center rounded-xl border border-white/20 px-8 text-sm font-medium text-white/80 transition-colors hover:border-white/40 hover:text-white"
          >
            Cómo funciona
          </Link>
        </div>

        {/* mock chat bubble */}
        <div className="mt-16 mx-auto max-w-sm rounded-2xl border border-white/10 bg-white/5 p-5 text-left text-sm">
          <p className="text-white/40 text-xs mb-3 font-medium">
            WhatsApp · Mateos Pet AI
          </p>
          <div className="space-y-2">
            <div className="inline-block rounded-xl rounded-tl-none bg-zinc-700 px-3 py-2 text-white/80">
              Hola! Quiero una cita para bañar a mi perro Max 🐕
            </div>
            <div className="flex justify-end">
              <div className="inline-block rounded-xl rounded-tr-none bg-green-600/80 px-3 py-2 text-white">
                ¡Hola! 😊 Con gusto. ¿Para cuándo necesitas la cita?
              </div>
            </div>
            <div className="inline-block rounded-xl rounded-tl-none bg-zinc-700 px-3 py-2 text-white/80">
              Mañana a las 3pm si hay disponibilidad
            </div>
            <div className="flex justify-end">
              <div className="inline-block rounded-xl rounded-tr-none bg-green-600/80 px-3 py-2 text-white">
                ✅ Cita confirmada para Max — mañana 3:00 PM. ¡Te esperamos!
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function Features() {
  return (
    <section className="bg-white px-6 py-24">
      <div className="mx-auto max-w-6xl">
        <div className="mb-16 text-center">
          <SectionLabel>Funciones</SectionLabel>
          <h2 className="mt-4 text-3xl font-bold tracking-tight sm:text-4xl">
            Todo lo que necesitas, listo para usar
          </h2>
          <p className="mt-4 text-muted-foreground">
            Sin configuraciones complejas. Conecta y empieza a automatizar.
          </p>
        </div>

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => (
            <div
              key={f.title}
              className="rounded-2xl border bg-zinc-50/60 p-6 transition-shadow hover:shadow-md"
            >
              <span className="text-3xl">{f.emoji}</span>
              <h3 className="mt-4 font-semibold">{f.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                {f.body}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function HowItWorks() {
  return (
    <section
      id="como-funciona"
      className="bg-zinc-50 px-6 py-24"
    >
      <div className="mx-auto max-w-4xl">
        <div className="mb-16 text-center">
          <SectionLabel>Cómo funciona</SectionLabel>
          <h2 className="mt-4 text-3xl font-bold tracking-tight sm:text-4xl">
            En marcha en menos de 10 minutos
          </h2>
        </div>

        <div className="relative grid gap-8 md:grid-cols-3">
          {/* connector line */}
          <div
            aria-hidden
            className="absolute top-7 left-[16.6%] right-[16.6%] hidden h-px bg-zinc-200 md:block"
          />

          {HOW_IT_WORKS.map((s) => (
            <div key={s.n} className="relative flex flex-col items-center text-center">
              <div className="relative z-10 flex h-14 w-14 items-center justify-center rounded-full border-2 border-zinc-200 bg-white font-mono text-lg font-bold text-zinc-400">
                {s.n}
              </div>
              <h3 className="mt-5 font-semibold">{s.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                {s.body}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Pricing() {
  return (
    <section className="bg-white px-6 py-24">
      <div className="mx-auto max-w-5xl">
        <div className="mb-16 text-center">
          <SectionLabel>Precios</SectionLabel>
          <h2 className="mt-4 text-3xl font-bold tracking-tight sm:text-4xl">
            Simple y transparente
          </h2>
          <p className="mt-4 text-muted-foreground">
            Empieza gratis. Escala cuando lo necesites.
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          {PLANS.map((plan) => (
            <div
              key={plan.name}
              className={[
                "relative flex flex-col rounded-2xl border p-8",
                plan.highlighted
                  ? "border-zinc-900 bg-zinc-950 text-white shadow-xl"
                  : "border-zinc-200 bg-white",
              ].join(" ")}
            >
              {plan.highlighted && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-white px-4 py-1 text-xs font-bold text-zinc-950 shadow">
                  Más popular
                </span>
              )}

              <div>
                <p
                  className={[
                    "text-sm font-semibold",
                    plan.highlighted ? "text-white/60" : "text-muted-foreground",
                  ].join(" ")}
                >
                  {plan.name}
                </p>
                <div className="mt-2 flex items-baseline gap-1">
                  <span className="text-4xl font-bold">{plan.price}</span>
                  {plan.period && (
                    <span
                      className={
                        plan.highlighted
                          ? "text-white/50 text-sm"
                          : "text-muted-foreground text-sm"
                      }
                    >
                      {plan.period}
                    </span>
                  )}
                </div>
                <p
                  className={[
                    "mt-2 text-sm",
                    plan.highlighted ? "text-white/60" : "text-muted-foreground",
                  ].join(" ")}
                >
                  {plan.description}
                </p>
              </div>

              <ul className="mt-8 flex-1 space-y-3">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm">
                    <span
                      className={
                        plan.highlighted ? "text-green-400" : "text-green-600"
                      }
                    >
                      ✓
                    </span>
                    <span
                      className={
                        plan.highlighted ? "text-white/80" : undefined
                      }
                    >
                      {f}
                    </span>
                  </li>
                ))}
              </ul>

              <Link
                href="/onboarding"
                className={[
                  "mt-8 flex h-11 items-center justify-center rounded-xl text-sm font-semibold transition-colors",
                  plan.highlighted
                    ? "bg-white text-zinc-950 hover:bg-white/90"
                    : "border border-zinc-200 bg-zinc-50 text-zinc-900 hover:bg-zinc-100",
                ].join(" ")}
              >
                {plan.cta}
              </Link>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Testimonial() {
  return (
    <section className="bg-zinc-50 px-6 py-24">
      <div className="mx-auto max-w-2xl text-center">
        <SectionLabel>Testimonios</SectionLabel>

        <blockquote className="mt-10">
          <p className="text-xl font-medium leading-relaxed text-zinc-800 sm:text-2xl">
            &ldquo;Desde que instalamos Mateos Pet AI, dejamos de perder citas
            por mensajes sin responder. El bot atiende a nuestros clientes
            incluso a las 2 de la mañana.&rdquo;
          </p>
          <footer className="mt-8 flex items-center justify-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-zinc-900 text-xl text-white">
              🐾
            </div>
            <div className="text-left">
              <p className="font-semibold">Mateos Pet</p>
              <p className="text-sm text-muted-foreground">
                Peluquería & Veterinaria · Medellín, Colombia 🇨🇴
              </p>
            </div>
          </footer>
        </blockquote>
      </div>
    </section>
  );
}

function FinalCTA() {
  return (
    <section className="bg-zinc-950 px-6 py-24 text-white">
      <div className="mx-auto max-w-2xl text-center">
        <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
          ¿Listo para automatizar tu veterinaria?
        </h2>
        <p className="mt-4 text-lg text-white/60">
          Regístrate gratis hoy. Sin tarjeta de crédito.
        </p>
        <div className="mt-10">
          <Link
            href="/onboarding"
            className="inline-flex h-12 items-center justify-center rounded-xl bg-white px-10 text-sm font-semibold text-zinc-950 transition-colors hover:bg-white/90"
          >
            Comenzar gratis →
          </Link>
        </div>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="border-t bg-white px-6 py-10">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 sm:flex-row">
        <span className="text-sm font-semibold text-zinc-900">
          Mateos Pet <span className="text-zinc-400">AI</span>
        </span>
        <nav className="flex gap-6 text-sm text-muted-foreground">
          <Link href="/onboarding" className="hover:text-foreground transition-colors">
            Registro
          </Link>
          <Link href="/login" className="hover:text-foreground transition-colors">
            Acceso
          </Link>
        </nav>
        <p className="text-xs text-muted-foreground">
          © {new Date().getFullYear()} Mateos Pet AI
        </p>
      </div>
    </footer>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function LandingPage() {
  return (
    <>
      <NavBar />
      <Hero />
      <Features />
      <HowItWorks />
      <Pricing />
      <Testimonial />
      <FinalCTA />
      <Footer />
    </>
  );
}
