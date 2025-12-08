"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  BarChart3,
  CalendarClock,
  Clock3,
  Moon,
  SunMedium,
  Users2,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useTranslations, type Language } from "@/components/i18n/language-provider";
import type { Patient, ShiftType, Worker } from "@/types";

type AnalyticsData = {
  totals: {
    totalShifts: number;
    dayShifts: number;
    nightShifts: number;
    totalHours: number;
    dayHours: number;
    nightHours: number;
    averageHoursPerShift: number;
  };
  weeks: {
    weekOfMonth: number;
    dayShifts: number;
    nightShifts: number;
    totalShifts: number;
  }[];
  assignments: {
    date: string;
    shiftType: ShiftType;
    patientId: string | null;
  }[];
  patientIds: string[];
};

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

function formatDateLabel(language: Language, value: string) {
  const monthNames = MONTH_LABELS[language] ?? MONTH_LABELS.bs;
  const date = new Date(value);
  const day = String(date.getDate()).padStart(2, "0");
  const month = monthNames[date.getMonth()];
  return `${day}. ${month} ${date.getFullYear()}`;
}

export default function AnalyticsPage() {
  const { t, language } = useTranslations();
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [selectedWorkerId, setSelectedWorkerId] = useState("");
  const [selectedMonth, setSelectedMonth] = useState(() => new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(() => new Date().getFullYear());
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isBootstrapping, setIsBootstrapping] = useState(true);
  const [isFetching, setIsFetching] = useState(false);

  const monthNames = MONTH_LABELS[language] ?? MONTH_LABELS.bs;

  useEffect(() => {
    const loadBaseData = async () => {
      setError(null);
      try {
        const [workersRes, patientsRes] = await Promise.all([
          fetch("/api/workers"),
          fetch("/api/patients"),
        ]);

        if (!workersRes.ok || !patientsRes.ok) {
          throw new Error("Network error");
        }

        const workersJson = await workersRes.json();
        const patientsJson = await patientsRes.json();
        setWorkers(workersJson.data ?? []);
        setPatients(patientsJson.data ?? []);
        if (!selectedWorkerId && workersJson.data?.[0]?.id) {
          setSelectedWorkerId(workersJson.data[0].id);
        }
      } catch (err) {
        console.error(err);
        setError(t("analytics.error"));
      } finally {
        setIsBootstrapping(false);
      }
    };

    loadBaseData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!selectedWorkerId) {
      setAnalytics(null);
      return;
    }

    const loadAnalytics = async () => {
      setIsFetching(true);
      setError(null);
      try {
        const response = await fetch(
          `/api/analytics?workerId=${selectedWorkerId}&month=${selectedMonth + 1}&year=${selectedYear}`
        );
        if (!response.ok) {
          throw new Error("Failed to load analytics");
        }
        const json = await response.json();
        setAnalytics(json.data ?? null);
      } catch (err) {
        console.error(err);
        setError(t("analytics.error"));
        setAnalytics(null);
      } finally {
        setIsFetching(false);
      }
    };

    loadAnalytics();
  }, [selectedMonth, selectedWorkerId, selectedYear, t]);

  const patientNameById = useMemo(
    () => new Map(patients.map((patient) => [patient.id, patient.name])),
    [patients]
  );

  const patientBreakdown = useMemo(() => {
    if (!analytics) return [];
    const map = new Map<
      string,
      {
        total: number;
        day: number;
        night: number;
      }
    >();

    analytics.assignments.forEach((assignment) => {
      if (!assignment.patientId) return;
      const current = map.get(assignment.patientId) ?? { total: 0, day: 0, night: 0 };
      current.total += 1;
      if (assignment.shiftType === "day") current.day += 1;
      if (assignment.shiftType === "night") current.night += 1;
      map.set(assignment.patientId, current);
    });

    return Array.from(map.entries())
      .map(([patientId, value]) => ({
        patientId,
        name: patientNameById.get(patientId) ?? t("analytics.timeline.unassignedPatient"),
        ...value,
      }))
      .sort((a, b) => b.total - a.total);
  }, [analytics, patientNameById, t]);

  const weekData = analytics?.weeks ?? [];
  const maxWeekShifts =
    weekData.length > 0 ? Math.max(...weekData.map((week) => week.totalShifts)) : 0;

  const totals = analytics?.totals ?? {
    totalShifts: 0,
    dayShifts: 0,
    nightShifts: 0,
    totalHours: 0,
    dayHours: 0,
    nightHours: 0,
    averageHoursPerShift: 0,
  };

  const timeline = analytics?.assignments ?? [];
  const isLoading = isBootstrapping || isFetching;
  const hasData = !!analytics && analytics.totals.totalShifts > 0;
  const availableYears = useMemo(() => {
    const current = new Date().getFullYear();
    return [current - 1, current, current + 1];
  }, []);

  return (
    <div className="flex flex-col gap-5">
      <Card className="space-y-5 border border-slate-200 px-5 py-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3 rounded-2xl bg-slate-50 px-3 py-2 text-slate-700">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-sky-500 via-blue-500 to-indigo-500 text-white shadow-sm">
              <BarChart3 className="h-5 w-5" aria-hidden />
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-slate-500">
                {t("analytics.title")}
              </p>
              <h1 className="text-lg font-semibold text-slate-900">
                {t("analytics.subtitle")}
              </h1>
            </div>
          </div>
          <Badge variant="sky" className="text-[11px]">
            {t("analytics.filters.helper")}
          </Badge>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <label className="space-y-2 text-xs font-semibold uppercase tracking-[0.25em] text-slate-500">
            <span className="block">{t("analytics.filters.worker")}</span>
            <select
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-800 shadow-sm transition hover:border-slate-300 focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-100"
              value={selectedWorkerId}
              onChange={(event) => setSelectedWorkerId(event.target.value)}
              disabled={isBootstrapping}
            >
              {workers.map((worker) => (
                <option key={worker.id} value={worker.id}>
                  {worker.name} · {worker.city}
                </option>
              ))}
            </select>
          </label>

          <label className="space-y-2 text-xs font-semibold uppercase tracking-[0.25em] text-slate-500">
            <span className="block">{t("analytics.filters.month")}</span>
            <select
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-800 shadow-sm transition hover:border-slate-300 focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-100"
              value={selectedMonth}
              onChange={(event) => setSelectedMonth(Number(event.target.value))}
              disabled={isBootstrapping}
            >
              {monthNames.map((label, index) => (
                <option key={label} value={index}>
                  {label}
                </option>
              ))}
            </select>
          </label>

          <label className="space-y-2 text-xs font-semibold uppercase tracking-[0.25em] text-slate-500">
            <span className="block">{t("analytics.filters.year")}</span>
            <select
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-800 shadow-sm transition hover:border-slate-300 focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-100"
              value={selectedYear}
              onChange={(event) => setSelectedYear(Number(event.target.value))}
              disabled={isBootstrapping}
            >
              {availableYears.map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </select>
          </label>
        </div>

        {error ? (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">
            {error}
          </div>
        ) : null}
        {isLoading ? (
          <div className="text-sm text-slate-600">{t("analytics.loading")}</div>
        ) : null}
        {!isBootstrapping && workers.length === 0 ? (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800">
            {t("workers.list.empty")}
          </div>
        ) : null}
      </Card>

      <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-6">
        <Card className="space-y-2 border border-slate-200 px-4 py-4 shadow-sm">
          <div className="flex items-center gap-2 text-xs uppercase tracking-[0.25em] text-slate-500">
            <Activity className="h-4 w-4 text-emerald-500" aria-hidden />
            {t("analytics.cards.totalShifts")}
          </div>
          <div className="text-3xl font-semibold text-slate-900">{totals.totalShifts}</div>
          <p className="text-xs text-slate-500">
            {t("analytics.cards.periodLabel", {
              month: monthNames[selectedMonth],
              year: selectedYear,
            })}
          </p>
        </Card>

        <Card className="space-y-2 border border-slate-200 px-4 py-4 shadow-sm">
          <div className="flex items-center gap-2 text-xs uppercase tracking-[0.25em] text-slate-500">
            <SunMedium className="h-4 w-4 text-amber-500" aria-hidden />
            {t("analytics.cards.dayShifts")}
          </div>
          <div className="text-3xl font-semibold text-slate-900">{totals.dayShifts}</div>
          <p className="text-xs text-amber-600">
            {t("analytics.cards.dayHours")}: {totals.dayHours}h
          </p>
        </Card>

        <Card className="space-y-2 border border-slate-200 px-4 py-4 shadow-sm">
          <div className="flex items-center gap-2 text-xs uppercase tracking-[0.25em] text-slate-500">
            <Moon className="h-4 w-4 text-indigo-500" aria-hidden />
            {t("analytics.cards.nightShifts")}
          </div>
          <div className="text-3xl font-semibold text-slate-900">{totals.nightShifts}</div>
          <p className="text-xs text-indigo-600">
            {t("analytics.cards.nightHours")}: {totals.nightHours}h
          </p>
        </Card>

        <Card className="space-y-2 border border-slate-200 px-4 py-4 shadow-sm">
          <div className="flex items-center gap-2 text-xs uppercase tracking-[0.25em] text-slate-500">
            <Clock3 className="h-4 w-4 text-sky-500" aria-hidden />
            {t("analytics.cards.totalHours")}
          </div>
          <div className="text-3xl font-semibold text-slate-900">{totals.totalHours}h</div>
          <p className="text-xs text-slate-500">
            {t("analytics.cards.avgHours")}: {totals.averageHoursPerShift || 0}h
          </p>
        </Card>

        <Card className="space-y-2 border border-slate-200 px-4 py-4 shadow-sm">
          <div className="flex items-center gap-2 text-xs uppercase tracking-[0.25em] text-slate-500">
            <CalendarClock className="h-4 w-4 text-emerald-500" aria-hidden />
            {t("analytics.cards.activeWeeks")}
          </div>
          <div className="text-3xl font-semibold text-slate-900">
            {weekData.length}
          </div>
          <p className="text-xs text-slate-500">{t("analytics.chart.subtitle")}</p>
        </Card>

        <Card className="space-y-2 border border-slate-200 px-4 py-4 shadow-sm">
          <div className="flex items-center gap-2 text-xs uppercase tracking-[0.25em] text-slate-500">
            <Users2 className="h-4 w-4 text-slate-500" aria-hidden />
            {t("analytics.patients.title")}
          </div>
          <div className="text-3xl font-semibold text-slate-900">
            {patientBreakdown.length}
          </div>
          <p className="text-xs text-slate-500">{t("analytics.patients.subtitle")}</p>
        </Card>
      </div>

      <Card className="space-y-4 border border-slate-200 px-5 py-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-slate-500">
              {t("analytics.chart.title")}
            </p>
            <h3 className="text-lg font-semibold text-slate-900">
              {monthNames[selectedMonth]} {selectedYear}
            </h3>
          </div>
          <Badge variant="emerald" className="text-[11px]">
            {t("analytics.chart.subtitle")}
          </Badge>
        </div>

        {weekData.length === 0 ? (
          <div className="rounded-xl border border-slate-100 bg-slate-50 px-4 py-3 text-sm text-slate-600">
            {t("analytics.empty")}
          </div>
        ) : (
          <div className="flex items-end gap-3 overflow-x-auto pb-1">
            {weekData.map((week) => {
              const dayHeight =
                maxWeekShifts > 0 && week.dayShifts > 0
                  ? Math.max(12, (week.dayShifts / maxWeekShifts) * 160)
                  : 0;
              const nightHeight =
                maxWeekShifts > 0 && week.nightShifts > 0
                  ? Math.max(12, (week.nightShifts / maxWeekShifts) * 160)
                  : 0;
              return (
                <div key={week.weekOfMonth} className="flex min-w-[110px] flex-1 flex-col gap-2">
                  <div className="relative flex h-48 items-end justify-stretch rounded-2xl border border-slate-100 bg-gradient-to-t from-white via-slate-50 to-slate-50 p-2 shadow-inner">
                    <div className="flex w-full items-end gap-1">
                      <div
                        className="flex flex-1 flex-col justify-end rounded-xl bg-amber-100 text-amber-700"
                        style={{ height: `${Math.min(dayHeight, 160)}px` }}
                        aria-label={t("analytics.cards.dayShifts")}
                      >
                        <span className="px-2 pb-2 text-xs font-semibold">
                          {week.dayShifts}
                        </span>
                      </div>
                      <div
                        className="flex flex-1 flex-col justify-end rounded-xl bg-indigo-100 text-indigo-700"
                        style={{ height: `${Math.min(nightHeight, 160)}px` }}
                        aria-label={t("analytics.cards.nightShifts")}
                      >
                        <span className="px-2 pb-2 text-xs font-semibold">
                          {week.nightShifts}
                        </span>
                      </div>
                    </div>
                    <div className="absolute right-2 top-2 rounded-full bg-slate-900 px-2 py-1 text-[10px] font-semibold text-white shadow-sm">
                      {week.totalShifts}
                    </div>
                  </div>
                  <div className="text-sm font-semibold text-slate-800">
                    {t("analytics.chart.weekLabel", { week: week.weekOfMonth })}
                  </div>
                  <p className="text-xs text-slate-500">
                    {t("analytics.cards.totalShifts")}: {week.totalShifts}
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
        <Card className="space-y-4 border border-slate-200 px-5 py-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-slate-500">
                {t("analytics.timeline.title")}
              </p>
              <h3 className="text-lg font-semibold text-slate-900">
                {t("analytics.timeline.subtitle")}
              </h3>
            </div>
          </div>
          {!hasData ? (
            <div className="rounded-xl border border-slate-100 bg-slate-50 px-4 py-3 text-sm text-slate-600">
              {isLoading ? t("analytics.loading") : t("analytics.empty")}
            </div>
          ) : (
            <div className="divide-y divide-slate-100 rounded-2xl border border-slate-100 bg-white">
              {timeline.map((item) => (
                <div
                  key={`${item.date}-${item.shiftType}-${item.patientId ?? "none"}`}
                  className="grid grid-cols-[1.4fr_1fr_1.2fr] items-center gap-3 px-4 py-3 text-sm text-slate-800 hover:bg-slate-50"
                >
                  <div className="space-y-1">
                    <p className="text-base font-semibold text-slate-900">
                      {formatDateLabel(language, item.date)}
                    </p>
                    <p className="text-xs uppercase tracking-[0.18em] text-slate-500">
                      {t("planner.preview.date")}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={item.shiftType === "day" ? "amber" : "slate"}>
                      {item.shiftType === "day"
                        ? t("analytics.timeline.day")
                        : t("analytics.timeline.night")}
                    </Badge>
                  </div>
                  <div className="truncate text-slate-800">
                    {item.patientId
                      ? patientNameById.get(item.patientId) ?? t("analytics.timeline.unassignedPatient")
                      : t("analytics.timeline.unassignedPatient")}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card className="space-y-3 border border-slate-200 px-5 py-5">
          <div className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-slate-500">
            <Users2 className="h-4 w-4 text-slate-500" aria-hidden />
            {t("analytics.patients.title")}
          </div>
          {!hasData ? (
            <p className="text-sm text-slate-600">{t("analytics.patients.none")}</p>
          ) : (
            <div className="space-y-3">
              {patientBreakdown.map((patient) => (
                <div
                  key={patient.patientId}
                  className="flex items-center justify-between gap-3 rounded-2xl border border-slate-100 bg-slate-50 px-3 py-3"
                >
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{patient.name}</p>
                    <p className="text-xs text-slate-500">
                      {t("analytics.cards.dayShifts")}: {patient.day} · {t("analytics.cards.nightShifts")}:{" "}
                      {patient.night}
                    </p>
                  </div>
                  <Badge variant="emerald" className="text-xs">
                    {patient.total} {t("analytics.cards.totalShifts")}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
