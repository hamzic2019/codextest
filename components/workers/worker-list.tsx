"use client";

import Link from "next/link";
import { Eye, Pencil, Trash2 } from "lucide-react";
import type { Worker } from "@/types";
import { Card } from "../ui/card";
import { useTranslations } from "../i18n/language-provider";

const actionButtonStyles =
  "inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 transition hover:-translate-y-[1px] hover:border-slate-300 hover:bg-slate-50";

export function WorkerList({
  workers,
  isLoading,
  error,
}: {
  workers: Worker[];
  isLoading?: boolean;
  error?: string | null;
}) {
  const { t } = useTranslations();

  const isEmpty = !isLoading && !error && workers.length === 0;

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
        <div className="grid grid-cols-[minmax(0,1.5fr)_auto] items-center px-5 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
          <span>{t("workers.list.name")}</span>
          <span className="text-right">{t("workers.list.actions")}</span>
        </div>

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

        {workers.map((worker) => (
          <div
            key={worker.id}
            className="grid grid-cols-[minmax(0,1.5fr)_auto] items-center gap-3 px-5 py-3 transition hover:bg-slate-50/70"
          >
            <p className="text-base font-semibold text-slate-900">{worker.name}</p>
            <div className="flex justify-end gap-2">
              <Link
                href={`/workers/${worker.id}`}
                className={actionButtonStyles}
                aria-label={t("workers.list.viewAria", { name: worker.name })}
              >
                <Eye className="h-4 w-4" />
                {t("workers.list.view")}
              </Link>
              <Link
                href={`/workers/${worker.id}?mode=edit`}
                className={actionButtonStyles}
                aria-label={t("workers.list.editAria", { name: worker.name })}
              >
                <Pencil className="h-4 w-4" />
                {t("workers.list.edit")}
              </Link>
              <button
                type="button"
                className={actionButtonStyles}
                aria-label={t("workers.list.deleteAria", { name: worker.name })}
              >
                <Trash2 className="h-4 w-4" />
                {t("workers.list.delete")}
              </button>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
