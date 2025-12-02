/* UI skeleton for primary app pages. */
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo } from "react";
import { HeartPulse, Settings2, Sparkles, Users2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ReactNode } from "react";
import { LanguageProvider, useTranslations } from "../i18n/language-provider";

const baseNavItems = [
  { labelKey: "nav.aiPlanner" as const, href: "/planner", icon: Sparkles },
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
    <div className="min-h-screen px-4 py-6 md:px-6">
      <div className="mx-auto flex max-w-[1600px] gap-6 lg:items-stretch">
        <aside className="hidden min-w-[220px] max-w-[240px] flex-col rounded-3xl border border-border/60 bg-white/90 p-4 shadow-sm backdrop-blur lg:flex lg:h-[calc(100vh-3rem)]">
          <Link
            href={primaryNavHref}
            className="flex items-center gap-3 rounded-2xl border border-sky-100 bg-sky-50 px-3 py-3 text-slate-900"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white text-lg font-semibold leading-none text-sky-600 shadow-sm">
              PK
            </div>
            <div className="leading-tight">
              <div className="text-xs uppercase tracking-[0.2em] text-slate-500">
                PflegeKI
              </div>
              <div className="text-lg font-semibold">Shift Studio</div>
            </div>
          </Link>

          <nav className="mt-6 flex flex-col gap-1">
            {navItemsWithoutSettings.map((item) => {
              const Icon = item.icon;
              const active =
                pathname === item.href || pathname.startsWith(item.href);

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "group flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm font-medium transition",
                    active
                      ? "bg-sky-50 text-sky-700 ring-1 ring-sky-200"
                      : "text-slate-700 hover:bg-slate-50"
                  )}
                >
                  <span
                    className={cn(
                      "flex h-9 w-9 items-center justify-center rounded-xl border text-slate-700",
                      active
                        ? "border-sky-200 bg-white text-sky-700"
                        : "border-border/60 bg-white/70"
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
            <div className="mt-auto">
              <Link
                href={settingsNavItem.href}
                className={cn(
                  "group flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm font-medium transition",
                  pathname === settingsNavItem.href ||
                    pathname.startsWith(settingsNavItem.href)
                    ? "bg-sky-50 text-sky-700 ring-1 ring-sky-200"
                    : "text-slate-700 hover:bg-slate-50"
                )}
              >
                <span
                  className={cn(
                    "flex h-9 w-9 items-center justify-center rounded-xl border text-slate-700",
                    pathname === settingsNavItem.href ||
                      pathname.startsWith(settingsNavItem.href)
                      ? "border-sky-200 bg-white text-sky-700"
                      : "border-border/60 bg-white/70"
                  )}
                >
                  <SettingsIcon className="h-4 w-4" strokeWidth={2.2} />
                </span>
                {settingsNavItem.label}
              </Link>
            </div>
          )}

        </aside>

        <div className="flex flex-1 flex-col gap-4 lg:gap-5">
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
  );
}
