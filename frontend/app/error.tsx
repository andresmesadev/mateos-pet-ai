"use client";
import { WorkspaceError } from "@/components/dashboard/workspace-error";

export default function Error({ retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return <main className="flex min-h-screen items-center bg-background p-4 text-foreground"><WorkspaceError onRetry={retry} standalone /></main>;
}
