import { NextResponse } from "next/server";
import { createServiceSupabaseClient } from "@/lib/supabase/server";
import { DEFAULT_OPENAI_MODEL, getOpenAIClient } from "@/lib/openai";
import type { PlanAssignment, WorkerPreference } from "@/types";

type SanitizedPreference = WorkerPreference & {
  days: number;
};

type OpenAIPlanItem = {
  date: string;
  dayWorkerId?: string | null;
  nightWorkerId?: string | null;
  note?: string | null;
};

function toDateKey(year: number, month: number, day: number) {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

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
}

function clampDays(days: number, maxDays: number) {
  if (Number.isNaN(days) || days < 1) return 1;
  return Math.min(days, maxDays);
}

function sanitizePreferences(
  preferences: WorkerPreference[],
  daysInMonth: number
): SanitizedPreference[] {
  return preferences.map((pref) => ({
    ...pref,
    days: clampDays(pref.days, daysInMonth),
    allowDay: pref.allowDay !== false,
    allowNight: pref.allowNight !== false,
  }));
}

function buildFallbackAssignments(
  baseAssignments: PlanAssignment[],
  preferences: SanitizedPreference[],
  workers: Array<{
    id: string;
    preferred_shifts: string[];
  }>,
  year: number,
  month: number,
  daysInMonth: number
): PlanAssignment[] {
  const prefById = new Map(preferences.map((pref) => [pref.workerId, pref]));
  const desiredById = new Map(preferences.map((pref) => [pref.workerId, pref.days]));
  const dayPool = preferences.filter((pref) => pref.allowDay).map((pref) => pref.workerId);
  const nightPool = preferences.filter((pref) => pref.allowNight).map((pref) => pref.workerId);

  const map = new Map<string, { day?: string | null; night?: string | null }>();
  baseAssignments.forEach((assignment) => {
    const entry = map.get(assignment.date) ?? {};
    entry[assignment.shiftType] = assignment.workerId ?? null;
    map.set(assignment.date, entry);
  });

  const usage = new Map<string, number>();
  const lastShift = new Map<string, { day: number; type: "day" | "night" }>();

  const incrementUsage = (id: string | null | undefined) => {
    if (!id) return;
    usage.set(id, (usage.get(id) ?? 0) + 1);
  };

  baseAssignments.forEach((assignment) => {
    incrementUsage(assignment.workerId);
  });

  const canTakeShift = (
    workerId: string,
    date: number,
    shift: "day" | "night",
    otherShiftWorker: string | null | undefined
  ) => {
    if (workerId === otherShiftWorker) return false;
    const last = lastShift.get(workerId);
    if (!last) return true;
    if (last.day === date && last.type !== shift) return false; // no 24h
    if (last.type === "night" && shift === "day" && last.day === date - 1) return false; // rest after night
    return true;
  };

  const pickWorker = (
    pool: string[],
    date: number,
    otherShiftWorker: string | null | undefined,
    shift: "day" | "night",
    allowRelaxed: boolean
  ) => {
    const sorted = [...pool].sort((a, b) => {
      const aPref = prefById.get(a);
      const bPref = prefById.get(b);
      const aDesired = desiredById.get(a) ?? 0;
      const bDesired = desiredById.get(b) ?? 0;
      const aUsage = usage.get(a) ?? 0;
      const bUsage = usage.get(b) ?? 0;
      const aPriority = aPref?.priority ? 1 : 0;
      const bPriority = bPref?.priority ? 1 : 0;
      const aDeficit = aDesired - aUsage;
      const bDeficit = bDesired - bUsage;
      if (aPriority !== bPriority) return bPriority - aPriority;
      if (aDeficit !== bDeficit) return bDeficit - aDeficit;
      return aUsage - bUsage;
    });

    for (const workerId of sorted) {
      if (allowRelaxed || canTakeShift(workerId, date, shift, otherShiftWorker)) {
        return workerId;
      }
    }
    return sorted[0] ?? null;
  };

  for (let day = 1; day <= daysInMonth; day++) {
    const dateKey = toDateKey(year, month, day);
    const entry = map.get(dateKey) ?? {};
    const otherDay = entry.night ?? null;
    if (!entry.day) {
      const workerId = pickWorker(dayPool.length ? dayPool : nightPool, day, otherDay, "day", false);
      entry.day = workerId ?? null;
      incrementUsage(workerId);
      if (workerId) lastShift.set(workerId, { day, type: "day" });
    } else {
      incrementUsage(entry.day);
      if (entry.day) lastShift.set(entry.day, { day, type: "day" });
    }

    const otherNight = entry.day ?? null;
    if (!entry.night) {
      const workerId = pickWorker(
        nightPool.length ? nightPool : dayPool,
        day,
        otherNight,
        "night",
        false
      );
      entry.night = workerId ?? null;
      incrementUsage(workerId);
      if (workerId) lastShift.set(workerId, { day, type: "night" });
    } else {
      incrementUsage(entry.night);
      if (entry.night) lastShift.set(entry.night, { day, type: "night" });
    }

    map.set(dateKey, entry);
  }

  const missingWorkers = preferences
    .map((pref) => pref.workerId)
    .filter((id) => (usage.get(id) ?? 0) === 0);

  if (missingWorkers.length > 0) {
    const dates = Array.from({ length: daysInMonth }, (_, index) => index + 1);
    for (const missing of missingWorkers) {
      const pref = prefById.get(missing);
      if (!pref) continue;
      const canDay = pref.allowDay;
      const canNight = pref.allowNight;
      let placed = false;
      for (const day of dates) {
        if (placed) break;
        const dateKey = toDateKey(year, month, day);
        const entry = map.get(dateKey);
        if (!entry) continue;
        if (canDay && entry.day && entry.day !== missing) {
          entry.day = missing;
          placed = true;
          incrementUsage(missing);
          map.set(dateKey, entry);
          break;
        }
        if (canNight && entry.night && entry.night !== missing) {
          entry.night = missing;
          placed = true;
          incrementUsage(missing);
          map.set(dateKey, entry);
          break;
        }
      }
    }
  }

  const result: PlanAssignment[] = [];
  map.forEach((entry, dateKey) => {
    const dayWorker = entry.day ?? null;
    const nightWorker = entry.night ?? null;
    // If still null (AI returned blank and pools were empty), relax constraints to fill with any available.
    const safeDay =
      dayWorker ??
      pickWorker(dayPool.length ? dayPool : nightPool, Number(dateKey.slice(-2)), null, "day", true) ??
      null;
    const safeNight =
      nightWorker ??
      pickWorker(
        nightPool.length ? nightPool : dayPool,
        Number(dateKey.slice(-2)),
        safeDay,
        "night",
        true
      ) ??
      null;

    result.push({ date: dateKey, shiftType: "day", workerId: safeDay });
    result.push({ date: dateKey, shiftType: "night", workerId: safeNight });
  });

  return result.sort((a, b) => a.date.localeCompare(b.date));
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

    const workerIds = workerPreferencesRaw.map((pref) => pref.workerId);
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
    const sanitizedPreferences = sanitizePreferences(workerPreferencesRaw, daysInMonth);
    const openai = getOpenAIClient();

    const systemPrompt = `
Ti si planer smjena za njegu. Moraš poštovati:
- Nema 24h u komadu: isti radnik ne može dan pa noć isti dan.
- Nakon noćne mora imati cijeli dan pauze prije nove dnevne.
- Poštuj preferencije (day/night), prioritetne radnike guraš češće.
- Koristi samo workerId iz liste. Ako nema radnika, ostavi null.
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
      preferences: sanitizedPreferences,
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
    const rawPlanSource = parsedObj.plan ?? parsedObj.assignments ?? parsedObj.days ?? [];
    const rawPlan: OpenAIPlanItem[] = Array.isArray(rawPlanSource)
      ? (rawPlanSource as OpenAIPlanItem[])
      : [];
    const assignments = extractPlanAssignments(rawPlan, year, month, daysInMonth);
    const finalAssignments = buildFallbackAssignments(
      assignments,
      sanitizedPreferences,
      workerRows,
      year,
      month,
      daysInMonth
    );
    const summary = typeof parsedObj.summary === "string" ? parsedObj.summary : null;

    return NextResponse.json({ data: { assignments: finalAssignments, summary } });
  } catch (error) {
    console.error("POST /api/plans/generate error", error);
    return NextResponse.json(
      { error: "Greška pri generisanju plana." },
      { status: 500 }
    );
  }
}
