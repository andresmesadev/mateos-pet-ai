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

function hoverGlowFromTint(tint: string): string {
  if (tint.includes("teal")) return "hover:shadow-[0_8px_32px_-4px_rgba(0,0,0,0.6),0_0_24px_rgba(20,184,166,0.25)]";
  if (tint.includes("violet")) return "hover:shadow-[0_8px_32px_-4px_rgba(0,0,0,0.6),0_0_24px_rgba(168,85,247,0.25)]";
  if (tint.includes("amber")) return "hover:shadow-[0_8px_32px_-4px_rgba(0,0,0,0.6),0_0_24px_rgba(245,158,11,0.25)]";
  if (tint.includes("sky")) return "hover:shadow-[0_8px_32px_-4px_rgba(0,0,0,0.6),0_0_24px_rgba(14,165,233,0.25)]";
  if (tint.includes("rose")) return "hover:shadow-[0_8px_32px_-4px_rgba(0,0,0,0.6),0_0_24px_rgba(244,63,94,0.25)]";
  if (tint.includes("emerald")) return "hover:shadow-[0_8px_32px_-4px_rgba(0,0,0,0.6),0_0_24px_rgba(16,185,129,0.25)]";
  return "hover:shadow-[0_8px_32px_-4px_rgba(0,0,0,0.6)]";
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
        "group relative overflow-hidden rounded-xl border-t-2 glass-card",
        "border border-white/[0.08]",
        accentBorderFromTint(tint),
        "bg-white/[0.04] shadow-[0_2px_8px_rgba(0,0,0,0.4)]",
        "transition-all duration-300",
        "-translate-y-0 hover:-translate-y-1",
        "hover:border-white/[0.14] hover:bg-white/[0.06]",
        hoverGlowFromTint(tint),
        isLg ? "p-5" : "p-4"
      )}
    >
      {/* Highlight inset superior */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />

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
            "flex shrink-0 items-center justify-center",
            "ring-1 ring-white/[0.12]",
            "transition-all duration-300",
            "group-hover:scale-110 group-hover:shadow-[0_0_14px_-2px_currentColor]",
            tint,
            isLg ? "h-11 w-11 rounded-xl" : "h-9 w-9 rounded-lg"
          )}
        >
          <Icon className={isLg ? "h-5 w-5" : "h-[18px] w-[18px]"} />
        </div>
      </div>

      <p
        className={cn(
          "gradient-text-value font-bold tracking-tight tabular-nums",
          isLg ? "mt-3 text-3xl" : "mt-2 text-[1.6rem]"
        )}
      >
        {value}
      </p>
      <div className="mt-1">{delta}</div>
    </div>
  );
}
