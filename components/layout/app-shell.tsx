/* UI skeleton for primary app pages. */
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo } from "react";
import { CalendarClock, HeartPulse, Settings2, Sparkles, Users2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ReactNode } from "react";
import { LanguageProvider, useTranslations } from "../i18n/language-provider";

const baseNavItems = [
  { labelKey: "nav.aiPlanner" as const, href: "/planner", icon: Sparkles },
  {
    labelKey: "nav.planOverview" as const,
    href: "/overview",
    icon: CalendarClock,
  },
  { labelKey: "nav.patients" as const, href: "/patients", icon: HeartPulse },
  { labelKey: "nav.workers" as const, href: "/workers", icon: Users2 },
  { labelKey: "nav.settings" as const, href: "/settings", icon: Settings2 },
];

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <LanguageProvider>
      <AppShellContent>{children}</AppShellContent>
    </LanguageProvider>
  );
}

function AppShellContent({ children }: { children: ReactNode }) {
  const { t } = useTranslations();
  const pathname = usePathname();
  const navItems = useMemo(
    () =>
      baseNavItems.map((item) => ({
        ...item,
        label: t(item.labelKey),
      })),
    [t]
  );
  const primaryNavHref = navItems[0]?.href ?? "/planner";
  const navItemsWithoutSettings = navItems.filter(
    (item) => item.labelKey !== "nav.settings"
  );
  const settingsNavItem = navItems.find(
    (item) => item.labelKey === "nav.settings"
  );
  const SettingsIcon = settingsNavItem?.icon;
  return (
    <div className="min-h-screen bg-[var(--background)]">
      <aside className="hidden w-72 flex-col border-r border-white/5 bg-gradient-to-b from-[#0f172a] via-[#0b1328] to-[#070d1c] px-4 py-6 text-slate-100 shadow-2xl lg:fixed lg:inset-y-0 lg:left-0 lg:z-40 lg:flex lg:overflow-y-auto">
        <Link
          href={primaryNavHref}
          className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-3 text-white shadow-[0_20px_60px_rgba(0,0,0,0.35)]"
        >
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-sky-400 to-indigo-500 text-lg font-semibold leading-none text-white ring-1 ring-white/30">
            PK
          </div>
          <div className="leading-tight">
            <div className="text-[11px] uppercase tracking-[0.25em] text-slate-300">
              PflegeKI - Your Buddy
            </div>
            <div className="text-lg font-semibold">Shift Studio</div>
          </div>
        </Link>

        <div className="mt-6 px-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
          Navigacija
        </div>
        <nav className="mt-2 flex flex-col gap-1.5">
          {navItemsWithoutSettings.map((item) => {
            const Icon = item.icon;
            const active =
              pathname === item.href || pathname.startsWith(item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition-all duration-150",
                  active
                    ? "bg-white/10 text-white shadow-[0_12px_35px_rgba(0,0,0,0.35)] ring-1 ring-white/15"
                    : "text-slate-200 hover:bg-white/5 hover:text-white hover:ring-1 hover:ring-white/10"
                )}
              >
                <span
                  className={cn(
                    "flex h-9 w-9 items-center justify-center rounded-xl border border-white/5 bg-white/5 text-slate-200",
                    active
                      ? "border-white/20 bg-white/10 text-white"
                      : "text-slate-300"
                  )}
                >
                  <Icon className="h-4 w-4" strokeWidth={2.2} />
                </span>
                {item.label}
              </Link>
            );
          })}
        </nav>

        {settingsNavItem && SettingsIcon && (
          <div className="mt-auto space-y-3 border-t border-white/5 pt-4">
            <Link
              href={settingsNavItem.href}
              className={cn(
                "group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition-all duration-150",
                pathname === settingsNavItem.href ||
                  pathname.startsWith(settingsNavItem.href)
                  ? "bg-white/10 text-white shadow-[0_12px_35px_rgba(0,0,0,0.35)] ring-1 ring-white/15"
                  : "text-slate-200 hover:bg-white/5 hover:text-white hover:ring-1 hover:ring-white/10"
              )}
            >
              <span
                className={cn(
                  "flex h-9 w-9 items-center justify-center rounded-xl border border-white/5 bg-white/5 text-slate-200",
                  pathname === settingsNavItem.href ||
                    pathname.startsWith(settingsNavItem.href)
                    ? "border-white/20 bg-white/10 text-white"
                    : "text-slate-300"
                )}
              >
                <SettingsIcon className="h-4 w-4" strokeWidth={2.2} />
              </span>
              {settingsNavItem.label}
            </Link>

            <div className="flex items-center gap-3 rounded-2xl border border-white/5 bg-white/[0.03] px-3 py-3 text-sm text-slate-100 shadow-[0_14px_40px_rgba(0,0,0,0.28)]">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-sky-500 to-indigo-500 text-base font-semibold text-white ring-1 ring-white/20">
                PK
              </div>
              <div className="leading-tight">
                <div className="text-sm font-semibold text-white">
                  PflegeKI tim
                </div>
                <div className="text-xs text-slate-300">Spremno za planiranje</div>
              </div>
            </div>
          </div>
        )}
      </aside>

      <div className="lg:pl-80">
        <div className="px-4 py-6 md:px-6">
          <div className="mx-auto flex max-w-[1600px] flex-col gap-4 lg:gap-5">
            <div className="grid grid-cols-2 gap-2 rounded-2xl border border-border/70 bg-white p-3 shadow-sm lg:hidden">
              {navItems.slice(0, 4).map((item) => {
                const Icon = item.icon;
                const active =
                  pathname === item.href || pathname.startsWith(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold transition",
                      active
                        ? "bg-sky-50 text-sky-700"
                        : "bg-white text-slate-800"
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    {item.label}
                  </Link>
                );
              })}
            </div>
            <main className="pb-12">{children}</main>
          </div>
        </div>
      </div>
    </div>
  );
}
