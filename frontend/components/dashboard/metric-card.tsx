import { type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

type MetricCardProps = {
  icon: LucideIcon;
  tint: string;
  label: string;
  value: string;
  delta: React.ReactNode;
  size?: "sm" | "lg";
};

export function MetricCard({
  icon: Icon,
  tint,
  label,
  value,
  delta,
  size = "lg",
}: MetricCardProps) {
  const isLg = size === "lg";
  return (
    <div
      className={cn(
        "group relative overflow-hidden rounded-xl border border-white/[0.06] bg-card",
        "shadow-[0_1px_4px_rgba(0,0,0,0.3)] transition-all duration-200",
        "hover:-translate-y-0.5 hover:border-white/[0.1] hover:shadow-[0_8px_32px_-8px_rgba(0,0,0,0.55)]",
        isLg ? "p-5" : "p-4"
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <p
          className={cn(
            "font-medium text-muted-foreground",
            isLg ? "text-sm" : "text-xs"
          )}
        >
          {label}
        </p>
        <div
          className={cn(
            "flex shrink-0 items-center justify-center ring-1 ring-white/10",
            "transition-transform duration-200 group-hover:scale-110",
            tint,
            isLg ? "h-11 w-11 rounded-xl" : "h-9 w-9 rounded-lg"
          )}
        >
          <Icon className={isLg ? "h-5 w-5" : "h-[18px] w-[18px]"} />
        </div>
      </div>
      <p
        className={cn(
          "font-bold tracking-tight tabular-nums",
          isLg ? "mt-3 text-3xl" : "mt-2 text-2xl"
        )}
      >
        {value}
      </p>
      <div className="mt-1">{delta}</div>
    </div>
  );
}
