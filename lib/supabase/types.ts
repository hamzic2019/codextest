import type { ShiftType, WorkerStatus } from "@/types";

export type Database = {
  public: {
    Tables: {
      patients: {
        Row: {
          id: string;
          name: string;
          city: string;
          level: string;
          notes: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          city: string;
          level?: string;
          notes?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          city?: string;
          level?: string;
          notes?: string | null;
          created_at?: string;
        };
      };
      workers: {
        Row: {
          id: string;
          name: string;
          role: string;
          city: string;
          status: WorkerStatus;
          preferred_shifts: ShiftType[];
          hours_planned: number;
          hours_completed: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          role?: string | null;
          city: string;
          status: WorkerStatus;
          preferred_shifts?: ShiftType[];
          hours_planned?: number;
          hours_completed?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          role?: string | null;
          city?: string;
          status?: WorkerStatus;
          preferred_shifts?: ShiftType[];
          hours_planned?: number;
          hours_completed?: number;
          created_at?: string;
        };
      };
      plans: {
        Row: {
          id: string;
          patient_id: string;
          month: number;
          year: number;
          prompt: string | null;
          summary: string | null;
          status: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          patient_id: string;
          month: number;
          year: number;
          prompt?: string | null;
          summary?: string | null;
          status?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          patient_id?: string;
          month?: number;
          year?: number;
          prompt?: string | null;
          summary?: string | null;
          status?: string;
          created_at?: string;
        };
      };
      plan_assignments: {
        Row: {
          id: string;
          plan_id: string;
          date: string;
          shift_type: ShiftType;
          worker_id: string | null;
          note: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          plan_id: string;
          date: string;
          shift_type: ShiftType;
          worker_id?: string | null;
          note?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          plan_id?: string;
          date?: string;
          shift_type?: ShiftType;
          worker_id?: string | null;
          note?: string | null;
          created_at?: string;
        };
      };
    };
  };
};
