export type ShiftType = "day" | "night";

export type WorkerStatus = "radnik" | "anerkennung" | "pocetnik";

export interface Worker {
  id: string;
  name: string;
  role: string;
  status: WorkerStatus;
  preferredShifts: ShiftType[];
  hoursPlanned: number;
  hoursCompleted: number;
  city: string;
}

export interface Patient {
  id: string;
  name: string;
  city: string;
  level: string;
  needs: string[];
  lastUpdate: string;
  tags: string[];
}

export interface Shift {
  id: string;
  patientId: string;
  workerId: string;
  date: string;
  type: ShiftType;
  start: string;
  end: string;
  note?: string;
}

export interface PlanPreview {
  patientId: string;
  month: string;
  summary: string;
  highlights: string[];
}
