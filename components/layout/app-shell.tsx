/* UI skeleton for primary app pages. */
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo } from "react";
import { BarChart3, CalendarClock, HeartPulse, Settings2, Sparkles, Users2 } from "lucide-react";
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
  { labelKey: "nav.analytics" as const, href: "/analytics", icon: BarChart3 },
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
      <aside className="relative hidden w-80 flex-col overflow-hidden border-r border-slate-800/50 bg-slate-900 px-5 py-6 text-slate-100 lg:fixed lg:inset-y-0 lg:left-0 lg:z-40 lg:flex lg:overflow-y-auto">

        <div className="relative space-y-4">
          <div className="flex items-center gap-3 rounded-3xl border border-white/10 bg-white/[0.04] px-3 py-3">
            <Link href={primaryNavHref} className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-sky-400 via-indigo-500 to-purple-500 text-lg font-semibold leading-none text-white ring-1 ring-white/35">
                PK
              </div>
              <div className="leading-tight">
                <div className="text-[11px] uppercase tracking-[0.28em] text-slate-200">
                  PflegeKI
                </div>
                <div className="text-lg font-semibold text-white">Shift Studio</div>
              </div>
            </Link>
          </div>
        </div>

        <nav className="relative mt-3 flex flex-col gap-1.5">
          {navItemsWithoutSettings.map((item) => {
            const Icon = item.icon;
            const active =
              pathname === item.href || pathname.startsWith(item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "group relative flex items-center gap-3 rounded-2xl px-3 py-3 text-sm font-semibold transition-all duration-150",
                  active
                    ? "bg-white/10 text-white ring-1 ring-white/10"
                    : "text-slate-200 hover:bg-white/10 hover:text-white"
                )}
              >
                <span
                  className={cn(
                    "flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-slate-200 transition-colors duration-150",
                    active
                      ? "border-white/25 bg-white/15 text-white"
                      : "group-hover:border-white/20 group-hover:bg-white/10"
                  )}
                >
                  <Icon className="h-5 w-5" strokeWidth={2.2} />
                </span>
                <span className="leading-tight">{item.label}</span>
                <span
                  className={cn(
                    "ml-auto h-2.5 w-2.5 rounded-full transition-colors duration-150",
                    active ? "bg-emerald-400" : "bg-white/20 group-hover:bg-white/40"
                  )}
                />
              </Link>
            );
          })}
        </nav>

        {settingsNavItem && SettingsIcon && (
          <div className="relative mt-auto space-y-3 border-t border-white/5 pt-4">
            <Link
              href={settingsNavItem.href}
              className={cn(
                "group flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.05] px-3 py-3 text-sm font-semibold transition-colors duration-150",
                pathname === settingsNavItem.href ||
                  pathname.startsWith(settingsNavItem.href)
                  ? "text-white ring-1 ring-white/10"
                  : "text-slate-200 hover:border-white/20 hover:bg-white/10 hover:text-white"
              )}
            >
              <span
                className={cn(
                  "flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-slate-200 transition-colors duration-150",
                  pathname === settingsNavItem.href ||
                    pathname.startsWith(settingsNavItem.href)
                    ? "border-white/25 bg-white/15 text-white"
                    : "group-hover:border-white/20 group-hover:bg-white/10"
                )}
              >
                <SettingsIcon className="h-5 w-5" strokeWidth={2.2} />
              </span>
              {settingsNavItem.label}
            </Link>
          </div>
        )}
      </aside>

      <div className="lg:pl-80">
        <div className="px-4 py-6 md:px-6">
          <div className="mx-auto flex max-w-[1600px] flex-col gap-4 lg:gap-5">
            <div className="grid grid-cols-2 gap-2 rounded-2xl border border-border/70 bg-white p-3 shadow-sm lg:hidden">
              {navItems.slice(0, 5).map((item) => {
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
