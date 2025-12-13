"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  CalendarClock,
  CalendarRange,
  Check,
  Loader2,
  Search,
  ShieldAlert,
  Stethoscope,
  Sun,
  UserRound,
  X,
} from "lucide-react";
import type { Worker } from "@/types";
import { cn } from "@/lib/utils";
import { useTranslations } from "../i18n/language-provider";
import { Badge } from "../ui/badge";
import { Card } from "../ui/card";

type SelectionMode = "range" | "multi";
type AbsenceType = "sick" | "vacation";

type CalendarDay = {
  iso: string;
  day: number;
  date: Date;
  inMonth: boolean;
};

function formatISO(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
    date.getDate()
  ).padStart(2, "0")}`;
}

function parseISO(value?: string | null) {
  if (!value) return null;
  const [y, m, d] = value.split("-").map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}

function buildMonthDays(currentMonth: Date): CalendarDay[] {
  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();
  const firstDay = new Date(year, month, 1);
  const offset = (firstDay.getDay() + 6) % 7; // Monday as first day
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const days: CalendarDay[] = [];
  for (let i = 0; i < offset; i += 1) {
    days.push({
      iso: "",
      day: 0,
      date: new Date(year, month, 0),
      inMonth: false,
    });
  }

  for (let day = 1; day <= daysInMonth; day += 1) {
    const date = new Date(year, month, day);
    days.push({ iso: formatISO(date), day, date, inMonth: true });
  }

  while (days.length % 7 !== 0) {
    days.push({
      iso: "",
      day: 0,
      date: new Date(year, month + 1, 1),
      inMonth: false,
    });
  }

  return days;
}

function initials(name: string) {
  return name
    .split(" ")
    .map((part) => part.trim()[0])
    .filter(Boolean)
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function dayLabels(locale: string) {
  const start = new Date(Date.UTC(2024, 0, 1)); // Monday
  return Array.from({ length: 7 }).map((_, index) =>
    new Intl.DateTimeFormat(locale, { weekday: "short" }).format(
      new Date(start.getTime() + index * 24 * 60 * 60 * 1000)
    )
  );
}

export function SickLeaveButton() {
  const { t, language } = useTranslations();
  const locale =
    language === "bs" ? "bs-BA" : language === "de" ? "de-DE" : "en-GB";

  const [open, setOpen] = useState(false);
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [search, setSearch] = useState("");
  const [absenceType, setAbsenceType] = useState<AbsenceType>("sick");
  const [selectedWorkerId, setSelectedWorkerId] = useState<string>("");
  const [mode, setMode] = useState<SelectionMode>("range");
  const [startDate, setStartDate] = useState<string | null>(null);
  const [endDate, setEndDate] = useState<string | null>(null);
  const [manualDates, setManualDates] = useState<Set<string>>(new Set());
  const [monthCursor, setMonthCursor] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [loadingWorkers, setLoadingWorkers] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  useEffect(() => {
    if (!open || workers.length > 0 || loadingWorkers) return;
    let cancelled = false;

    const loadWorkers = async () => {
      try {
        setLoadingWorkers(true);
        const res = await fetch("/api/workers");
        if (!res.ok) throw new Error("Network error");
        const json = await res.json();
        if (cancelled) return;
        setWorkers(json.data ?? []);
        if (!selectedWorkerId && json.data?.length) {
          setSelectedWorkerId(json.data[0].id);
        }
      } catch (err) {
        console.error(err);
      } finally {
        if (!cancelled) setLoadingWorkers(false);
      }
    };

    loadWorkers();

    return () => {
      cancelled = true;
    };
  }, [loadingWorkers, open, selectedWorkerId, workers.length]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  const monthFormatter = useMemo(
    () => new Intl.DateTimeFormat(locale, { month: "long", year: "numeric" }),
    [locale]
  );
  const dateFormatter = useMemo(
    () => new Intl.DateTimeFormat(locale, { day: "numeric", month: "short", year: "numeric" }),
    [locale]
  );
  const weekdayLabels = useMemo(() => dayLabels(locale), [locale]);

  const calendarDays = useMemo(() => buildMonthDays(monthCursor), [monthCursor]);

  const filteredWorkers = useMemo(() => {
    const term = search.toLowerCase().trim();
    if (!term) return workers;
    return workers.filter(
      (worker) =>
        worker.name.toLowerCase().includes(term) ||
        (worker.city ?? "").toLowerCase().includes(term) ||
        (worker.role ?? "").toLowerCase().includes(term)
    );
  }, [search, workers]);

  const selectionCount = useMemo(() => {
    if (mode === "multi") return manualDates.size;
    if (!startDate) return 0;
    if (!endDate) return 1;
    const start = parseISO(startDate);
    const end = parseISO(endDate);
    if (!start || !end) return 0;
    const diffDays = Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    return diffDays + 1;
  }, [endDate, manualDates.size, mode, startDate]);

  const selectionPreview = useMemo(() => {
    if (mode === "multi") {
      const sorted = Array.from(manualDates).sort();
      return sorted.slice(0, 3).map((iso) => dateFormatter.format(parseISO(iso)!)).join(" · ");
    }
    if (!startDate) return t("sickLeave.noSelection");
    if (!endDate) return dateFormatter.format(parseISO(startDate)!);
    return `${dateFormatter.format(parseISO(startDate)!)} → ${dateFormatter.format(
      parseISO(endDate)!
    )}`;
  }, [dateFormatter, endDate, manualDates, mode, startDate, t]);

  const selectedWorker = useMemo(
    () => workers.find((worker) => worker.id === selectedWorkerId),
    [selectedWorkerId, workers]
  );

  const typeLabel = t(`sickLeave.type.${absenceType}` as any);

  const handleDayClick = (day: CalendarDay) => {
    if (!day.inMonth || !day.iso) return;
    if (mode === "multi") {
      const updated = new Set(manualDates);
      if (updated.has(day.iso)) {
        updated.delete(day.iso);
      } else {
        updated.add(day.iso);
      }
      setManualDates(updated);
      return;
    }

    if (!startDate || (startDate && endDate)) {
      setStartDate(day.iso);
      setEndDate(null);
      return;
    }

    if (startDate && !endDate) {
      const start = parseISO(startDate);
      const next = parseISO(day.iso);
      if (!start || !next) return;
      if (next < start) {
        setStartDate(day.iso);
        setEndDate(startDate);
      } else {
        setEndDate(day.iso);
      }
    }
  };

  const setModeAndSync = (nextMode: SelectionMode) => {
    if (nextMode === mode) return;
    if (nextMode === "multi") {
      const selection = new Set<string>();
      if (startDate && endDate) {
        const start = parseISO(startDate);
        const end = parseISO(endDate);
        if (start && end) {
          const cursor = new Date(start);
          while (cursor <= end) {
            selection.add(formatISO(cursor));
            cursor.setDate(cursor.getDate() + 1);
          }
        }
      } else if (startDate) {
        selection.add(startDate);
      }
      setManualDates(selection);
      setStartDate(null);
      setEndDate(null);
    } else {
      if (manualDates.size > 0) {
        const sorted = Array.from(manualDates).sort();
        setStartDate(sorted[0]);
        setEndDate(sorted[sorted.length - 1] ?? sorted[0]);
      }
      setManualDates(new Set());
    }
    setMode(nextMode);
  };

  const isSelected = (iso: string) => {
    if (!iso) return false;
    if (mode === "multi") return manualDates.has(iso);
    if (!startDate) return false;
    if (!endDate) return iso === startDate;
    return iso >= startDate && iso <= endDate;
  };

  const isEdge = (iso: string) => {
    if (!iso) return false;
    if (mode === "multi") return false;
    return iso === startDate || iso === endDate;
  };

  const handleSave = () => {
    if (!selectedWorkerId || selectionCount === 0) return;
    setFeedback(
      t("sickLeave.feedback", {
        count: selectionCount,
        type: typeLabel,
      })
    );
  };

  const resetState = () => {
    setOpen(false);
    setFeedback(null);
    setStartDate(null);
    setEndDate(null);
    setManualDates(new Set());
  };

  const monthLabel = monthFormatter.format(monthCursor);

  return (
    <div className="relative">
      <Card className="relative overflow-hidden border-white/10 bg-slate-900 px-3 py-2.5 text-slate-100 shadow-md">
        <div className="absolute inset-0 bg-gradient-to-br from-sky-500/10 via-indigo-400/5 to-purple-500/10" />
        <div className="relative flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-2xl bg-gradient-to-br from-sky-500 via-indigo-500 to-purple-500 text-white shadow-inner ring-1 ring-white/25">
            <ShieldAlert className="h-4 w-4 shrink-0" />
          </span>
          <div className="flex-1">
            <p className="text-sm font-semibold" suppressHydrationWarning>
              {t("sickLeave.title")}
            </p>
            <p className="text-[11px] text-slate-300" suppressHydrationWarning>
              {t("sickLeave.subtitle")}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="relative mt-2 flex h-9 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-sky-400 via-indigo-500 to-purple-500 px-3 text-sm font-semibold text-white transition hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
        >
          <CalendarClock className="h-4 w-4" />
          {t("sickLeave.title")}
        </button>
        {feedback ? (
          <p className="relative mt-2 text-[11px] text-emerald-200">{feedback}</p>
        ) : null}
      </Card>

      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-slate-900/65 backdrop-blur-sm"
            onClick={resetState}
          />
          <div className="relative z-10 w-[85vw] max-w-[440px] max-h-[60vh] overflow-hidden rounded-[16px] bg-white shadow-[0_16px_40px_rgba(15,23,42,0.28)]">
            <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-sky-400 via-indigo-500 to-purple-500" />
            <div className="flex items-center justify-between px-3 pb-2 pt-3">
              <div className="flex items-center gap-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-2xl bg-slate-900 text-white shadow-inner ring-1 ring-slate-900/10">
                  <Stethoscope className="h-4 w-4 shrink-0" />
                </span>
                <div>
                  <p className="text-sm font-semibold text-slate-900" suppressHydrationWarning>
                    {t("sickLeave.title")}
                  </p>
                  <p className="text-[11px] text-slate-500" suppressHydrationWarning>
                    {t("sickLeave.subtitle")}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={resetState}
                className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:bg-slate-50"
                aria-label="Close"
              >
                <X className="h-4 w-4 shrink-0" />
              </button>
            </div>

            <div className="grid gap-2.5 px-3 pb-3">
              <div className="space-y-2">
                <Card className="border-slate-200 bg-slate-50/80 p-2">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">
                        {t("sickLeave.workerLabel")}
                      </p>
                      <p className="text-[11px] text-slate-500">{t("sickLeave.mode.helper")}</p>
                    </div>
                    <Badge variant="sky" className="bg-sky-50 text-[11px] text-sky-700">
                      {t("planner.workersLabel")}
                    </Badge>
                  </div>

                  <div className="mt-2 grid grid-cols-2 gap-1.5">
                    <button
                      type="button"
                      onClick={() => setAbsenceType("sick")}
                      className={cn(
                        "flex items-center gap-1.5 rounded-xl border px-3 py-2 text-[11px] font-semibold transition",
                        absenceType === "sick"
                          ? "border-sky-200 bg-sky-50 text-sky-800 shadow-[0_6px_18px_rgba(14,165,233,0.2)]"
                          : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"
                      )}
                    >
                      <Stethoscope className="h-4 w-4" />
                      {t("sickLeave.type.sick")}
                    </button>
                    <button
                      type="button"
                      onClick={() => setAbsenceType("vacation")}
                      className={cn(
                        "flex items-center gap-1.5 rounded-xl border px-3 py-2 text-[11px] font-semibold transition",
                        absenceType === "vacation"
                          ? "border-amber-200 bg-amber-50 text-amber-800 shadow-[0_6px_18px_rgba(251,191,36,0.35)]"
                          : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"
                      )}
                    >
                      <Sun className="h-4 w-4" />
                      {t("sickLeave.type.vacation")}
                    </button>
                  </div>
                  <p className="mt-1 text-[11px] text-slate-500">{t("sickLeave.type.helper")}</p>

                  <div className="mt-1.5 rounded-2xl border border-slate-200/80 bg-white shadow-inner">
                    <div className="flex items-center gap-2 border-b border-slate-100 px-3 py-2">
                      <Search className="h-4 w-4 text-slate-400" />
                      <input
                        value={search}
                        onChange={(event) => setSearch(event.target.value)}
                        placeholder={t("sickLeave.searchPlaceholder")}
                        className="w-full bg-transparent text-sm text-slate-800 outline-none placeholder:text-slate-400"
                      />
                    </div>

                    <div className="max-h-36 space-y-1 overflow-y-auto p-2">
                      {loadingWorkers ? (
                        <div className="flex items-center gap-2 px-2 py-2 text-sm text-slate-500">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          {t("sickLeave.loading")}
                        </div>
                      ) : null}

                      {!loadingWorkers && filteredWorkers.length === 0 ? (
                        <div className="px-2 py-2 text-sm text-slate-500">
                          {t("sickLeave.noWorker")}
                        </div>
                      ) : null}

                      {filteredWorkers.map((worker) => (
                        <button
                          key={worker.id}
                          type="button"
                          onClick={() => setSelectedWorkerId(worker.id)}
                          className={cn(
                            "flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-200",
                            worker.id === selectedWorkerId
                              ? "bg-sky-50 text-sky-900 shadow-[0_8px_22px_rgba(14,165,233,0.16)] ring-1 ring-sky-100"
                              : "text-slate-800 hover:bg-slate-50"
                          )}
                        >
                          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-900 text-[11px] font-bold text-white">
                            {initials(worker.name)}
                          </div>
                          <div className="flex-1">
                            <p className="text-sm font-semibold">{worker.name}</p>
                            <p className="text-[11px] text-slate-500">{worker.city}</p>
                          </div>
                          <Badge variant="slate" className="rounded-full text-[10px]">
                            {t(`planner.worker.status.${worker.status}` as any)}
                          </Badge>
                        </button>
                      ))}
                    </div>
                  </div>
                </Card>

                <Card className="border-slate-200 bg-white p-2.5">
                  <div className="flex items-center gap-2">
                    <Badge
                      variant="emerald"
                      className="bg-emerald-50 text-[11px] text-emerald-700"
                    >
                      {t("sickLeave.calendarTitle")}
                    </Badge>
                    <span className="text-xs text-slate-500">{selectionPreview}</span>
                  </div>
                  <div className="mt-1.5 grid grid-cols-2 gap-1.5">
                    <button
                      type="button"
                      onClick={() => setModeAndSync("range")}
                      className={cn(
                        "flex items-center gap-1.5 rounded-xl border px-3 py-2 text-[11px] font-semibold transition",
                        mode === "range"
                          ? "border-sky-200 bg-sky-50 text-sky-800 shadow-[0_6px_18px_rgba(14,165,233,0.2)]"
                          : "border-slate-200 bg-slate-50 text-slate-700 hover:border-slate-300"
                      )}
                    >
                      <CalendarRange className="h-4 w-4" />
                      {t("sickLeave.mode.range")}
                    </button>
                    <button
                      type="button"
                      onClick={() => setModeAndSync("multi")}
                      className={cn(
                        "flex items-center gap-1.5 rounded-xl border px-3 py-2 text-[11px] font-semibold transition",
                        mode === "multi"
                          ? "border-purple-200 bg-purple-50 text-purple-800 shadow-[0_6px_18px_rgba(147,51,234,0.16)]"
                          : "border-slate-200 bg-slate-50 text-slate-700 hover:border-slate-300"
                      )}
                    >
                      <CalendarClock className="h-4 w-4" />
                      {t("sickLeave.mode.multi")}
                    </button>
                  </div>

                  {mode === "range" ? (
                    <div className="mt-2 grid grid-cols-2 gap-1.5">
                      <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                        <p className="text-[11px] text-slate-500">{t("sickLeave.startLabel")}</p>
                        <p className="text-sm font-semibold text-slate-900">
                          {startDate ? dateFormatter.format(parseISO(startDate)!) : "—"}
                        </p>
                      </div>
                      <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                        <p className="text-[11px] text-slate-500">{t("sickLeave.endLabel")}</p>
                        <p className="text-sm font-semibold text-slate-900">
                          {endDate ? dateFormatter.format(parseISO(endDate)!) : "—"}
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="mt-2 rounded-xl border border-purple-100 bg-purple-50 px-3 py-2 text-sm text-purple-800">
                      {manualDates.size === 0
                        ? t("sickLeave.noSelection")
                        : selectionPreview}
                    </div>
                  )}
                </Card>
              </div>

              <Card className="border-slate-200 bg-white p-2.5">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">
                      {t("sickLeave.calendarTitle")}
                    </p>
                    <p className="text-[11px] text-slate-500">
                      {selectionCount > 0
                        ? t("sickLeave.summary", { count: selectionCount })
                        : t("sickLeave.noSelection")}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2 py-1">
                    <button
                      type="button"
                      onClick={() =>
                        setMonthCursor(
                          new Date(monthCursor.getFullYear(), monthCursor.getMonth() - 1, 1)
                        )
                      }
                      className="flex h-6 w-6 items-center justify-center rounded-full text-slate-600 transition hover:bg-white"
                    >
                      <ArrowLeft className="h-3 w-3" />
                    </button>
                    <span className="px-2 text-sm font-semibold text-slate-900 capitalize">
                      {monthLabel}
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        setMonthCursor(
                          new Date(monthCursor.getFullYear(), monthCursor.getMonth() + 1, 1)
                        )
                      }
                      className="flex h-6 w-6 items-center justify-center rounded-full text-slate-600 transition hover:bg-white"
                    >
                      <ArrowRight className="h-3 w-3" />
                    </button>
                  </div>
                </div>

                <div className="mt-1.5 grid grid-cols-7 gap-1 text-center text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                  {weekdayLabels.map((label) => (
                    <span key={label}>{label}</span>
                  ))}
                </div>

                <div className="mt-1 grid grid-cols-7 gap-0.5">
                  {calendarDays.map((day, index) => {
                    if (!day.inMonth) {
                      return <span key={`${day.iso}-${index}`} className="h-8 rounded-md" />;
                    }
                    const selected = isSelected(day.iso);
                    const edge = isEdge(day.iso);
                    return (
                      <button
                        key={day.iso}
                        type="button"
                        onClick={() => handleDayClick(day)}
                        className={cn(
                          "relative flex h-7 items-center justify-center rounded-md border text-[10px] font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-200",
                          selected
                            ? "border-transparent bg-gradient-to-br from-sky-400 via-indigo-500 to-purple-500 text-white shadow-[0_8px_22px_rgba(79,70,229,0.2)]"
                            : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50"
                        )}
                        aria-pressed={selected}
                      >
                        {edge ? (
                          <span className="absolute inset-0 rounded-md border border-white/70" />
                        ) : null}
                        {day.day}
                      </button>
                    );
                  })}
                </div>

                <div className="mt-3 grid gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 sm:grid-cols-3">
                  <div className="flex items-center gap-2.5">
                    <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-900 text-[10px] font-semibold text-white">
                      {selectedWorker ? initials(selectedWorker.name) : "?"}
                    </span>
                    <div className="text-[11px] text-slate-500">
                      <p className="text-sm font-semibold text-slate-900">
                        {selectedWorker?.name ?? t("sickLeave.workerLabel")}
                      </p>
                      <p>{selectedWorker?.city}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-slate-600">
                    <ShieldAlert className="h-4 w-4 text-amber-500" />
                    {t("sickLeave.helper.blocked")}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-slate-600">
                    <Check className="h-4 w-4 text-emerald-500" />
                    {t("sickLeave.helper.redMarks")}
                  </div>
                </div>
              </Card>
            </div>

            <div className="flex flex-col gap-2 border-t border-slate-200 bg-slate-50 px-3.5 py-3 md:flex-row md:items-center md:justify-between">
              <div className="text-[11px] text-slate-600">
                <div className="flex items-center gap-2">
                  <CalendarClock className="h-4 w-4 text-sky-600" />
                  <span className="font-semibold text-slate-800">{typeLabel}</span>
                  <span className="text-slate-500">
                    {selectionCount > 0
                      ? t("sickLeave.summary", { count: selectionCount })
                      : t("sickLeave.noSelection")}
                  </span>
                </div>
                <p className="text-[11px] text-slate-500">{t("sickLeave.helper.regenerate")}</p>
                {feedback ? (
                  <p className="mt-1 text-[11px] font-semibold text-emerald-600">{feedback}</p>
                ) : null}
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={resetState}
                  className="flex h-8 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                >
                  {t("sickLeave.cancel")}
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={!selectedWorkerId || selectionCount === 0}
                  className="flex h-8 items-center gap-2 rounded-xl bg-gradient-to-r from-sky-500 via-indigo-500 to-purple-600 px-3 text-sm font-semibold text-white shadow-[0_10px_24px_rgba(79,70,229,0.18)] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <UserRound className="h-4 w-4" />
                  {t("sickLeave.submit")}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
