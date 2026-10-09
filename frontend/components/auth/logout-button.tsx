"use client";

import { signOut } from "next-auth/react";
import { clearWorkspaceSession, workspaceStorage } from "@/lib/workspace-session";

import { Button } from "@/components/ui/button";

export function LogoutButton() {
  return (
    <Button
      type="button"
      variant="outline"
      onClick={() => { clearWorkspaceSession(workspaceStorage()); void signOut({ callbackUrl: "/login" }); }}
    >
      Cerrar sesión
    </Button>
  );
}
