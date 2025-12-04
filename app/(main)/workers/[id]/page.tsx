import { notFound } from "next/navigation";
import { createServiceSupabaseClient } from "@/lib/supabase/server";
import { WorkerDetailView } from "@/components/workers/worker-detail-view";
import type { Worker } from "@/types";

async function fetchWorker(id: string): Promise<Worker | null> {
  const supabase = createServiceSupabaseClient();
  const { data, error } = await supabase.from("workers").select("*").eq("id", id).maybeSingle();
  if (error) {
    console.error("Error loading worker", error);
    return null;
  }
  if (!data) return null;
  return {
    id: data.id,
    name: data.name,
    role: data.role ?? undefined,
    city: data.city,
    status: data.status,
    preferredShifts: data.preferred_shifts ?? ["day", "night"],
    hoursPlanned: data.hours_planned ?? 0,
    hoursCompleted: data.hours_completed ?? 0,
    createdAt: data.created_at,
  };
}

export default async function WorkerDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const worker = await fetchWorker(params.id);

  if (!worker) {
    return notFound();
  }

  return (
    <WorkerDetailView worker={worker} workerShifts={[]} patients={[]} />
  );
}
