"use client";

import Link from "next/link";
import { Clock3, MoveLeft, Moon, Sun } from "lucide-react";
import type { Patient, Shift, Worker } from "@/types";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { SectionHeader } from "@/components/ui/section-header";
import { useTranslations } from "@/components/i18n/language-provider";

function statusBadgeVariant(status: Worker["status"]) {
  if (status === "anerkennung") return "amber" as const;
  if (status === "pocetnik") return "slate" as const;
  return "emerald" as const;
}

export function WorkerDetailView({
  worker,
  workerShifts,
  patients,
}: {
  worker: Worker;
  workerShifts: Shift[];
  patients: Patient[];
}) {
  const { t } = useTranslations();
  const backLabel = t("common.backTo", { target: t("nav.workers") });
  const statusLabels = {
    radnik: t("planner.worker.status.radnik"),
    pocetnik: t("planner.worker.status.pocetnik"),
    anerkennung: t("planner.worker.status.anerkennung"),
  };

  return (
    <div className="flex flex-col gap-5">
      <Link
        href="/workers"
        className="inline-flex w-fit items-center gap-2 rounded-xl border border-border/70 bg-white px-3 py-2 text-sm font-semibold text-slate-800 transition hover:-translate-y-[1px] hover:border-sky-200 hover:bg-slate-50"
        aria-label={backLabel}
      >
        <MoveLeft className="h-4 w-4" />
        {backLabel}
      </Link>

      <Card className="border-sky-100 bg-gradient-to-r from-white via-sky-50 to-emerald-50">
        <div className="flex flex-wrap items-center gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-slate-500">
              {t("workerDetail.label")}
            </p>
            <h1 className="text-xl font-semibold text-slate-900">{worker.name}</h1>
            <p className="text-sm text-slate-600">{worker.role}</p>
          </div>
          <div className="ml-auto flex flex-wrap gap-2 text-sm text-slate-600">
            <Badge variant={statusBadgeVariant(worker.status)}>
              {statusLabels[worker.status] ?? worker.status}
            </Badge>
            <Badge variant="sky">{worker.city}</Badge>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-slate-700">
          <span className="inline-flex items-center gap-2 rounded-xl bg-white px-3 py-2 text-slate-800 shadow-inner shadow-slate-100">
            <Clock3 className="h-4 w-4 text-emerald-600" />
            {t("workerDetail.planned", { hours: worker.hoursPlanned })}
          </span>
          <span className="inline-flex items-center gap-2 rounded-xl bg-slate-100 px-3 py-2 text-slate-800">
            {t("workerDetail.completed", { hours: worker.hoursCompleted })}
          </span>
          {worker.preferredShifts.includes("day") ? (
            <span className="inline-flex items-center gap-2 rounded-xl bg-sky-50 px-3 py-2 text-sky-700">
              <Sun className="h-4 w-4" />
              {t("workerDetail.shift.day")}
            </span>
          ) : null}
          {worker.preferredShifts.includes("night") ? (
            <span className="inline-flex items-center gap-2 rounded-xl bg-slate-900/90 px-3 py-2 text-white">
              <Moon className="h-4 w-4" />
              {t("workerDetail.shift.night")}
            </span>
          ) : null}
        </div>
      </Card>

      <SectionHeader
        title={t("workerDetail.activeShifts")}
        subtitle={t("workerDetail.shiftsSubtitle")}
      />
      <Card className="space-y-2">
        {workerShifts.length === 0 ? (
          <p className="text-sm text-slate-600">{t("workerDetail.noShifts")}</p>
        ) : (
          workerShifts.map((shift) => {
            const patient = patients.find((p) => p.id === shift.patientId);
            return (
              <div
                key={shift.id}
                className="flex flex-wrap items-center gap-3 rounded-2xl border border-border/70 bg-white/80 px-4 py-3"
              >
                <Badge variant={shift.type === "day" ? "sky" : "slate"}>
                  {shift.type === "day"
                    ? t("patientDetail.shift.day")
                    : t("patientDetail.shift.night")}
                </Badge>
                <p className="text-sm font-semibold text-slate-900">{shift.date}</p>
                <p className="text-sm text-slate-600">
                  {shift.start} - {shift.end}
                </p>
                <Badge variant="emerald">{patient?.name}</Badge>
              </div>
            );
          })
        )}
      </Card>
    </div>
  );
}
