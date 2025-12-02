"use client";

import { useMemo, useState } from "react";
import { CalendarClock, Info, ListChecks, Moon, Sun } from "lucide-react";
import { PatientSelector } from "@/components/planner/patient-selector";
import { Card } from "@/components/ui/card";
import { patients, planPreviews, shifts, workers } from "@/lib/mock-data";
import { useTranslations } from "@/components/i18n/language-provider";
import type { Language } from "@/components/i18n/language-provider";

const MONTH_LABELS: Record<Language, string[]> = {
  bs: ["jan", "feb", "mar", "apr", "maj", "jun", "jul", "avg", "sep", "okt", "nov", "dec"],
  de: ["Jan", "Feb", "Mär", "Apr", "Mai", "Jun", "Jul", "Aug", "Sep", "Okt", "Nov", "Dez"],
  en: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
};

function formatMonthLabel(language: Language, date: Date) {
  const monthNames = MONTH_LABELS[language] ?? MONTH_LABELS.bs;
  const monthName = monthNames[date.getMonth()];
  return `${monthName} ${date.getFullYear()}`;
}

export default function PlanOverviewPage() {
  const { t, language } = useTranslations();
  const [selectedPatient, setSelectedPatient] = useState<string>(
    () => patients[0]?.id ?? ""
  );

  const workerById = useMemo(
    () => new Map(workers.map((worker) => [worker.id, worker])),
    []
  );

  const patientShifts = useMemo(
    () => shifts.filter((shift) => shift.patientId === selectedPatient),
    [selectedPatient]
  );

  const monthStart = useMemo(() => {
    if (patientShifts.length > 0) {
      const earliestDate = patientShifts.reduce((earliest, shift) => {
        const current = new Date(shift.date);
        return current < earliest ? current : earliest;
      }, new Date(patientShifts[0]!.date));
      return new Date(earliestDate.getFullYear(), earliestDate.getMonth(), 1);
    }

    return new Date(2025, 1, 1);
  }, [patientShifts]);

  const daysInMonth = useMemo(
    () => new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0).getDate(),
    [monthStart]
  );

  const rows = useMemo(() => {
    return Array.from({ length: daysInMonth }, (_, index) => {
      const date = new Date(
        monthStart.getFullYear(),
        monthStart.getMonth(),
        index + 1
      );
      const isoDate = date.toISOString().slice(0, 10);
      const dayShift = patientShifts.find(
        (shift) => shift.date === isoDate && shift.type === "day"
      );
      const nightShift = patientShifts.find(
        (shift) => shift.date === isoDate && shift.type === "night"
      );

      const dayWorker = dayShift ? workerById.get(dayShift.workerId) : undefined;
      const nightWorker = nightShift ? workerById.get(nightShift.workerId) : undefined;

      return {
        key: date.toISOString(),
        dayLabel: String(index + 1).padStart(2, "0"),
        monthLabel: formatMonthLabel(language, date),
        day: dayWorker?.name ?? t("overview.unassigned"),
        night: nightWorker?.name ?? t("overview.unassigned"),
      };
    });
  }, [daysInMonth, language, monthStart, patientShifts, t, workerById]);

  const preview = useMemo(
    () => planPreviews.find((item) => item.patientId === selectedPatient),
    [selectedPatient]
  );

  return (
    <div className="flex flex-col gap-5">
      <Card className="space-y-4 border border-slate-200 px-5 py-6">
        <div className="flex flex-wrap items-start gap-4">
          <div className="flex items-center gap-3 rounded-2xl bg-slate-50 px-3 py-2 text-slate-700">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-900 text-white shadow-sm">
              <CalendarClock className="h-5 w-5" aria-hidden />
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-slate-500">
                {t("overview.title")}
              </p>
              <h1 className="text-lg font-semibold text-slate-900">
                {t("overview.subtitle")}
              </h1>
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <p className="text-xs uppercase tracking-[0.2em] text-slate-500">
            {t("planner.patient.label")}
          </p>
          <PatientSelector
            data={patients}
            value={selectedPatient}
            onChange={(patientId) => setSelectedPatient(patientId)}
          />
        </div>

        <div className="grid gap-4 lg:grid-cols-[1fr_0.9fr]">
          <Card className="space-y-3 border border-slate-100 p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[11px] uppercase tracking-[0.3em] text-slate-500">
                  {t("planner.preview.kicker")}
                </p>
                <h3 className="text-lg font-semibold text-slate-900">
                  {t("planner.preview.title")}
                </h3>
              </div>
              <span className="text-sm font-semibold text-slate-500">
                {t("planner.preview.meta", { days: rows.length, workers: workers.length })}
              </span>
            </div>

            <div className="overflow-hidden rounded-2xl border border-slate-100">
              <div className="grid grid-cols-[1.3fr_1fr_1fr] bg-slate-50 px-4 py-3 text-[11px] uppercase tracking-[0.3em] text-slate-500">
                <span>{t("planner.preview.date")}</span>
                <span className="text-left">
                  <div className="flex items-center gap-1">
                    <Sun className="h-3 w-3 text-slate-500" aria-hidden />
                    {t("planner.preview.day")}
                  </div>
                </span>
                <span className="text-left">
                  <div className="flex items-center gap-1">
                    <Moon className="h-3 w-3 text-slate-500" aria-hidden />
                    {t("planner.preview.night")}
                  </div>
                </span>
              </div>
              <div className="divide-y divide-slate-100">
                {rows.map((row) => (
                  <div
                    key={row.key}
                    className="grid grid-cols-[1.3fr_1fr_1fr] px-4 py-3 text-sm text-slate-700 transition-colors hover:bg-slate-50"
                  >
                    <span className="flex flex-col gap-0.5 text-slate-900">
                      <span className="text-base font-semibold leading-tight">
                        {row.dayLabel}
                      </span>
                      <span className="text-xs uppercase tracking-[0.3em] text-slate-500">
                        {row.monthLabel}
                      </span>
                    </span>
                    <span className="truncate text-slate-800">{row.day}</span>
                    <span className="truncate text-slate-800">{row.night}</span>
                  </div>
                ))}
              </div>
            </div>
          </Card>

          <Card className="space-y-4 border border-slate-100 p-4 shadow-sm">
            <div className="flex items-center gap-2 text-slate-700">
              <ListChecks className="h-5 w-5" aria-hidden />
              <div>
                <p className="text-[11px] uppercase tracking-[0.3em] text-slate-500">
                  {t("overview.summary.title")}
                </p>
                <h3 className="text-lg font-semibold text-slate-900">
                  {t("overview.summary.subtitle")}
                </h3>
              </div>
            </div>

            {preview ? (
              <div className="space-y-3">
                <div className="rounded-xl bg-slate-50 p-3 text-sm text-slate-700">
                  <div className="mb-1 text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                    {preview.month}
                  </div>
                  <p className="leading-relaxed">{preview.summary}</p>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                    <Info className="h-4 w-4 text-slate-500" aria-hidden />
                    {t("overview.summary.highlights")}
                  </div>
                  <ul className="space-y-2 text-sm text-slate-700">
                    {preview.highlights.map((item) => (
                      <li key={item} className="flex items-start gap-2 rounded-xl bg-white px-3 py-2 shadow-sm">
                        <span className="mt-1 inline-block h-2 w-2 rounded-full bg-sky-500" aria-hidden />
                        <span className="leading-relaxed">{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
                {t("overview.summary.empty")}
              </div>
            )}
          </Card>
        </div>
      </Card>
    </div>
  );
}
