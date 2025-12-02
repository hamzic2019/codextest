import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

type BadgeVariant = "sky" | "emerald" | "slate" | "amber" | "red";

const variantStyles: Record<BadgeVariant, string> = {
  sky: "bg-sky-50 text-sky-700 border-sky-100",
  emerald: "bg-emerald-50 text-emerald-700 border-emerald-100",
  slate: "bg-slate-50 text-slate-700 border-slate-200",
  amber: "bg-amber-50 text-amber-700 border-amber-100",
  red: "bg-rose-50 text-rose-700 border-rose-100",
};

export function Badge({
  children,
  variant = "slate",
  className,
}: {
  children: ReactNode;
  variant?: BadgeVariant;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-wide",
        variantStyles[variant],
        className
      )}
    >
      {children}
    </span>
  );
}
