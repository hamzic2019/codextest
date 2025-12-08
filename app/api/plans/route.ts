import { NextResponse } from "next/server";
import { createServiceSupabaseClient } from "@/lib/supabase/server";
import type { Plan, PlanAssignment, ShiftType } from "@/types";

type PlanRow = {
  id: string;
  patient_id: string;
  month: number;
  year: number;
  prompt: string | null;
  summary: string | null;
  status: string;
  created_at: string;
};

type AssignmentRow = {
  id: string;
  plan_id: string;
  date: string;
  shift_type: "day" | "night";
  worker_id: string | null;
  note: string | null;
  created_at: string;
};

type PlanRowWithAssignments = PlanRow & {
  plan_assignments?: AssignmentRow[];
};

type BusyAssignmentRow = {
  date: string;
  shift_type: ShiftType;
  worker_id: string;
  plans: {
    patient_id: string;
    month: number;
    year: number;
  };
};

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function normalizeWorkerId(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!UUID_REGEX.test(trimmed)) return null;
  return trimmed;
}

function detectRestViolations(assignments: PlanAssignment[]) {
  const byWorker = new Map<
    string,
    Map<string, { day: boolean; night: boolean }>
  >();

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

function mapPlan(row: PlanRow, assignments: AssignmentRow[]): Plan {
  const mappedAssignments: PlanAssignment[] = assignments.map((assignment) => ({
    date: assignment.date,
    shiftType: assignment.shift_type,
    workerId: assignment.worker_id,
    note: assignment.note,
  }));

  return {
    id: row.id,
    patientId: row.patient_id,
    month: row.month,
    year: row.year,
    prompt: row.prompt,
    summary: row.summary,
    status: (row.status as Plan["status"]) ?? "saved",
    assignments: mappedAssignments,
    createdAt: row.created_at,
  };
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const patientId = url.searchParams.get("patientId");
    const mode = url.searchParams.get("mode");
    const monthParam = url.searchParams.get("month");
    const yearParam = url.searchParams.get("year");
    const excludePatientId = url.searchParams.get("excludePatientId");

    const supabase = createServiceSupabaseClient();

    if (mode === "available" && patientId) {
      const { data, error } = await supabase
        .from("plans")
        .select("month, year, patient_id")
        .eq("patient_id", patientId)
        .order("year", { ascending: false })
        .order("month", { ascending: false });

      if (error) throw error;

      return NextResponse.json({
        data:
          data?.map((item) => ({
            patientId: item.patient_id,
            month: item.month,
            year: item.year,
          })) ?? [],
      });
    }

    if (mode === "busy") {
      const month = Number(monthParam);
      const year = Number(yearParam);

      if (Number.isNaN(month) || Number.isNaN(year)) {
        return NextResponse.json(
          { error: "month i year su obavezni parametri." },
          { status: 400 }
        );
      }

      const { data, error } = await supabase
        .from("plan_assignments")
        .select("date, shift_type, worker_id, plans!inner(patient_id, month, year)")
        .not("worker_id", "is", null)
        .eq("plans.month", month)
        .eq("plans.year", year)
        .order("date", { ascending: true });

      if (error) throw error;

      const rows = (data ?? []) as BusyAssignmentRow[];
      const filtered =
        excludePatientId && excludePatientId.length > 0
          ? rows.filter((row) => row.plans.patient_id !== excludePatientId)
          : rows;

      const busy = filtered.map((row) => ({
        date: row.date,
        shiftType: row.shift_type as "day" | "night",
        workerId: row.worker_id as string,
        patientId: row.plans.patient_id,
      }));

      return NextResponse.json({ data: busy });
    }

    const month = Number(monthParam);
    const year = Number(yearParam);

    if (!patientId || Number.isNaN(month) || Number.isNaN(year)) {
      return NextResponse.json(
        { error: "patientId, month i year su obavezni parametri." },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from("plans")
      .select("*, plan_assignments (*)")
      .eq("patient_id", patientId)
      .eq("month", month)
      .eq("year", year)
      .maybeSingle();

    if (error) throw error;

    if (!data) {
      return NextResponse.json({ data: null });
    }

    const planData = data as PlanRowWithAssignments;
    const assignments = planData.plan_assignments ?? [];
    return NextResponse.json({ data: mapPlan(planData, assignments) });
  } catch (error) {
    console.error("GET /api/plans error", error);
    return NextResponse.json(
      { error: "Greška pri čitanju plana." },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const payload = await request.json();
    const patientId = String(payload.patientId ?? "").trim();
    const month = Number(payload.month);
    const year = Number(payload.year);
    const assignmentsRaw = Array.isArray(payload.assignments)
      ? (payload.assignments as PlanAssignment[])
      : [];
    const prompt = payload.prompt ? String(payload.prompt) : null;
    const summary = payload.summary ? String(payload.summary) : null;
    const assignments = assignmentsRaw.map((assignment) => ({
      ...assignment,
      workerId: normalizeWorkerId(assignment.workerId),
    }));

    if (!patientId || Number.isNaN(month) || Number.isNaN(year)) {
      return NextResponse.json(
        { error: "patientId, month i year su obavezni." },
        { status: 400 }
      );
    }

    const supabase = createServiceSupabaseClient();

    const assignmentsToCheck = assignments.filter(
      (assignment) => assignment.workerId !== null && assignment.workerId !== undefined
    );

    if (assignmentsToCheck.length > 0) {
      const workerIds = Array.from(new Set(assignmentsToCheck.map((assignment) => assignment.workerId as string)));

      const { data: busyRows, error: busyError } = await supabase
        .from("plan_assignments")
        .select("date, shift_type, worker_id, plans!inner(patient_id, month, year)")
        .in("worker_id", workerIds)
        .not("worker_id", "is", null)
        .eq("plans.month", month)
        .eq("plans.year", year)
        .neq("plans.patient_id", patientId);

      if (busyError) throw busyError;

      const busyAssignments: PlanAssignment[] =
        (busyRows ?? []).map((row) => ({
          date: row.date,
          shiftType: row.shift_type as ShiftType,
          workerId: row.worker_id,
          note: null,
        })) ?? [];

      const conflicting = busyAssignments.filter((busy) =>
        assignmentsToCheck.some(
          (assignment) =>
            assignment.workerId === busy.workerId &&
            assignment.date === busy.date &&
            assignment.shiftType === busy.shiftType
        )
      );

      if (conflicting.length > 0) {
        return NextResponse.json(
          { error: "Neki radnici su već zauzeti na drugim planovima za iste datume/smjene." },
          { status: 409 }
        );
      }

      const restViolation = detectRestViolations([...assignments, ...busyAssignments]);
      if (restViolation) {
        const { workerId, date, nextDate, reason } = restViolation;
        const message =
          reason === "same-day"
            ? `Radnik ${workerId} ne može imati dnevnu i noćnu smjenu istog dana (${date}).`
            : `Radnik ${workerId} ne može raditi noć ${date} i dnevnu ${nextDate ?? "sljedećeg dana"} (12h odmora).`;
        return NextResponse.json({ error: message }, { status: 400 });
      }
    } else {
      const restViolation = detectRestViolations(assignments);
      if (restViolation) {
        const { workerId, date, nextDate, reason } = restViolation;
        const message =
          reason === "same-day"
            ? `Radnik ${workerId} ne može imati dnevnu i noćnu smjenu istog dana (${date}).`
            : `Radnik ${workerId} ne može raditi noć ${date} i dnevnu ${nextDate ?? "sljedećeg dana"} (12h odmora).`;
        return NextResponse.json({ error: message }, { status: 400 });
      }
    }

    const { data: existing } = await supabase
      .from("plans")
      .select("id")
      .eq("patient_id", patientId)
      .eq("month", month)
      .eq("year", year)
      .maybeSingle();

    if (existing?.id) {
      await supabase.from("plan_assignments").delete().eq("plan_id", existing.id);
      await supabase.from("plans").delete().eq("id", existing.id);
    }

    const { data: inserted, error: insertError } = await supabase
      .from("plans")
      .insert({
        patient_id: patientId,
        month,
        year,
        prompt,
        summary,
        status: "saved",
      })
      .select()
      .single();

    if (insertError) throw insertError;
    if (!inserted) throw new Error("Insert returned empty result.");

    const planId = inserted.id;

    const assignmentRows = assignments.map((assignment) => ({
      plan_id: planId,
      date: assignment.date,
      shift_type: assignment.shiftType,
      worker_id: assignment.workerId ?? null,
      note: assignment.note ?? null,
    }));

    if (assignmentRows.length > 0) {
      const { error: assignError } = await supabase
        .from("plan_assignments")
        .insert(assignmentRows);
      if (assignError) {
        await supabase.from("plans").delete().eq("id", planId);
        if (assignError.code === "23505") {
          return NextResponse.json(
            { error: "Radnik je već zauzet na drugom planu za taj datum/smjenu." },
            { status: 409 }
          );
        }
        throw assignError;
      }
    }

    const responsePlan = mapPlan(inserted as PlanRow, assignmentRows as AssignmentRow[]);

    return NextResponse.json({ data: responsePlan });
  } catch (error) {
    console.error("POST /api/plans error", error);
    return NextResponse.json(
      { error: "Greška pri snimanju plana." },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const url = new URL(request.url);
    const patientId = url.searchParams.get("patientId");
    const monthParam = url.searchParams.get("month");
    const yearParam = url.searchParams.get("year");

    const month = Number(monthParam);
    const year = Number(yearParam);

    if (!patientId || Number.isNaN(month) || Number.isNaN(year)) {
      return NextResponse.json(
        { error: "patientId, month i year su obavezni parametri za brisanje." },
        { status: 400 }
      );
    }

    const supabase = createServiceSupabaseClient();

    const { data: existing, error: fetchError } = await supabase
      .from("plans")
      .select("id")
      .eq("patient_id", patientId)
      .eq("month", month)
      .eq("year", year)
      .maybeSingle();

    if (fetchError) throw fetchError;

    if (!existing) {
      return NextResponse.json({ data: null });
    }

    const { error: deleteError } = await supabase
      .from("plans")
      .delete()
      .eq("id", existing.id);

    if (deleteError) throw deleteError;

    return NextResponse.json({ data: { success: true } });
  } catch (error) {
    console.error("DELETE /api/plans error", error);
    return NextResponse.json(
      { error: "Greška pri brisanju plana." },
      { status: 500 }
    );
  }
}
