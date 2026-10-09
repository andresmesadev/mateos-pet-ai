import { Suspense } from "react";

import { DashboardSidebar } from "@/components/dashboard/dashboard-sidebar";
import { DashboardTopbar } from "@/components/dashboard/dashboard-topbar";
import { BreadcrumbNav } from "@/components/dashboard/breadcrumb-nav";
import { ToastProvider } from "@/components/ui/toast";
import { DashboardAccessProvider } from "@/components/dashboard/dashboard-access-provider";
import { OperationHelp } from "@/components/dashboard/operation-help";
import { DashboardLoading } from "@/components/dashboard/dashboard-loading";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ToastProvider>
      <Suspense fallback={<div className="p-6 md:p-8"><DashboardLoading /></div>}><DashboardAccessProvider>
      <div className="min-h-screen bg-[#f5f9f8] text-foreground">

        <DashboardSidebar />

        <div className="lg:pl-64">
          <Suspense fallback={null}>
            <DashboardTopbar />
          </Suspense>
          <main className="px-4 py-6 md:px-8 md:py-8">
            <Suspense fallback={<DashboardLoading />}>
              <BreadcrumbNav />
              {children}
              <OperationHelp />
            </Suspense>
          </main>
        </div>
      </div>
      </DashboardAccessProvider></Suspense>
    </ToastProvider>
  );
}
