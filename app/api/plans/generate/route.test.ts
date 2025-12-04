import { describe, expect, it } from "vitest";
import { buildSchedule, getShiftHours, normalizeTargets, sanitizePreferences } from "./route";
import type { PlanAssignment, WorkerPreference } from "@/types";

const baseYear = 2024;
const baseMonth = 5; // May

function withHours(preferences: WorkerPreference[], daysInMonth: number) {
  return sanitizePreferences(preferences, daysInMonth).map((pref) => ({
    ...pref,
    hoursPlanned: 0,
    hoursCompleted: 0,
  }));
}

describe("planner normalizeTargets", () => {
  it("distributes day/night hours to available shift hours", () => {
    const daysInMonth = 30;
    const normalized = normalizeTargets(
      withHours(
        [
          { workerId: "a", allowDay: true, allowNight: true, days: 10, ratio: 60, priority: false },
          { workerId: "b", allowDay: true, allowNight: true, days: 10, ratio: 40, priority: false },
        ],
        daysInMonth
      ),
      daysInMonth
    );

    const totalDay = normalized.reduce((sum, pref) => sum + pref.targetDayHours, 0);
    const totalNight = normalized.reduce((sum, pref) => sum + pref.targetNightHours, 0);
    expect(totalDay).toBeCloseTo(daysInMonth * getShiftHours("day"), 1);
    expect(totalNight).toBeCloseTo(daysInMonth * getShiftHours("night"), 1);
  });
});

describe("planner buildSchedule", () => {
  const daysInMonth = 6;

  it("blocks only the busy shift, not the full day", () => {
    const normalized = normalizeTargets(
      withHours(
        [
          { workerId: "a", allowDay: true, allowNight: true, days: 5, ratio: 60, priority: false },
          { workerId: "b", allowDay: true, allowNight: true, days: 5, ratio: 40, priority: false },
        ],
        daysInMonth
      ),
      daysInMonth
    );

    const busyAssignments: PlanAssignment[] = [
      { date: "2024-05-01", shiftType: "day", workerId: "a", note: null },
    ];

    const { assignments } = buildSchedule(
      normalized,
      [],
      busyAssignments,
      baseYear,
      baseMonth - 1,
      daysInMonth,
      1
    );

    const dayOne = assignments.find(
      (item) => item.date === "2024-05-01" && item.shiftType === "day"
    );
    const nightOne = assignments.find(
      (item) => item.date === "2024-05-01" && item.shiftType === "night"
    );

    expect(dayOne?.workerId).not.toBe("a");
    expect(nightOne?.workerId).toBeDefined();
  });

  it("respects day/night quotas with tolerance", () => {
    const normalized = normalizeTargets(
      withHours(
        [
          { workerId: "a", allowDay: true, allowNight: true, days: 8, ratio: 80, priority: false },
          { workerId: "b", allowDay: true, allowNight: true, days: 8, ratio: 20, priority: false },
        ],
        daysInMonth
      ),
      daysInMonth
    );

    const { stateById } = buildSchedule(
      normalized,
      [],
      [],
      baseYear,
      baseMonth - 1,
      daysInMonth,
      1
    );

    const tolerance = Number(process.env.PLAN_SHIFT_TOLERANCE ?? 1);
    normalized.forEach((pref) => {
      const state = stateById.get(pref.workerId);
      expect(state).toBeDefined();
      if (!state) return;
      expect(state.assignedDayShifts).toBeLessThanOrEqual(pref.targetDayShifts + tolerance);
      expect(state.assignedNightShifts).toBeLessThanOrEqual(pref.targetNightShifts + tolerance);
    });
  });

  it("caps spreadAcrossPatients hours and leaves room for others", () => {
    const normalized = normalizeTargets(
      withHours(
        [
          {
            workerId: "a",
            allowDay: true,
            allowNight: true,
            days: 12,
            ratio: 50,
            priority: false,
            spreadAcrossPatients: true,
          },
          { workerId: "b", allowDay: true, allowNight: true, days: 6, ratio: 50, priority: false },
        ],
        daysInMonth
      ),
      daysInMonth
    );

    const { stateById } = buildSchedule(
      normalized,
      [],
      [],
      baseYear,
      baseMonth - 1,
      daysInMonth,
      1
    );

    const workerA = normalized.find((pref) => pref.workerId === "a")!;
    const stateA = stateById.get("a")!;
    expect(stateA.assignedHours + stateA.baseHours).toBeLessThanOrEqual(
      workerA.maxPatientHours + getShiftHours("day")
    );
  });
});
