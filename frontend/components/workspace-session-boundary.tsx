"use client";

import { useEffect } from "react";
import { useSession } from "next-auth/react";
import { ensureWorkspaceOwner, workspaceStorage } from "@/lib/workspace-session";

export function WorkspaceSessionBoundary() {
  const { data: session, status } = useSession();
  const user = session?.user;
  const owner = status === "authenticated" && user?.email ? `${user.email.toLowerCase()}:${user.staffId ?? "admin"}:${user.sessionVersion ?? "current"}` : null;
  useEffect(() => { if (status !== "loading") ensureWorkspaceOwner(workspaceStorage(), owner); }, [owner, status]);
  return null;
}
