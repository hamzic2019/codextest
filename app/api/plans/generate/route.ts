import { NextResponse } from "next/server";
import { createServiceSupabaseClient } from "@/lib/supabase/server";
import { DEFAULT_OPENAI_MODEL, getOpenAIClient } from "@/lib/openai";
import type { PlanAssignment, WorkerPreference } from "@/types";

const DAY_SHIFT_HOURS = Number(process.env.DAY_SHIFT_HOURS ?? process.env.NEXT_PUBLIC_DAY_SHIFT_HOURS ?? 8);
const NIGHT_SHIFT_HOURS = Number(
  process.env.NIGHT_SHIFT_HOURS ?? process.env.NEXT_PUBLIC_NIGHT_SHIFT_HOURS ?? 10
);
const HARD_OVERTIME_BUFFER_HOURS = Number(process.env.PLAN_HARD_OVERTIME_HOURS ?? 8);
const SOFT_EXTRA_SHIFT_ALLOWANCE = Number(process.env.PLAN_SOFT_EXTRA_SHIFTS ?? 1);
const DAY_NIGHT_TOLERANCE_SHIFTS = Number(process.env.PLAN_SHIFT_TOLERANCE ?? 1);
const MAX_SPREAD_RATIO = Number(process.env.PLAN_MAX_PATIENT_SPREAD ?? 0.6);
const DEFAULT_PATIENT_PRIORITY = Number(
  process.env.PATIENT_PRIORITY ?? process.env.NEXT_PUBLIC_PATIENT_PRIORITY ?? 1
);

type SanitizedPreference = WorkerPreference & {
  targetDays: number;
  priority: boolean;
  spreadAcrossPatients: boolean;
};

type PreferenceWithHours = SanitizedPreference & {
  hoursPlanned: number;
  hoursCompleted: number;
};

type NormalizedPreference = PreferenceWithHours & {
  targetDayHours: number;
  targetNightHours: number;
  targetHours: number;
  targetDayShifts: number;
  targetNightShifts: number;
  softCapHours: number;
  hardCapHours: number;
  maxPatientHours: number;
};

type WorkerState = {
  id: string;
  targetHours: number;
  targetDayHours: number;
  targetNightHours: number;
  targetDayShifts: number;
  targetNightShifts: number;
  assignedShifts: number;
  assignedDayShifts: number;
  assignedNightShifts: number;
  assignedHours: number;
  assignedDayHours: number;
  assignedNightHours: number;
  priority: boolean;
  allowDay: boolean;
  allowNight: boolean;
  ratio: number;
  lastDay?: number;
  lastType?: "day" | "night";
  streak: number;
  softCapHours: number;
  hardCapHours: number;
  baseHours: number;
  maxPatientHours: number;
  spreadAcrossPatients: boolean;
};

type OpenAIPlanItem = {
  date: string;
  dayWorkerId?: string | null;
  nightWorkerId?: string | null;
  note?: string | null;
};

const MAX_CONSECUTIVE_DAYS = 4;
const MAX_CONSECUTIVE_NIGHTS = 3;

function toDateKey(year: number, month: number, day: number) {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function isWeekend(year: number, monthZeroBased: number, day: number) {
  const weekday = new Date(year, monthZeroBased, day).getDay(); // 0=Sun
  return weekday === 0 || weekday === 6;
}

function clamp(value: number, min: number, max: number) {
  if (Number.isNaN(value)) return min;
  return Math.max(min, Math.min(max, value));
}

function getShiftHours(shift: "day" | "night") {
  return shift === "day" ? DAY_SHIFT_HOURS : NIGHT_SHIFT_HOURS;
}

function sanitizePreferences(preferences: WorkerPreference[], daysInMonth: number): SanitizedPreference[] {
  return preferences.map((pref) => {
    const allowDay = pref.allowDay !== false;
    const allowNight = pref.allowNight !== false;
    const requestedRatio = clamp(pref.ratio ?? 50, 0, 100);
    const ratio = allowDay && allowNight ? requestedRatio : allowDay ? 100 : 0;

    return {
      ...pref,
      priority: Boolean(pref.priority),
      spreadAcrossPatients: Boolean(pref.spreadAcrossPatients),
      targetDays: clamp(pref.days, 0, daysInMonth),
      allowDay,
      allowNight,
      ratio,
    };
  });
}

function normalizeShiftHours(
  requested: { pref: PreferenceWithHours; dayHours: number; nightHours: number }[],
  availableHours: number,
  shift: "day" | "night"
) {
  const shiftHours = getShiftHours(shift);
  const allowKey = shift === "day" ? "allowDay" : "allowNight";
  const requestedKey: "dayHours" | "nightHours" = shift === "day" ? "dayHours" : "nightHours";
  const requestedTotal = requested.reduce((sum, item) => sum + item[requestedKey], 0);
  const eligible = requested.filter((item) => item.pref[allowKey]);
  const result = new Map<string, number>();

  if (availableHours <= 0 || eligible.length === 0) {
    requested.forEach((item) => result.set(item.pref.workerId, 0));
    return result;
  }

  if (requestedTotal === 0) {
    const totalShifts = Math.round(availableHours / shiftHours);
    const base = Math.floor(totalShifts / eligible.length);
    const remainder = totalShifts - base * eligible.length;
    let cursor = 0;
    eligible.forEach((item) => {
      const shifts = base + (cursor < remainder ? 1 : 0);
      result.set(item.pref.workerId, shifts * shiftHours);
      cursor += 1;
    });
    requested.forEach((item) => {
      if (!result.has(item.pref.workerId)) result.set(item.pref.workerId, 0);
    });
    return result;
  }

  const factor = availableHours / requestedTotal;

  eligible.forEach((item) => {
    const minAllowed = item.pref.priority ? shiftHours : 0;
    const scaled = Math.max(
      minAllowed,
      Math.round((item[requestedKey] * factor) / shiftHours) * shiftHours
    );
    result.set(item.pref.workerId, scaled);
  });
  requested.forEach((item) => {
    if (!result.has(item.pref.workerId)) result.set(item.pref.workerId, 0);
  });

  let diff = availableHours - Array.from(result.values()).reduce((sum, hours) => sum + hours, 0);
  const ordered = [...eligible].sort((a, b) => {
    if (a.pref.priority === b.pref.priority) return a.pref.targetDays - b.pref.targetDays;
    return a.pref.priority ? -1 : 1;
  });
  let guard = 0;

  while (Math.abs(diff) >= shiftHours / 2 && guard < 400 && ordered.length > 0) {
    const target = ordered[guard % ordered.length];
    const current = result.get(target.pref.workerId) ?? 0;
    if (diff > 0) {
      result.set(target.pref.workerId, current + shiftHours);
      diff -= shiftHours;
    } else if (current - shiftHours >= 0) {
      result.set(target.pref.workerId, current - shiftHours);
      diff += shiftHours;
    }
    guard += 1;
  }

  return result;
}

function normalizeTargets(preferences: PreferenceWithHours[], daysInMonth: number): NormalizedPreference[] {
  if (preferences.length === 0) return [];

  const totalDayHoursAvailable = daysInMonth * DAY_SHIFT_HOURS;
  const totalNightHoursAvailable = daysInMonth * NIGHT_SHIFT_HOURS;
  const requested = preferences.map((pref) => {
    const dayHours = pref.allowDay ? pref.targetDays * (pref.ratio / 100) * DAY_SHIFT_HOURS : 0;
    const nightHours = pref.allowNight
      ? pref.targetDays * ((100 - pref.ratio) / 100) * NIGHT_SHIFT_HOURS
      : 0;
    return { pref, dayHours, nightHours };
  });

  const normalizedDayHours = normalizeShiftHours(requested, totalDayHoursAvailable, "day");
  const normalizedNightHours = normalizeShiftHours(requested, totalNightHoursAvailable, "night");

  return preferences.map((pref) => {
    const targetDayHours = normalizedDayHours.get(pref.workerId) ?? 0;
    const targetNightHours = normalizedNightHours.get(pref.workerId) ?? 0;
    const targetHours = targetDayHours + targetNightHours;
    const targetDayShifts =
      pref.allowDay && targetDayHours > 0
        ? Math.max(pref.priority ? 1 : 0, Math.round(targetDayHours / DAY_SHIFT_HOURS))
        : 0;
    const targetNightShifts =
      pref.allowNight && targetNightHours > 0
        ? Math.max(pref.priority ? 1 : 0, Math.round(targetNightHours / NIGHT_SHIFT_HOURS))
        : 0;

    const softCapHours =
      targetHours + Math.max(DAY_SHIFT_HOURS, NIGHT_SHIFT_HOURS) * SOFT_EXTRA_SHIFT_ALLOWANCE;
    const hardCapHours = targetHours + HARD_OVERTIME_BUFFER_HOURS;
    const consumed = pref.hoursPlanned + pref.hoursCompleted;
    const maxPatientHours = pref.spreadAcrossPatients
      ? Math.max(targetHours * MAX_SPREAD_RATIO, consumed + Math.max(DAY_SHIFT_HOURS, NIGHT_SHIFT_HOURS))
      : targetHours + HARD_OVERTIME_BUFFER_HOURS;

    return {
      ...pref,
      targetDayHours,
      targetNightHours,
      targetHours,
      targetDayShifts,
      targetNightShifts,
      softCapHours,
      hardCapHours,
      maxPatientHours,
    };
  });
}

function extractPlanAssignments(rawPlan: OpenAIPlanItem[], year: number, month: number, daysInMonth: number): PlanAssignment[] {
  const byDate = new Map<string, OpenAIPlanItem>();
  rawPlan.forEach((item) => {
    if (item.date) byDate.set(item.date, item);
  });

  const assignments: PlanAssignment[] = [];
  for (let day = 1; day <= daysInMonth; day++) {
    const dateKey = toDateKey(year, month, day);
    const item = byDate.get(dateKey);
    const legacy =
      item && typeof item === "object"
        ? (item as {
            day_worker_id?: string | null;
            night_worker_id?: string | null;
            day?: string | null;
            night?: string | null;
            note?: string | null;
          })
        : undefined;
    const dayWorker = item?.dayWorkerId ?? legacy?.day_worker_id ?? legacy?.day ?? null;
    const nightWorker = item?.nightWorkerId ?? legacy?.night_worker_id ?? legacy?.night ?? null;
    const note = item?.note ?? legacy?.note ?? null;
    assignments.push({ date: dateKey, shiftType: "day", workerId: dayWorker ?? null, note });
    assignments.push({ date: dateKey, shiftType: "night", workerId: nightWorker ?? null, note });
  }
  return assignments;
}

function isRestOk(state: WorkerState, day: number, shift: "day" | "night") {
  if (!state.lastDay) return true;
  if (state.lastDay === day && state.lastType && state.lastType !== shift) return false; // no 24h
  if (state.lastType === "night" && state.lastDay === day - 1 && shift === "day") return false; // rest after night
  return true;
}

function wouldExceedConsecutive(state: WorkerState, day: number, shift: "day" | "night") {
  if (!state.lastDay || state.lastDay !== day - 1 || state.lastType !== shift) return false;
  const limit = shift === "night" ? MAX_CONSECUTIVE_NIGHTS : MAX_CONSECUTIVE_DAYS;
  return state.streak + 1 > limit;
}

function applyAssignment(state: WorkerState, day: number, shift: "day" | "night") {
  const consecutive = state.lastDay === day - 1 && state.lastType === shift ? state.streak + 1 : 1;
  const next: WorkerState = {
    ...state,
    assignedShifts: state.assignedShifts + 1,
    assignedDayShifts: state.assignedDayShifts + (shift === "day" ? 1 : 0),
    assignedNightShifts: state.assignedNightShifts + (shift === "night" ? 1 : 0),
    assignedHours: state.assignedHours + getShiftHours(shift),
    assignedDayHours: state.assignedDayHours + (shift === "day" ? getShiftHours("day") : 0),
    assignedNightHours:
      state.assignedNightHours + (shift === "night" ? getShiftHours("night") : 0),
    lastDay: day,
    lastType: shift,
    streak: consecutive,
  };
  return next;
}

function isValidCandidate(
  worker: WorkerState,
  day: number,
  shift: "day" | "night",
  existingDay: string | null | undefined,
  busyWorkers: { day: Set<string>; night: Set<string> } | undefined,
  respectCaps: boolean
) {
  const shiftHours = getShiftHours(shift);
  const projectedHours = worker.baseHours + worker.assignedHours + shiftHours;

  if (busyWorkers?.[shift]?.has(worker.id)) return false;
  if (existingDay && existingDay === worker.id) return false;
  if (shift === "day" && !worker.allowDay) return false;
  if (shift === "night" && !worker.allowNight) return false;
  if (!isRestOk(worker, day, shift)) return false;
  if (wouldExceedConsecutive(worker, day, shift)) return false;
  if (projectedHours > worker.hardCapHours) return false;
  if (worker.spreadAcrossPatients && projectedHours > worker.maxPatientHours) return false;

  if (respectCaps) {
    if (projectedHours > worker.softCapHours) return false;
    const shiftCap =
      shift === "day"
        ? worker.targetDayShifts + DAY_NIGHT_TOLERANCE_SHIFTS
        : worker.targetNightShifts + DAY_NIGHT_TOLERANCE_SHIFTS;
    const assignedForShift =
      shift === "day" ? worker.assignedDayShifts : worker.assignedNightShifts;
    if (assignedForShift >= shiftCap) return false;
  }
  return true;
}

function createInitialWorkerState(pref: NormalizedPreference): WorkerState {
  return {
    id: pref.workerId,
    targetHours: pref.targetHours,
    targetDayHours: pref.targetDayHours,
    targetNightHours: pref.targetNightHours,
    targetDayShifts: pref.targetDayShifts,
    targetNightShifts: pref.targetNightShifts,
    assignedShifts: 0,
    assignedDayShifts: 0,
    assignedNightShifts: 0,
    assignedHours: 0,
    assignedDayHours: 0,
    assignedNightHours: 0,
    priority: pref.priority,
    allowDay: pref.allowDay !== false,
    allowNight: pref.allowNight !== false,
    ratio: pref.ratio ?? 50,
    streak: 0,
    softCapHours: pref.softCapHours,
    hardCapHours: pref.hardCapHours,
    baseHours: pref.hoursPlanned + pref.hoursCompleted,
    maxPatientHours: pref.maxPatientHours,
    spreadAcrossPatients: pref.spreadAcrossPatients,
  };
}

function scoreCandidate(
  worker: WorkerState,
  day: number,
  shift: "day" | "night",
  daysInMonth: number,
  weekend: boolean,
  patientPriority: number
) {
  const shiftHours = getShiftHours(shift);
  const projectedHours = worker.baseHours + worker.assignedHours + shiftHours;
  const remaining = Math.max(worker.targetHours - (worker.assignedHours + worker.baseHours), 0);
  const shiftNeed =
    shift === "day"
      ? Math.max(worker.targetDayHours - worker.assignedDayHours, 0)
      : Math.max(worker.targetNightHours - worker.assignedNightHours, 0);
  const priorityBoost = worker.priority ? 3 : 1;
  const balancePref = shift === "day" ? worker.ratio : 100 - worker.ratio; // 0..100 (ratio is day %)
  const balanceScore = balancePref / 50; // ~0..2
  const distributionScore = 1 - Math.abs(day - daysInMonth / 2) / (daysInMonth / 2); // center-spread
  const weekendPenalty = weekend ? 0.9 : 1;
  const fairness = 1 / (1 + worker.assignedShifts);
  const overTarget = Math.max(projectedHours - worker.targetHours, 0);
  const overtimePenalty =
    overTarget <= shiftHours
      ? Math.max(0.5, 1 - overTarget / (shiftHours * 1.5))
      : Math.max(0.25, 1 - overTarget / (HARD_OVERTIME_BUFFER_HOURS + shiftHours));
  const spreadPenalty =
    worker.spreadAcrossPatients && worker.maxPatientHours > 0
      ? Math.max(0.3, 1 - projectedHours / worker.maxPatientHours)
      : 1;
  const priorityPull =
    projectedHours > worker.targetHours
      ? 1 + Math.max(patientPriority - 1, 0) * 0.2
      : 1;
  const quotaPressure =
    shift === "day"
      ? Math.max(0.65, 1 - worker.assignedDayShifts / Math.max(worker.targetDayShifts || 1, 1))
      : Math.max(
          0.65,
          1 - worker.assignedNightShifts / Math.max(worker.targetNightShifts || 1, 1)
        );
  return (
    (shiftNeed * 2 + remaining + distributionScore + fairness) *
    priorityBoost *
    balanceScore *
    weekendPenalty *
    overtimePenalty *
    spreadPenalty *
    quotaPressure *
    priorityPull
  );
}

function buildEmptySchedule(daysInMonth: number) {
  const schedule = new Map<number, { day?: string | null; night?: string | null }>();
  for (let day = 1; day <= daysInMonth; day++) {
    schedule.set(day, { day: null, night: null });
  }
  return schedule;
}

function mapAssignmentsToSchedule(assignments: PlanAssignment[]) {
  const schedule = new Map<number, { day?: string | null; night?: string | null }>();
  assignments.forEach((assignment) => {
    const day = Number(assignment.date.split("-")[2]);
    const entry = schedule.get(day) ?? {};
    entry[assignment.shiftType] = assignment.workerId ?? null;
    schedule.set(day, entry);
  });
  return schedule;
}

function isAssignmentValid(
  worker: WorkerState,
  day: number,
  shift: "day" | "night",
  entry: { day?: string | null; night?: string | null },
  busyWorkers: { day: Set<string>; night: Set<string> } | undefined
) {
  if (shift === "day" && entry.day && entry.day !== worker.id) return false;
  if (shift === "night" && entry.night && entry.night !== worker.id) return false;
  return isValidCandidate(worker, day, shift, entry.day, busyWorkers, true);
}

function simulateSchedule(
  schedule: Map<number, { day?: string | null; night?: string | null }>,
  preferences: NormalizedPreference[],
  busyByDay: Map<number, { day: Set<string>; night: Set<string> }>,
  daysInMonth: number,
  respectCaps: boolean
) {
  const stateById = new Map<string, WorkerState>();
  preferences.forEach((pref) => stateById.set(pref.workerId, createInitialWorkerState(pref)));

  for (let day = 1; day <= daysInMonth; day++) {
    const entry = schedule.get(day) ?? { day: null, night: null };
    const busyWorkers = busyByDay.get(day);

    (["day", "night"] as const).forEach((shift) => {
      const workerId = entry[shift];
      if (!workerId) return;
      const worker = stateById.get(workerId);
      if (!worker) return;
      if (!isAssignmentValid(worker, day, shift, entry, busyWorkers, respectCaps)) {
        stateById.clear();
        return;
      }
      stateById.set(workerId, applyAssignment(worker, day, shift));
    });
    if (stateById.size === 0) return null;
  }

  return stateById;
}

function repairSchedule(
  schedule: Map<number, { day?: string | null; night?: string | null }>,
  preferences: NormalizedPreference[],
  busyByDay: Map<number, { day: Set<string>; night: Set<string> }>,
  year: number,
  monthZeroBased: number,
  daysInMonth: number,
  patientPriority: number
) {
  let stateById =
    simulateSchedule(new Map(schedule), preferences, busyByDay, daysInMonth, false) ??
    new Map<string, WorkerState>();
  if (stateById.size === 0) return { schedule, stateById };

  const prefMap = new Map(preferences.map((pref) => [pref.workerId, pref]));

  for (let day = 1; day <= daysInMonth; day++) {
    const entry = schedule.get(day) ?? { day: null, night: null };
    const busyWorkers = busyByDay.get(day);
    const weekend = isWeekend(year, monthZeroBased, day);
    (["day", "night"] as const).forEach((shift) => {
      const workerId = entry[shift];
      if (!workerId) return;
      const workerState = stateById.get(workerId);
      if (!workerState) return;
      const targetShifts =
        shift === "day"
          ? workerState.targetDayShifts + DAY_NIGHT_TOLERANCE_SHIFTS
          : workerState.targetNightShifts + DAY_NIGHT_TOLERANCE_SHIFTS;
      const assignedForShift =
        shift === "day" ? workerState.assignedDayShifts : workerState.assignedNightShifts;
      if (assignedForShift <= targetShifts) return;

      const candidates = preferences
        .map((pref) => stateById.get(pref.workerId)!)
        .filter((candidate) => candidate?.id !== workerId)
        .filter((candidate) =>
          isValidCandidate(candidate, day, shift, shift === "day" ? entry.night : entry.day, busyWorkers, false)
        )
        .sort((a, b) => {
          const aPref = prefMap.get(a.id);
          const bPref = prefMap.get(b.id);
          const aNeed =
            shift === "day"
              ? (aPref?.targetDayShifts ?? 0) - a.assignedDayShifts
              : (aPref?.targetNightShifts ?? 0) - a.assignedNightShifts;
          const bNeed =
            shift === "day"
              ? (bPref?.targetDayShifts ?? 0) - b.assignedDayShifts
              : (bPref?.targetNightShifts ?? 0) - b.assignedNightShifts;
          const needDiff = bNeed - aNeed;
          if (needDiff !== 0) return needDiff;
          const aScore = scoreCandidate(a, day, shift, daysInMonth, weekend, patientPriority);
          const bScore = scoreCandidate(b, day, shift, daysInMonth, weekend, patientPriority);
          return bScore - aScore;
        });

      for (const candidate of candidates) {
        const cloned = new Map(schedule);
        const cloneEntry = { ...(cloned.get(day) ?? { day: null, night: null }) };
        cloneEntry[shift] = candidate.id;
        cloned.set(day, cloneEntry);
        const simulated = simulateSchedule(cloned, preferences, busyByDay, daysInMonth, false);
        if (!simulated) continue;
        const newWorkerState = simulated.get(workerId);
        const newCandidateState = simulated.get(candidate.id);
        if (!newWorkerState || !newCandidateState) continue;
        const newAssignedForShift =
          shift === "day" ? newWorkerState.assignedDayShifts : newWorkerState.assignedNightShifts;
        if (newAssignedForShift < assignedForShift) {
          schedule = cloned;
          stateById = simulated;
          break;
        }
      }
    });
  }

  return { schedule, stateById };
}

function buildSchedule(
  preferences: NormalizedPreference[],
  baseAssignments: PlanAssignment[],
  busyAssignments: PlanAssignment[],
  year: number,
  monthZeroBased: number,
  daysInMonth: number,
  patientPriority: number
) {
  const schedule =
    baseAssignments.length > 0 ? mapAssignmentsToSchedule(baseAssignments) : buildEmptySchedule(daysInMonth);

  const busyByDay = new Map<number, { day: Set<string>; night: Set<string> }>();
  busyAssignments.forEach((assignment) => {
    const day = Number(assignment.date.split("-")[2]);
    if (!busyByDay.has(day)) busyByDay.set(day, { day: new Set(), night: new Set() });
    if (assignment.workerId) busyByDay.get(day)![assignment.shiftType].add(assignment.workerId);
  });

  const stateById = new Map<string, WorkerState>();
  preferences.forEach((pref) => {
    stateById.set(pref.workerId, createInitialWorkerState(pref));
  });

  // Validate AI assignments and drop invalid ones.
  for (let day = 1; day <= daysInMonth; day++) {
    const entry = schedule.get(day) ?? { day: null, night: null };
    const busyWorkers = busyByDay.get(day);
    (["day", "night"] as const).forEach((shift) => {
      const workerId = entry[shift];
      if (!workerId) return;
      const worker = stateById.get(workerId);
      if (!worker) {
        entry[shift] = null;
        return;
      }
      const valid = isAssignmentValid(worker, day, shift, entry, busyWorkers, true);
      if (!valid) {
        entry[shift] = null;
      } else {
        const nextState = applyAssignment(worker, day, shift);
        stateById.set(workerId, nextState);
      }
    });
    schedule.set(day, entry);
  }

  // Fill remaining slots day-by-day respecting quotas.
  for (let day = 1; day <= daysInMonth; day++) {
    const weekend = isWeekend(year, monthZeroBased, day);
    const entry = schedule.get(day) ?? { day: null, night: null };
    const busyWorkers = busyByDay.get(day);

    (["day", "night"] as const).forEach((shift) => {
      if (shift === "day" && entry.day) return;
      if (shift === "night" && entry.night) return;

      const candidates = preferences
        .map((pref) => stateById.get(pref.workerId)!)
        .filter((worker) => isValidCandidate(worker, day, shift, entry.day, busyWorkers, true));

      if (candidates.length === 0) return;

      const best = candidates
        .map((worker) => ({
          worker,
          score: scoreCandidate(worker, day, shift, daysInMonth, weekend, patientPriority),
        }))
        .sort((a, b) => b.score - a.score)[0];

      if (!best) return;

      const nextState = applyAssignment(best.worker, day, shift);
      stateById.set(best.worker.id, nextState);
      if (shift === "day") entry.day = best.worker.id;
      else entry.night = best.worker.id;
    });

    schedule.set(day, entry);
  }

  // Second pass: fill remaining slots with relaxed caps (still respecting rest/busy rules).
  for (let day = 1; day <= daysInMonth; day++) {
    const weekend = isWeekend(year, monthZeroBased, day);
    const entry = schedule.get(day) ?? { day: null, night: null };
    const busyWorkers = busyByDay.get(day);

    (["day", "night"] as const).forEach((shift) => {
      if (shift === "day" && entry.day) return;
      if (shift === "night" && entry.night) return;

      const candidates = preferences
        .map((pref) => stateById.get(pref.workerId)!)
        .filter((worker) => isValidCandidate(worker, day, shift, entry.day, busyWorkers, false));

      if (candidates.length === 0) return;

      const best = candidates
        .map((worker) => ({
          worker,
          score: scoreCandidate(worker, day, shift, daysInMonth, weekend, patientPriority),
        }))
        .sort((a, b) => b.score - a.score)[0];

      if (!best) return;

      const nextState = applyAssignment(best.worker, day, shift);
      stateById.set(best.worker.id, nextState);
      if (shift === "day") entry.day = best.worker.id;
      else entry.night = best.worker.id;
    });

    schedule.set(day, entry);
  }

  // Guarantee everyone gets at least one shift if possible via swaps.
  const unassigned = preferences.filter(
    (pref) => (stateById.get(pref.workerId)?.assignedShifts ?? 0) === 0
  );
  for (const pref of unassigned) {
    for (let day = 1; day <= daysInMonth; day++) {
      const entry = schedule.get(day)!;
      const busyWorkers = busyByDay.get(day);
      const shifts: ("day" | "night")[] = ["day", "night"];
      let placed = false;
      for (const shift of shifts) {
        const currentId = entry[shift];
        if (!currentId) continue;
        const currentState = stateById.get(currentId)!;
        const candidateState = stateById.get(pref.workerId)!;
        if (!candidateState) continue;
        if (
          isValidCandidate(
            candidateState,
            day,
            shift,
            shift === "day" ? entry.night : entry.day,
            busyWorkers,
            false
          ) &&
          currentState.assignedShifts > 1
        ) {
          entry[shift] = pref.workerId;
          stateById.set(pref.workerId, applyAssignment(candidateState, day, shift));
          stateById.set(currentId, {
            ...currentState,
            assignedShifts: currentState.assignedShifts - 1,
          });
          placed = true;
          break;
        }
      }
      if (placed) break;
    }
  }

  const repaired = repairSchedule(
    schedule,
    preferences,
    busyByDay,
    year,
    monthZeroBased,
    daysInMonth,
    patientPriority
  );
  const finalSchedule = repaired.stateById.size > 0 ? repaired.schedule : schedule;
  const finalState = repaired.stateById.size > 0 ? repaired.stateById : stateById;

  const result: PlanAssignment[] = [];
  finalSchedule.forEach((entry, day) => {
    const dateKey = toDateKey(year, monthZeroBased + 1, day);
    result.push({ date: dateKey, shiftType: "day", workerId: entry.day ?? null });
    result.push({ date: dateKey, shiftType: "night", workerId: entry.night ?? null });
  });

  result.sort((a, b) => a.date.localeCompare(b.date));
  return { assignments: result, stateById: finalState, normalizedPrefs: preferences };
}

function formatMeta(
  preferences: NormalizedPreference[],
  stateById: Map<string, WorkerState>,
  daysInMonth: number,
  notes: string[]
) {
  const perWorker = preferences.map((pref) => {
    const state = stateById.get(pref.workerId);
    const assignedHours = state?.assignedHours ?? 0;
    const assignedDay = state?.assignedDayShifts ?? 0;
    const assignedNight = state?.assignedNightShifts ?? 0;
    const shortfall = pref.targetHours - assignedHours;
    if (shortfall > 0 && pref.priority) {
      notes.push(
        `${pref.workerId} (prioritet) tražio ${Math.round(pref.targetHours)}h, dodijeljeno ${Math.round(assignedHours)}h zbog ograničenja.`
      );
    }
    return `${pref.workerId}: ${Math.round(assignedHours)}h/${Math.round(pref.targetHours)}h (D ${assignedDay}/${pref.targetDayShifts}, N ${assignedNight}/${pref.targetNightShifts})`;
  });
  const capsNote = `Limiti: dan ${DAY_SHIFT_HOURS}h, noć ${NIGHT_SHIFT_HOURS}h, soft +${SOFT_EXTRA_SHIFT_ALLOWANCE} smjena, hard +${HARD_OVERTIME_BUFFER_HOURS}h, tolerancija D/N +${DAY_NIGHT_TOLERANCE_SHIFTS}.`;
  return `Plan za ${daysInMonth} dana. ${capsNote} Pokrivenost: ${perWorker.join("; ")}. ${notes.join(" ")}`.trim();
}

export async function POST(request: Request) {
  try {
    const payload = await request.json();
    const patientId = String(payload.patientId ?? "").trim();
    const workerPreferencesRaw = Array.isArray(payload.workerPreferences)
      ? (payload.workerPreferences as WorkerPreference[])
      : [];
    const month = Number(payload.month);
    const year = Number(payload.year);
    const prompt = payload.prompt ? String(payload.prompt) : "";
    const spreadAcrossPatientsFlag = Boolean(payload.spreadAcrossPatients);
    const patientPriority =
      Math.max(1, Number(payload.patientPriority ?? DEFAULT_PATIENT_PRIORITY)) ||
      DEFAULT_PATIENT_PRIORITY;

    if (!patientId || Number.isNaN(month) || Number.isNaN(year)) {
      return NextResponse.json({ error: "patientId, month i year su obavezni." }, { status: 400 });
    }

    const supabase = createServiceSupabaseClient();
    const { data: patient, error: patientError } = await supabase
      .from("patients")
      .select("*")
      .eq("id", patientId)
      .maybeSingle();

    if (patientError) throw patientError;
    if (!patient) {
      return NextResponse.json({ error: "Pacijent nije pronađen." }, { status: 404 });
    }

    const workerIds = workerPreferencesRaw.map((pref) => pref.workerId);
    if (workerIds.length === 0) {
      return NextResponse.json({ error: "Dodajte bar jednog radnika prije generisanja." }, { status: 400 });
    }

    const { data: workerRows, error: workersError } = await supabase.from("workers").select("*").in("id", workerIds);

    if (workersError) throw workersError;
    if (!workerRows || workerRows.length === 0) {
      return NextResponse.json({ error: "Radnici nisu pronađeni u bazi." }, { status: 404 });
    }

    const workerMap = new Map(workerRows.map((worker) => [worker.id, worker]));

    const { data: otherPlans } = await supabase
      .from("plans")
      .select("id")
      .eq("month", month)
      .eq("year", year)
      .neq("patient_id", patientId);

    const otherPlanIds = (otherPlans ?? []).map((plan) => plan.id).filter(Boolean);

    const busyAssignments: PlanAssignment[] = [];
    if (otherPlanIds.length > 0) {
      const { data: busyRows, error: busyError } = await supabase
        .from("plan_assignments")
        .select("date, shift_type, worker_id")
        .in("plan_id", otherPlanIds);

      if (busyError) throw busyError;
      busyRows?.forEach((row) => {
        busyAssignments.push({
          date: row.date,
          shiftType: row.shift_type,
          workerId: row.worker_id,
          note: null,
        });
      });
    }

    const daysInMonth = new Date(year, month, 0).getDate();
    const sanitizedPreferences = sanitizePreferences(workerPreferencesRaw, daysInMonth);
    const monthZeroBased = month - 1;
    const preferencesWithHours: PreferenceWithHours[] = sanitizedPreferences.map((pref) => {
      const worker = workerMap.get(pref.workerId);
      return {
        ...pref,
        spreadAcrossPatients: pref.spreadAcrossPatients ?? spreadAcrossPatientsFlag,
        hoursPlanned: Number(worker?.hours_planned ?? worker?.hoursPlanned ?? 0),
        hoursCompleted: Number(worker?.hours_completed ?? worker?.hoursCompleted ?? 0),
      };
    });
    const normalizedPrefs = normalizeTargets(preferencesWithHours, daysInMonth);
    const dayHoursAvailable = daysInMonth * DAY_SHIFT_HOURS;
    const nightHoursAvailable = daysInMonth * NIGHT_SHIFT_HOURS;

    const openai = getOpenAIClient();
    const systemPrompt = `
Ti si planer smjena za njegu. Prvo ispoštuj prioritetne radnike (priority=true): daju im se njihove tražene smjene (npr. 17 dana sa 100% noćne) koliko god je to realno moguće, uz poštovanje pravila odmora.
Istovremeno svaki odabrani radnik mora dobiti barem nekoliko smjena; preostale smjene ravnopravno podijeli tako da niko ne ostane na 0 i da raspored izgleda fer.
Moraš poštovati:
- Nema 24h u komadu: isti radnik ne može dan pa noć isti dan.
- Nakon noćne mora imati cijeli dan pauze prije nove dnevne.
- Poštuj preferencije (day/night) i ratio; prioritetni radnici imaju prednost kod popune.
- Ne planiraj "u cugu": izbjegavaj serije duže od 4-5 dana istog radnika; miješaj radnike kroz mjesec, uključujući vikende.
- Dnevna smjena traje ${DAY_SHIFT_HOURS}h, noćna ${NIGHT_SHIFT_HOURS}h; izbjegavaj da radnik pređe svoj cilj sati više od jedne dodatne smjene.
- Koristi samo workerId iz liste. Ako baš nema radnika, ostavi null, ali pokušaj popuniti sve smjene.
Vrati strogi JSON sa poljem "plan": [{ "date": "YYYY-MM-DD", "dayWorkerId": "<id|null>", "nightWorkerId": "<id|null>", "note": "..." }].
`;

    const userPayload = {
      month,
      year,
      daysInMonth,
      patient: {
        id: patient.id,
        name: patient.name,
        city: patient.city,
        level: patient.level,
        notes: patient.notes,
      },
      prompt,
      shiftHours: { day: DAY_SHIFT_HOURS, night: NIGHT_SHIFT_HOURS },
      patientPriority,
      spreadAcrossPatients: spreadAcrossPatientsFlag,
      workers: workerRows.map((worker) => ({
        id: worker.id,
        name: worker.name,
        role: worker.role,
        city: worker.city,
        status: worker.status,
        preferredShifts: worker.preferred_shifts,
        hoursPlanned: worker.hours_planned,
        hoursCompleted: worker.hours_completed,
      })),
      preferences: preferencesWithHours,
    };

    let aiAssignments: PlanAssignment[] = [];
    let aiWarning: string | null = null;
    try {
      const completion = await openai.chat.completions.create({
        model: DEFAULT_OPENAI_MODEL,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: systemPrompt.trim() },
          { role: "user", content: `Generiši optimalnu rotaciju. Ulazni podaci: ${JSON.stringify(userPayload)}` },
        ],
        temperature: 0.2,
      });

      const content = completion.choices[0]?.message?.content;
      if (content) {
        try {
          const parsed = JSON.parse(content) as Record<string, unknown>;
          const rawPlanSource = parsed.plan ?? parsed.assignments ?? parsed.days ?? [];
          const rawPlan: OpenAIPlanItem[] = Array.isArray(rawPlanSource) ? (rawPlanSource as OpenAIPlanItem[]) : [];
          aiAssignments = extractPlanAssignments(rawPlan, year, month, daysInMonth);
          if (aiAssignments.length === 0) {
            aiWarning = "AI nije vratio nijednu smjenu; koristim heuristiku.";
          }
        } catch (error) {
          console.warn("OpenAI plan parse error", error);
          aiWarning = "AI je vratio neispravan JSON, prelazim na heurističko punjenje.";
        }
      }
    } catch (error) {
      console.error("OpenAI plan failed, fallback only", error);
      aiWarning = "OpenAI nije dostupan; koristim heurističko punjenje.";
      aiAssignments = [];
    }

    const notes: string[] = [];
    const requestedDayHours = preferencesWithHours.reduce((sum, pref) => {
      return sum + (pref.allowDay ? pref.targetDays * (pref.ratio / 100) * DAY_SHIFT_HOURS : 0);
    }, 0);
    const requestedNightHours = preferencesWithHours.reduce((sum, pref) => {
      return (
        sum + (pref.allowNight ? pref.targetDays * ((100 - pref.ratio) / 100) * NIGHT_SHIFT_HOURS : 0)
      );
    }, 0);
    const requestedTotalHours = requestedDayHours + requestedNightHours;
    const totalHoursAvailable = dayHoursAvailable + nightHoursAvailable;

    if (requestedTotalHours < totalHoursAvailable) {
      notes.push("Zatraženo manje sati od ukupnog broja dostupnih sati; popunjavam best-effort.");
    }
    if (requestedTotalHours > totalHoursAvailable) {
      notes.push("Traženo više sati nego što ima slotova; dio smjena će biti ograničen.");
    }
    if (requestedDayHours > dayHoursAvailable || requestedNightHours > nightHoursAvailable) {
      notes.push(
        `Dnevne tražene ${Math.round(requestedDayHours)}h/${Math.round(dayHoursAvailable)}h, noćne ${Math.round(requestedNightHours)}h/${Math.round(nightHoursAvailable)}h.`
      );
    }

    if (busyAssignments.length > 0) {
      notes.push(
        `Blokirano ${busyAssignments.length} smjena (po smjeni) zbog postojećih planova drugih pacijenata.`
      );
    }

    if (preferencesWithHours.some((pref) => pref.spreadAcrossPatients || spreadAcrossPatientsFlag)) {
      notes.push(`Ravnomjerna raspodjela: max ${Math.round(MAX_SPREAD_RATIO * 100)}% sati po pacijentu.`);
    }

    if (patientPriority > 1) {
      notes.push(`Prioritet pacijenta: ${patientPriority}.`);
    }

    if (aiWarning) {
      notes.push(aiWarning);
    }

    const { assignments: finalAssignments, stateById, normalizedPrefs: resolvedPrefs } = buildSchedule(
      normalizedPrefs,
      aiAssignments,
      busyAssignments,
      year,
      monthZeroBased,
      daysInMonth,
      patientPriority
    );

    const summary = formatMeta(resolvedPrefs, stateById, daysInMonth, notes);

    return NextResponse.json({ data: { assignments: finalAssignments, summary, aiWarning } });
  } catch (error) {
    console.error("POST /api/plans/generate error", error);
    return NextResponse.json({ error: "Greška pri generisanju plana." }, { status: 500 });
  }
}

export { sanitizePreferences, normalizeTargets, buildSchedule, getShiftHours };
