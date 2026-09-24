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
      <div className="min-h-screen bg-[#f5f9f8] text-foreground">

        <DashboardSidebar />

        <div className="lg:pl-64">
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
