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

function accentBorderFromTint(tint: string): string {
  if (tint.includes("teal")) return "border-t-teal-500/60";
  if (tint.includes("violet")) return "border-t-violet-500/60";
  if (tint.includes("amber")) return "border-t-amber-500/60";
  if (tint.includes("sky")) return "border-t-sky-500/60";
  if (tint.includes("rose")) return "border-t-rose-500/60";
  if (tint.includes("emerald")) return "border-t-emerald-500/60";
  if (tint.includes("orange")) return "border-t-orange-500/60";
  return "border-t-white/20";
}

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
        "group relative overflow-hidden rounded-xl border border-white/[0.1] border-t-2 bg-card",
        accentBorderFromTint(tint),
        "shadow-[0_2px_8px_rgba(0,0,0,0.35)] transition-all duration-200",
        "hover:-translate-y-0.5 hover:border-white/[0.15] hover:shadow-[0_8px_32px_-8px_rgba(0,0,0,0.6)]",
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
            "flex shrink-0 items-center justify-center ring-1 ring-white/[0.12]",
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
          isLg ? "mt-3 text-3xl" : "mt-2 text-[1.6rem]"
        )}
      >
        {value}
      </p>
      <div className="mt-1">{delta}</div>
    </div>
  );
}
