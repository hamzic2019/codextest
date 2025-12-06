import { NextResponse } from "next/server";
import { createServiceSupabaseClient } from "@/lib/supabase/server";
import type { Worker } from "@/types";
import type { ShiftType, WorkerStatus } from "@/types";

const allowedStatuses: WorkerStatus[] = [
  "radnik",
  "anarbeitung",
  "student",
  "externi",
  "pocetnik",
  "anerkennung",
];

function normalizeStatus(status: WorkerStatus): WorkerStatus {
  return allowedStatuses.includes(status) ? status : "radnik";
}

function mapWorker(row: {
  id: string;
  name: string;
  role: string | null;
  city: string;
  status: WorkerStatus;
  preferred_shifts: ShiftType[];
  hours_planned: number;
  hours_completed: number;
  created_at: string;
}): Worker {
  return {
    id: row.id,
    name: row.name,
    role: row.role ?? "—",
    city: row.city,
    status: normalizeStatus(row.status),
    preferredShifts:
      row.preferred_shifts && row.preferred_shifts.length > 0
        ? row.preferred_shifts
        : ["day", "night"],
    hoursPlanned: row.hours_planned ?? 0,
    hoursCompleted: row.hours_completed ?? 0,
    createdAt: row.created_at,
  };
}

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const supabase = createServiceSupabaseClient();
    const { data, error } = await supabase
      .from("workers")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (error) throw error;
    if (!data) {
      return NextResponse.json({ error: "Radnik nije pronađen." }, { status: 404 });
    }

    return NextResponse.json({ data: mapWorker(data) });
  } catch (error) {
    console.error("GET /api/workers/:id error", error);
    return NextResponse.json(
      { error: "Greška pri čitanju radnika." },
      { status: 500 }
    );
  }
}

export async function PUT(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const payload = await request.json();
    const name = String(payload.name ?? "").trim();
    const city = String(payload.city ?? "").trim();
    const status = normalizeStatus(String(payload.status ?? "").trim() as WorkerStatus);
    const role = String(payload.role ?? "").trim() || status;
    const preferredShifts = Array.isArray(payload.preferredShifts)
      ? (payload.preferredShifts as ShiftType[])
      : ["day", "night"];
    const hoursPlanned = Number(payload.hoursPlanned);
    const hoursCompleted = Number(payload.hoursCompleted);

    if (!name || !city) {
      return NextResponse.json(
        { error: "Ime i grad su obavezni." },
        { status: 400 }
      );
    }

    const supabase = createServiceSupabaseClient();
    const { data, error } = await supabase
      .from("workers")
      .update({
        name,
        city,
        status,
        role,
        preferred_shifts: preferredShifts,
        hours_planned: Number.isNaN(hoursPlanned) ? 0 : hoursPlanned,
        hours_completed: Number.isNaN(hoursCompleted) ? 0 : hoursCompleted,
      })
      .eq("id", id)
      .select()
      .maybeSingle();

    if (error) throw error;
    if (!data) {
      return NextResponse.json({ error: "Radnik nije pronađen." }, { status: 404 });
    }

    return NextResponse.json({ data: mapWorker(data) });
  } catch (error) {
    console.error("PUT /api/workers/:id error", error);
    return NextResponse.json(
      { error: "Greška pri izmjeni radnika." },
      { status: 500 }
    );
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const supabase = createServiceSupabaseClient();
    // Unassign the worker from any plan entries before deleting to avoid FK violations.
    const { error: unassignError } = await supabase
      .from("plan_assignments")
      .update({ worker_id: null })
      .eq("worker_id", id);

    if (unassignError) throw unassignError;

    const { error } = await supabase.from("workers").delete().eq("id", id);

    if (error) throw error;

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("DELETE /api/workers/:id error", error);
    return NextResponse.json(
      { error: "Greška pri brisanju radnika." },
      { status: 500 }
    );
  }
}
