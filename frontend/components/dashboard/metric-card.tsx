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
  const isLarge = size === "lg";

  return (
    <div
      className={cn(
        "flex min-w-0 flex-col rounded-2xl border border-slate-200 bg-white shadow-sm",
        isLarge ? "min-h-40 p-5" : "min-h-36 p-4"
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs font-semibold leading-snug text-slate-600 sm:text-sm">{label}</p>
        <span className={cn("flex shrink-0 items-center justify-center rounded-xl", tint, isLarge ? "h-11 w-11" : "h-9 w-9")}>
          <Icon className={isLarge ? "h-5 w-5" : "h-[18px] w-[18px]"} aria-hidden="true" />
        </span>
      </div>
      <p className={cn("mt-auto break-words font-bold tracking-tight tabular-nums text-slate-900", isLarge ? "text-3xl" : "text-2xl")}>
        {value}
      </p>
      <div className="mt-1 min-h-5">{delta}</div>
    </div>
  );
}
