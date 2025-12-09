import { NextResponse } from "next/server";
import { createServiceSupabaseClient } from "@/lib/supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import type { Patient } from "@/types";

function mapPatient(row: {
  id: string;
  name: string;
  city: string;
  level: string;
  notes: string | null;
  created_at: string;
}): Patient {
  return {
    id: row.id,
    name: row.name,
    city: row.city,
    level: row.level,
    notes: row.notes,
    createdAt: row.created_at,
  };
}

export async function GET() {
  try {
    const supabase = createServiceSupabaseClient() as SupabaseClient<Database>;
    const { data, error } = await supabase
      .from("patients")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) throw error;

    return NextResponse.json({ data: data?.map(mapPatient) ?? [] });
  } catch (error) {
    console.error("GET /api/patients error", error);
    return NextResponse.json(
      { error: "Greška pri čitanju pacijenata." },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
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

    const supabase = createServiceSupabaseClient() as SupabaseClient<Database>;
    const { data, error } = await (supabase.from("patients") as any)
      .insert({ name, city, level, notes })
      .select()
      .single();

    if (error) throw error;
    if (!data) throw new Error("Insert returned empty result.");

    return NextResponse.json({ data: mapPatient(data) });
  } catch (error) {
    console.error("POST /api/patients error", error);
    return NextResponse.json(
      { error: "Greška pri snimanju pacijenta." },
      { status: 500 }
    );
  }
}
