import { NextResponse } from "next/server";
import { createServiceSupabaseClient } from "@/lib/supabase/server";
import { DEFAULT_OPENAI_MODEL, getOpenAIClient } from "@/lib/openai";
import type { PlanAssignment, ShiftType, WorkerPreference } from "@/types";

type SanitizedPreference = WorkerPreference & {
  targetDays: number;
  priority: boolean;
};

type BusyAssignment = PlanAssignment & { patientId?: string | null };

type NormalizedPreference = SanitizedPreference & {
  targetDay: number;
  targetNight: number;
  softCap: number;
  hardCap: number;
};

type WorkerState = {
  id: string;
  targetDays: number;
  targetDay: number;
  targetNight: number;
  assigned: number;
  assignedDay: number;
  assignedNight: number;
  priority: boolean;
  allowDay: boolean;
  allowNight: boolean;
  ratio: number;
  lastDay?: number;
  lastType?: "day" | "night";
  streak: number;
  softCap: number;
  hardCap: number;
};

type WorkerShiftHistory = {
  lastDay?: number;
  lastType?: ShiftType;
};

type OpenAIPlanItem = {
  date: string;
  dayWorkerId?: string | null;
  nightWorkerId?: string | null;
  note?: string | null;
};

type LockedShift = { date: string; shiftType: ShiftType };
type AvailabilityBlock = {
  day: boolean[];
  night: boolean[];
};

function toDateKey(year: number, month: number, day: number) {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function clamp(value: number, min: number, max: number) {
  if (Number.isNaN(value)) return min;
  return Math.max(min, Math.min(max, value));
}

function getDayFromDate(date: string) {
  return Number(date.split("-")[2]);
}

function clampTargetsToAvailability(
  preferences: SanitizedPreference[],
  busyAssignments: BusyAssignment[],
  year: number,
  monthZeroBased: number,
  daysInMonth: number
) {
  const blocked = new Map<string, AvailabilityBlock>();

  const ensure = (workerId: string) => {
    if (!blocked.has(workerId)) {
      blocked.set(workerId, {
        day: Array.from({ length: daysInMonth + 2 }, () => false),
        night: Array.from({ length: daysInMonth + 2 }, () => false),
      });
    }
    return blocked.get(workerId)!;
  };

  busyAssignments.forEach((assignment) => {
    if (!assignment.workerId) return;
    const day = getDayFromDate(assignment.date);
    if (Number.isNaN(day) || day < 1 || day > daysInMonth) return;
    const entry = ensure(assignment.workerId);
    entry[assignment.shiftType][day] = true;
    // Isti dan druga smjena takođe blokirana.
    if (assignment.shiftType === "day") entry.night[day] = true;
    if (assignment.shiftType === "night") {
      entry.day[day] = true;
      // 12h odmora: blokiraj dnevnu naredni dan.
      if (day + 1 <= daysInMonth) {
        entry.day[day + 1] = true;
      }
    }
  });

  return preferences.map((pref) => {
    const entry = blocked.get(pref.workerId);
    if (!entry) return pref;
    let available = 0;
    for (let day = 1; day <= daysInMonth; day++) {
      if (!entry.day[day]) available += 1;
      if (!entry.night[day]) available += 1;
    }
    return { ...pref, targetDays: Math.min(pref.targetDays, available) };
  });
}

function sanitizePreferences(preferences: WorkerPreference[], daysInMonth: number): SanitizedPreference[] {
  return preferences.map((pref) => ({
    ...pref,
    priority: Boolean(pref.priority),
    targetDays: clamp(pref.days, 0, daysInMonth),
    allowDay: pref.allowDay !== false,
    allowNight: pref.allowNight !== false,
    ratio: clamp(pref.ratio ?? 50, 0, 100),
  }));
}

function normalizeTargets(preferences: SanitizedPreference[], totalSlots: number): SanitizedPreference[] {
  if (preferences.length === 0) return preferences;

  const capped = preferences.map((pref) => ({
    ...pref,
    targetDays: Math.max(0, Math.min(pref.targetDays, totalSlots)),
  }));

  const requested = capped.reduce((sum, pref) => sum + pref.targetDays, 0);
  if (requested <= totalSlots) {
    // Ne povećavamo traženi broj: ostaje gornja granica koju je korisnik zadao.
    return capped;
  }

  const factor = totalSlots / requested;
  const working = capped.map((pref) => {
    const scaled = Math.floor(pref.targetDays * factor);
    return { pref, current: Math.max(0, Math.min(scaled, pref.targetDays)) };
  });

  const currentTotal = working.reduce((sum, item) => sum + item.current, 0);
  let remaining = totalSlots - currentTotal;

  // Raspodijeli preostale slotove (ako ih ima zbog zaokruživanja) bez prelaska originalnog targeta.
  while (remaining > 0) {
    const candidate = working.find((item) => item.current < item.pref.targetDays);
    if (!candidate) break;
    candidate.current += 1;
    remaining -= 1;
  }

  return working.map((item) => ({ ...item.pref, targetDays: item.current }));
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

function evaluateRestRule(
  history: WorkerShiftHistory | undefined,
  workerId: string,
  day: number,
  shift: ShiftType,
  entry: { day?: string | null; night?: string | null },
  busyEntry?: { day: Set<string>; night: Set<string> }
): { allowed: boolean; reason?: string } {
  const otherShiftWorker = shift === "day" ? entry.night : entry.day;
  if (otherShiftWorker && otherShiftWorker === workerId) {
    // Same worker već zauzet u drugoj smjeni istog dana.
    return { allowed: false, reason: "same-day-other-shift" };
  }

  if (busyEntry) {
    const busySameDay =
      busyEntry.day.has(workerId) || busyEntry.night.has(workerId);
    if (busySameDay) {
      return { allowed: false, reason: "busy-same-day" };
    }
  }

  if (history?.lastDay === day && history.lastType && history.lastType !== shift) {
    // Already has another shift this calendar day.
    return { allowed: false, reason: "same-day-two-shifts" };
  }

  if (history?.lastDay === day - 1 && history.lastType === "night" && shift === "day") {
    // Night on X -> day on X+1 is forbidden (needs 12h rest).
    return { allowed: false, reason: "night-to-day" };
  }

  return { allowed: true };
}

function applyAssignment(state: WorkerState, day: number, shift: "day" | "night", countTowardsPlan = true) {
  const consecutive = state.lastDay === day - 1 && state.lastType === shift ? state.streak + 1 : 1;
  const next: WorkerState = {
    ...state,
    assigned: state.assigned + (countTowardsPlan ? 1 : 0),
    assignedDay: state.assignedDay + (countTowardsPlan && shift === "day" ? 1 : 0),
    assignedNight: state.assignedNight + (countTowardsPlan && shift === "night" ? 1 : 0),
    lastDay: day,
    lastType: shift,
    streak: consecutive,
  };
  return next;
}

function buildEmptySchedule(daysInMonth: number) {
  const schedule = new Map<number, { day?: string | null; night?: string | null }>();
  for (let day = 1; day <= daysInMonth; day++) {
    schedule.set(day, { day: null, night: null });
  }
  return schedule;
}

function detectRestViolationsLocal(assignments: PlanAssignment[]) {
  const byWorker = new Map<string, Map<string, { day: boolean; night: boolean }>>();

  const add = (workerId: string, date: string, shift: ShiftType) => {
    if (!byWorker.has(workerId)) {
      byWorker.set(workerId, new Map());
    }
    const entry = byWorker.get(workerId)!.get(date) ?? { day: false, night: false };
    entry[shift] = true;
    byWorker.get(workerId)!.set(date, entry);
  };

  assignments.forEach((assignment) => {
    if (!assignment.workerId) return;
    add(assignment.workerId, assignment.date, assignment.shiftType);
  });

  for (const [workerId, dateMap] of byWorker.entries()) {
    for (const [date, entry] of dateMap.entries()) {
      if (entry.day && entry.night) {
        return { workerId, date, reason: "same-day" } as const;
      }

      if (entry.night) {
        const next = new Date(date);
        next.setDate(next.getDate() + 1);
        const y = next.getFullYear();
        const m = String(next.getMonth() + 1).padStart(2, "0");
        const d = String(next.getDate()).padStart(2, "0");
        const nextKey = `${y}-${m}-${d}`;
        const nextEntry = dateMap.get(nextKey);
        if (nextEntry?.day) {
          return { workerId, date, nextDate: nextKey, reason: "night-to-day" } as const;
        }
      }
    }
  }

  return null;
}

function validateGeneratedAssignments(assignments: PlanAssignment[], busyAssignments: BusyAssignment[]) {
  const busyMap = new Map<string, { day: Set<string>; night: Set<string> }>();
  busyAssignments.forEach((assignment) => {
    if (!assignment.workerId) return;
    const current = busyMap.get(assignment.date) ?? { day: new Set<string>(), night: new Set<string>() };
    current[assignment.shiftType].add(assignment.workerId);
    busyMap.set(assignment.date, current);
  });

  for (const assignment of assignments) {
    if (!assignment.workerId) continue;
    const busy = busyMap.get(assignment.date);
    if (busy?.[assignment.shiftType]?.has(assignment.workerId)) {
      return `Radnik ${assignment.workerId} je zauzet kod drugog pacijenta ${assignment.date} (${assignment.shiftType}).`;
    }
    if (assignment.shiftType === "day") {
      const prevDate = new Date(assignment.date);
      prevDate.setDate(prevDate.getDate() - 1);
      const prevKey = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, "0")}-${String(prevDate.getDate()).padStart(2, "0")}`;
      const prevBusy = busyMap.get(prevKey);
      if (prevBusy?.night.has(assignment.workerId)) {
        return `Radnik ${assignment.workerId} radio je noć ${prevKey} kod drugog pacijenta pa ne može dnevnu ${assignment.date}.`;
      }
    }
    if (assignment.shiftType === "night") {
      const nextDate = new Date(assignment.date);
      nextDate.setDate(nextDate.getDate() + 1);
      const nextKey = `${nextDate.getFullYear()}-${String(nextDate.getMonth() + 1).padStart(2, "0")}-${String(nextDate.getDate()).padStart(2, "0")}`;
      const nextBusy = busyMap.get(nextKey);
      if (nextBusy?.day.has(assignment.workerId)) {
        return `Radnik ${assignment.workerId} ima dnevnu ${nextKey} kod drugog pacijenta pa ne može noćnu ${assignment.date}.`;
      }
    }
  }

  const restViolation = detectRestViolationsLocal([...assignments, ...busyAssignments]);
  if (restViolation) {
    const { workerId, date, nextDate, reason } = restViolation;
    return reason === "same-day"
      ? `Radnik ${workerId} ne može imati dnevnu i noćnu smjenu istog dana (${date}).`
      : `Radnik ${workerId} ne može raditi noć ${date} i dnevnu ${nextDate ?? "sljedećeg dana"} (12h odmora).`;
  }

  return null;
}

function buildSchedule(
  preferences: SanitizedPreference[],
  aiAssignments: PlanAssignment[],
  lockedAssignments: PlanAssignment[],
  busyAssignments: BusyAssignment[],
  lockedMap: Map<number, Partial<Record<ShiftType, boolean>>>,
  year: number,
  monthZeroBased: number,
  daysInMonth: number
) {
  const totalSlots = daysInMonth * 2;
  const normalizedPrefs = normalizeTargets(preferences, totalSlots).map<NormalizedPreference>((pref) => {
    const targetDay = Math.round(pref.targetDays * (pref.ratio / 100));
    const targetNight = Math.max(pref.targetDays - targetDay, 0);
    const softCap = pref.targetDays;
    const hardCap = pref.targetDays;
    return { ...pref, targetDay, targetNight, softCap, hardCap };
  });
  const selectedIds = new Set(normalizedPrefs.map((pref) => pref.workerId));
  const schedule = buildEmptySchedule(daysInMonth);
  const historyById = new Map<string, WorkerShiftHistory>();

  const busyByDay = new Map<number, { day: Set<string>; night: Set<string> }>();
  busyAssignments.forEach((assignment) => {
    const day = getDayFromDate(assignment.date);
    if (!busyByDay.has(day)) busyByDay.set(day, { day: new Set(), night: new Set() });
    if (assignment.workerId) busyByDay.get(day)![assignment.shiftType].add(assignment.workerId);
  });

  const stateById = new Map<string, WorkerState>();
  normalizedPrefs.forEach((pref) => {
    stateById.set(pref.workerId, {
      id: pref.workerId,
      targetDays: pref.targetDays,
      targetDay: pref.targetDay,
      targetNight: pref.targetNight,
      assigned: 0,
      assignedDay: 0,
      assignedNight: 0,
      priority: pref.priority,
      allowDay: pref.allowDay !== false,
      allowNight: pref.allowNight !== false,
      ratio: pref.ratio ?? 50,
      streak: 0,
      softCap: pref.softCap,
      hardCap: pref.hardCap,
    });
  });

  // Seed locked assignments; keep them and count toward worker load.
  lockedAssignments.forEach((assignment) => {
    const day = getDayFromDate(assignment.date);
    const entry = schedule.get(day) ?? {};
    entry[assignment.shiftType] =
      assignment.workerId && selectedIds.has(assignment.workerId) ? assignment.workerId : null;
    schedule.set(day, entry);
  });

  // Apply AI suggestions if present and not locked.
  aiAssignments.forEach((assignment) => {
    const day = getDayFromDate(assignment.date);
    if (lockedMap.get(day)?.[assignment.shiftType]) return;
    const entry = schedule.get(day) ?? {};
    entry[assignment.shiftType] =
      assignment.workerId && selectedIds.has(assignment.workerId) ? assignment.workerId : null;
    schedule.set(day, entry);
  });

  const scoreCandidateSimple = (worker: WorkerState, shift: "day" | "night") => {
    const totalRemaining = Math.max(worker.targetDays - worker.assigned, 0);
    const shiftRemaining =
      shift === "day"
        ? Math.max(worker.targetDay - worker.assignedDay, 0)
        : Math.max(worker.targetNight - worker.assignedNight, 0);
    const fairness = 1 / (1 + worker.assigned);
    const priorityBoost = worker.priority ? 2 : 1;
    return shiftRemaining * 5 + totalRemaining * 2 + fairness * 3 * priorityBoost;
  };

  const ensureStateForWorker = (workerId: string) => {
    if (stateById.has(workerId)) return stateById.get(workerId)!;
    const placeholder: WorkerState = {
      id: workerId,
      targetDays: 0,
      targetDay: 0,
      targetNight: 0,
      assigned: 0,
      assignedDay: 0,
      assignedNight: 0,
      priority: false,
      allowDay: true,
      allowNight: true,
      ratio: 50,
      streak: 0,
      softCap: totalSlots,
      hardCap: totalSlots,
    };
    stateById.set(workerId, placeholder);
    return placeholder;
  };

  const recordHistory = (workerId: string, day: number, shift: ShiftType) => {
    const next: WorkerShiftHistory = { lastDay: day, lastType: shift };
    historyById.set(workerId, next);
  };

  const canWork = (
    worker: WorkerState,
    day: number,
    shift: ShiftType,
    entry: { day?: string | null; night?: string | null },
    busyEntry: { day: Set<string>; night: Set<string> }
  ) => {
    if (!selectedIds.has(worker.id)) return false;
    if (shift === "day" && !worker.allowDay) return false;
    if (shift === "night" && !worker.allowNight) return false;
    if (busyEntry[shift].has(worker.id)) return false;
    if (shift === "night") {
      const busyNext = busyByDay.get(day + 1);
      if (busyNext?.day.has(worker.id)) return false;
    }
    if (worker.assigned >= worker.hardCap) return false;
    const rest = evaluateRestRule(historyById.get(worker.id), worker.id, day, shift, entry, busyEntry);
    if (!rest.allowed) return false;
    return true;
  };

  // Validate seeded (locked/AI) assignments and fill gaps in one forward pass to keep history coherent.
  for (let day = 1; day <= daysInMonth; day++) {
    const busyEntry = busyByDay.get(day) ?? { day: new Set<string>(), night: new Set<string>() };
    const entry = schedule.get(day) ?? { day: null, night: null };

    // Busy smjene se računaju u historiju odmora (bez povećanja plana).
    (["day", "night"] as const).forEach((shift) => {
      busyEntry[shift].forEach((workerId) => {
        const worker = stateById.get(workerId);
        if (worker) {
          stateById.set(workerId, applyAssignment(worker, day, shift, false));
        }
        recordHistory(workerId, day, shift);
      });
    });

    // Validiraj već postavljene (locked/AI) smjene.
    (["day", "night"] as const).forEach((shift) => {
      const workerId = entry[shift];
      if (!workerId) return;
      const worker = ensureStateForWorker(workerId);
      if (worker.assigned >= worker.hardCap) {
        entry[shift] = null;
        return;
      }
      const rest = evaluateRestRule(historyById.get(workerId), workerId, day, shift, entry, busyEntry);
      if (!rest.allowed) {
        entry[shift] = null; // čak i ako je locked, pravilo odmora pobjeđuje
        return;
      }
      stateById.set(workerId, applyAssignment(worker, day, shift));
      recordHistory(workerId, day, shift);
    });

    // Popuni praznine.
    (["day", "night"] as const).forEach((shift) => {
      if (entry[shift]) return;
      if (lockedMap.get(day)?.[shift]) return; // zaključano, ali prazno => ostaje prazno

      const candidates = normalizedPrefs
        .map((pref) => ensureStateForWorker(pref.workerId))
        .filter((worker) => canWork(worker, day, shift, entry, busyEntry));

      const pick = () => {
        if (candidates.length === 0) return null;
        const best = candidates
          .map((worker) => ({ worker, score: scoreCandidateSimple(worker, shift) }))
          .sort((a, b) => b.score - a.score)[0];
        if (!best) return null;
        return best.worker;
      };

      let chosen = pick();

      if (!chosen) {
        const anyValid = normalizedPrefs
          .map((pref) => ensureStateForWorker(pref.workerId))
          .filter((worker) => canWork(worker, day, shift, entry, busyEntry));
        if (anyValid.length > 0) {
          chosen = anyValid.sort((a, b) => a.assigned - b.assigned)[0];
        }
      }

      if (chosen) {
        const nextState = applyAssignment(chosen, day, shift);
        stateById.set(chosen.id, nextState);
        entry[shift] = chosen.id;
        recordHistory(chosen.id, day, shift);
      }
    });

    schedule.set(day, entry);
  }

  const result: PlanAssignment[] = [];
  schedule.forEach((entry, day) => {
    const dateKey = toDateKey(year, monthZeroBased + 1, day);
    result.push({ date: dateKey, shiftType: "day", workerId: entry.day ?? null });
    result.push({ date: dateKey, shiftType: "night", workerId: entry.night ?? null });
  });

  result.sort((a, b) => a.date.localeCompare(b.date));
  return { assignments: result, stateById, normalizedPrefs };
}

function formatMeta(preferences: NormalizedPreference[], stateById: Map<string, WorkerState>, daysInMonth: number, notes: string[]) {
  const perWorker = preferences.map((pref) => {
    const state = stateById.get(pref.workerId);
    const assigned = state?.assigned ?? 0;
    const shortfall = pref.targetDays - assigned;
    if (shortfall > 0 && pref.priority) {
      notes.push(`${pref.workerId} (prioritet) tražio ${pref.targetDays}, dodijeljeno ${assigned} zbog ograničenja.`);
    }
    return `${pref.workerId}: ${assigned}/${pref.targetDays}`;
  });
  return `Plan za ${daysInMonth} dana. Pokrivenost: ${perWorker.join("; ")}. ${notes.join(" ")}`.trim();
}

/*
// Pseudotestovi za evaluateRestRule (dozvoljeno):
// 9 day -> 10 day -> 11 day: allowed
// 9 day -> 10 day -> 11 night: allowed
// 9 day -> 10 night -> 11 night -> 12 day: allowed
//
// Zabranjeno:
// day + night isti datum (same-day-other-shift)
// 9 day -> 10 night -> 11 day (night-to-day blokira dnevnu na 11.)
*/

export async function POST(request: Request) {
  try {
    const payload = await request.json();
    const patientId = String(payload.patientId ?? "").trim();
    const workerPreferencesRaw = Array.isArray(payload.workerPreferences)
      ? (payload.workerPreferences as WorkerPreference[])
      : [];
    const currentAssignmentsRaw = Array.isArray(payload.currentAssignments)
      ? (payload.currentAssignments as PlanAssignment[])
      : [];
    const lockedShiftsRaw = Array.isArray(payload.lockedShifts)
      ? (payload.lockedShifts as LockedShift[])
      : [];
    const month = Number(payload.month);
    const year = Number(payload.year);
    const prompt = payload.prompt ? String(payload.prompt) : "";

    if (!patientId || Number.isNaN(month) || Number.isNaN(year)) {
      return NextResponse.json({ error: "patientId, month i year su obavezni." }, { status: 400 });
    }

    const supabase = createServiceSupabaseClient() as any;
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

    const { data: otherPlans } = await supabase
      .from("plans")
      .select("id, patient_id")
      .eq("month", month)
      .eq("year", year)
      .neq("patient_id", patientId);

    const otherPlanRows = (otherPlans ?? []) as { id: string; patient_id: string | null }[];
    const otherPlanIds = otherPlanRows.map((plan) => plan.id).filter(Boolean);
    const planPatientMap = new Map<string, string>();
    otherPlanRows.forEach((plan) => {
      if (plan?.id && plan?.patient_id) planPatientMap.set(plan.id, plan.patient_id);
    });

    const busyAssignments: BusyAssignment[] = [];
    if (otherPlanIds.length > 0) {
      const { data: busyRows, error: busyError } = await supabase
        .from("plan_assignments")
        .select("date, shift_type, worker_id, plan_id")
        .in("plan_id", otherPlanIds);

      if (busyError) throw busyError;
      const busyRowsTyped = (busyRows ?? []) as {
        date: string;
        shift_type: ShiftType;
        worker_id: string | null;
        plan_id: string | null;
      }[];
      busyRowsTyped.forEach((row) => {
        busyAssignments.push({
          date: row.date,
          shiftType: row.shift_type,
          workerId: row.worker_id,
          note: null,
          patientId: planPatientMap.get(row.plan_id ?? "") ?? undefined,
        });
      });
    }

    const daysInMonth = new Date(year, month, 0).getDate();
    const sanitizedPreferences = sanitizePreferences(workerPreferencesRaw, daysInMonth);
    const monthZeroBased = month - 1;
    const totalSlots = daysInMonth * 2;
    const availabilityClamped = clampTargetsToAvailability(
      sanitizedPreferences,
      busyAssignments,
      year,
      monthZeroBased,
      daysInMonth
    );
    const lockedMap = new Map<number, Partial<Record<ShiftType, boolean>>>();
    lockedShiftsRaw.forEach((item) => {
      const day = Number(item.date.split("-")[2]);
      if (Number.isNaN(day)) return;
      const entry = lockedMap.get(day) ?? {};
      entry[item.shiftType] = true;
      lockedMap.set(day, entry);
    });
    const lockedAssignments = currentAssignmentsRaw.filter((assignment) => {
      const day = Number(assignment.date.split("-")[2]);
      return lockedMap.get(day)?.[assignment.shiftType];
    });

    const openai = getOpenAIClient();
const systemPrompt = `
Ti si planer smjena za njegu. Prvo ispoštuj prioritetne radnike (priority=true): oni moraju dobiti traženi broj smjena i preferirani omjer (npr. 17 dana sa 100% noćne) koliko god je realno moguće, uz poštovanje pravila odmora; ostale radnike prilagodi oko njih.
Istovremeno svaki odabrani radnik treba dobiti barem nekoliko smjena; preostale smjene ravnopravno podijeli tako da niko ne ostane na 0 i da raspored izgleda fer.
Moraš poštovati:
- Nema 24h u komadu: isti radnik ne može dan pa noć isti dan.
- Obaveznih 12h odmora nakon noćne: ako radi noć (npr. 10.), naredni kalendarski dan (11.) ne smije raditi dnevnu; može noć ili odmor. Tek dan poslije (12.) može opet dnevnu.
- Ako radi dnevnu, sutradan može dnevnu ili noćnu.
- Poštuj preferencije (day/night) i ratio; prioritetni radnici imaju prednost kod popune.
- Ne planiraj "u cugu": izbjegavaj serije duže od 4-5 dana istog radnika; miješaj radnike kroz mjesec, uključujući vikende.
- Koristi samo workerId iz liste. Ako baš nema radnika, ostavi null, ali pokušaj popuniti sve smjene.
- Dobijaš listu busyShifts (drugi pacijenti u istom mjesecu). Nikad ne dodjeljuj radnika na isti datum/smjenu ako je tamo već busy, niti na noć ako ima dnevnu naredni dan kod drugog pacijenta.
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
      workers: workerRows.map((worker: any) => ({
        id: worker.id,
        name: worker.name,
        role: worker.role ?? "",
        city: worker.city,
        status: worker.status,
        preferredShifts:
          worker.preferred_shifts && worker.preferred_shifts.length > 0
            ? worker.preferred_shifts
            : ["day", "night"],
        hoursPlanned: worker.hours_planned ?? 0,
        hoursCompleted: worker.hours_completed ?? 0,
      })),
      preferences: sanitizedPreferences,
      busyShifts: busyAssignments.map((item) => ({
        date: item.date,
        shiftType: item.shiftType,
        workerId: item.workerId,
        patientId: (item as { patientId?: string }).patientId ?? null,
      })),
    };

    let aiAssignments: PlanAssignment[] = [];
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
        const parsed = JSON.parse(content) as Record<string, unknown>;
        const rawPlanSource = parsed.plan ?? parsed.assignments ?? parsed.days ?? [];
        const rawPlan: OpenAIPlanItem[] = Array.isArray(rawPlanSource) ? (rawPlanSource as OpenAIPlanItem[]) : [];
        aiAssignments = extractPlanAssignments(rawPlan, year, month, daysInMonth);
      }
    } catch (error) {
      console.error("OpenAI plan failed, fallback only", error);
      aiAssignments = [];
    }

    const notes: string[] = [];
    if (sanitizedPreferences.reduce((sum, pref) => sum + pref.targetDays, 0) < totalSlots) {
      notes.push("Zatraženo manje smjena od ukupnog broja slotova; popunjavam best-effort.");
    }

    if (busyAssignments.length > 0) {
      notes.push(`Blokirano ${busyAssignments.length} smjena zbog postojećih planova drugih pacijenata.`);
    }

    const { assignments: finalAssignments, stateById, normalizedPrefs } = buildSchedule(
      availabilityClamped,
      aiAssignments,
      lockedAssignments,
      busyAssignments,
      lockedMap,
      year,
      monthZeroBased,
      daysInMonth
    );

    const conflictMessage = validateGeneratedAssignments(finalAssignments, busyAssignments);
    if (conflictMessage) {
      return NextResponse.json({ error: conflictMessage }, { status: 409 });
    }

    const summary = formatMeta(normalizedPrefs, stateById, daysInMonth, notes);

    return NextResponse.json({ data: { assignments: finalAssignments, summary } });
  } catch (error) {
    console.error("POST /api/plans/generate error", error);
    return NextResponse.json({ error: "Greška pri generisanju plana." }, { status: 500 });
  }
}
