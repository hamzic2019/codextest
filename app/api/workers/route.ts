import { NextResponse } from "next/server";
import { createServiceSupabaseClient } from "@/lib/supabase/server";
import type { Worker } from "@/types";
import type { ShiftType, WorkerStatus } from "@/types";

function mapWorker(row: {
  id: string;
  name: string;
  role: string;
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
    role: row.role,
    city: row.city,
    status: row.status,
    preferredShifts: row.preferred_shifts ?? [],
    hoursPlanned: row.hours_planned ?? 0,
    hoursCompleted: row.hours_completed ?? 0,
    createdAt: row.created_at,
  };
}

export async function GET() {
  try {
    const supabase = createServiceSupabaseClient();
    const { data, error } = await supabase
      .from("workers")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) throw error;

    return NextResponse.json({ data: data?.map(mapWorker) ?? [] });
  } catch (error) {
    console.error("GET /api/workers error", error);
    return NextResponse.json(
      { error: "Greška pri čitanju radnika." },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const payload = await request.json();
    const name = String(payload.name ?? "").trim();
    const role = String(payload.role ?? "").trim();
    const city = String(payload.city ?? "").trim();
    const status = (payload.status ?? "radnik") as WorkerStatus;
    const preferredShifts = Array.isArray(payload.preferredShifts)
      ? (payload.preferredShifts as ShiftType[])
      : ["day"];
    const hoursPlanned = Number(payload.hoursPlanned) || 0;
    const hoursCompleted = Number(payload.hoursCompleted) || 0;

    if (!name || !role || !city) {
      return NextResponse.json(
        { error: "Ime, uloga i grad su obavezni." },
        { status: 400 }
      );
    }

    const supabase = createServiceSupabaseClient();
    const { data, error } = await supabase
      .from("workers")
      .insert({
        name,
        role,
        city,
        status,
        preferred_shifts: preferredShifts,
        hours_planned: hoursPlanned,
        hours_completed: hoursCompleted,
      })
      .select()
      .single();

    if (error) throw error;
    if (!data) throw new Error("Insert returned empty result.");

    return NextResponse.json({ data: mapWorker(data) });
  } catch (error) {
    console.error("POST /api/workers error", error);
    return NextResponse.json(
      { error: "Greška pri snimanju radnika." },
      { status: 500 }
    );
  }
}
