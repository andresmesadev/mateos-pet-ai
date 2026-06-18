import Link from "next/link";
import { type ReactNode } from "react";

import { Button } from "@/components/ui/button";

type EmptyStateProps = {
  /** Emoji o ícono grande mostrado en el círculo superior */
  icon: ReactNode;
  title: string;
  description: string;
  /** CTA opcional — si el agente WhatsApp es la fuente de datos, suele omitirse */
  action?: { label: string; href: string };
  /** Pista secundaria (ej. "El agente WhatsApp está activo") */
  hint?: string;
};

export function EmptyState({ icon, title, description, action, hint }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed px-6 py-12 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted text-3xl">
        {icon}
      </div>
      <p className="mt-4 text-base font-semibold">{title}</p>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">{description}</p>

      {action && (
        <Button asChild size="sm" className="mt-4">
          <Link href={action.href}>{action.label}</Link>
        </Button>
      )}

      {hint && (
        <div className="mt-4 flex items-center gap-1.5 text-xs text-muted-foreground">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-green-500" />
          </span>
          {hint}
        </div>
      )}
    </div>
  );
}
