"use client";

import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock,
  FileDown,
  Moon,
  Save,
  Search,
  Sparkles,
  Star,
  Sun,
  Lock,
  Unlock,
  UserRoundSearch,
  X,
} from "lucide-react";
import { Badge } from "../ui/badge";
import { Card } from "../ui/card";
import type {
  Patient,
  Plan,
  PlanAssignment,
  ShiftType,
  Worker,
  WorkerPreference,
} from "@/types";
import { PatientSelector } from "./patient-selector";
import { useTranslations } from "../i18n/language-provider";
import type { Language } from "../i18n/language-provider";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

type PreviewRow = {
  dateKey: string;
  dayLabel: string;
  monthLabel: string;
  day: string;
  night: string;
  isToday: boolean;
};

type ShiftLockState = Record<string, Record<ShiftType, boolean>>;
type BusyShiftMap = Record<string, Record<ShiftType, string[]>>;

const SHIFT_DAY_START_HOUR = 8;
const SHIFT_NIGHT_START_HOUR = 20;

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

function statusVariant(status: Worker["status"]) {
  if (status === "anarbeitung" || status === "anerkennung") return "amber" as const;
  if (status === "pocetnik" || status === "student") return "sky" as const;
  if (status === "externi") return "slate" as const;
  return "emerald" as const;
}

function initials(name: string) {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function WorkerSearchSelect({
  workers,
  selectedIds,
  onSelect,
}: {
  workers: Worker[];
  selectedIds: string[];
  onSelect: (workerId: string) => void;
}) {
  const { t } = useTranslations();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [menuStyle, setMenuStyle] = useState<React.CSSProperties | null>(null);
  const rafRef = useRef<number | null>(null);
  const statusLabels = useMemo(
    () => ({
      radnik: t("planner.worker.status.radnik"),
      anarbeitung: t("planner.worker.status.anarbeitung"),
      student: t("planner.worker.status.student"),
      externi: t("planner.worker.status.externi"),
      pocetnik: t("planner.worker.status.pocetnik"),
      anerkennung: t("planner.worker.status.anerkennung"),
    }),
    [t]
  );

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    return workers.filter((worker) => {
      if (selectedIds.includes(worker.id)) return false;
      if (!term) return true;
      const safeRole = (worker.role ?? "").toLowerCase();
      const safeCity = (worker.city ?? "").toLowerCase();
      return (
        worker.name.toLowerCase().includes(term) ||
        safeRole.includes(term) ||
        safeCity.includes(term)
      );
    });
  }, [query, workers, selectedIds]);

  useEffect(() => {
    const onClickOutside = (event: MouseEvent) => {
      if (!wrapperRef.current) return;
      if (!wrapperRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  useEffect(() => {
    if (!open || !wrapperRef.current) return;
    const cancelFrame = () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
    const updatePosition = () => {
      if (!wrapperRef.current) return;
      const rect = wrapperRef.current.getBoundingClientRect();
      const viewportWidth = window.innerWidth;
      const maxLeft = viewportWidth - rect.width - 16;
      const clampedLeft = Math.max(12, Math.min(rect.left, maxLeft));
      setMenuStyle({
        position: "fixed",
        left: clampedLeft,
        top: rect.bottom + 8,
        width: rect.width,
        zIndex: 9900000,
      });
    };
    const scheduleUpdate = () => {
      if (rafRef.current) return;
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = null;
        updatePosition();
      });
    };

    updatePosition();
    window.addEventListener("resize", scheduleUpdate, { passive: true });
    window.addEventListener("scroll", scheduleUpdate, { passive: true });
    return () => {
      cancelFrame();
      window.removeEventListener("resize", scheduleUpdate);
      window.removeEventListener("scroll", scheduleUpdate);
    };
  }, [open]);

  return (
    <div ref={wrapperRef} className="relative w-full overflow-visible">
      <button
        type="button"
        className="flex w-full items-center gap-3 rounded-2xl border border-slate-200 bg-white/95 px-4 py-3 text-left text-sm font-semibold text-slate-700 shadow-sm transition focus:outline-none focus-visible:border-sky-200 focus-visible:shadow-[0_16px_50px_rgba(56,189,248,0.16)]"
        onClick={() => setOpen(true)}
      >
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-900 text-white shadow-sm">
          <UserRoundSearch className="h-5 w-5" aria-hidden />
        </div>
        <div className="flex-1">
          <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">
            {t("planner.worker.searchTitle")}
          </div>
          <div className="relative mt-1 flex items-center gap-2 text-base font-semibold text-slate-900">
            <Search className="h-4 w-4 text-slate-400" aria-hidden />
            <span className="truncate text-sm text-slate-500">
              {selectedIds.length > 0
                ? t("planner.worker.searchSelected", { count: selectedIds.length })
                : t("planner.worker.searchPlaceholder")}
            </span>
          </div>
        </div>
        <Badge variant="sky" className="text-[11px]">
          {t("planner.worker.searchBadge")}
        </Badge>
      </button>

      {open &&
        menuStyle &&
        createPortal(
          <div
            className="scroll-custom max-h-[300px] overflow-y-auto rounded-xl border border-slate-200 bg-white/98 p-3 shadow-[0_30px_80px_rgba(15,23,42,0.18)]"
            style={menuStyle}
          >
            <div className="relative mb-3">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden />
              <input
                autoFocus
                type="text"
                placeholder={t("planner.worker.searchInputPlaceholder")}
                className="w-full rounded-lg border border-slate-200 bg-white px-9 py-2 text-sm font-medium text-slate-900 placeholder:text-slate-400 focus:border-sky-200 focus:outline-none focus:ring-2 focus:ring-sky-100"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
            </div>
            {filtered.length === 0 ? (
              <div className="px-3 py-2 text-sm text-slate-500">
                {t("planner.worker.searchEmpty")}
              </div>
            ) : (
              <div className="grid gap-2">
                {filtered.map((worker) => {
                  const disabled = selectedIds.includes(worker.id);
                  return (
                    <button
                      key={worker.id}
                      type="button"
                      disabled={disabled}
                      className={`group flex items-center gap-3 rounded-lg border px-3 py-2 text-left transition ${
                        disabled
                          ? "border-slate-100 bg-slate-50 text-slate-400"
                          : "border-transparent hover:-translate-y-[1px] hover:border-slate-200 hover:bg-slate-50"
                      }`}
                      onMouseDown={(event) => {
                        event.preventDefault();
                        if (disabled) return;
                        onSelect(worker.id);
                        setQuery("");
                        setOpen(false);
                      }}
                    >
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-900 text-sm font-bold text-white shadow-sm group-hover:bg-slate-800">
                        {initials(worker.name)}
                      </div>
                      <div className="flex-1">
                        <div className="text-sm font-semibold text-slate-900 group-hover:text-slate-700">
                          {worker.name}
                        </div>
                      <div className="text-xs text-slate-500 group-hover:text-slate-700">
                          {worker.city} · {worker.role || t("planner.worker.roleFallback")}
                      </div>
                      </div>
                      <Badge variant={statusVariant(worker.status)}>
                        {statusLabels[worker.status] ?? worker.status}
                      </Badge>
                    </button>
                  );
                })}
              </div>
            )}
          </div>,
          document.body
        )}
    </div>
  );
}

type WorkerCardProps = {
  worker: Worker;
  preference: WorkerPreference;
  t: ReturnType<typeof useTranslations>["t"];
  statusLabels: Record<Worker["status"], string>;
  onUpdate: (workerId: string, updates: Partial<Omit<WorkerPreference, "workerId">>) => void;
  onRemove: (workerId: string) => void;
};

const WorkerCard = memo(function WorkerCard({
  worker,
  preference,
  t,
  statusLabels,
  onUpdate,
  onRemove,
}: WorkerCardProps) {
  const focusLabel =
    preference.ratio === 50
      ? t("planner.worker.focusBalanced")
      : preference.ratio > 50
        ? t("planner.worker.focusDay", { percent: preference.ratio })
        : t("planner.worker.focusNight", { percent: 100 - preference.ratio });

  const sliderPrimary = "#0ea5e9";
  const sliderBase = "#e2e8f0";
  const textMutedClass = "text-slate-500";
  const chipClass = "border-slate-200 bg-slate-50 text-slate-700";
  const priorityClass = preference.priority
    ? "border-amber-200 bg-amber-50 text-amber-800"
    : "border-slate-200 bg-white text-slate-600 hover:border-slate-300";
  const controlSurface = "border-slate-200 bg-white text-slate-700";
  const cardContainerClass =
    "rounded-2xl border border-border/70 bg-white p-5 shadow-sm";

  return (
    <div className={cardContainerClass}>
      <div className="relative flex items-start gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-900 text-sm font-semibold text-white">
          {initials(worker.name)}
        </div>
        <div className="flex-1 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-base font-semibold text-slate-900">
              {worker.name}
            </p>
            <span
              className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-wide ${chipClass}`}
            >
              {worker.city}
            </span>
            <Badge variant={statusVariant(worker.status)}>
              {statusLabels[worker.status] ?? worker.status}
            </Badge>
            <button
              type="button"
              onClick={() => onRemove(preference.workerId)}
              className="ml-auto inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-400 transition hover:border-red-200 hover:bg-red-50 hover:text-red-600"
              aria-label={t("planner.worker.removeAria")}
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <p className={`text-xs ${textMutedClass}`}>
            {focusLabel}
          </p>
        </div>
      </div>

      <div className="relative mt-5 space-y-4 rounded-2xl border border-slate-100 bg-slate-50/80 p-4">
        <div className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-[0.18em]">
          <span className={textMutedClass}>{t("planner.worker.shiftFocus")}</span>
          <span className="text-slate-700">{focusLabel}</span>
        </div>
        <input
          type="range"
          min={0}
          max={100}
          value={preference.ratio}
          onChange={(event) =>
            onUpdate(preference.workerId, { ratio: Number(event.target.value) })
          }
          className="h-3 w-full cursor-pointer appearance-none rounded-full"
          style={{
            background: `linear-gradient(90deg, ${sliderPrimary} ${preference.ratio}%, ${sliderBase} ${preference.ratio}%)`,
          }}
        />
        <div className="flex items-center justify-between text-xs">
          <span className={textMutedClass}>
            Pomjeri slider prema dnevnim ili noćnim smjenama.
          </span>
          <span className="text-sm font-semibold text-slate-900">
            {preference.ratio}%
          </span>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <label
            className={`flex items-center gap-3 rounded-xl border px-3 py-3 text-xs font-semibold ${controlSurface}`}
          >
            <Clock className="h-4 w-4" />
            <span className="uppercase tracking-[0.12em]">
              {t("planner.worker.planDays")}
            </span>
            <input
              type="number"
              min={0}
              max={31}
              value={preference.days}
              onChange={(event) =>
                onUpdate(preference.workerId, {
                  days: Math.max(0, Number(event.target.value) || 0),
                })
              }
              className="ml-auto w-16 rounded-lg border border-slate-200 bg-white px-2 py-1 text-right text-sm font-semibold text-slate-900 focus:border-sky-200 focus:outline-none focus:ring-2 focus:ring-sky-100"
            />
          </label>
          <button
            type="button"
            onClick={() => onUpdate(preference.workerId, { priority: !preference.priority })}
            aria-pressed={preference.priority}
            className={`flex items-center justify-between rounded-xl border px-3 py-3 text-xs font-semibold transition hover:-translate-y-[1px] hover:border-slate-300 hover:bg-slate-50 ${controlSurface}`}
          >
            <span className="uppercase tracking-[0.12em]">
              {t("planner.worker.priority")}
            </span>
            <span
              className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[11px] font-semibold ${priorityClass}`}
            >
              <Star className="h-3.5 w-3.5" />
              {preference.priority ? "On" : "Off"}
            </span>
          </button>
        </div>
        <p className={`text-[11px] ${textMutedClass}`}>
          0% = samo noćne, 100% = samo dnevne · Ovo je maksimalan broj smjena za radnika.
        </p>
      </div>
    </div>
  );
});

function ShiftDropdownCell({
  shift,
  availableWorkers,
  selectedWorker,
  locked,
  lockDisabled,
  onSelect,
  onToggleLock,
}: {
  shift: ShiftType;
  availableWorkers: Worker[];
  selectedWorker?: Worker;
  locked: boolean;
  lockDisabled: boolean;
  onSelect: (workerId: string) => void;
  onToggleLock: () => void;
}) {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const { t } = useTranslations();
  const lockLabel = locked ? t("planner.unlockShift") : t("planner.lockShift");

  useEffect(() => {
    if (!open) return;
    const handleClick = (event: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  return (
    <div ref={wrapperRef} className="relative">
      <div
        className={`flex w-full items-center gap-3 rounded-xl border border-transparent px-2 py-1 text-left text-slate-500 transition ${
          locked ? "opacity-60 bg-slate-50" : "hover:bg-slate-50/60"
        }`}
      >
        <button
          type="button"
          aria-label={lockLabel}
          title={lockLabel}
          onClick={(event) => {
            event.stopPropagation();
            onToggleLock();
            setOpen(false);
          }}
          className={`inline-flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full border text-slate-500 transition ${
            locked
              ? "border-amber-200 bg-amber-50 text-amber-700 hover:border-amber-300"
              : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
          } ${lockDisabled ? "pointer-events-none opacity-60" : ""}`}
          disabled={lockDisabled}
        >
          {locked ? <Lock className="h-4 w-4" aria-hidden /> : <Unlock className="h-4 w-4" aria-hidden />}
        </button>
        <button
          type="button"
          className={`flex min-w-0 flex-1 flex-col items-start gap-0.5 rounded-lg border border-transparent px-2 py-1 text-left ${
            locked ? "cursor-not-allowed text-slate-400" : "text-slate-500 hover:text-slate-700"
          }`}
          onClick={(event) => {
            event.stopPropagation();
            if (locked) return;
            setOpen((prev) => !prev);
          }}
        >
          <span
            className={`text-base font-semibold ${
              selectedWorker ? "text-slate-900" : "text-slate-400"
            }`}
          >
            {selectedWorker?.name ?? "—"}
          </span>
          {locked ? (
            <span className="text-[11px] uppercase tracking-[0.2em] text-amber-700">
              {t("planner.lockedLabel")}
            </span>
          ) : null}
          <span className="sr-only">
            {shift === "day" ? t("planner.shift.dayLabel") : t("planner.shift.nightLabel")}
          </span>
        </button>
      </div>
      {open && !locked && (
        <div className="absolute left-0 right-0 z-30 mt-2 max-h-52 overflow-auto rounded-2xl border border-slate-200 bg-white p-2 shadow-[0_25px_60px_rgba(15,23,42,0.2)]">
          {availableWorkers.length === 0 ? (
            <div className="px-3 py-2 text-[13px] text-slate-500">
              {t("planner.noAvailableWorkers")}
            </div>
          ) : (
            availableWorkers.map((worker) => (
              <button
                key={worker.id}
                type="button"
                className="flex w-full flex-col gap-1 rounded-xl px-3 py-2 text-left transition hover:bg-slate-50"
                onClick={() => {
                  onSelect(worker.id);
                  setOpen(false);
                }}
              >
                <span className="text-sm font-semibold text-slate-900">
                  {worker.name}
                </span>
                <span className="text-[11px] uppercase tracking-[0.2em] text-slate-500">
                  {worker.city} · {worker.role || t("planner.worker.roleFallback")}
                </span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

function preferenceFromWorker(worker: Worker, priority = false): WorkerPreference {
  const shifts =
    worker.preferredShifts && worker.preferredShifts.length > 0
      ? worker.preferredShifts
      : (["day", "night"] as ShiftType[]);
  const allowDay = shifts.includes("day");
  const allowNight = shifts.includes("night");
  const ratio =
    shifts.length === 1
      ? shifts[0] === "day"
        ? 70
        : 30
      : 50;

  return {
    workerId: worker.id,
    allowDay,
    allowNight,
    ratio,
    days: 7,
    priority,
  };
}

function autoPickLeastBusyWorkers(workers: Worker[], limit = 5): WorkerPreference[] {
  const sorted = [...workers].sort((a, b) => {
    const aCompleted = a.hoursCompleted ?? 0;
    const bCompleted = b.hoursCompleted ?? 0;
    if (aCompleted !== bCompleted) return aCompleted - bCompleted;
    const aPlanned = a.hoursPlanned ?? 0;
    const bPlanned = b.hoursPlanned ?? 0;
    if (aPlanned !== bPlanned) return aPlanned - bPlanned;
    return a.name.localeCompare(b.name);
  });

  return sorted.slice(0, limit).map((worker) => preferenceFromWorker(worker));
}

function toDateKey(year: number, monthZeroBased: number, day: number) {
  return `${year}-${String(monthZeroBased + 1).padStart(2, "0")}-${String(day).padStart(
    2,
    "0"
  )}`;
}

function assignmentsListToMap(
  list: PlanAssignment[]
): Record<string, Record<ShiftType, string | null>> {
  const next: Record<string, Record<ShiftType, string | null>> = {};
  list.forEach((item) => {
    if (!next[item.date]) next[item.date] = { day: null, night: null };
    next[item.date][item.shiftType] = item.workerId ?? null;
  });
  return next;
}

function mapAssignmentsToArray(
  map: Record<string, Record<ShiftType, string | null>>,
  year: number,
  monthZeroBased: number,
  daysInMonth: number
): PlanAssignment[] {
  const rows: PlanAssignment[] = [];
  for (let day = 1; day <= daysInMonth; day++) {
    const dateKey = toDateKey(year, monthZeroBased, day);
    const entry = map[dateKey];
    rows.push({
      date: dateKey,
      shiftType: "day",
      workerId: entry?.day ?? null,
    });
    rows.push({
      date: dateKey,
      shiftType: "night",
      workerId: entry?.night ?? null,
    });
  }
  return rows;
}

function localEvaluateRestRule(
  dateKey: string,
  shift: ShiftType,
  workerId: string,
  assignments: Record<string, Record<ShiftType, string | null>>,
  busyShifts: BusyShiftMap
): { allowed: boolean; reason?: string } {
  const entry = assignments[dateKey] ?? { day: null, night: null };
  const otherShiftWorker = shift === "day" ? entry.night : entry.day;
  if (otherShiftWorker && otherShiftWorker === workerId) {
    return { allowed: false, reason: "same-day-other-shift" };
  }

  const busyEntry = busyShifts[dateKey] ?? { day: [], night: [] };
  if ((busyEntry.day ?? []).includes(workerId) || (busyEntry.night ?? []).includes(workerId)) {
    return { allowed: false, reason: "busy-same-day" };
  }

  const dateValue = new Date(dateKey);
  const prevDate = new Date(dateValue);
  prevDate.setDate(prevDate.getDate() - 1);
  const prevDateKey = toDateKey(prevDate.getFullYear(), prevDate.getMonth(), prevDate.getDate());
  const prevAssignments = assignments[prevDateKey];
  const prevBusy = busyShifts[prevDateKey] ?? { day: [], night: [] };

  if (shift === "day") {
    if (prevAssignments?.night === workerId) {
      return { allowed: false, reason: "night-to-day" };
    }
    if ((prevBusy.night ?? []).includes(workerId)) {
      return { allowed: false, reason: "night-to-day" };
    }
  }

  if (shift === "night") {
    const nextDate = new Date(dateValue);
    nextDate.setDate(nextDate.getDate() + 1);
    const nextDateKey = toDateKey(
      nextDate.getFullYear(),
      nextDate.getMonth(),
      nextDate.getDate()
    );
    const nextBusy = busyShifts[nextDateKey] ?? { day: [], night: [] };
    if ((nextBusy.day ?? []).includes(workerId)) {
      return { allowed: false, reason: "night-to-day" };
    }
  }

  return { allowed: true };
}

function clampRequestedDays(days: number, daysInMonth: number) {
  if (Number.isNaN(days) || days < 0) return 0;
  // Max 2 shifts per day; keep cap to daysInMonth to avoid silly values.
  return Math.min(days, daysInMonth);
}

function buildDefaultLocks(
  now: Date,
  year: number,
  monthZeroBased: number,
  daysInMonth: number
): ShiftLockState {
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();
  const currentHour = now.getHours();
  const isPastMonth =
    year < currentYear || (year === currentYear && monthZeroBased < currentMonth);
  const isCurrentMonth = year === currentYear && monthZeroBased === currentMonth;

  if (!isCurrentMonth && !isPastMonth) return {};

  const todayDay = now.getDate();
  const locks: ShiftLockState = {};

  for (let day = 1; day <= daysInMonth; day++) {
    const dateKey = toDateKey(year, monthZeroBased, day);
    const isPastDay = isPastMonth || (isCurrentMonth && day < todayDay);
    const isToday = isCurrentMonth && day === todayDay;
    const lockDay =
      isPastDay || (isToday && currentHour >= SHIFT_DAY_START_HOUR);
    const lockNight =
      isPastDay || (isToday && currentHour >= SHIFT_NIGHT_START_HOUR);
    locks[dateKey] = { day: lockDay, night: lockNight };
  }

  return locks;
}

export function PlannerWizard() {
  const { t, language } = useTranslations();
  const [patients, setPatients] = useState<Patient[]>([]);
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [selectedPatient, setSelectedPatient] = useState("");
  const [selectedWorkers, setSelectedWorkers] = useState<WorkerPreference[]>([]);
  const [planMonth, setPlanMonth] = useState(() => new Date().getMonth());
  const [planYear, setPlanYear] = useState(() => new Date().getFullYear());
  const todayDate = useMemo(() => new Date(), []);
  const plannerMonthNames = useMemo(
    () => MONTH_LABELS[language] ?? MONTH_LABELS.bs,
    [language]
  );
  const todayDisplay = useMemo(
    () => `${todayDate.getDate()}. ${plannerMonthNames[todayDate.getMonth()]}`,
    [plannerMonthNames, todayDate]
  );
  const todayStart = useMemo(
    () => new Date(todayDate.getFullYear(), todayDate.getMonth(), todayDate.getDate()),
    [todayDate]
  );
  const availablePlanYears = useMemo(() => {
    const currentYear = new Date().getFullYear();
    const minYear = currentYear - 1;
    const maxYear = currentYear + 4;
    const years = Array.from({ length: maxYear - minYear + 1 }, (_, index) => minYear + index);
    if (!years.includes(planYear)) {
      years.push(planYear);
    }
    return years.sort((a, b) => a - b);
  }, [planYear]);
  const handleStepMonth = useCallback(
    (direction: -1 | 1) => {
      const nextDate = new Date(planYear, planMonth + direction, 1);
      setPlanMonth(nextDate.getMonth());
      setPlanYear(nextDate.getFullYear());
    },
    [planMonth, planYear]
  );
  const selectedPlanLabel = useMemo(
    () => formatMonthLabel(language, new Date(planYear, planMonth, 1)),
    [language, planMonth, planYear]
  );
  const isCurrentPlanMonth =
    planMonth === todayDate.getMonth() && planYear === todayDate.getFullYear();
  const [promptText, setPromptText] = useState("");
  const [assignments, setAssignments] = useState<
    Record<string, Record<ShiftType, string | null>>
  >({});
  const [shiftLocks, setShiftLocks] = useState<ShiftLockState>({});
  const [generatedSummary, setGeneratedSummary] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationProgress, setGenerationProgress] = useState(0);
  const [isSaving, setIsSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [isLoadingPlan, setIsLoadingPlan] = useState(false);
  const [sanitizationNotice, setSanitizationNotice] = useState<string | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [busyShifts, setBusyShifts] = useState<BusyShiftMap>({});

  const statusLabels = useMemo(
    () => ({
      radnik: t("planner.worker.status.radnik"),
      anarbeitung: t("planner.worker.status.anarbeitung"),
      student: t("planner.worker.status.student"),
      externi: t("planner.worker.status.externi"),
      pocetnik: t("planner.worker.status.pocetnik"),
      anerkennung: t("planner.worker.status.anerkennung"),
    }),
    [t]
  );

  const selectedIds = useMemo(
    () => selectedWorkers.map((item) => item.workerId),
    [selectedWorkers]
  );

  const workerById = useMemo(() => new Map(workers.map((worker) => [worker.id, worker])), [
    workers,
  ]);
  const daysInMonth = useMemo(
    () => new Date(planYear, planMonth + 1, 0).getDate(),
    [planMonth, planYear]
  );

  const hasAnyAssignment = useMemo(
    () =>
      Object.values(assignments).some((entry) => {
        if (!entry) return false;
        return Boolean(entry.day) || Boolean(entry.night);
      }),
    [assignments]
  );

  const totalAssigned = useMemo(() => {
    let total = 0;
    Object.values(assignments).forEach((entry) => {
      if (entry?.day) total += 1;
      if (entry?.night) total += 1;
    });
    return total;
  }, [assignments]);

  useEffect(() => {
    const loadData = async () => {
      setIsLoadingData(true);
      setErrorMessage(null);
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

        setPatients(patientsJson.data ?? []);
        setWorkers(workersJson.data ?? []);

        if (!selectedPatient && patientsJson.data?.length) {
          setSelectedPatient(patientsJson.data[0].id);
        }
      } catch (error) {
        console.error(error);
        setErrorMessage(t("planner.loadError"));
      } finally {
        setIsLoadingData(false);
      }
    };

    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!selectedPatient && patients.length > 0) {
      setSelectedPatient(patients[0].id);
    }
  }, [patients, selectedPatient]);

  useEffect(() => {
    if (!selectedPatient) return;

    const controller = new AbortController();
    const loadPlan = async () => {
      const now = new Date();
      const daysThisMonth = new Date(planYear, planMonth + 1, 0).getDate();
      const defaultLocks = buildDefaultLocks(now, planYear, planMonth, daysThisMonth);
      setShiftLocks(defaultLocks);
      setIsLoadingPlan(true);
      setStatusMessage(null);
      setErrorMessage(null);
      setSanitizationNotice(null);

      try {
        const response = await fetch(
          `/api/plans?patientId=${selectedPatient}&month=${planMonth + 1}&year=${planYear}`,
          { signal: controller.signal }
        );

        if (!response.ok) {
          throw new Error("Failed to load plan");
        }

        const json = await response.json();
        const plan = (json.data ?? null) as Plan | null;

        if (!plan) {
          setAssignments({});
          setGeneratedSummary(null);
          setPromptText("");
          setShiftLocks(defaultLocks);
          setHasUnsavedChanges(false);
          return;
        }

        const planAssignments = plan.assignments ?? [];
        setAssignments(assignmentsListToMap(planAssignments));
        setGeneratedSummary(plan.summary ?? null);
        setPromptText(plan.prompt ?? "");
        setShiftLocks(defaultLocks);
        setHasUnsavedChanges(false);
      } catch (error) {
        if ((error as Error).name === "AbortError") return;
        console.error(error);
        setAssignments({});
        setGeneratedSummary(null);
        setPromptText("");
        setErrorMessage(t("planner.loadError"));
        setShiftLocks(defaultLocks);
        setHasUnsavedChanges(false);
      } finally {
        if (!controller.signal.aborted) {
          setIsLoadingPlan(false);
        }
      }
    };

    loadPlan();
    return () => controller.abort();
  }, [planMonth, planYear, selectedPatient, t, workerById]);

  useEffect(() => {
    const controller = new AbortController();
    const loadBusy = async () => {
      try {
        const response = await fetch(
          `/api/plans?mode=busy&month=${planMonth + 1}&year=${planYear}${
            selectedPatient ? `&excludePatientId=${selectedPatient}` : ""
          }`,
          { signal: controller.signal }
        );

        if (!response.ok) {
          throw new Error("Failed to load busy shifts");
        }

        const json = await response.json();
        const items = Array.isArray(json.data) ? json.data : [];
        const next: BusyShiftMap = {};
        items.forEach((item: { date?: string; shiftType?: ShiftType; workerId?: string }) => {
          if (!item?.date || !item?.shiftType || !item?.workerId) return;
          if (!next[item.date]) next[item.date] = { day: [], night: [] };
          next[item.date][item.shiftType].push(item.workerId);
        });
        if (!controller.signal.aborted) {
          setBusyShifts(next);
        }
      } catch (error) {
        if ((error as Error).name === "AbortError") return;
        console.error(error);
        if (!controller.signal.aborted) {
          setBusyShifts({});
        }
      }
    };

    loadBusy();
    return () => controller.abort();
  }, [planMonth, planYear, selectedPatient]);

  useEffect(() => {
    if (!isGenerating) {
      setGenerationProgress(0);
      return;
    }

    setGenerationProgress(6);
    const interval = setInterval(() => {
      setGenerationProgress((prev) => Math.min(99, prev + Math.random() * 2 + 0.4));
    }, 520);

    return () => clearInterval(interval);
  }, [isGenerating]);

  const availableWorkersByShift = useMemo(() => {
    const build = (shift: ShiftType) => {
      const fromPref = selectedWorkers
        .filter((pref) => (shift === "day" ? pref.allowDay : pref.allowNight))
        .map((pref) => workerById.get(pref.workerId))
        .filter((worker): worker is Worker => Boolean(worker));

      if (fromPref.length > 0) return fromPref;

      return workers.filter((worker) =>
        (worker.preferredShifts ?? ["day", "night"]).includes(shift)
      );
    };

    return {
      day: build("day"),
      night: build("night"),
    };
  }, [selectedWorkers, workerById, workers]);

  const upsertWorker = useCallback(
    (workerId: string) => {
      setSelectedWorkers((prev) => {
        if (prev.some((worker) => worker.workerId === workerId)) return prev;
        const meta = workerById.get(workerId);
        return [
          ...prev,
          meta
            ? preferenceFromWorker(meta)
            : { workerId, allowDay: true, allowNight: true, ratio: 50, days: 7, priority: false },
        ];
      });
    },
    [workerById]
  );

  const updateWorker = useCallback(
    (
      workerId: string,
      updates: Partial<Omit<WorkerPreference, "workerId">>
    ) => {
      setSelectedWorkers((prev) =>
        prev.map((item) =>
          item.workerId === workerId ? { ...item, ...updates } : item
        )
      );
    },
    []
  );

  const removeWorker = useCallback((workerId: string) => {
    setSelectedWorkers((prev) => prev.filter((item) => item.workerId !== workerId));
  }, []);

  const previewRows = useMemo<PreviewRow[]>(() => {
    const fallbackWorker: Worker = {
      id: "placeholder",
      name: t("planner.shift.unknown"),
      role: "-",
      status: "radnik",
      preferredShifts: ["day"],
      hoursPlanned: 0,
      hoursCompleted: 0,
      city: "-",
    };
    const fallbackPool = workers.length > 0 ? workers : [fallbackWorker];

    const dayCycle = selectedWorkers
      .filter((pref) => pref.allowDay)
      .map((pref) => workerById.get(pref.workerId))
      .filter((worker): worker is Worker => Boolean(worker));
    const nightCycle = selectedWorkers
      .filter((pref) => pref.allowNight)
      .map((pref) => workerById.get(pref.workerId))
      .filter((worker): worker is Worker => Boolean(worker));

    const safeDayCycle = dayCycle.length > 0 ? dayCycle : fallbackPool;
    const safeNightCycle = nightCycle.length > 0 ? nightCycle : fallbackPool;

    return Array.from({ length: daysInMonth }, (_, index) => {
      const date = new Date(planYear, planMonth, index + 1);
      const dayLabel = String(index + 1).padStart(2, "0");
      const dateKey = toDateKey(planYear, planMonth, index + 1);
      const assignedDayId = assignments[dateKey]?.day;
      const assignedNightId = assignments[dateKey]?.night;

      const dayWorker = assignedDayId
        ? workerById.get(assignedDayId) ?? fallbackWorker
        : safeDayCycle[index % safeDayCycle.length];
      const nightWorker = assignedNightId
        ? workerById.get(assignedNightId) ?? fallbackWorker
        : safeNightCycle[index % safeNightCycle.length];

      return {
        dateKey,
        dayLabel,
        monthLabel: formatMonthLabel(language, date),
        day: dayWorker?.name ?? t("planner.shift.unknown"),
        night: nightWorker?.name ?? t("planner.shift.unknown"),
        isToday: isCurrentPlanMonth && date.getDate() === todayDate.getDate(),
      };
    });
  }, [
    assignments,
    daysInMonth,
    isCurrentPlanMonth,
    language,
    planMonth,
    planYear,
    selectedWorkers,
    t,
    todayDate,
    workerById,
    workers,
  ]);

  const assignWorker = (dateKey: string, shift: ShiftType, workerId: string) => {
    const lockState = shiftLocks[dateKey];
    if (lockState?.[shift]) return;
    const restCheck = localEvaluateRestRule(dateKey, shift, workerId, assignments, busyShifts);
    if (!restCheck.allowed) {
      const reason = restCheck.reason;
      if (reason === "same-day-other-shift" || reason === "busy-same-day") {
        setErrorMessage("Radnik je već zauzet u drugoj smjeni tog dana.");
      } else if (reason === "night-to-day") {
        setErrorMessage("Radnik mora imati 12h odmora poslije noćne; ne može na dnevnu naredni dan.");
      } else {
        setErrorMessage("Smjena krši pravila odmora.");
      }
      return;
    }

    setStatusMessage(null);
    setHasUnsavedChanges(true);
    setAssignments((prev) => ({
      ...prev,
      [dateKey]: { ...{ day: null, night: null }, ...prev[dateKey], [shift]: workerId },
    }));
  };

  const toggleLock = (dateKey: string, shift: ShiftType) => {
    const dateValue = new Date(dateKey);
    if (dateValue < todayStart) return;
    setShiftLocks((prev) => {
      const current = prev[dateKey] ?? { day: false, night: false };
      setHasUnsavedChanges(true);
      return {
        ...prev,
        [dateKey]: { ...current, [shift]: !current[shift] },
      };
    });
  };

  const handleGenerate = async () => {
    if (!selectedPatient) {
      setErrorMessage(t("planner.generateMissing"));
      return;
    }

    let workersToUse = selectedWorkers;

    if (workersToUse.length === 0) {
      const autoSelected = autoPickLeastBusyWorkers(workers);
      if (autoSelected.length === 0) {
        setErrorMessage(t("planner.generateMissing"));
        return;
      }
      workersToUse = autoSelected;
      setSelectedWorkers(autoSelected);
      setStatusMessage("Automatski odabrani radnici sa najmanje sati.");
    }

    setIsGenerating(true);
    setStatusMessage(null);
    setErrorMessage(null);
    setSanitizationNotice(null);

    try {
      const clampedWorkers = workersToUse.map((worker) => ({
        ...worker,
        days: clampRequestedDays(worker.days, daysInMonth),
      }));
      const wasClamped = workersToUse.some(
        (worker) => worker.days !== clampRequestedDays(worker.days, daysInMonth)
      );
      const notices: string[] = [];
      if (wasClamped) {
        notices.push(t("planner.daysClamped", { max: daysInMonth }));
      }

      const totalSlots = daysInMonth * 2;
      const requested = clampedWorkers.reduce((sum, worker) => sum + worker.days, 0);
      const requestedDay = clampedWorkers.reduce(
        (sum, worker) => sum + worker.days * (worker.ratio / 100),
        0
      );
      const requestedNight = requested - requestedDay;

      let scaledWorkers = clampedWorkers;
      if (requested > totalSlots) {
        const factor = totalSlots / Math.max(requested, 1);
        const meta = clampedWorkers.map((worker) => ({
          pref: worker,
          scaled: Math.max(0, Math.floor(worker.days * factor)),
        }));
        const scaledTotal = meta.reduce((sum, item) => sum + item.scaled, 0);
        let remaining = totalSlots - scaledTotal;
        const byNeed = [...meta].sort(
          (a, b) => b.pref.days - a.pref.days || a.pref.workerId.localeCompare(b.pref.workerId)
        );
        let idx = 0;
        while (remaining > 0 && byNeed.length > 0) {
          byNeed[idx % byNeed.length].scaled += 1;
          remaining -= 1;
          idx += 1;
        }
        scaledWorkers = meta.map((item) => ({ ...item.pref, days: item.scaled }));
        const effectiveRequested = scaledWorkers.reduce((sum, worker) => sum + worker.days, 0);
        notices.push(
          `Traženo ${requested} smjena (dnevne ≈ ${Math.round(requestedDay)}, noćne ≈ ${Math.round(
            requestedNight
          )}); automatski podešeno na ${effectiveRequested} zbog ograničenja ${totalSlots} slotova (${daysInMonth} dnevnih / ${daysInMonth} noćnih).`
        );
      } else {
        notices.push(
          `Traženo ${requested} smjena (dnevne ≈ ${Math.round(requestedDay)}, noćne ≈ ${Math.round(
            requestedNight
          )}); dostupno ${totalSlots} slotova (${daysInMonth} dnevnih / ${daysInMonth} noćnih).`
        );
      }
      setSanitizationNotice(notices.join(" · "));

      const response = await fetch("/api/plans/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          patientId: selectedPatient,
          workerPreferences: scaledWorkers,
          month: planMonth + 1,
          year: planYear,
          prompt: promptText,
          currentAssignments: mapAssignmentsToArray(assignments, planYear, planMonth, daysInMonth),
          lockedShifts: Object.entries(shiftLocks).flatMap(([date, shifts]) =>
            (["day", "night"] as const)
              .filter((shift) => shifts[shift])
              .map((shift) => ({ date, shiftType: shift }))
          ),
        }),
      });

      const json = await response.json();
      if (!response.ok) {
        throw new Error(json.error || "Failed to generate plan");
      }

      const assignmentList: PlanAssignment[] = json.data?.assignments ?? [];
      const generatedAssignments = assignmentsListToMap(assignmentList);
      const mergedAssignments: Record<string, Record<ShiftType, string | null>> = {
        ...generatedAssignments,
      };

      Object.entries(shiftLocks).forEach(([dateKey, shiftState]) => {
        const existing = assignments[dateKey];
        if (!mergedAssignments[dateKey]) {
          mergedAssignments[dateKey] = { day: null, night: null };
        }
        if (shiftState.day) {
          mergedAssignments[dateKey].day = existing?.day ?? null;
        }
        if (shiftState.night) {
          mergedAssignments[dateKey].night = existing?.night ?? null;
        }
      });

      setAssignments(mergedAssignments);
      setGeneratedSummary(json.data?.summary ?? null);
      setStatusMessage(t("planner.generateSuccess"));
      setHasUnsavedChanges(true);
    } catch (error) {
      console.error(error);
      setErrorMessage(t("planner.generateError"));
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSave = async () => {
    if (!selectedPatient) {
      setErrorMessage(t("planner.generateMissing"));
      return;
    }

    setIsSaving(true);
    setStatusMessage(null);
    setErrorMessage(null);

    try {
      const payloadAssignments = mapAssignmentsToArray(
        assignments,
        planYear,
        planMonth,
        daysInMonth
      );

      const response = await fetch("/api/plans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          patientId: selectedPatient,
          month: planMonth + 1,
          year: planYear,
          prompt: promptText,
          summary: generatedSummary,
          assignments: payloadAssignments,
        }),
      });

      const json = await response.json();
      if (!response.ok) {
        throw new Error(json.error || "Failed to save plan");
      }

      const savedPlan = (json.data ?? null) as Plan | null;
      if (savedPlan?.assignments) {
        setAssignments(assignmentsListToMap(savedPlan.assignments));
      }
      if (savedPlan?.summary) {
        setGeneratedSummary(savedPlan.summary);
      }
      const warningText = json.warnings
        ? Array.isArray(json.warnings)
          ? json.warnings.join(" · ")
          : String(json.warnings)
        : null;
      setSanitizationNotice(warningText ?? null);

      setStatusMessage(t("planner.saveSuccess"));
      setHasUnsavedChanges(false);
    } catch (error) {
      console.error(error);
      setErrorMessage((error as Error).message || t("planner.saveError"));
    } finally {
      setIsSaving(false);
    }
  };

  const handleExport = () => {
    const patient = patients.find((p) => p.id === selectedPatient);
    const doc = new jsPDF();
    doc.setFontSize(12);
    doc.text(`Pacijent: ${patient?.name ?? "-"}`, 14, 16);
    doc.text(`Grad: ${patient?.city ?? "-"}`, 14, 24);
    doc.text(`Pflegegrad: ${patient?.level ?? "-"}`, 14, 32);
    doc.text(`Mjesec: ${selectedPlanLabel}`, 14, 40);
    doc.text(`Generisano: ${new Date().toLocaleString()}`, 14, 48);
    if (generatedSummary) {
      doc.text("Sažetak:", 14, 58);
      doc.text(doc.splitTextToSize(generatedSummary, 180), 14, 66);
    }

    autoTable(doc, {
      startY: generatedSummary ? 80 : 64,
      head: [["Datum", "Dnevna", "Noćna"]],
      body: previewRows.map((row) => [
        `${row.dayLabel}. ${row.monthLabel}`,
        row.day,
        row.night,
      ]),
      styles: { fontSize: 9 },
      headStyles: { fillColor: [15, 23, 42] },
    });

    doc.save(
      `plan-${patient?.name ?? "pacijent"}-${planYear}-${String(planMonth + 1).padStart(2, "0")}.pdf`
    );
  };

  const disableGenerate =
    isGenerating ||
    isLoadingData ||
    isLoadingPlan ||
    !selectedPatient ||
    workers.length === 0;
  const disableSave =
    isSaving || isGenerating || isLoadingPlan || !selectedPatient || !hasAnyAssignment;
  const todayRow = previewRows.find((row) => row.isToday);
  const progressPercent = Math.min(99, Math.max(0, Math.round(generationProgress)));

  return (
    <Card className="relative space-y-4 overflow-hidden">
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="text-xl font-semibold text-slate-900">{t("planner.title")}</h2>
          {hasUnsavedChanges ? (
            <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700">
              {t("planner.unsavedChanges")}
            </span>
          ) : null}
          {statusMessage ? (
            <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
              {statusMessage}
            </span>
          ) : null}
          {errorMessage ? (
            <span className="rounded-full bg-red-50 px-3 py-1 text-xs font-semibold text-red-700">
              {errorMessage}
            </span>
          ) : null}
          {sanitizationNotice ? (
            <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700">
              {sanitizationNotice}
            </span>
          ) : null}
        </div>

        <div className="space-y-3">
          <PatientSelector
            value={selectedPatient}
            onChange={(patientId) => setSelectedPatient(patientId)}
            data={patients}
            isLoading={isLoadingData}
          />
        </div>

        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-3">
            <p className="text-xs uppercase tracking-[0.2em] text-slate-500">
              {t("planner.workersLabel")}
            </p>
          </div>
          <WorkerSearchSelect
            workers={workers}
            selectedIds={selectedIds}
            onSelect={upsertWorker}
          />

          {isLoadingData ? (
            <div className="rounded-xl border border-slate-100 bg-slate-50 px-4 py-3 text-sm text-slate-600">
              {t("planner.loading")}
            </div>
          ) : null}

          {workers.length === 0 && !isLoadingData ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              {t("planner.noWorkers")}
            </div>
          ) : null}

          <div className="grid gap-3 lg:grid-cols-2">
            {selectedWorkers.map((item) => {
              const worker = workerById.get(item.workerId);
              if (!worker) return null;
              return (
                <WorkerCard
                  key={item.workerId}
                  worker={worker}
                  preference={item}
                  t={t}
                  statusLabels={statusLabels}
                  onUpdate={updateWorker}
                  onRemove={removeWorker}
                />
              );
            })}
          </div>
        </div>

        <div className="space-y-2">
          <p className="text-xs uppercase tracking-[0.2em] text-slate-500">
            {t("planner.promptLabel")}
          </p>
          <textarea
            placeholder={t("planner.promptPlaceholder")}
            className="w-full resize-none rounded-2xl border border-border/70 bg-white px-3 py-3 text-sm text-slate-800 outline-none placeholder:text-slate-400"
            rows={4}
            value={promptText}
            onChange={(event) => setPromptText(event.target.value)}
          />
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white/90 p-4 shadow-[0_18px_50px_rgba(15,23,42,0.08)] relative overflow-hidden">
          <div
            className={`flex flex-wrap items-center justify-between gap-3 transition duration-300 ${
              isGenerating ? "opacity-0 pointer-events-none" : "opacity-100"
            }`}
            aria-hidden={isGenerating}
          >
            <div className="flex min-w-[280px] flex-1 items-center gap-2 rounded-xl border border-slate-100 bg-slate-50/70 p-3 shadow-inner sm:p-3.5">
              <button
                type="button"
                aria-label={t("planner.generate.prevMonth")}
                onClick={() => handleStepMonth(-1)}
                className="inline-flex h-11 w-11 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 shadow-sm transition hover:-translate-y-[1px] hover:border-slate-300 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-sky-100"
              >
                <ChevronLeft className="h-4 w-4" aria-hidden />
              </button>
              <div className="flex flex-1 flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
                <label className="sr-only" htmlFor="planner-month-select">
                  {t("planner.generate.monthLabel")}
                </label>
                <div className="relative flex-1 min-w-[160px] sm:min-w-[180px]">
                  <select
                    id="planner-month-select"
                    aria-label={t("planner.generate.monthLabel")}
                    className="h-11 w-full appearance-none rounded-xl border border-slate-200 bg-white px-3 pr-10 text-sm font-semibold text-slate-700 shadow-sm shadow-slate-100 transition hover:border-slate-300 focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-100"
                    value={planMonth}
                    onChange={(event) => setPlanMonth(Number(event.target.value))}
                  >
                    {plannerMonthNames.map((label, index) => (
                      <option key={label} value={index}>
                        {label}
                      </option>
                    ))}
                  </select>
                  <ChevronDown
                    className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
                    aria-hidden
                  />
                </div>
                <label className="sr-only" htmlFor="planner-year-select">
                  {t("planner.generate.yearLabel")}
                </label>
                <div className="relative w-full sm:w-[140px]">
                  <select
                    id="planner-year-select"
                    aria-label={t("planner.generate.yearLabel")}
                    className="h-11 w-full appearance-none rounded-xl border border-slate-200 bg-white px-3 pr-10 text-sm font-semibold text-slate-700 shadow-sm shadow-slate-100 transition hover:border-slate-300 focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-100"
                    value={planYear}
                    onChange={(event) => setPlanYear(Number(event.target.value))}
                  >
                    {availablePlanYears.map((year) => (
                      <option key={year} value={year}>
                        {year}
                      </option>
                    ))}
                  </select>
                  <ChevronDown
                    className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
                    aria-hidden
                  />
                </div>
              </div>
              <button
                type="button"
                aria-label={t("planner.generate.nextMonth")}
                onClick={() => handleStepMonth(1)}
                className="inline-flex h-11 w-11 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 shadow-sm transition hover:-translate-y-[1px] hover:border-slate-300 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-sky-100"
              >
                <ChevronRight className="h-4 w-4" aria-hidden />
              </button>
            </div>

            <div className="flex flex-wrap items-center justify-end gap-3">
              <button
                type="button"
                onClick={handleGenerate}
                disabled={disableGenerate}
                className="group inline-flex w-full min-w-[170px] items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 px-5 py-3 text-sm font-semibold text-white shadow-[0_14px_32px_rgba(15,23,42,0.28)] transition hover:-translate-y-[2px] hover:shadow-[0_18px_46px_rgba(15,23,42,0.32)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-200 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
              >
                <Sparkles className="h-4 w-4 transition duration-150 group-hover:scale-110" />
                {isGenerating ? t("planner.generating") : t("planner.generate")}
              </button>
              <button
                type="button"
                onClick={handleExport}
                className="group inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 shadow-[0_10px_30px_rgba(15,23,42,0.08)] transition hover:-translate-y-[2px] hover:border-slate-300 hover:bg-slate-50 hover:shadow-[0_12px_38px_rgba(15,23,42,0.12)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-100 sm:w-auto"
              >
                <FileDown className="h-4 w-4 transition duration-150 group-hover:scale-110 group-hover:text-slate-900" />
                {t("planner.export")}
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={disableSave}
                className="group inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-emerald-500 to-emerald-600 px-5 py-3 text-sm font-semibold text-white shadow-[0_14px_32px_rgba(16,185,129,0.35)] transition hover:-translate-y-[2px] hover:shadow-[0_18px_48px_rgba(16,185,129,0.42)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-100 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
              >
                <Save className="h-4 w-4 transition duration-150 group-hover:scale-110" />
                  {isSaving ? t("planner.saving") : t("planner.save")}
              </button>
            </div>
          </div>
          {isGenerating ? (
            <div className="absolute inset-0 z-10 flex items-center justify-center rounded-2xl bg-slate-900/90">
              <div className="flex w-full flex-col items-center gap-4 rounded-2xl bg-slate-900/90 px-6 py-4">
                <div className="flex w-full items-center justify-between text-sm font-semibold tracking-[0.3em] text-white">
                  <span>Planiranje</span>
                  <div className="h-2 w-2 rounded-full bg-cyan-400 animate-pulse" />
                </div>
                <div className="relative h-2 w-full overflow-hidden rounded-full bg-slate-700">
                  <div
                    className="absolute inset-0 h-full rounded-full bg-gradient-to-r from-cyan-400 via-blue-500 to-indigo-500 animate-[scan_2s_linear_infinite]"
                    style={{ width: `${progressPercent}%` }}
                  />
                  <div className="absolute inset-y-0 left-0 h-full w-full bg-gradient-to-r from-transparent via-white/40 to-transparent opacity-40 animate-[glow_4s_ease-in-out_infinite]" />
                </div>
                <div className="w-full text-xs font-semibold tracking-[0.3em] text-white/70">
                  {progressPercent}% kompletirano
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </div>

      <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_30px_60px_rgba(15,23,42,0.08)]">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-[11px] uppercase tracking-[0.3em] text-slate-500">
              {t("planner.preview.kicker")}
            </p>
            <h3 className="text-lg font-semibold text-slate-900">
              {t("planner.preview.title")}
            </h3>
          </div>
          <div className="flex flex-col items-end gap-1 text-right">
            <span className="inline-flex items-center rounded-full bg-slate-100 px-3 py-1 text-[11px] font-semibold tracking-[0.2em] text-slate-600">
              {selectedPlanLabel}
            </span>
            <span className="text-sm font-semibold text-slate-500">
              {t("planner.preview.meta", {
                days: previewRows.length,
                workers: selectedWorkers.length,
              })}
            </span>
            <span className="text-xs text-slate-500">
              {t("planner.preview.assigned", { count: totalAssigned })}
            </span>
          </div>
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
            {previewRows.map((row) => {
              const assignedDayId = assignments[row.dateKey]?.day;
              const assignedNightId = assignments[row.dateKey]?.night;
              const lockState = shiftLocks[row.dateKey] ?? { day: false, night: false };
              const dayLocked = lockState.day;
              const nightLocked = lockState.night;
              const busyDayIds = new Set(busyShifts[row.dateKey]?.day ?? []);
              const busyNightIds = new Set(busyShifts[row.dateKey]?.night ?? []);
              const dayOptions = availableWorkersByShift.day.filter(
                (worker) => !busyDayIds.has(worker.id)
              );
              const nightOptions = availableWorkersByShift.night.filter(
                (worker) => !busyNightIds.has(worker.id)
              );
              const rowLockedClass =
                dayLocked && nightLocked ? "ring-1 ring-amber-200 bg-amber-50/70" : "";
              const isPastDate = new Date(row.dateKey) < todayStart;

              return (
                <div
                  key={row.dateKey}
                  className={`grid grid-cols-[1.3fr_1fr_1fr] px-4 py-3 text-sm text-slate-700 transition-colors hover:bg-slate-50 ${
                    row.isToday ? "bg-sky-50 text-slate-900 ring-1 ring-sky-200" : ""
                  } ${rowLockedClass}`}
                >
                  <div className="flex flex-col gap-0.5 text-slate-900">
                    <span className="text-base font-semibold leading-tight">
                      {row.dayLabel}
                    </span>
                    <span className="text-xs uppercase tracking-[0.3em] text-slate-500">
                      {row.monthLabel}
                    </span>
                    {rowLockedClass ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-amber-700">
                        <Lock className="h-3 w-3" aria-hidden /> {t("planner.lockedLabel")}
                      </span>
                    ) : null}
                  </div>
                  <ShiftDropdownCell
                    shift="day"
                    availableWorkers={dayOptions}
                    selectedWorker={
                      assignedDayId ? workerById.get(assignedDayId) : undefined
                    }
                    locked={dayLocked}
                    lockDisabled={isPastDate}
                    onSelect={(workerId) => assignWorker(row.dateKey, "day", workerId)}
                    onToggleLock={() => toggleLock(row.dateKey, "day")}
                  />
                  <ShiftDropdownCell
                    shift="night"
                    availableWorkers={nightOptions}
                    selectedWorker={
                      assignedNightId ? workerById.get(assignedNightId) : undefined
                    }
                    locked={nightLocked}
                    lockDisabled={isPastDate}
                    onSelect={(workerId) => assignWorker(row.dateKey, "night", workerId)}
                    onToggleLock={() => toggleLock(row.dateKey, "night")}
                  />
                </div>
              );
            })}
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
      </div>
    </Card>
  );
}
