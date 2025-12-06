import { NextResponse } from "next/server";
import { createServiceSupabaseClient } from "@/lib/supabase/server";
import type { Plan, PlanAssignment } from "@/types";

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
    const assignments = Array.isArray(payload.assignments)
      ? (payload.assignments as PlanAssignment[])
      : [];
    const prompt = payload.prompt ? String(payload.prompt) : null;
    const summary = payload.summary ? String(payload.summary) : null;

    if (!patientId || Number.isNaN(month) || Number.isNaN(year)) {
      return NextResponse.json(
        { error: "patientId, month i year su obavezni." },
        { status: 400 }
      );
    }

    const supabase = createServiceSupabaseClient();

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
      if (assignError) throw assignError;
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
