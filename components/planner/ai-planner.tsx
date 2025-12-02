"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  ChevronDown,
  Clock,
  Download,
  Moon,
  Save,
  Search,
  Sparkles,
  Star,
  Sun,
  UserRoundSearch,
  X,
} from "lucide-react";
import { patients, workers } from "@/lib/mock-data";
import { Badge } from "../ui/badge";
import { Card } from "../ui/card";
import type { Worker, ShiftType } from "@/types";
import { PatientSelector } from "./patient-selector";
import { useTranslations } from "../i18n/language-provider";
import type { Language } from "../i18n/language-provider";

type WorkerPreference = {
  workerId: string;
  allowDay: boolean;
  allowNight: boolean;
  ratio: number; // 0 = samo noćne, 100 = samo dnevne
  days: number;
  priority: boolean;
};

type PreviewRow = {
  dateKey: string;
  dayLabel: string;
  monthLabel: string;
  day: string;
  night: string;
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

function formatMonthLabel(language: Language, date: Date) {
  const monthNames = MONTH_LABELS[language] ?? MONTH_LABELS.bs;
  const monthName = monthNames[date.getMonth()];
  return `${monthName} ${date.getFullYear()}`;
}

function statusVariant(status: Worker["status"]) {
  if (status === "anerkennung") return "amber" as const;
  if (status === "pocetnik") return "slate" as const;
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
  const statusLabels = useMemo(
    () => ({
      radnik: t("planner.worker.status.radnik"),
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
      return (
        worker.name.toLowerCase().includes(term) ||
        worker.role.toLowerCase().includes(term) ||
        worker.city.toLowerCase().includes(term)
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
    const updatePosition = () => {
      const rect = wrapperRef.current!.getBoundingClientRect();
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
    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
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

      {open && menuStyle &&
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
                          {worker.city} · {worker.role}
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
            <style jsx>{`
              .scroll-custom {
                scrollbar-width: thin;
                scrollbar-color: rgba(15, 23, 42, 0.2) transparent;
              }
              .scroll-custom::-webkit-scrollbar {
                width: 6px;
              }
              .scroll-custom::-webkit-scrollbar-track {
                background: transparent;
                margin: 12px 0;
              }
              .scroll-custom::-webkit-scrollbar-thumb {
                background: rgba(15, 23, 42, 0.2);
                border-radius: 999px;
              }
            `}</style>
          </div>,
          document.body
        )}
    </div>
  );
}

function ShiftDropdownCell({
  shift,
  availableWorkers,
  selectedWorker,
  onSelect,
}: {
  shift: ShiftType;
  availableWorkers: Worker[];
  selectedWorker?: Worker;
  onSelect: (workerId: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const { t } = useTranslations();

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
      <button
        type="button"
        className="flex w-full flex-col items-start gap-1 text-left text-slate-500 transition hover:text-slate-700 focus:outline-none"
        onClick={(event) => {
          event.stopPropagation();
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
        <span className="sr-only">
          {shift === "day" ? t("planner.shift.dayLabel") : t("planner.shift.nightLabel")}
        </span>
      </button>
      {open && (
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
                  {worker.city} · {worker.role}
                </span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

function ShiftToggle({
  active,
  icon: Icon,
  label,
  onClick,
}: {
  active: boolean;
  icon: typeof Sun;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-semibold transition ${
        active
          ? "border-sky-200 bg-sky-50 text-sky-800"
          : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
      }`}
    >
      <Icon className="h-4 w-4" />
      {label}
    </button>
  );
}

export function PlannerWizard() {
  const { t, language } = useTranslations();
  const statusLabels = useMemo(
    () => ({
      radnik: t("planner.worker.status.radnik"),
      pocetnik: t("planner.worker.status.pocetnik"),
      anerkennung: t("planner.worker.status.anerkennung"),
    }),
    [t]
  );
  const shiftToggleLabels = useMemo(
    () => ({
      day: t("planner.worker.allowDay"),
      night: t("planner.worker.allowNight"),
    }),
    [t]
  );
  const [planMonth, setPlanMonth] = useState(() => new Date().getMonth());
  const [planYear, setPlanYear] = useState(() => new Date().getFullYear());
  const plannerMonthNames = useMemo(
    () => MONTH_LABELS[language] ?? MONTH_LABELS.bs,
    [language]
  );
  const availablePlanYears = useMemo(() => {
    const currentYear = new Date().getFullYear();
    return Array.from({ length: 4 }, (_, index) => currentYear + index);
  }, []);
  const selectedPlanLabel = useMemo(
    () => formatMonthLabel(language, new Date(planYear, planMonth, 1)),
    [language, planMonth, planYear]
  );
  const [selectedPatient, setSelectedPatient] = useState(patients[0].id);
  const [selectedWorkers, setSelectedWorkers] = useState<WorkerPreference[]>(() =>
    workers.slice(0, 3).map((worker, index) => ({
      workerId: worker.id,
      allowDay: worker.preferredShifts.includes("day"),
      allowNight: worker.preferredShifts.includes("night"),
      ratio:
        worker.preferredShifts.length === 1
          ? worker.preferredShifts[0] === "day"
            ? 75
            : 25
          : 50,
      days: 6 + index * 2,
      priority: index === 0,
    }))
  );

  const selectedIds = useMemo(
    () => selectedWorkers.map((item) => item.workerId),
    [selectedWorkers]
  );

  const upsertWorker = (workerId: string) => {
    setSelectedWorkers((prev) => {
      if (prev.some((worker) => worker.workerId === workerId)) return prev;
      const meta = workers.find((worker) => worker.id === workerId);
      return [
        ...prev,
        {
          workerId,
          allowDay: meta?.preferredShifts.includes("day") ?? true,
          allowNight: meta?.preferredShifts.includes("night") ?? true,
          ratio:
            meta?.preferredShifts.length === 1
              ? meta.preferredShifts[0] === "day"
                ? 70
                : 30
              : 50,
          days: 7,
          priority: false,
        },
      ];
    });
  };

  const updateWorker = (
    workerId: string,
    updates: Partial<Omit<WorkerPreference, "workerId">>
  ) => {
    setSelectedWorkers((prev) =>
      prev.map((item) =>
        item.workerId === workerId ? { ...item, ...updates } : item
      )
    );
  };

  const toggleShift = (workerId: string, shift: ShiftType) => {
    setSelectedWorkers((prev) =>
      prev.map((item) => {
        if (item.workerId !== workerId) return item;
        const nextDay = shift === "day" ? !item.allowDay : item.allowDay;
        const nextNight = shift === "night" ? !item.allowNight : item.allowNight;

        const safeDay = nextDay || (!nextDay && !nextNight && shift === "night");
        const safeNight = nextNight || (!nextDay && !nextNight && shift === "day");

        return { ...item, allowDay: safeDay, allowNight: safeNight };
      })
    );
  };

  const removeWorker = (workerId: string) => {
    setSelectedWorkers((prev) => prev.filter((item) => item.workerId !== workerId));
  };

  const previewRows = useMemo<PreviewRow[]>(() => {
    const enriched = selectedWorkers
      .map((pref) => {
        const worker = workers.find((person) => person.id === pref.workerId);
        if (!worker) return null;
        return { worker, pref };
      })
      .filter(
        (entry): entry is { worker: Worker; pref: WorkerPreference } => Boolean(entry)
      );

    const dayCycle = enriched
      .filter((entry) => entry.pref.allowDay)
      .map((entry) => entry.worker);
    const nightCycle = enriched
      .filter((entry) => entry.pref.allowNight)
      .map((entry) => entry.worker);

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
    const fallbackNightPool =
      fallbackPool.length > 1 ? fallbackPool.slice(1, 3) : fallbackPool;

    const safeDayCycle =
      dayCycle.length > 0
        ? dayCycle
        : fallbackPool.slice(0, Math.min(2, fallbackPool.length));
    const safeNightCycle =
      nightCycle.length > 0
        ? nightCycle
        : fallbackNightPool.length > 0
          ? fallbackNightPool
          : safeDayCycle;
    const finalNightCycle =
      safeNightCycle.length > 0 ? safeNightCycle : safeDayCycle;

    const previewLength = new Date(planYear, planMonth + 1, 0).getDate();

    return Array.from({ length: previewLength }, (_, index) => {
      const date = new Date(planYear, planMonth, index + 1);
      const day = String(index + 1).padStart(2, "0");
      const dateKey = `${planYear}-${String(planMonth + 1).padStart(2, "0")}-${String(
        index + 1
      ).padStart(2, "0")}`;
      const dayName =
        safeDayCycle[index % safeDayCycle.length]?.name ?? t("planner.shift.unknown");
      const nightName =
        finalNightCycle[index % finalNightCycle.length]?.name ?? t("planner.shift.unknown");

      return {
        dateKey,
        dayLabel: day,
        monthLabel: formatMonthLabel(language, date),
        day: dayName,
        night: nightName,
      };
    });
  }, [language, planMonth, planYear, selectedWorkers, t]);

  const availableWorkersByShift = useMemo(() => {
    const build = (shift: ShiftType) => {
      const fromPref = selectedWorkers
        .filter((pref) => (shift === "day" ? pref.allowDay : pref.allowNight))
        .map((pref) => workers.find((worker) => worker.id === pref.workerId))
        .filter((worker): worker is Worker => Boolean(worker));

      if (fromPref.length > 0) return fromPref;

      return workers.filter((worker) =>
        worker.preferredShifts.includes(shift)
      );
    };

    return {
      day: build("day"),
      night: build("night"),
    };
  }, [selectedWorkers]);

  const workerById = useMemo(() => {
    return new Map(workers.map((worker) => [worker.id, worker]));
  }, []);

  const [assignments, setAssignments] = useState<
    Record<string, Record<ShiftType, string | undefined>>
  >({});

  const assignWorker = (dateKey: string, shift: ShiftType, workerId: string) => {
    setAssignments((prev) => ({
      ...prev,
      [dateKey]: { ...prev[dateKey], [shift]: workerId },
    }));
  };

  return (
    <Card className="space-y-4">
      <div className="flex items-center gap-3">
        <h2 className="text-xl font-semibold text-slate-900">{t("planner.title")}</h2>
      </div>

      <div className="space-y-3">
        <PatientSelector
          value={selectedPatient}
          onChange={(patientId) => setSelectedPatient(patientId)}
          data={patients}
        />
      </div>

      <div className="space-y-3">
        <p className="text-xs uppercase tracking-[0.2em] text-slate-500">
          {t("planner.workersLabel")}
        </p>
        <WorkerSearchSelect
          workers={workers}
          selectedIds={selectedIds}
          onSelect={upsertWorker}
        />

        <div className="grid gap-3 lg:grid-cols-2">
          {selectedWorkers.map((item) => {
            const worker = workers.find((person) => person.id === item.workerId);
            if (!worker) return null;
            const focusLabel =
              item.ratio === 50
                ? t("planner.worker.focusBalanced")
                : item.ratio > 50
                  ? t("planner.worker.focusDay", { percent: item.ratio })
                  : t("planner.worker.focusNight", { percent: 100 - item.ratio });

            return (
              <div
                key={item.workerId}
                className="rounded-2xl border border-border/70 bg-white p-4 shadow-[0_14px_40px_rgba(15,23,42,0.06)]"
              >
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-900 text-sm font-semibold text-white">
                    {initials(worker.name)}
                  </div>
                  <div className="flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-semibold text-slate-900">
                        {worker.name}
                      </p>
                      <Badge variant={statusVariant(worker.status)}>
                        {statusLabels[worker.status] ?? worker.status}
                      </Badge>
                      <Badge variant="sky">{worker.city}</Badge>
                      {item.priority ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-amber-700">
                          <Star className="h-3.5 w-3.5" /> {t("planner.worker.priority")}
                        </span>
                      ) : null}
                      <button
                        type="button"
                        onClick={() => removeWorker(item.workerId)}
                        className="ml-auto inline-flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 text-slate-500 transition hover:border-red-200 hover:bg-red-50 hover:text-red-600"
                        aria-label={t("planner.worker.removeAria")}
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                    <p className="text-xs text-slate-500">{worker.role}</p>
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <ShiftToggle
                    active={item.allowDay}
                    icon={Sun}
                    label={shiftToggleLabels.day}
                    onClick={() => toggleShift(item.workerId, "day")}
                  />
                  <ShiftToggle
                    active={item.allowNight}
                    icon={Moon}
                    label={shiftToggleLabels.night}
                    onClick={() => toggleShift(item.workerId, "night")}
                  />
                  <button
                    type="button"
                    onClick={() => updateWorker(item.workerId, { priority: !item.priority })}
                    className={`inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-semibold transition ${
                      item.priority
                        ? "border-amber-200 bg-amber-50 text-amber-800"
                        : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
                    }`}
                  >
                    <Star className="h-4 w-4" />
                    {item.priority ? t("planner.worker.priority") : t("planner.worker.addPriority")}
                  </button>
                </div>

                <div className="mt-4 space-y-3 rounded-xl bg-slate-50/80 p-3">
                  <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-[0.15em] text-slate-500">
                    <span>{t("planner.worker.shiftFocus")}</span>
                    <span className="text-slate-700">{focusLabel}</span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={item.ratio}
                    onChange={(event) =>
                      updateWorker(item.workerId, { ratio: Number(event.target.value) })
                    }
                    className="h-2 w-full cursor-pointer appearance-none rounded-full bg-slate-200"
                    style={{
                      background: `linear-gradient(90deg, #0ea5e9 ${item.ratio}%, #e2e8f0 ${item.ratio}%)`,
                    }}
                  />
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600">
                      <Clock className="h-4 w-4" />
                      <span className="uppercase tracking-[0.12em]">
                        {t("planner.worker.planDays")}
                      </span>
                      <input
                        type="number"
                        min={1}
                        max={31}
                        value={item.days}
                        onChange={(event) =>
                          updateWorker(item.workerId, { days: Number(event.target.value) || 1 })
                        }
                        className="ml-auto w-16 rounded-lg border border-slate-200 px-2 py-1 text-right text-sm font-semibold text-slate-900 focus:border-sky-200 focus:outline-none focus:ring-2 focus:ring-sky-100"
                      />
                    </label>
                    <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600">
                      <span className="uppercase tracking-[0.12em]">
                        {t("planner.worker.balance")}
                      </span>
                      <span className="text-sm font-bold text-slate-900">{item.ratio}%</span>
                    </div>
                  </div>
                </div>
              </div>
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
        />
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:gap-4">
        <div className="grid flex-1 gap-3 sm:grid-cols-2">
          <label className="text-[11px] uppercase tracking-[0.2em] text-slate-500">
            <span className="block text-[11px]">{t("planner.generate.monthLabel")}</span>
            <div className="relative mt-1">
              <select
                aria-label={t("planner.generate.monthLabel")}
                className="appearance-none w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 pr-10 text-sm font-medium text-slate-700 shadow-sm shadow-slate-100 transition hover:border-slate-300 focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-100"
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
          </label>
          <label className="text-[11px] uppercase tracking-[0.2em] text-slate-500">
            <span className="block text-[11px]">{t("planner.generate.yearLabel")}</span>
            <div className="relative mt-1">
              <select
                aria-label={t("planner.generate.yearLabel")}
                className="appearance-none w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 pr-10 text-sm font-medium text-slate-700 shadow-sm shadow-slate-100 transition hover:border-slate-300 focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-100"
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
          </label>
        </div>

        <div className="flex flex-col gap-2 sm:w-auto sm:flex-row sm:items-center sm:justify-end sm:gap-3 sm:pl-2">
          <button className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:-translate-y-[1px] sm:w-auto">
            <Sparkles className="h-4 w-4" />
            {t("planner.generate")}
          </button>
          <button
            type="button"
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 shadow-sm transition hover:-translate-y-[1px] hover:border-slate-300 hover:bg-slate-50 sm:w-auto"
          >
            <Download className="h-4 w-4" />
            {t("planner.export")}
          </button>
          <button className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-500 px-4 py-3 text-sm font-semibold text-white shadow-lg transition hover:-translate-y-[1px] hover:bg-emerald-600 sm:w-auto">
            <Save className="h-4 w-4" />
            {t("planner.save")}
          </button>
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

              return (
                <div
                  key={row.dateKey}
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
                  <ShiftDropdownCell
                    shift="day"
                    availableWorkers={availableWorkersByShift.day}
                    selectedWorker={
                      assignedDayId ? workerById.get(assignedDayId) : undefined
                    }
                    onSelect={(workerId) =>
                      assignWorker(row.dateKey, "day", workerId)
                    }
                  />
                  <ShiftDropdownCell
                    shift="night"
                    availableWorkers={availableWorkersByShift.night}
                    selectedWorker={
                      assignedNightId ? workerById.get(assignedNightId) : undefined
                    }
                    onSelect={(workerId) =>
                      assignWorker(row.dateKey, "night", workerId)
                    }
                  />
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </Card>
  );
}
