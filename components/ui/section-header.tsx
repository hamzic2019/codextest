import type { ReactNode } from "react";

export function SectionHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <div>
        <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
        {subtitle ? (
          <p className="text-sm text-slate-500">{subtitle}</p>
        ) : null}
      </div>
      {action ? <div className="ml-auto">{action}</div> : null}
    </div>
  );
}
