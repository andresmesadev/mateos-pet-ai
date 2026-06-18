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
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-3">
        {Icon && (
          <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${tint}`}>
            <Icon className="h-5 w-5" />
          </div>
        )}
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
          {description && (
            <p className="mt-1 text-sm text-muted-foreground">{description}</p>
          )}
        </div>
      </div>

      {children && <div className="flex shrink-0 items-center gap-2">{children}</div>}
    </div>
  );
}
