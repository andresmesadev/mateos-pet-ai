import { type LucideIcon } from "lucide-react";

/**
 * Encabezado de página estándar para todas las pantallas internas del dashboard.
 * Garantiza tipografía, espaciado e iconografía consistentes.
 */
export function PageHeader({
  title,
  description,
  icon: Icon,
  tint = "bg-primary/15 text-primary",
  children,
}: {
  title: string;
  description?: string;
  icon?: LucideIcon;
  tint?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between pb-5 border-b border-white/[0.08]">
      <div className="flex items-center gap-4">
        {Icon && (
          <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ring-1 ring-white/[0.12] shadow-[0_0_16px_-4px_rgba(0,0,0,0.5)] ${tint}`}>
            <Icon className="h-6 w-6" />
          </div>
        )}
        <div>
          <h1 className="text-2xl font-bold tracking-tight leading-tight">{title}</h1>
          {description && (
            <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>
          )}
        </div>
      </div>

      {children && <div className="flex shrink-0 items-center gap-2">{children}</div>}
    </div>
  );
}
