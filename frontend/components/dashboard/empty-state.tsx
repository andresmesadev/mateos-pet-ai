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
    <div className="flex flex-col items-center justify-center rounded-xl border border-white/[0.08] bg-muted/10 px-6 py-14 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-muted/60 text-3xl ring-1 ring-white/[0.08] shadow-[0_0_24px_-8px_rgba(0,0,0,0.4)]">
        {icon}
      </div>
      <p className="mt-5 text-base font-semibold tracking-tight">{title}</p>
      <p className="mt-1.5 max-w-xs text-sm text-muted-foreground leading-relaxed">{description}</p>

      {action && (
        <Button asChild size="sm" className="mt-5">
          <Link href={action.href}>{action.label}</Link>
        </Button>
      )}

      {hint && (
        <div className="mt-5 flex items-center gap-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/5 px-3 py-1.5 text-xs text-emerald-400">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
          </span>
          {hint}
        </div>
      )}
    </div>
  );
}
