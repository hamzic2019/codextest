"use client";

import { useMemo, useState } from "react";
import { ChevronsUpDown, HeartPulse } from "lucide-react";

import type { Patient } from "@/types";
import { patients } from "@/lib/mock-data";
import { Badge } from "../ui/badge";
import { Card } from "../ui/card";
import { useTranslations } from "../i18n/language-provider";

function initials(name: string) {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export function PatientSelector({
  value,
  onChange,
  data = patients,
}: {
  value: string;
  onChange: (patientId: string) => void;
  data?: Patient[];
}) {
  const [open, setOpen] = useState(false);
  const { t } = useTranslations();

  const activePatient = useMemo(
    () => data.find((patient) => patient.id === value),
    [data, value]
  );

  const handleSelect = (patientId: string) => {
    onChange(patientId);
    setOpen(false);
  };

  return (
    <div className="relative w-full space-y-2">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="group relative flex w-full items-center gap-3 overflow-hidden rounded-2xl border border-slate-200/80 bg-gradient-to-br from-white via-white to-slate-50 px-4 py-3 text-left shadow-[0_16px_40px_rgba(15,23,42,0.05)] transition hover:-translate-y-[1px] hover:border-sky-200/70 hover:shadow-[0_22px_60px_rgba(14,165,233,0.14)] focus:outline-none"
      >
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-900 text-white shadow-inner ring-1 ring-slate-900/10">
          <HeartPulse className="h-5 w-5" aria-hidden />
        </div>
        <div className="flex-1">
          <p className="text-[10px] uppercase tracking-[0.22em] text-slate-500">
            {t("planner.patient.label")}
          </p>
          {activePatient ? (
            <div className="flex flex-wrap items-center gap-x-2 text-sm font-semibold text-slate-900">
              <span>{activePatient.name}</span>
              <span className="text-slate-500">·</span>
              <span className="text-slate-700">{activePatient.city}</span>
              <Badge
                variant="sky"
                className="ml-2 rounded-full bg-sky-50 text-[11px] font-semibold text-sky-800"
              >
                {activePatient.level}
              </Badge>
            </div>
          ) : (
            <p className="text-sm font-semibold text-slate-700">
              {t("planner.patient.placeholder")}
            </p>
          )}
        </div>
        <div className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-gradient-to-br from-slate-50 to-white text-slate-600 shadow-inner transition group-hover:border-sky-200 group-hover:text-sky-700">
          <ChevronsUpDown className="h-4 w-4" aria-hidden />
        </div>
      </button>

      {open && (
        <Card className="absolute left-0 right-0 z-20 mt-2 space-y-1 border border-slate-200/70 bg-white/95 p-2 shadow-[0_20px_55px_rgba(15,23,42,0.16)] backdrop-blur">
          {data.map((patient) => (
            <button
              key={patient.id}
              type="button"
              onClick={() => handleSelect(patient.id)}
              className={`flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-200 ${
                patient.id === value
                  ? "bg-sky-50/80 text-sky-900 shadow-[0_12px_24px_rgba(14,165,233,0.18)] ring-1 ring-sky-100"
                  : "text-slate-800 hover:bg-slate-50"
              }`}
            >
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-900 text-xs font-bold text-white">
                {initials(patient.name)}
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold">{patient.name}</p>
                <p className="text-xs text-slate-500">{patient.city}</p>
              </div>
              <Badge
                variant="sky"
                className="rounded-full bg-sky-50 text-[11px] font-semibold text-sky-800 ring-1 ring-sky-100"
              >
                {patient.level}
              </Badge>
            </button>
          ))}
        </Card>
      )}
    </div>
  );
}
