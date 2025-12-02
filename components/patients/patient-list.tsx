/* Patient list with translated labels */
"use client";

import Link from "next/link";
import { Eye, Pencil, Trash2 } from "lucide-react";
import type { Patient } from "@/types";
import { Card } from "../ui/card";
import { useTranslations } from "../i18n/language-provider";

const actionButtonStyles =
  "inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 transition hover:-translate-y-[1px] hover:border-slate-300 hover:bg-slate-50";

export function PatientList({ patients }: { patients: Patient[] }) {
  const { t } = useTranslations();

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
        <div className="grid grid-cols-[minmax(0,1.5fr)_auto] items-center px-5 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
          <span>{t("patients.list.name")}</span>
          <span className="text-right">{t("patients.list.actions")}</span>
        </div>

        {patients.map((patient) => (
          <div
            key={patient.id}
            className="grid grid-cols-[minmax(0,1.5fr)_auto] items-center gap-3 px-5 py-3 transition hover:bg-slate-50/70"
          >
            <p className="text-base font-semibold text-slate-900">{patient.name}</p>
            <div className="flex justify-end gap-2">
              <Link
                href={`/patients/${patient.id}`}
                className={actionButtonStyles}
                aria-label={t("patients.list.viewAria", { name: patient.name })}
              >
                <Eye className="h-4 w-4" />
                {t("patients.list.view")}
              </Link>
              <Link
                href={`/patients/${patient.id}/edit`}
                className={actionButtonStyles}
                aria-label={t("patients.list.editAria", { name: patient.name })}
              >
                <Pencil className="h-4 w-4" />
                {t("patients.list.edit")}
              </Link>
              <button
                type="button"
                className={actionButtonStyles}
                aria-label={t("patients.list.deleteAria", { name: patient.name })}
              >
                <Trash2 className="h-4 w-4" />
                {t("patients.list.delete")}
              </button>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
