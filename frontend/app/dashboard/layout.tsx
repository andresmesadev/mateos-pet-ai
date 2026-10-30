import { Suspense } from "react";

import { ToastProvider } from "@/components/ui/toast";
import { DashboardFrame } from "@/components/dashboard/dashboard-frame";
import { DashboardLoading } from "@/components/dashboard/dashboard-loading";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ToastProvider>
      <Suspense fallback={<div className="p-6 md:p-8"><DashboardLoading /></div>}><DashboardFrame>{children}</DashboardFrame></Suspense>
    </ToastProvider>
  );
}
