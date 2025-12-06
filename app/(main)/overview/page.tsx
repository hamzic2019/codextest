"use client";

import { useEffect, useMemo, useState } from "react";
import { CalendarClock, ChevronDown, Moon, Sun } from "lucide-react";
import { PatientSelector } from "@/components/planner/patient-selector";
import { Card } from "@/components/ui/card";
import { useTranslations } from "@/components/i18n/language-provider";
import type { Language } from "@/components/i18n/language-provider";
import type { Patient, PlanAssignment, Worker } from "@/types";

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
  const [patientsState, setPatientsState] = useState<Patient[]>([]);
  const [workersState, setWorkersState] = useState<Worker[]>([]);
  const [planAssignments, setPlanAssignments] = useState<PlanAssignment[]>([]);
  const [selectedPatient, setSelectedPatient] = useState<string>("");
  const [selectedYear, setSelectedYear] = useState(() => fallbackYear);
  const [selectedMonth, setSelectedMonth] = useState(() => fallbackMonth);
  const [availablePlans, setAvailablePlans] = useState<{ month: number; year: number }[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteFeedback, setDeleteFeedback] = useState<
    { type: "success" | "error"; message: string } | null
  >(null);

  const workerById = useMemo(
    () => new Map(workersState.map((worker) => [worker.id, worker])),
    [workersState]
  );

  const monthStart = useMemo(
    () => new Date(selectedYear, selectedMonth, 1),
    [selectedYear, selectedMonth]
  );

  const daysInMonth = useMemo(
    () => new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0).getDate(),
    [monthStart]
  );

  const assignmentByDate = useMemo(() => {
    const map = new Map<
      string,
      {
        day?: string | null;
        night?: string | null;
      }
    >();

    planAssignments.forEach((assignment) => {
      const existing = map.get(assignment.date) ?? {};
      map.set(assignment.date, {
        ...existing,
        [assignment.shiftType]: assignment.workerId ?? null,
      });
    });

    return map;
  }, [planAssignments]);

  const availableYears = useMemo(() => {
    const unique = Array.from(new Set(availablePlans.map((item) => item.year))).sort(
      (a, b) => a - b
    );
    return unique.length > 0 ? unique : [fallbackYear];
  }, [availablePlans, fallbackYear]);

  const hasPlanForSelection = useMemo(
    () =>
      availablePlans.some(
        (plan) => plan.year === selectedYear && plan.month === selectedMonth + 1
      ),
    [availablePlans, selectedMonth, selectedYear]
  );

  const isCurrentMonth = selectedMonth === todayDate.getMonth();

  const rows = useMemo(() => {
    return Array.from({ length: daysInMonth }, (_, index) => {
      const date = new Date(
        monthStart.getFullYear(),
        monthStart.getMonth(),
        index + 1
      );
      const dateKey = formatDateKey(date);
      const dayWorkerId = assignmentByDate.get(dateKey)?.day;
      const nightWorkerId = assignmentByDate.get(dateKey)?.night;

      const dayWorker = dayWorkerId ? workerById.get(dayWorkerId) : undefined;
      const nightWorker = nightWorkerId ? workerById.get(nightWorkerId) : undefined;

      return {
        key: date.toISOString(),
        dayLabel: String(index + 1).padStart(2, "0"),
        monthLabel: formatMonthLabel(language, date),
        day: dayWorker?.name ?? t("overview.unassigned"),
        night: nightWorker?.name ?? t("overview.unassigned"),
        isToday: isCurrentMonth && date.getDate() === todayDate.getDate(),
      };
    });
  }, [assignmentByDate, daysInMonth, isCurrentMonth, language, monthStart, t, todayDate, workerById]);

  const todayRow = rows.find((row) => row.isToday);
  const disableDeleteButton =
    isDeleting || isLoading || !hasPlanForSelection || !selectedPatient;

  useEffect(() => {
    setDeleteConfirm(false);
    setDeleteFeedback(null);
  }, [selectedMonth, selectedPatient, selectedYear]);

  useEffect(() => {
    const loadBaseData = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const [patientsRes, workersRes] = await Promise.all([
          fetch("/api/patients"),
          fetch("/api/workers"),
        ]);

        if (!patientsRes.ok || !workersRes.ok) {
          throw new Error("Network error");
        }

        const patientsJson = await patientsRes.json();
        const workersJson = await workersRes.json();
        setPatientsState(patientsJson.data ?? []);
        setWorkersState(workersJson.data ?? []);
        if (!selectedPatient && patientsJson.data?.length) {
          setSelectedPatient(patientsJson.data[0].id);
        }
      } catch (err) {
        console.error(err);
        setError(t("overview.loadError"));
      } finally {
        setIsLoading(false);
      }
    };

    loadBaseData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!selectedPatient) return;
    const loadAvailablePlans = async () => {
      try {
        const response = await fetch(
          `/api/plans?patientId=${selectedPatient}&mode=available`
        );
        if (!response.ok) throw new Error("Failed to load available plans");
        const json = await response.json();
        setAvailablePlans(json.data ?? []);
      } catch (err) {
        console.error(err);
      }
    };
    loadAvailablePlans();
  }, [selectedPatient]);

  useEffect(() => {
    if (!selectedPatient) return;
    const loadPlan = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const response = await fetch(
          `/api/plans?patientId=${selectedPatient}&month=${selectedMonth + 1}&year=${selectedYear}`
        );
        if (!response.ok) throw new Error("Failed to load plan");
        const json = await response.json();
        setPlanAssignments(json.data?.assignments ?? []);
      } catch (err) {
        console.error(err);
        setPlanAssignments([]);
        setError(t("overview.loadError"));
      } finally {
        setIsLoading(false);
      }
    };
    loadPlan();
  }, [selectedPatient, selectedMonth, selectedYear, t]);

  const handleDeletePlan = async () => {
    if (!selectedPatient) return;
    setDeleteFeedback(null);

    if (!deleteConfirm) {
      setDeleteConfirm(true);
      return;
    }

    setIsDeleting(true);
    try {
      const response = await fetch(
        `/api/plans?patientId=${selectedPatient}&month=${selectedMonth + 1}&year=${selectedYear}`,
        { method: "DELETE" }
      );

      const json = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error((json as { error?: string }).error || "Failed to delete plan");
      }

      setPlanAssignments([]);
      setAvailablePlans((prev) =>
        prev.filter((plan) => !(plan.year === selectedYear && plan.month === selectedMonth + 1))
      );
      setDeleteFeedback({ type: "success", message: t("overview.deleteSuccess") });
    } catch (err) {
      console.error(err);
      setDeleteFeedback({ type: "error", message: t("overview.deleteError") });
    } finally {
      setIsDeleting(false);
      setDeleteConfirm(false);
    }
  };

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
            data={patientsState}
            value={selectedPatient}
            onChange={(patientId) => setSelectedPatient(patientId)}
            isLoading={isLoading}
          />
          {error ? (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
              {error}
            </div>
          ) : null}
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
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-[11px] uppercase tracking-[0.3em] text-slate-500">
                  {t("planner.preview.kicker")}
                </p>
                <h3 className="text-lg font-semibold text-slate-900">
                  {t("planner.preview.title")}
                </h3>
              </div>
              <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                <span className="text-sm font-semibold text-slate-500">
                  {t("planner.preview.meta", { days: rows.length })}
                </span>
                <button
                  type="button"
                  onClick={handleDeletePlan}
                  disabled={disableDeleteButton}
                  className={`inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-semibold transition ${
                    deleteConfirm
                      ? "border-red-300 bg-red-50 text-red-700"
                      : "border-red-200 bg-white text-red-700 hover:border-red-300 hover:bg-red-50"
                  } disabled:cursor-not-allowed disabled:opacity-60`}
                >
                  {isDeleting
                    ? t("overview.deleting")
                    : deleteConfirm
                      ? t("overview.deleteConfirm")
                      : t("overview.delete")}
                </button>
              </div>
            </div>
            {deleteConfirm ? (
              <p className="text-sm font-semibold text-red-600">
                {t("overview.deleteHint")}
              </p>
            ) : null}
            {deleteFeedback ? (
              <div
                className={`rounded-xl border px-4 py-3 text-sm font-semibold ${
                  deleteFeedback.type === "success"
                    ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                    : "border-red-200 bg-red-50 text-red-700"
                }`}
              >
                {deleteFeedback.message}
              </div>
            ) : null}

            <div className="overflow-hidden rounded-2xl border border-slate-100">
              {isLoading ? (
                <div className="px-4 py-3 text-sm text-slate-600">
                  {t("overview.loading")}
                </div>
              ) : null}
              {!isLoading && planAssignments.length === 0 ? (
                <div className="px-4 py-3 text-sm text-slate-600">
                  {t("overview.noPlan")}
                </div>
              ) : null}
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
