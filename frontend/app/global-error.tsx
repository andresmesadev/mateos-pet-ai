"use client";
import { WorkspaceError } from "@/components/dashboard/workspace-error";
import "./globals.css";

export default function GlobalError({ retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return <html lang="es"><head><title>Recuperar acceso · Mateos Pet AI</title></head><body style={{ fontFamily: "Arial, Helvetica, sans-serif" }} className="min-h-screen bg-background text-foreground"><main className="flex min-h-screen items-center p-4"><WorkspaceError onRetry={retry} standalone /></main></body></html>;
}
