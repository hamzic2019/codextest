import { NextResponse } from "next/server";
import { createServiceSupabaseClient } from "@/lib/supabase/server";
import { DEFAULT_OPENAI_MODEL, getOpenAIClient } from "@/lib/openai";
import type { PlanAssignment, WorkerPreference } from "@/types";

<<<<<<< HEAD
=======
type SanitizedPreference = WorkerPreference & {
  targetDays: number;
  priority: boolean;
};

type WorkerState = {
  id: string;
  targetDays: number;
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
};

>>>>>>> backend
type OpenAIPlanItem = {
  date: string;
  dayWorkerId?: string | null;
  nightWorkerId?: string | null;
  note?: string | null;
};

<<<<<<< HEAD
=======
const MAX_CONSECUTIVE_DAYS = 4;
const MAX_CONSECUTIVE_NIGHTS = 3;

>>>>>>> backend
function toDateKey(year: number, month: number, day: number) {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

<<<<<<< HEAD
function extractPlanAssignments(
  rawPlan: OpenAIPlanItem[],
  year: number,
  month: number,
  daysInMonth: number
): PlanAssignment[] {
  const byDate = new Map<string, OpenAIPlanItem>();
  rawPlan.forEach((item) => {
    if (item.date) {
      byDate.set(item.date, item);
    }
  });

  const assignments: PlanAssignment[] = [];

=======
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
  const totalRequested = preferences.reduce((sum, pref) => sum + pref.targetDays, 0);
  if (totalRequested <= totalSlots || totalRequested === 0) return preferences;
  const factor = totalSlots / totalRequested;
  return preferences.map((pref) => {
    const scaled = Math.max(pref.priority ? 1 : 0, Math.floor(pref.targetDays * factor));
    return { ...pref, targetDays: clamp(scaled, 0, pref.targetDays) };
  });
}

function extractPlanAssignments(rawPlan: OpenAIPlanItem[], year: number, month: number, daysInMonth: number): PlanAssignment[] {
  const byDate = new Map<string, OpenAIPlanItem>();
  rawPlan.forEach((item) => {
    if (item.date) byDate.set(item.date, item);
  });

  const assignments: PlanAssignment[] = [];
>>>>>>> backend
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
<<<<<<< HEAD
    const dayWorker =
      item?.dayWorkerId ??
      legacy?.day_worker_id ??
      legacy?.day ??
      null;
    const nightWorker =
      item?.nightWorkerId ??
      legacy?.night_worker_id ??
      legacy?.night ??
      null;
    const note = item?.note ?? legacy?.note ?? null;

    assignments.push({
      date: dateKey,
      shiftType: "day",
      workerId: dayWorker ?? null,
      note,
    });
    assignments.push({
      date: dateKey,
      shiftType: "night",
      workerId: nightWorker ?? null,
      note,
    });
  }

  return assignments;
=======
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
  maxPerWorker: number
) {
  if (worker.assigned >= maxPerWorker) return false;
  if (existingDay && existingDay === worker.id) return false;
  if (shift === "day" && !worker.allowDay) return false;
  if (shift === "night" && !worker.allowNight) return false;
  if (!isRestOk(worker, day, shift)) return false;
  if (wouldExceedConsecutive(worker, day, shift)) return false;
  return true;
}

function scoreCandidate(
  worker: WorkerState,
  day: number,
  shift: "day" | "night",
  daysInMonth: number,
  weekend: boolean
) {
  const remaining = worker.targetDays - worker.assigned;
  const priorityBoost = worker.priority ? 3 : 1;
  const balancePref = shift === "day" ? worker.ratio : 100 - worker.ratio; // 0..100
  const balanceScore = balancePref / 50; // ~0..2
  const distributionScore = 1 - Math.abs(day - daysInMonth / 2) / (daysInMonth / 2); // center-spread
  const weekendPenalty = weekend ? 0.9 : 1;
  return remaining * priorityBoost * balanceScore * weekendPenalty + distributionScore;
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
  maxPerWorker: number
) {
  if (shift === "day" && entry.day && entry.day !== worker.id) return false;
  if (shift === "night" && entry.night && entry.night !== worker.id) return false;
  return isValidCandidate(worker, day, shift, entry.day, maxPerWorker);
}

function buildSchedule(
  preferences: SanitizedPreference[],
  baseAssignments: PlanAssignment[],
  year: number,
  monthZeroBased: number,
  daysInMonth: number
) {
  const totalSlots = daysInMonth * 2;
  const normalizedPrefs = normalizeTargets(preferences, totalSlots);
  const schedule = baseAssignments.length > 0 ? mapAssignmentsToSchedule(baseAssignments) : buildEmptySchedule(daysInMonth);

  const stateById = new Map<string, WorkerState>();
  normalizedPrefs.forEach((pref) => {
    stateById.set(pref.workerId, {
      id: pref.workerId,
      targetDays: pref.targetDays,
      assigned: 0,
      assignedDay: 0,
      assignedNight: 0,
      priority: pref.priority,
      allowDay: pref.allowDay !== false,
      allowNight: pref.allowNight !== false,
      ratio: pref.ratio ?? 50,
      streak: 0,
    });
  });

  // Validate AI assignments and drop invalid ones.
  for (let day = 1; day <= daysInMonth; day++) {
    const entry = schedule.get(day) ?? { day: null, night: null };
    (["day", "night"] as const).forEach((shift) => {
      const workerId = entry[shift];
      if (!workerId) return;
      const worker = stateById.get(workerId);
      if (!worker) {
        entry[shift] = null;
        return;
      }
      const valid = isAssignmentValid(worker, day, shift, entry, worker.targetDays);
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
      if (shift === "day" && entry.day) return;
      if (shift === "night" && entry.night) return;

      const candidates = normalizedPrefs
        .map((pref) => stateById.get(pref.workerId)!)
        .filter((worker) => isValidCandidate(worker, day, shift, entry.day, worker.targetDays));

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
          isValidCandidate(candidateState, day, shift, shift === "day" ? entry.night : entry.day, candidateState.targetDays) &&
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
  return { assignments: result, stateById };
}

function formatMeta(
  preferences: SanitizedPreference[],
  stateById: Map<string, WorkerState>,
  daysInMonth: number,
  notes: string[]
) {
  const perWorker = preferences.map((pref) => {
    const state = stateById.get(pref.workerId);
    const assigned = state?.assigned ?? 0;
    const shortfall = pref.targetDays - assigned;
    if (shortfall > 0 && pref.priority) {
      notes.push(
        `${pref.workerId} (prioritet) tražio ${pref.targetDays}, dodijeljeno ${assigned} zbog ograničenja.`
      );
    }
    return `${pref.workerId}: ${assigned}/${pref.targetDays}`;
  });
  return `Plan za ${daysInMonth} dana. Pokrivenost: ${perWorker.join("; ")}. ${notes.join(" ")}`.trim();
>>>>>>> backend
}

export async function POST(request: Request) {
  try {
    const payload = await request.json();
    const patientId = String(payload.patientId ?? "").trim();
<<<<<<< HEAD
    const workerPreferences = Array.isArray(payload.workerPreferences)
=======
    const workerPreferencesRaw = Array.isArray(payload.workerPreferences)
>>>>>>> backend
      ? (payload.workerPreferences as WorkerPreference[])
      : [];
    const month = Number(payload.month);
    const year = Number(payload.year);
    const prompt = payload.prompt ? String(payload.prompt) : "";

    if (!patientId || Number.isNaN(month) || Number.isNaN(year)) {
      return NextResponse.json(
        { error: "patientId, month i year su obavezni." },
        { status: 400 }
      );
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

<<<<<<< HEAD
    const workerIds = workerPreferences.map((pref) => pref.workerId);
=======
    const workerIds = workerPreferencesRaw.map((pref) => pref.workerId);
>>>>>>> backend
    if (workerIds.length === 0) {
      return NextResponse.json(
        { error: "Dodajte bar jednog radnika prije generisanja." },
        { status: 400 }
      );
    }

    const { data: workerRows, error: workersError } = await supabase
      .from("workers")
      .select("*")
      .in("id", workerIds);

    if (workersError) throw workersError;
    if (!workerRows || workerRows.length === 0) {
      return NextResponse.json(
        { error: "Radnici nisu pronađeni u bazi." },
        { status: 404 }
      );
    }

    const daysInMonth = new Date(year, month, 0).getDate();
<<<<<<< HEAD
    const openai = getOpenAIClient();

    const systemPrompt = `
Ti si planer smjena za njegu. Moraš poštovati:
- Nema 24h u komadu: isti radnik ne može dan pa noć isti dan.
- Nakon noćne mora imati cijeli dan pauze prije nove dnevne.
- Poštuj preferencije (day/night), prioritetne radnike guraš češće.
- Koristi samo workerId iz liste. Ako nema radnika, ostavi null.
=======
    const sanitizedPreferences = sanitizePreferences(workerPreferencesRaw, daysInMonth);
    const monthZeroBased = month - 1;
    const totalSlots = daysInMonth * 2;

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
>>>>>>> backend
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
        role: worker.role,
        city: worker.city,
        status: worker.status,
        preferredShifts: worker.preferred_shifts,
        hoursPlanned: worker.hours_planned,
        hoursCompleted: worker.hours_completed,
      })),
<<<<<<< HEAD
      preferences: workerPreferences,
    };

    const completion = await openai.chat.completions.create({
      model: DEFAULT_OPENAI_MODEL,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: systemPrompt.trim() },
        {
          role: "user",
          content: `Generiši optimalnu rotaciju. Ulazni podaci: ${JSON.stringify(userPayload)}`,
        },
      ],
      temperature: 0.2,
    });

    const content = completion.choices[0]?.message?.content;
    if (!content) {
      throw new Error("OpenAI nije vratio sadržaj.");
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(content);
    } catch (error) {
      console.error("Parse OpenAI JSON", error, content);
      throw new Error("OpenAI je vratio nevalidan JSON.");
    }

    if (!parsed || typeof parsed !== "object") {
      throw new Error("OpenAI je vratio nevalidan JSON.");
    }

    const parsedObj = parsed as Record<string, unknown>;
    const rawPlanSource =
      parsedObj.plan ?? parsedObj.assignments ?? parsedObj.days ?? [];
    const rawPlan: OpenAIPlanItem[] = Array.isArray(rawPlanSource)
      ? (rawPlanSource as OpenAIPlanItem[])
      : [];
    const assignments = extractPlanAssignments(rawPlan, year, month, daysInMonth);
    const summary =
      typeof parsedObj.summary === "string" ? parsedObj.summary : null;

    return NextResponse.json({ data: { assignments, summary } });
=======
      preferences: sanitizedPreferences,
    };

    let aiAssignments: PlanAssignment[] = [];
    try {
      const completion = await openai.chat.completions.create({
        model: DEFAULT_OPENAI_MODEL,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: systemPrompt.trim() },
          {
            role: "user",
            content: `Generiši optimalnu rotaciju. Ulazni podaci: ${JSON.stringify(userPayload)}`,
          },
        ],
        temperature: 0.2,
      });

      const content = completion.choices[0]?.message?.content;
      if (content) {
        const parsed = JSON.parse(content) as Record<string, unknown>;
        const rawPlanSource = parsed.plan ?? parsed.assignments ?? parsed.days ?? [];
        const rawPlan: OpenAIPlanItem[] = Array.isArray(rawPlanSource)
          ? (rawPlanSource as OpenAIPlanItem[])
          : [];
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

    const { assignments: finalAssignments, stateById } = buildSchedule(
      sanitizedPreferences,
      aiAssignments,
      year,
      monthZeroBased,
      daysInMonth
    );

    const summary = formatMeta(sanitizedPreferences, stateById, daysInMonth, notes);

    return NextResponse.json({ data: { assignments: finalAssignments, summary } });
>>>>>>> backend
  } catch (error) {
    console.error("POST /api/plans/generate error", error);
    return NextResponse.json(
      { error: "Greška pri generisanju plana." },
      { status: 500 }
    );
  }
}
