import { Suspense } from "react";

import { DashboardSidebar } from "@/components/dashboard/dashboard-sidebar";
import { DashboardTopbar } from "@/components/dashboard/dashboard-topbar";
import { BreadcrumbNav } from "@/components/dashboard/breadcrumb-nav";
import { ToastProvider } from "@/components/ui/toast";

function AmbientOrbs() {
  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
      {/* Orbe principal azul cielo — esquina superior izquierda ("confianza clínica") */}
      <div
        className="absolute -left-48 -top-48 h-[700px] w-[700px] animate-pulse rounded-full"
        style={{
          background: "radial-gradient(circle, oklch(0.72 0.16 232 / 16%) 0%, transparent 70%)",
          animationDuration: "8s",
        }}
      />
      {/* Orbe verde fresco — esquina inferior derecha ("salud"/naturaleza) */}
      <div
        className="absolute -bottom-32 -right-48 h-[600px] w-[600px] animate-pulse rounded-full"
        style={{
          background: "radial-gradient(circle, oklch(0.72 0.16 152 / 13%) 0%, transparent 70%)",
          animationDuration: "12s",
          animationDelay: "4s",
        }}
      />
      {/* Orbe azul cielo pequeño — centro derecha */}
      <div
        className="absolute right-1/4 top-1/3 h-[400px] w-[400px] animate-pulse rounded-full"
        style={{
          background: "radial-gradient(circle, oklch(0.72 0.16 232 / 9%) 0%, transparent 70%)",
          animationDuration: "10s",
          animationDelay: "2s",
        }}
      />
    </div>
  );
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ToastProvider>
      <div
        className="relative min-h-screen bg-background text-foreground"
        style={{
          backgroundImage: [
            /* Gradiente ambiental azul cielo arriba izquierda */
            "radial-gradient(ellipse 75% 45% at 10% -5%, oklch(0.72 0.14 232 / 16%) 0%, transparent 55%)",
            /* Gradiente ambiental verde fresco abajo derecha */
            "radial-gradient(ellipse 55% 40% at 90% 105%, oklch(0.72 0.15 152 / 12%) 0%, transparent 55%)",
            /* Grid puntual sutil */
            "radial-gradient(circle at 1px 1px, oklch(0.4 0.03 235 / 7%) 1px, transparent 0)",
          ].join(", "),
          backgroundSize: "100% 100%, 100% 100%, 28px 28px",
        }}
      >
        <AmbientOrbs />

        <DashboardSidebar />

        {/* Contenido principal — encima de los orbes */}
        <div className="relative z-10 lg:pl-64">
          <Suspense fallback={null}>
            <DashboardTopbar />
          </Suspense>
          <main className="px-4 py-6 md:px-8 md:py-8">
            <Suspense fallback={null}>
              <BreadcrumbNav />
              {children}
            </Suspense>
          </main>
        </div>
      </div>
    </ToastProvider>
  );
}
