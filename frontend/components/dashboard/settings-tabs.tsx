"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { StaffManager } from "@/components/dashboard/staff-manager";
import { TenantsTable } from "@/components/dashboard/tenants-table";

export function SettingsTabs({
  isSuperAdmin,
  children,
}: {
  isSuperAdmin: boolean;
  children: React.ReactNode;
}) {
  return (
    <Tabs defaultValue="negocio" className="space-y-4">
      <TabsList>
        <TabsTrigger value="negocio">Negocio</TabsTrigger>
        <TabsTrigger value="staff">Staff</TabsTrigger>
        {isSuperAdmin && <TabsTrigger value="tenants">Tenants</TabsTrigger>}
      </TabsList>

      <TabsContent value="negocio">{children}</TabsContent>
      <TabsContent value="staff">
        <StaffManager />
      </TabsContent>
      {isSuperAdmin && (
        <TabsContent value="tenants">
          <TenantsTable />
        </TabsContent>
      )}
    </Tabs>
  );
}
