"use client";

import { Card } from "@/components/ui/card";
import {
  LANGUAGE_OPTIONS,
  useTranslations,
  type Language,
} from "@/components/i18n/language-provider";
import { Check, Languages } from "lucide-react";

export default function SettingsPage() {
  const { t, language, setLanguage } = useTranslations();

  const languageOptionLabel = (code: Language) => {
    if (code === "bs") return t("language.bs");
    if (code === "de") return t("language.de");
    return t("language.en");
  };

  return (
    <div className="flex flex-col gap-5">
      <Card className="border border-slate-200 px-5 py-6">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-900 text-white shadow-sm">
            <Languages className="h-5 w-5" />
          </div>
          <div className="flex-1">
            <p className="text-xs uppercase tracking-[0.2em] text-slate-500">
              {t("nav.settings")}
            </p>
            <h1 className="text-xl font-semibold text-slate-900">
              {t("settings.title")}
            </h1>
            <p className="mt-1 text-sm text-slate-600">{t("settings.subtitle")}</p>
          </div>
        </div>
      </Card>

      <Card className="space-y-4 border border-slate-200 bg-white/95 px-5 py-5 shadow-sm">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-100 text-slate-700 ring-1 ring-slate-200">
            <Languages className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-slate-500">
              {t("settings.languageLabel")}
            </p>
            <p className="text-sm text-slate-600">{t("settings.languageDescription")}</p>
          </div>
        </div>

        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
          {LANGUAGE_OPTIONS.map((option) => {
            const selected = language === option.code;
            return (
              <button
                key={option.code}
                type="button"
                onClick={() => setLanguage(option.code)}
                className={`flex items-center gap-3 rounded-2xl border px-3 py-3 text-left transition ${
                  selected
                    ? "border-sky-200 bg-sky-50/80 shadow-sm"
                    : "border-slate-200 bg-white hover:-translate-y-[1px] hover:border-slate-300"
                }`}
              >
                <span
                  className={`flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br text-sm font-bold text-white shadow-sm ${option.accent}`}
                  aria-hidden
                >
                  {option.short}
                </span>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-slate-900">
                      {languageOptionLabel(option.code)}
                    </p>
                    {selected ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-slate-900 px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-white">
                        <Check className="h-3 w-3" />
                        {t("settings.selected")}
                      </span>
                    ) : null}
                  </div>
                  <p className="text-xs text-slate-500">
                    {t(
                      option.code === "bs"
                        ? "language.bs.helper"
                        : option.code === "de"
                          ? "language.de.helper"
                          : "language.en.helper"
                    )}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      </Card>
    </div>
  );
}
