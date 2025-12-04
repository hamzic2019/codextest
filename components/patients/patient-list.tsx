"use client";

import { Eye, MapPin, Pencil, ShieldHalf, StickyNote, Trash2 } from "lucide-react";
import type { Patient } from "@/types";
import { Card } from "../ui/card";
import { Badge } from "../ui/badge";
import { useTranslations } from "../i18n/language-provider";

const actionButtonStyles =
  "inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 transition hover:-translate-y-[1px] hover:border-slate-300 hover:bg-slate-50";

export function PatientList({
  patients,
  isLoading,
  error,
  onView,
  onEdit,
  onDelete,
}: {
  patients: Patient[];
  isLoading?: boolean;
  error?: string | null;
  onView: (patient: Patient) => void;
  onEdit: (patient: Patient) => void;
  onDelete: (patient: Patient) => void;
}) {
  const { t } = useTranslations();

  const isEmpty = !isLoading && !error && patients.length === 0;

  return (
    <Card className="p-0">
      <div className="flex items-center justify-between border-b border-border/60 px-5 py-4">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-slate-500">
            {t("patients.list.title")}
          </p>
          <p className="text-sm text-slate-500">{t("patients.list.subtitle")}</p>
        </div>
      </div>

      <div className="divide-y divide-border/60">
        {isLoading ? (
          <div className="px-5 py-6 text-sm text-slate-600">
            {t("patients.list.loading")}
          </div>
        ) : null}

        {error ? (
          <div className="px-5 py-6 text-sm font-semibold text-red-600">{error}</div>
        ) : null}

        {isEmpty ? (
          <div className="px-5 py-6 text-sm text-slate-600">
            {t("patients.list.empty")}
          </div>
        ) : null}

        <div className="grid gap-2 p-4">
          {patients.map((patient) => (
            <div
              key={patient.id}
              className="group rounded-2xl border border-border/60 bg-white/80 p-4 shadow-sm transition hover:-translate-y-[1px] hover:border-sky-200 hover:shadow-md"
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <div className="flex-1 space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-base font-semibold text-slate-900">
                      {patient.name}
                    </p>
                    <Badge variant="sky" className="inline-flex items-center gap-1">
                      <MapPin className="h-3.5 w-3.5" />
                      {patient.city || t("patients.modal.cityPlaceholder")}
                    </Badge>
                    <Badge variant="emerald" className="inline-flex items-center gap-1">
                      <ShieldHalf className="h-3.5 w-3.5" />
                      {patient.level || "Pflegegrad 3"}
                    </Badge>
                  </div>
                  {patient.notes ? (
                    <p className="inline-flex items-start gap-2 rounded-xl bg-slate-50 px-3 py-2 text-sm text-slate-700">
                      <StickyNote className="mt-[2px] h-4 w-4 text-slate-400" />
                      <span className="line-clamp-2">{patient.notes}</span>
                    </p>
                  ) : null}
                </div>
                <div className="flex flex-wrap justify-start gap-2 sm:justify-end">
                  <button
                    type="button"
                    className={actionButtonStyles}
                    onClick={() => onView(patient)}
                    aria-label={t("patients.list.viewAria", { name: patient.name })}
                  >
                    <Eye className="h-4 w-4" />
                    {t("patients.list.view")}
                  </button>
                  <button
                    type="button"
                    className={actionButtonStyles}
                    onClick={() => onEdit(patient)}
                    aria-label={t("patients.list.editAria", { name: patient.name })}
                  >
                    <Pencil className="h-4 w-4" />
                    {t("patients.list.edit")}
                  </button>
                  <button
                    type="button"
                    className={`${actionButtonStyles} border-red-200 text-red-700 hover:border-red-300 hover:bg-red-50`}
                    onClick={() => onDelete(patient)}
                    aria-label={t("patients.list.deleteAria", { name: patient.name })}
                  >
                    <Trash2 className="h-4 w-4" />
                    {t("patients.list.delete")}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
}
