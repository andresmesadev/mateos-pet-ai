import { type LucideIcon } from "lucide-react";

import { Card } from "@/components/ui/card";

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
    <Card className={isLg ? "p-5" : "p-4"}>
      <div className="flex items-start justify-between gap-2">
        <p className={`font-medium text-muted-foreground ${isLg ? "text-sm" : "text-xs"}`}>
          {label}
        </p>
        <div
          className={`flex shrink-0 items-center justify-center ${tint} ${
            isLg ? "h-11 w-11 rounded-xl" : "h-9 w-9 rounded-lg"
          }`}
        >
          <Icon className={isLg ? "h-5 w-5" : "h-[18px] w-[18px]"} />
        </div>
      </div>
      <p className={`font-bold tracking-tight ${isLg ? "mt-3 text-3xl" : "mt-2 text-2xl"}`}>
        {value}
      </p>
      <div className="mt-1">{delta}</div>
    </Card>
  );
}
