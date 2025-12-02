import { notFound } from "next/navigation";
import { planPreviews, patients, shifts, workers } from "@/lib/mock-data";
import { PatientDetailView } from "@/components/patients/patient-detail-view";

export default function PatientDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const patient = patients.find((p) => p.id === params.id);

  if (!patient) {
    return notFound();
  }

  const patientShifts = shifts.filter((shift) => shift.patientId === patient.id);
  const preview = planPreviews.find((p) => p.patientId === patient.id);

  return (
    <PatientDetailView
      patient={patient}
      patientShifts={patientShifts}
      preview={preview}
      workers={workers}
    />
  );
}
