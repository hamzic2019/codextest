"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  ChevronDown,
  Clock,
  FileDown,
  Moon,
  Save,
  Search,
  Sparkles,
  Star,
  Sun,
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

function clampRequestedDays(days: number, daysInMonth: number) {
  if (Number.isNaN(days) || days < 1) return 1;
  // Max 2 shifts per day; keep cap to daysInMonth to avoid silly values.
  return Math.min(days, daysInMonth);
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
  const availablePlanYears = useMemo(() => {
    const currentYear = new Date().getFullYear();
    return Array.from({ length: 4 }, (_, index) => currentYear + index);
  }, []);
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
  const [generatedSummary, setGeneratedSummary] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [isLoadingPlan, setIsLoadingPlan] = useState(false);
  const [sanitizationNotice, setSanitizationNotice] = useState<string | null>(null);

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
  const shiftToggleLabels = useMemo(
    () => ({
      day: t("planner.worker.allowDay"),
      night: t("planner.worker.allowNight"),
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

        if (selectedWorkers.length === 0 && workersJson.data?.length) {
          const defaults = (workersJson.data as Worker[])
            .slice(0, 3)
            .map((worker, index) => preferenceFromWorker(worker, index === 0));
          setSelectedWorkers(defaults);
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
    if (workers.length > 0 && selectedWorkers.length === 0) {
      const defaults = workers.slice(0, 3).map((worker, index) =>
        preferenceFromWorker(worker, index === 0)
      );
      setSelectedWorkers(defaults);
    }
  }, [selectedWorkers.length, workers]);

  useEffect(() => {
    if (!selectedPatient) return;

    const controller = new AbortController();
    const loadPlan = async () => {
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
          return;
        }

        const planAssignments = plan.assignments ?? [];
        setAssignments(assignmentsListToMap(planAssignments));
        setGeneratedSummary(plan.summary ?? null);
        setPromptText(plan.prompt ?? "");

        if (planAssignments.length > 0) {
          setSelectedWorkers((prev) => {
            const existing = new Set(prev.map((item) => item.workerId));
            const next = [...prev];

            planAssignments.forEach((assignment) => {
              if (!assignment.workerId || existing.has(assignment.workerId)) return;
              const workerMeta = workerById.get(assignment.workerId);
              if (!workerMeta) return;
              next.push(preferenceFromWorker(workerMeta));
              existing.add(assignment.workerId);
            });

            return next;
          });
        }
      } catch (error) {
        if ((error as Error).name === "AbortError") return;
        console.error(error);
        setAssignments({});
        setGeneratedSummary(null);
        setPromptText("");
        setErrorMessage(t("planner.loadError"));
      } finally {
        if (!controller.signal.aborted) {
          setIsLoadingPlan(false);
        }
      }
    };

    loadPlan();
    return () => controller.abort();
  }, [planMonth, planYear, selectedPatient, t, workerById]);

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

  const upsertWorker = (workerId: string) => {
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
    setStatusMessage(null);
    setAssignments((prev) => ({
      ...prev,
      [dateKey]: { ...prev[dateKey], [shift]: workerId },
    }));
  };

  const handleGenerate = async () => {
    if (!selectedPatient || selectedWorkers.length === 0) {
      setErrorMessage(t("planner.generateMissing"));
      return;
    }

    setIsGenerating(true);
    setStatusMessage(null);
    setErrorMessage(null);
    setSanitizationNotice(null);

    try {
      const clampedWorkers = selectedWorkers.map((worker) => ({
        ...worker,
        days: clampRequestedDays(worker.days, daysInMonth),
      }));
      const wasClamped = selectedWorkers.some(
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
      notices.push(
        `Traženo ${requested} smjena (dnevne ≈ ${Math.round(requestedDay)}, noćne ≈ ${Math.round(
          requestedNight
        )}); dostupno ${totalSlots} slotova (${daysInMonth} dnevnih / ${daysInMonth} noćnih).`
      );
      setSanitizationNotice(notices.join(" · "));

      const response = await fetch("/api/plans/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          patientId: selectedPatient,
          workerPreferences: clampedWorkers,
          month: planMonth + 1,
          year: planYear,
          prompt: promptText,
        }),
      });

      const json = await response.json();
      if (!response.ok) {
        throw new Error(json.error || "Failed to generate plan");
      }

      const assignmentList: PlanAssignment[] = json.data?.assignments ?? [];
      setAssignments(assignmentsListToMap(assignmentList));
      setGeneratedSummary(json.data?.summary ?? null);
      setStatusMessage(t("planner.generateSuccess"));
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

      setStatusMessage(t("planner.saveSuccess"));
    } catch (error) {
      console.error(error);
      setErrorMessage(t("planner.saveError"));
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
    selectedWorkers.length === 0;
  const disableSave =
    isSaving || isGenerating || isLoadingPlan || !selectedPatient || !hasAnyAssignment;
  const todayRow = previewRows.find((row) => row.isToday);

  return (
    <Card className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="text-xl font-semibold text-slate-900">{t("planner.title")}</h2>
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
        <p className="text-xs uppercase tracking-[0.2em] text-slate-500">
          {t("planner.workersLabel")}
        </p>
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
                    <p className="text-xs text-slate-500">
                      {worker.role || t("planner.worker.roleFallback")}
                    </p>
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
                    {item.priority
                      ? t("planner.worker.priority")
                      : t("planner.worker.addPriority")}
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
                  <p className="text-[11px] text-slate-500">
                    0% = samo noćne, 100% = samo dnevne.
                  </p>
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
                  <p className="text-[11px] text-slate-500">
                    Broj dana je želja; ako nema dovoljno pokrivenosti, planer može dodati koji dan više.
                  </p>
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
          value={promptText}
          onChange={(event) => setPromptText(event.target.value)}
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
          <button
            type="button"
          onClick={handleGenerate}
          disabled={disableGenerate}
          className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:-translate-y-[1px] disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
        >
          <Sparkles className="h-4 w-4" />
          {isGenerating ? t("planner.generating") : t("planner.generate")}
        </button>
        <button
          type="button"
          onClick={handleExport}
          className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 shadow-sm transition hover:-translate-y-[1px] hover:border-slate-300 hover:bg-slate-50 sm:w-auto"
        >
          <FileDown className="h-4 w-4" />
          {t("planner.export")}
        </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={disableSave}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-500 px-4 py-3 text-sm font-semibold text-white shadow-lg transition hover:-translate-y-[1px] hover:bg-emerald-600 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
          >
            <Save className="h-4 w-4" />
            {isSaving ? t("planner.saving") : t("planner.save")}
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
            <span className="text-xs text-slate-500">
              {t("planner.preview.assigned", { count: totalAssigned })}
            </span>
          </div>
        </div>

        {generatedSummary ? (
          <div className="rounded-xl border border-sky-100 bg-sky-50/70 px-4 py-3 text-sm text-slate-700">
            {generatedSummary}
          </div>
        ) : null}

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
                  <ShiftDropdownCell
                    shift="day"
                    availableWorkers={availableWorkersByShift.day}
                    selectedWorker={
                      assignedDayId ? workerById.get(assignedDayId) : undefined
                    }
                    onSelect={(workerId) => assignWorker(row.dateKey, "day", workerId)}
                  />
                  <ShiftDropdownCell
                    shift="night"
                    availableWorkers={availableWorkersByShift.night}
                    selectedWorker={
                      assignedNightId ? workerById.get(assignedNightId) : undefined
                    }
                    onSelect={(workerId) => assignWorker(row.dateKey, "night", workerId)}
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
