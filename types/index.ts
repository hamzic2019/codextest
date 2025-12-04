export type ShiftType = "day" | "night";

export type WorkerStatus = "radnik" | "anerkennung" | "pocetnik";

export type Patient = {
  id: string;
  name: string;
  city: string;
  level: string;
  notes?: string | null;
  createdAt?: string;
  needs?: string[];
  tags?: string[];
  lastUpdate?: string;
};

export type Worker = {
  id: string;
  name: string;
  role: string;
  city: string;
  status: WorkerStatus;
  preferredShifts: ShiftType[];
  hoursPlanned: number;
  hoursCompleted: number;
  createdAt?: string;
};

export type PlanStatus = "draft" | "saved";

export type PlanAssignment = {
  date: string; // YYYY-MM-DD
  shiftType: ShiftType;
  workerId: string | null;
  note?: string | null;
};

export type Shift = {
  id: string;
  patientId: string;
  workerId: string;
  date: string;
  type: ShiftType;
  start: string;
  end: string;
  note?: string;
};

export type Plan = {
  id: string;
  patientId: string;
  month: number; // 1-12
  year: number;
  prompt?: string | null;
  summary?: string | null;
  status: PlanStatus;
  assignments: PlanAssignment[];
  createdAt?: string;
};

export type WorkerPreference = {
  workerId: string;
  allowDay: boolean;
  allowNight: boolean;
  ratio: number;
  days: number;
  priority: boolean;
  spreadAcrossPatients?: boolean;
};

export type GeneratedPlan = {
  assignments: PlanAssignment[];
  summary?: string | null;
};

export type PlanPreview = {
  patientId?: string;
  month?: string;
  summary?: string | null;
  highlights: string[];
};
