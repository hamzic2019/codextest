"use client";

import Link from "next/link";
import { CalendarClock, FileChartLine, MoveLeft } from "lucide-react";
import type { Patient, PlanPreview, Shift, Worker } from "@/types";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { SectionHeader } from "@/components/ui/section-header";
import { useTranslations } from "@/components/i18n/language-provider";

export function PatientDetailView({
  patient,
  patientShifts,
  preview,
  workers,
}: {
  patient: Patient;
  patientShifts: Shift[];
  preview?: PlanPreview;
  workers: Worker[];
}) {
  const { t } = useTranslations();
  const backLabel = t("common.backTo", { target: t("nav.patients") });

  return (
    <div className="flex flex-col gap-5">
      <Link
        href="/patients"
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
              {t("patientDetail.label")}
            </p>
            <h1 className="text-xl font-semibold text-slate-900">{patient.name}</h1>
            <p className="text-sm text-slate-600">
              {patient.level} · {patient.city}
            </p>
          </div>
          <div className="ml-auto flex flex-wrap gap-2 text-sm text-slate-600">
            {patient.tags.map((tag) => (
              <Badge key={tag} variant="emerald">
                {tag}
              </Badge>
            ))}
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-2 text-sm text-slate-700">
          {patient.needs.map((need) => (
            <span
              key={need}
              className="rounded-xl bg-white px-3 py-2 text-slate-800 shadow-inner shadow-slate-100"
            >
              {need}
            </span>
          ))}
        </div>
      </Card>

      <SectionHeader
        title={t("patientDetail.activeShifts")}
        subtitle={t("patientDetail.shiftsSubtitle")}
      />
      <Card className="space-y-2">
        {patientShifts.length === 0 ? (
          <p className="text-sm text-slate-600">{t("patientDetail.noShifts")}</p>
        ) : (
          patientShifts.map((shift) => {
            const worker = workers.find((w) => w.id === shift.workerId);
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
                <Badge variant="emerald">{worker?.name}</Badge>
                {shift.note ? (
                  <span className="text-xs text-slate-500">{shift.note}</span>
                ) : null}
              </div>
            );
          })
        )}
      </Card>

      <SectionHeader
        title={t("patientDetail.planTitle")}
        subtitle={t("patientDetail.planSubtitle")}
      />
      <Card className="border border-sky-100 bg-white/90 shadow-inner shadow-sky-50">
        <div className="flex items-center gap-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-500/10 text-sky-600">
            <CalendarClock className="h-4 w-4" />
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-slate-500">
              {preview?.month ?? t("patientDetail.planMissing")}
            </p>
            <p className="text-sm text-slate-600">
              {preview?.summary ?? t("patientDetail.planHint")}
            </p>
          </div>
        </div>
        {preview ? (
          <ul className="mt-3 space-y-2 text-sm text-slate-700">
            {preview.highlights.map((item) => (
              <li
                key={item}
                className="flex items-start gap-2 rounded-xl bg-slate-50 px-3 py-2"
              >
                <span className="mt-1 h-2 w-2 rounded-full bg-emerald-500" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        ) : null}
        <Link
          href="/planner"
          className="mt-4 inline-flex w-fit items-center gap-2 rounded-xl bg-gradient-to-r from-sky-500 to-emerald-500 px-4 py-2 text-sm font-semibold text-white transition hover:-translate-y-[1px]"
        >
          <FileChartLine className="h-4 w-4" />
          {t("patientDetail.openPlanner")}
        </Link>
      </Card>
    </div>
  );
}
