import { NextResponse } from "next/server";
import { createServiceSupabaseClient } from "@/lib/supabase/server";
import { DEFAULT_OPENAI_MODEL, getOpenAIClient } from "@/lib/openai";
import type { PlanAssignment, ShiftType, WorkerPreference } from "@/types";

type SanitizedPreference = WorkerPreference & {
  targetDays: number;
  priority: boolean;
};

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

type OpenAIPlanItem = {
  date: string;
  dayWorkerId?: string | null;
  nightWorkerId?: string | null;
  note?: string | null;
};

type LockedShift = { date: string; shiftType: ShiftType };

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
  const requested = preferences.reduce((sum, pref) => sum + pref.targetDays, 0);
  if (preferences.length === 0) return preferences;

  const distributeRemainder = (list: SanitizedPreference[], remaining: number, direction: "add" | "sub") => {
    let idx = 0;
    // Avoid infinite loops by iterating with a safety counter.
    let safety = 500;
    while (remaining !== 0 && safety > 0) {
      const pref = list[idx % list.length];
      const minAllowed = pref.priority ? 1 : 0;
      if (direction === "add") {
        pref.targetDays += 1;
        remaining -= 1;
      } else if (direction === "sub" && pref.targetDays > minAllowed) {
        pref.targetDays -= 1;
        remaining += 1; // remaining is negative
      }
      idx += 1;
      safety -= 1;
    }
  };

  // If nothing requested, split evenly.
  if (requested === 0) {
    const base = Math.floor(totalSlots / preferences.length);
    const remainder = totalSlots - base * preferences.length;
    return preferences.map((pref, index) => ({
      ...pref,
      targetDays: base + (index < remainder ? 1 : 0),
    }));
  }

  const factor = totalSlots / requested;
  const scaled = preferences.map((pref) => ({
    ...pref,
    targetDays: Math.max(pref.priority ? 1 : 0, Math.round(pref.targetDays * factor)),
  }));

  const currentTotal = scaled.reduce((sum, pref) => sum + pref.targetDays, 0);
  const diff = totalSlots - currentTotal;

  // Adjust so the normalized total exactly matches the available slots.
  if (diff > 0) {
    const ordered = [...scaled].sort((a, b) => {
      if (a.priority === b.priority) return a.targetDays - b.targetDays;
      return a.priority ? -1 : 1;
    });
    distributeRemainder(ordered, diff, "add");
    const finalTotal = ordered.reduce((sum, pref) => sum + pref.targetDays, 0);
    if (finalTotal !== totalSlots && ordered[0]) {
      ordered[0].targetDays += totalSlots - finalTotal;
    }
    return ordered;
  }

  if (diff < 0) {
    const ordered = [...scaled].sort((a, b) => {
      if (a.priority === b.priority) return b.targetDays - a.targetDays;
      return a.priority ? 1 : -1;
    });
    distributeRemainder(ordered, diff, "sub");
    const finalTotal = ordered.reduce((sum, pref) => sum + pref.targetDays, 0);
    if (finalTotal !== totalSlots && ordered[0]) {
      ordered[0].targetDays += totalSlots - finalTotal;
    }
    return ordered;
  }

  return scaled;
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
    assigned: state.assigned + 1,
    assignedDay: state.assignedDay + (shift === "day" ? 1 : 0),
    assignedNight: state.assignedNight + (shift === "night" ? 1 : 0),
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
  busyWorkers: Set<string> | undefined,
  respectCaps: boolean
) {
  if (busyWorkers?.has(worker.id)) return false;
  if (existingDay && existingDay === worker.id) return false;
  if (shift === "day" && !worker.allowDay) return false;
  if (shift === "night" && !worker.allowNight) return false;
  if (!isRestOk(worker, day, shift)) return false;
  if (wouldExceedConsecutive(worker, day, shift)) return false;
  if (respectCaps) {
    const softCap = Math.max(worker.softCap, worker.targetDays + 3);
    if (worker.assigned >= softCap) return false;
    const shiftCap = shift === "day" ? worker.targetDay + 2 : worker.targetNight + 2;
    const assignedForShift = shift === "day" ? worker.assignedDay : worker.assignedNight;
    if (assignedForShift >= shiftCap) return false;
  }
  return true;
}

function scoreCandidate(worker: WorkerState, day: number, shift: "day" | "night", daysInMonth: number, weekend: boolean) {
  const remaining = Math.max(worker.targetDays - worker.assigned, 0);
  const shiftNeed =
    shift === "day"
      ? Math.max(worker.targetDay - worker.assignedDay, 0)
      : Math.max(worker.targetNight - worker.assignedNight, 0);
  const priorityBoost = worker.priority ? 3 : 1;
  const balancePref = shift === "day" ? worker.ratio : 100 - worker.ratio; // 0..100 (ratio is day %)
  const balanceScore = balancePref / 50; // ~0..2
  const distributionScore = 1 - Math.abs(day - daysInMonth / 2) / (daysInMonth / 2); // center-spread
  const weekendPenalty = weekend ? 0.9 : 1;
  const capPressure = worker.assigned >= worker.targetDays ? 0.6 : 1;
  const fairness = 1 / (1 + worker.assigned);
  return (
    (shiftNeed * 2 + remaining + distributionScore + fairness) *
    priorityBoost *
    balanceScore *
    weekendPenalty *
    capPressure
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
  busyWorkers: Set<string> | undefined
) {
  if (shift === "day" && entry.day && entry.day !== worker.id) return false;
  if (shift === "night" && entry.night && entry.night !== worker.id) return false;
  return isValidCandidate(worker, day, shift, entry.day, busyWorkers, true);
}

function buildSchedule(
  preferences: SanitizedPreference[],
  aiAssignments: PlanAssignment[],
  lockedAssignments: PlanAssignment[],
  busyAssignments: PlanAssignment[],
  lockedMap: Map<number, Partial<Record<ShiftType, boolean>>>,
  year: number,
  monthZeroBased: number,
  daysInMonth: number
) {
  const totalSlots = daysInMonth * 2;
  const normalizedPrefs = normalizeTargets(preferences, totalSlots).map<NormalizedPreference>((pref) => {
    const targetDay = Math.round(pref.targetDays * (pref.ratio / 100));
    const targetNight = Math.max(pref.targetDays - targetDay, 0);
    const softCap = Math.max(pref.targetDays + 3, Math.ceil(totalSlots / (preferences.length || 1)) + (pref.priority ? 3 : 2));
    const hardCap = Math.max(softCap + 4, pref.targetDays + 6);
    return { ...pref, targetDay, targetNight, softCap, hardCap };
  });
  const schedule = buildEmptySchedule(daysInMonth);

  // Seed locked assignments first; they are immutable.
  lockedAssignments.forEach((assignment) => {
    const day = Number(assignment.date.split("-")[2]);
    const entry = schedule.get(day) ?? {};
    entry[assignment.shiftType] = assignment.workerId ?? null;
    schedule.set(day, entry);
  });

  // Apply AI assignments if not locked.
  aiAssignments.forEach((assignment) => {
    const day = Number(assignment.date.split("-")[2]);
    const locked = lockedMap.get(day);
    if (locked?.[assignment.shiftType]) return;
    const entry = schedule.get(day) ?? {};
    entry[assignment.shiftType] = assignment.workerId ?? null;
    schedule.set(day, entry);
  });

  const busyByDay = new Map<number, Set<string>>();
  busyAssignments.forEach((assignment) => {
    const day = Number(assignment.date.split("-")[2]);
    if (!busyByDay.has(day)) busyByDay.set(day, new Set());
    if (assignment.workerId) busyByDay.get(day)!.add(assignment.workerId);
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

  // Validate AI assignments and drop invalid ones.
  for (let day = 1; day <= daysInMonth; day++) {
    const entry = schedule.get(day) ?? { day: null, night: null };
    (["day", "night"] as const).forEach((shift) => {
      if (lockedMap.get(day)?.[shift]) return;
      const workerId = entry[shift];
      if (!workerId) return;
      const worker = stateById.get(workerId);
      if (!worker) {
        entry[shift] = null;
        return;
      }
      const valid = isAssignmentValid(worker, day, shift, entry, busyByDay.get(day));
      if (!valid) {
        entry[shift] = null;
      } else {
        const nextState = applyAssignment(worker, day, shift);
        stateById.set(workerId, nextState);
      }
    });
    schedule.set(day, entry);
  }

  // Fill remaining slots day-by-day.
  for (let day = 1; day <= daysInMonth; day++) {
    const weekend = isWeekend(year, monthZeroBased, day);
    const entry = schedule.get(day) ?? { day: null, night: null };

    (["day", "night"] as const).forEach((shift) => {
      if (lockedMap.get(day)?.[shift]) return;
      if (shift === "day" && entry.day) return;
      if (shift === "night" && entry.night) return;

      const busyWorkers = busyByDay.get(day);
      const candidates = normalizedPrefs
        .map((pref) => stateById.get(pref.workerId)!)
        .filter((worker) => isValidCandidate(worker, day, shift, entry.day, busyWorkers, true));

      if (candidates.length === 0) return;

      const best = candidates
        .map((worker) => ({
          worker,
          score: scoreCandidate(worker, day, shift, daysInMonth, weekend),
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
      if (lockedMap.get(day)?.[shift]) return;
      if (shift === "day" && entry.day) return;
      if (shift === "night" && entry.night) return;

      const candidates = normalizedPrefs
        .map((pref) => stateById.get(pref.workerId)!)
        .filter((worker) => {
          // Hard cap only to avoid pathological overloads.
          if (worker.assigned >= worker.hardCap) return false;
          return isValidCandidate(worker, day, shift, entry.day, busyWorkers, false);
        });

      if (candidates.length === 0) return;

      const best = candidates
        .map((worker) => ({
          worker,
          score: scoreCandidate(worker, day, shift, daysInMonth, weekend),
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
  const unassigned = normalizedPrefs.filter((pref) => (stateById.get(pref.workerId)?.assigned ?? 0) === 0);
  for (const pref of unassigned) {
    for (let day = 1; day <= daysInMonth; day++) {
      const entry = schedule.get(day)!;
      const shifts: ("day" | "night")[] = ["day", "night"];
      let placed = false;
      for (const shift of shifts) {
        const currentId = entry[shift];
        if (!currentId) continue;
        const currentState = stateById.get(currentId)!;
        const candidateState = stateById.get(pref.workerId)!;
        // Try swap if candidate can take it and current can be removed.
        if (
          isValidCandidate(candidateState, day, shift, shift === "day" ? entry.night : entry.day, busyByDay.get(day), true) &&
          currentState.assigned > 1
        ) {
          entry[shift] = pref.workerId;
          stateById.set(pref.workerId, applyAssignment(candidateState, day, shift));
          stateById.set(currentId, { ...currentState, assigned: currentState.assigned - 1 });
          placed = true;
          break;
        }
      }
      if (placed) break;
    }
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
    const totalSlots = daysInMonth * 2;
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
Ti si planer smjena za njegu. Prvo ispoštuj prioritetne radnike (priority=true): daju im se njihove tražene smjene (npr. 17 dana sa 100% noćne) koliko god je to realno moguće, uz poštovanje pravila odmora.
Istovremeno svaki odabrani radnik mora dobiti barem nekoliko smjena; preostale smjene ravnopravno podijeli tako da niko ne ostane na 0 i da raspored izgleda fer.
Moraš poštovati:
- Nema 24h u komadu: isti radnik ne može dan pa noć isti dan.
- Nakon noćne mora imati cijeli dan pauze prije nove dnevne.
- Poštuj preferencije (day/night) i ratio; prioritetni radnici imaju prednost kod popune.
- Ne planiraj "u cugu": izbjegavaj serije duže od 4-5 dana istog radnika; miješaj radnike kroz mjesec, uključujući vikende.
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
      workers: workerRows.map((worker) => ({
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
      sanitizedPreferences,
      aiAssignments,
      lockedAssignments,
      busyAssignments,
      lockedMap,
      year,
      monthZeroBased,
      daysInMonth
    );

    const summary = formatMeta(normalizedPrefs, stateById, daysInMonth, notes);

    return NextResponse.json({ data: { assignments: finalAssignments, summary } });
  } catch (error) {
    console.error("POST /api/plans/generate error", error);
    return NextResponse.json({ error: "Greška pri generisanju plana." }, { status: 500 });
  }
}
