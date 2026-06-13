import { LogoutButton } from "@/components/auth/logout-button";
import { DashboardNav } from "@/components/dashboard/dashboard-nav";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <main className="min-h-screen bg-muted/40 p-6">
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-4xl font-bold tracking-tight">Mateos Pet AI</h1>
          <p className="mt-2 text-muted-foreground">
            Dashboard administrativo inteligente
          </p>
        </div>

        <LogoutButton />
      </div>

      <DashboardNav />
      {children}
    </main>
  );
}
