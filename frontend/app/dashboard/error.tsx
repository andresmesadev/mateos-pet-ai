"use client";
import { WorkspaceError } from "@/components/dashboard/workspace-error";

export default function Error({ retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return <WorkspaceError onRetry={retry} />;
}
