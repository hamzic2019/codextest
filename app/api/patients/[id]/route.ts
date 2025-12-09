import { NextResponse } from "next/server";
import { createServiceSupabaseClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/types";
import type { Patient } from "@/types";

type PatientRow = Database["public"]["Tables"]["patients"]["Row"];
type PatientUpdate = Database["public"]["Tables"]["patients"]["Update"];

function mapPatient(row: PatientRow): Patient {
  return {
    id: row.id,
    name: row.name,
    city: row.city,
    level: row.level,
    notes: row.notes,
    createdAt: row.created_at,
  };
}

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const { id } = await context.params;
  try {
    const supabase = createServiceSupabaseClient();
    const { data, error } = await (supabase.from("patients") as any)
      .select("id, name, city, level, notes, created_at")
      .eq("id", id)
      .maybeSingle();

    if (error) throw error;
    if (!data) {
      return NextResponse.json({ error: "Pacijent nije pronađen." }, { status: 404 });
    }

    return NextResponse.json({ data: mapPatient(data) });
  } catch (error) {
    console.error(`GET /api/patients/${id} error`, error);
    return NextResponse.json(
      { error: "Greška pri čitanju pacijenta." },
      { status: 500 }
    );
  }
}

export async function PUT(request: Request, context: RouteContext) {
  const { id } = await context.params;
  try {
    const payload = await request.json();
    const name = String(payload.name ?? "").trim();
    const city = String(payload.city ?? "").trim();
    const level = String(payload.level ?? "").trim() || "Pflegegrad 3";
    const notes = payload.notes ? String(payload.notes) : null;

    if (!name || !city) {
      return NextResponse.json(
        { error: "Ime i grad su obavezni." },
        { status: 400 }
      );
    }

    const supabase = createServiceSupabaseClient();
    const updatePayload: PatientUpdate = { name, city, level, notes };
    const { data, error } = await (supabase.from("patients") as any)
      .update(updatePayload)
      .eq("id", id)
      .select()
      .maybeSingle();

    if (error) throw error;
    if (!data) {
      return NextResponse.json({ error: "Pacijent nije pronađen." }, { status: 404 });
    }

    return NextResponse.json({ data: mapPatient(data as PatientRow) });
  } catch (error) {
    console.error(`PUT /api/patients/${id} error`, error);
    return NextResponse.json(
      { error: "Greška pri izmjeni pacijenta." },
      { status: 500 }
    );
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  const { id } = await context.params;
  try {
    const supabase = createServiceSupabaseClient();
    const { error } = await supabase.from("patients").delete().eq("id", id);

    if (error) throw error;

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("DELETE /api/patients/:id error", error);
    return NextResponse.json(
      { error: "Greška pri brisanju pacijenta." },
      { status: 500 }
    );
  }
}
