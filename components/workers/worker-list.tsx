"use client";

import { Clock3, Eye, MapPin, Pencil, ShieldHalf, Trash2 } from "lucide-react";
import type { Worker } from "@/types";
import { Card } from "../ui/card";
import { Badge } from "../ui/badge";
import { useTranslations } from "../i18n/language-provider";

const actionButtonStyles =
  "inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 transition hover:-translate-y-[1px] hover:border-slate-300 hover:bg-slate-50";

export function WorkerList({
  workers,
  isLoading,
  error,
  onView,
  onEdit,
  onDelete,
}: {
  workers: Worker[];
  isLoading?: boolean;
  error?: string | null;
  onView: (worker: Worker) => void;
  onEdit: (worker: Worker) => void;
  onDelete: (worker: Worker) => void;
}) {
  const { t } = useTranslations();

  const isEmpty = !isLoading && !error && workers.length === 0;
  const statusLabels = {
    radnik: t("planner.worker.status.radnik"),
    anarbeitung: t("planner.worker.status.anarbeitung"),
    student: t("planner.worker.status.student"),
    externi: t("planner.worker.status.externi"),
    pocetnik: t("planner.worker.status.pocetnik"),
    anerkennung: t("planner.worker.status.anerkennung"),
  };

  return (
    <Card className="p-0">
      <div className="flex items-center justify-between border-b border-border/60 px-5 py-4">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-slate-500">
            {t("workers.list.title")}
          </p>
          <p className="text-sm text-slate-500">{t("workers.list.subtitle")}</p>
        </div>
      </div>

      <div className="divide-y divide-border/60">
        {isLoading ? (
          <div className="px-5 py-6 text-sm text-slate-600">
            {t("workers.list.loading")}
          </div>
        ) : null}

        {error ? (
          <div className="px-5 py-6 text-sm font-semibold text-red-600">{error}</div>
        ) : null}

        {isEmpty ? (
          <div className="px-5 py-6 text-sm text-slate-600">{t("workers.list.empty")}</div>
        ) : null}

        <div className="grid gap-2 p-4">
          {workers.map((worker) => (
            <div
              key={worker.id}
              className="group rounded-2xl border border-border/60 bg-white/80 p-4 shadow-sm transition hover:-translate-y-[1px] hover:border-emerald-200 hover:shadow-md"
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <div className="flex-1 space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-base font-semibold text-slate-900">
                      {worker.name}
                    </p>
                    <Badge variant="emerald" className="inline-flex items-center gap-1">
                      <ShieldHalf className="h-3.5 w-3.5" />
                      {statusLabels[worker.status] ?? worker.status}
                    </Badge>
                    <Badge variant="sky" className="inline-flex items-center gap-1">
                      <MapPin className="h-3.5 w-3.5" />
                      {worker.city}
                    </Badge>
                  </div>
                  <div className="inline-flex items-center gap-2 rounded-xl bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-700">
                    <Clock3 className="h-4 w-4 text-emerald-500" />
                    {t("workerDetail.planned", { hours: worker.hoursPlanned ?? 0 })}
                  </div>
                </div>
                <div className="flex flex-wrap justify-start gap-2 sm:justify-end">
                  <button
                    type="button"
                    className={actionButtonStyles}
                    onClick={() => onView(worker)}
                    aria-label={t("workers.list.viewAria", { name: worker.name })}
                  >
                    <Eye className="h-4 w-4" />
                    {t("workers.list.view")}
                  </button>
                  <button
                    type="button"
                    className={actionButtonStyles}
                    onClick={() => onEdit(worker)}
                    aria-label={t("workers.list.editAria", { name: worker.name })}
                  >
                    <Pencil className="h-4 w-4" />
                    {t("workers.list.edit")}
                  </button>
                  <button
                    type="button"
                    className={`${actionButtonStyles} border-red-200 text-red-700 hover:border-red-300 hover:bg-red-50`}
                    onClick={() => onDelete(worker)}
                    aria-label={t("workers.list.deleteAria", { name: worker.name })}
                  >
                    <Trash2 className="h-4 w-4" />
                    {t("workers.list.delete")}
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
