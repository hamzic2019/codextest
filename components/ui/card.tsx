import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

export function Card({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-3xl border border-border/70 bg-white/80 p-4 shadow-lg shadow-sky-100/60 backdrop-blur",
        className
      )}
    >
      {children}
    </div>
  );
}
