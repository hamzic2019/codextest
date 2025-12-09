import { notFound } from "next/navigation";
import { createServiceSupabaseClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/types";
import { PatientDetailView } from "@/components/patients/patient-detail-view";
import type { Patient } from "@/types";

type PatientRow = Database["public"]["Tables"]["patients"]["Row"];

async function fetchPatient(id: string): Promise<Patient | null> {
  const supabase = createServiceSupabaseClient();
  const { data, error } = await supabase
    .from("patients")
    .select("id, name, city, level, notes, created_at")
    .eq("id", id)
    .maybeSingle<PatientRow>();
  if (error) {
    console.error("Error loading patient", error);
    return null;
  }
  if (!data) return null;
  return {
    id: data.id,
    name: data.name,
    city: data.city,
    level: data.level,
    notes: data.notes,
    createdAt: data.created_at,
  };
}

export default async function PatientDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const patient = await fetchPatient(params.id);

  if (!patient) {
    return notFound();
  }

  return (
    <PatientDetailView
      patient={patient}
      patientShifts={[]}
      preview={undefined}
      workers={[]}
    />
  );
}
