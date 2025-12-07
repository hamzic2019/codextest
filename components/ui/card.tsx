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
        "rounded-3xl border border-border/60 bg-white p-4 shadow-sm",
        className
      )}
    >
      {children}
    </div>
  );
}
