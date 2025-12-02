"use client";

import { useMemo, useState } from "react";
import { CalendarClock, ChevronDown, Moon, Sun } from "lucide-react";
import { PatientSelector } from "@/components/planner/patient-selector";
import { Card } from "@/components/ui/card";
import { patients, shifts, workers } from "@/lib/mock-data";
import { useTranslations } from "@/components/i18n/language-provider";
import type { Language } from "@/components/i18n/language-provider";

const MONTH_LABELS: Record<Language, string[]> = {
  bs: [
    "Januar",
    "Februar",
    "Mart",
    "April",
    "Maj",
    "Juni",
    "Juli",
    "Avgust",
    "Septembar",
    "Oktobar",
    "Novembar",
    "Decembar",
  ],
  de: [
    "Januar",
    "Februar",
    "März",
    "April",
    "Mai",
    "Juni",
    "Juli",
    "August",
    "September",
    "Oktober",
    "November",
    "Dezember",
  ],
  en: [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ],
};

function formatMonthLabel(language: Language, date: Date) {
  const monthNames = MONTH_LABELS[language] ?? MONTH_LABELS.bs;
  const monthName = monthNames[date.getMonth()];
  return `${monthName} ${date.getFullYear()}`;
}

function formatDateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
    date.getDate()
  ).padStart(2, "0")}`;
}

export default function PlanOverviewPage() {
  const { t, language } = useTranslations();
  const monthNames = MONTH_LABELS[language] ?? MONTH_LABELS.bs;
  const todayDate = useMemo(() => new Date(), []);
  const fallbackYear = todayDate.getFullYear();
  const fallbackMonth = todayDate.getMonth();
  const todayDisplay = `${todayDate.getDate()}. ${monthNames[todayDate.getMonth()]}`;
  const [selectedPatient, setSelectedPatient] = useState<string>(
    () => patients[0]?.id ?? ""
  );

  const [selectedYear, setSelectedYear] = useState(() => fallbackYear);
  const [selectedMonth, setSelectedMonth] = useState(() => fallbackMonth);

  const workerById = useMemo(
    () => new Map(workers.map((worker) => [worker.id, worker])),
    []
  );

  const patientShifts = useMemo(
    () => shifts.filter((shift) => shift.patientId === selectedPatient),
    [selectedPatient]
  );

  const monthStart = useMemo(
    () => new Date(selectedYear, selectedMonth, 1),
    [selectedYear, selectedMonth]
  );

  const daysInMonth = useMemo(
    () => new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0).getDate(),
    [monthStart]
  );

  const availableYears = useMemo(() => {
    const unique = Array.from(
      new Set(shifts.map((shift) => new Date(shift.date).getFullYear()))
    );

    if (unique.length === 0) {
      return [fallbackYear];
    }

    return unique.sort((a, b) => a - b);
  }, []);

  const isCurrentMonth = selectedMonth === todayDate.getMonth();

  const rows = useMemo(() => {
    return Array.from({ length: daysInMonth }, (_, index) => {
      const date = new Date(
        monthStart.getFullYear(),
        monthStart.getMonth(),
        index + 1
      );
      const dateKey = formatDateKey(date);
      const dayShift = patientShifts.find(
        (shift) => shift.date === dateKey && shift.type === "day"
      );
      const nightShift = patientShifts.find(
        (shift) => shift.date === dateKey && shift.type === "night"
      );

      const dayWorker = dayShift ? workerById.get(dayShift.workerId) : undefined;
      const nightWorker = nightShift ? workerById.get(nightShift.workerId) : undefined;

      return {
        key: date.toISOString(),
        dayLabel: String(index + 1).padStart(2, "0"),
        monthLabel: formatMonthLabel(language, date),
        day: dayWorker?.name ?? t("overview.unassigned"),
        night: nightWorker?.name ?? t("overview.unassigned"),
        isToday: isCurrentMonth && date.getDate() === todayDate.getDate(),
      };
    });
  }, [daysInMonth, isCurrentMonth, language, monthStart, patientShifts, t, todayDate, workerById]);

  const todayRow = rows.find((row) => row.isToday);

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
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-[11px] uppercase tracking-[0.3em] text-slate-500">
              <span className="block text-[11px]">{t("overview.calendar.monthLabel")}</span>
              <div className="relative mt-1">
                <select
                  aria-label={t("overview.calendar.monthSelectAria")}
                  className="appearance-none w-full rounded-xl border border-slate-200 bg-white px-3 py-2 pr-10 text-sm text-slate-700 shadow-sm shadow-slate-100 transition hover:border-slate-300 focus:border-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-200"
                  value={selectedMonth}
                  onChange={(event) => setSelectedMonth(Number(event.target.value))}
                >
                  {monthNames.map((label, index) => (
                    <option key={label} value={index}>
                      {label}
                    </option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" aria-hidden />
              </div>
            </label>
            <label className="text-[11px] uppercase tracking-[0.3em] text-slate-500">
              <span className="block text-[11px]">{t("overview.calendar.yearLabel")}</span>
              <div className="relative mt-1">
                <select
                  aria-label={t("overview.calendar.yearSelectAria")}
                  className="appearance-none w-full rounded-xl border border-slate-200 bg-white px-3 py-2 pr-10 text-sm text-slate-700 shadow-sm shadow-slate-100 transition hover:border-slate-300 focus:border-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-200"
                  value={selectedYear}
                  onChange={(event) => setSelectedYear(Number(event.target.value))}
                >
                  {availableYears.map((year) => (
                    <option key={year} value={year}>
                      {year}
                    </option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" aria-hidden />
              </div>
            </label>
          </div>
        </div>

        <div>
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
                    className={`grid grid-cols-[1.3fr_1fr_1fr] px-4 py-3 text-sm text-slate-700 transition-colors hover:bg-slate-50 ${
                      row.isToday ? "bg-sky-50 text-slate-900 ring-1 ring-sky-200" : ""
                    }`}
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
              {todayRow && (
                <div className="border-t border-slate-100 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                  <span className="font-semibold text-slate-800">
                    {t("overview.calendar.todayLabel")}:{" "}
                  </span>
                  <span className="text-slate-700">{todayDisplay}</span>
                </div>
              )}
            </div>
          </Card>
        </div>
      </Card>
    </div>
  );
}
