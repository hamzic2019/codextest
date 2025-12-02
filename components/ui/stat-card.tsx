import { TrendingDown, TrendingUp } from "lucide-react";
import { Card } from "./card";
import { cn } from "@/lib/utils";

export function StatCard({
  title,
  value,
  trend,
  caption,
}: {
  title: string;
  value: string;
  trend?: { value: string; direction: "up" | "down" };
  caption?: string;
}) {
  const positive = trend?.direction === "up";

  return (
    <Card className="flex flex-col gap-3">
      <div className="text-xs uppercase tracking-[0.2em] text-slate-500">
        {title}
      </div>
      <div className="text-3xl font-semibold text-slate-900">{value}</div>
      <div className="flex items-center gap-2 text-sm text-slate-500">
        {trend ? (
          <span
            className={cn(
              "inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-semibold",
              positive
                ? "bg-emerald-50 text-emerald-700"
                : "bg-rose-50 text-rose-700"
            )}
          >
            {positive ? (
              <TrendingUp className="h-3.5 w-3.5" />
            ) : (
              <TrendingDown className="h-3.5 w-3.5" />
            )}
            {trend.value}
          </span>
        ) : null}
        {caption ? <span>{caption}</span> : null}
      </div>
    </Card>
  );
}
