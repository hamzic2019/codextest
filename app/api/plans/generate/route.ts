import { NextResponse } from "next/server";
import { createServiceSupabaseClient } from "@/lib/supabase/server";
import { DEFAULT_OPENAI_MODEL, getOpenAIClient } from "@/lib/openai";
import type { PlanAssignment, WorkerPreference } from "@/types";

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

export async function POST(request: Request) {
  try {
    const payload = await request.json();
    const patientId = String(payload.patientId ?? "").trim();
    const workerPreferences = Array.isArray(payload.workerPreferences)
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

    const workerIds = workerPreferences.map((pref) => pref.workerId);
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
  } catch (error) {
    console.error("POST /api/plans/generate error", error);
    return NextResponse.json(
      { error: "Greška pri generisanju plana." },
      { status: 500 }
    );
  }
}
