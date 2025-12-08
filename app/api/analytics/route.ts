import { NextResponse } from "next/server";
import { createServiceSupabaseClient } from "@/lib/supabase/server";
import type { ShiftType } from "@/types";

// Fixed duration assumptions for analytics summaries.
const DAY_SHIFT_HOURS = 8;
const NIGHT_SHIFT_HOURS = 10;

type AnalyticsRow = {
  date: string;
  shift_type: ShiftType;
  worker_id: string | null;
  plans: {
    patient_id: string;
    month: number;
    year: number;
  } | null;
};

function getWeekOfMonth(dateString: string) {
  const date = new Date(dateString);
  const dayOfMonth = date.getDate();
  return Math.floor((dayOfMonth - 1) / 7) + 1;
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const workerId = url.searchParams.get("workerId");
    const month = Number(url.searchParams.get("month"));
    const year = Number(url.searchParams.get("year"));

    if (!workerId || Number.isNaN(month) || Number.isNaN(year)) {
      return NextResponse.json(
        { error: "workerId, month i year su obavezni parametri." },
        { status: 400 }
      );
    }

    const supabase = createServiceSupabaseClient();
    const { data, error } = await supabase
      .from("plan_assignments")
      .select("date, shift_type, worker_id, plans!inner(month, year, patient_id)")
      .eq("worker_id", workerId)
      .eq("plans.month", month)
      .eq("plans.year", year)
      .order("date", { ascending: true });

    if (error) throw error;

    const assignments =
      (data as AnalyticsRow[] | null | undefined)?.map((row) => ({
        date: row.date,
        shiftType: row.shift_type,
        patientId: row.plans?.patient_id ?? null,
      })) ?? [];

    const dayShifts = assignments.filter((item) => item.shiftType === "day").length;
    const nightShifts = assignments.length - dayShifts;
    const dayHours = dayShifts * DAY_SHIFT_HOURS;
    const nightHours = nightShifts * NIGHT_SHIFT_HOURS;
    const totalHours = dayHours + nightHours;
    const totalShifts = assignments.length;

    const weeksMap = new Map<
      number,
      {
        dayShifts: number;
        nightShifts: number;
      }
    >();

    assignments.forEach((assignment) => {
      const week = getWeekOfMonth(assignment.date);
      const current = weeksMap.get(week) ?? { dayShifts: 0, nightShifts: 0 };
      if (assignment.shiftType === "day") {
        current.dayShifts += 1;
      } else {
        current.nightShifts += 1;
      }
      weeksMap.set(week, current);
    });

    const weeks = Array.from(weeksMap.entries())
      .sort(([a], [b]) => a - b)
      .map(([weekOfMonth, value]) => ({
        weekOfMonth,
        ...value,
        totalShifts: value.dayShifts + value.nightShifts,
      }));

    const patientIds = Array.from(
      new Set(assignments.map((assignment) => assignment.patientId).filter(Boolean))
    ) as string[];

    const averageHoursPerShift =
      totalShifts > 0 ? Number((totalHours / totalShifts).toFixed(1)) : 0;

    return NextResponse.json({
      data: {
        totals: {
          totalShifts,
          dayShifts,
          nightShifts,
          totalHours,
          dayHours,
          nightHours,
          averageHoursPerShift,
        },
        weeks,
        assignments,
        patientIds,
      },
    });
  } catch (error) {
    console.error("GET /api/analytics error", error);
    return NextResponse.json(
      { error: "Greška pri izračunu analitike." },
      { status: 500 }
    );
  }
}
