import { notFound } from "next/navigation";
import { workers, shifts, patients } from "@/lib/mock-data";
import { WorkerDetailView } from "@/components/workers/worker-detail-view";

export default function WorkerDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const worker = workers.find((w) => w.id === params.id);

  if (!worker) {
    return notFound();
  }

  const workerShifts = shifts.filter((shift) => shift.workerId === worker.id);

  return (
    <WorkerDetailView worker={worker} workerShifts={workerShifts} patients={patients} />
  );
}
