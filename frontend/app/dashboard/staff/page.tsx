import { UserCog } from "lucide-react";

import { PageHeader } from "@/components/dashboard/page-header";
import { StaffManager } from "@/components/dashboard/staff-manager";

export default function StaffPage() {
  return (
    <div>
      <PageHeader
        title="Equipo"
        description="Gestiona veterinarios, peluqueros y administrativos"
        icon={UserCog}
        tint="bg-sky-500/15 text-sky-400"
      />
      <StaffManager />
    </div>
  );
}
