import { Suspense } from "react";

import { DashboardSidebar } from "@/components/dashboard/dashboard-sidebar";
import { DashboardTopbar } from "@/components/dashboard/dashboard-topbar";
import { BreadcrumbNav } from "@/components/dashboard/breadcrumb-nav";
import { ToastProvider } from "@/components/ui/toast";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ToastProvider>
      <div className="dark min-h-screen bg-background text-foreground">
        <DashboardSidebar />

        {/* Contenido (deja espacio para el sidebar fijo en desktop) */}
        <div className="lg:pl-64">
          <DashboardTopbar />
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
