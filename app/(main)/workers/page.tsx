"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { WorkerList } from "@/components/workers/worker-list";
import { Plus, X } from "lucide-react";
import { workers as mockWorkers } from "@/lib/mock-data";
import { useTranslations } from "@/components/i18n/language-provider";
import type { ShiftType, Worker, WorkerStatus } from "@/types";

type NewWorkerForm = {
  name: string;
  role: string;
  city: string;
  status: WorkerStatus;
  preferredShifts: ShiftType[];
  hoursPlanned: string;
  hoursCompleted: string;
};

const shiftOptions: ShiftType[] = ["day", "night"];
const statusOptions: WorkerStatus[] = ["radnik", "pocetnik", "anerkennung"];

const createEmptyForm = (): NewWorkerForm => ({
  name: "",
  role: "",
  city: "",
  status: "radnik",
  preferredShifts: ["day"],
  hoursPlanned: "",
  hoursCompleted: "",
});

export default function WorkersPage() {
  const { t } = useTranslations();
  const [workersState, setWorkersState] = useState<Worker[]>(() => mockWorkers);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [form, setForm] = useState<NewWorkerForm>(createEmptyForm);

  const resetForm = () => setForm(createEmptyForm());
  const openModal = () => {
    resetForm();
    setIsModalOpen(true);
  };
  const closeModal = () => {
    resetForm();
    setIsModalOpen(false);
  };

  const toggleShift = (shift: ShiftType) => {
    setForm((prev) => {
      const hasShift = prev.preferredShifts.includes(shift);
      const nextShifts = hasShift
        ? prev.preferredShifts.filter((item) => item !== shift)
        : [...prev.preferredShifts, shift];
      return { ...prev, preferredShifts: nextShifts };
    });
  };

  const isSaveDisabled =
    !form.name.trim() || !form.role.trim() || !form.city.trim();

  const handleSave = () => {
    if (isSaveDisabled) return;
    const newWorker: Worker = {
      id: `w-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      name: form.name.trim(),
      role: form.role.trim(),
      city: form.city.trim(),
      status: form.status,
      preferredShifts:
        form.preferredShifts.length > 0 ? form.preferredShifts : ["day"],
      hoursPlanned: Number(form.hoursPlanned) || 0,
      hoursCompleted: Number(form.hoursCompleted) || 0,
    };

    setWorkersState((prev) => [newWorker, ...prev]);
    closeModal();
  };

  const statusLabels = {
    radnik: t("planner.worker.status.radnik"),
    pocetnik: t("planner.worker.status.pocetnik"),
    anerkennung: t("planner.worker.status.anerkennung"),
  };

  return (
    <div className="flex flex-col gap-5">
      <Card className="border border-slate-200 px-5 py-6">
        <div className="flex flex-wrap items-start gap-4">
          <div className="flex-1">
            <p className="text-xs uppercase tracking-[0.2em] text-slate-500">
              {t("workers.title")}
            </p>
            <h1 className="text-xl font-semibold text-slate-900">
              {t("workers.subtitle")}
            </h1>
            <p className="mt-2 text-sm text-slate-600">{t("workers.description")}</p>
          </div>
          <button
            type="button"
            onClick={openModal}
            className="inline-flex items-center gap-2 rounded-xl bg-slate-900/90 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:-translate-y-[1px] hover:shadow"
          >
            <Plus className="h-4 w-4" />
            {t("workers.add")}
          </button>
        </div>
      </Card>

      <WorkerList workers={workersState} />

      {isModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 px-4 py-6"
        >
          <Card className="relative w-full max-w-2xl space-y-6 p-6">
            <button
              type="button"
              onClick={closeModal}
              aria-label={t("workers.modal.cancel")}
              className="absolute right-4 top-4 inline-flex h-9 w-9 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-500 shadow-sm transition hover:border-slate-300 hover:text-slate-700"
            >
              <X className="h-4 w-4" />
            </button>

            <div className="space-y-2 pt-2">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-500">
                {t("workers.modal.title")}
              </p>
              <h2 className="text-xl font-semibold text-slate-900">
                {t("workers.modal.subtitle")}
              </h2>
            </div>

            <form
              className="space-y-4"
              onSubmit={(event) => {
                event.preventDefault();
                handleSave();
              }}
            >
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="space-y-1 text-xs uppercase tracking-[0.18em] text-slate-500">
                  <span>{t("workers.modal.nameLabel")}</span>
                  <input
                    value={form.name}
                    placeholder={t("workers.modal.namePlaceholder")}
                    onChange={(event) =>
                      setForm((prev) => ({ ...prev, name: event.target.value }))
                    }
                    className="w-full rounded-2xl border border-border/70 bg-slate-50 px-3 py-2 text-sm text-slate-900 outline-none focus:border-sky-200"
                  />
                </label>
                <label className="space-y-1 text-xs uppercase tracking-[0.18em] text-slate-500">
                  <span>{t("workers.modal.roleLabel")}</span>
                  <input
                    value={form.role}
                    placeholder={t("workers.modal.rolePlaceholder")}
                    onChange={(event) =>
                      setForm((prev) => ({ ...prev, role: event.target.value }))
                    }
                    className="w-full rounded-2xl border border-border/70 bg-slate-50 px-3 py-2 text-sm text-slate-900 outline-none focus:border-sky-200"
                  />
                </label>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="space-y-1 text-xs uppercase tracking-[0.18em] text-slate-500">
                  <span>{t("workers.modal.cityLabel")}</span>
                  <input
                    value={form.city}
                    placeholder={t("workers.modal.cityPlaceholder")}
                    onChange={(event) =>
                      setForm((prev) => ({ ...prev, city: event.target.value }))
                    }
                    className="w-full rounded-2xl border border-border/70 bg-slate-50 px-3 py-2 text-sm text-slate-900 outline-none focus:border-sky-200"
                  />
                </label>
                <label className="space-y-1 text-xs uppercase tracking-[0.18em] text-slate-500">
                  <span>{t("workers.modal.statusLabel")}</span>
                  <select
                    value={form.status}
                    onChange={(event) =>
                      setForm((prev) => ({
                        ...prev,
                        status: event.target.value as WorkerStatus,
                      }))
                    }
                    className="w-full rounded-2xl border border-border/70 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-sky-200"
                  >
                    {statusOptions.map((status) => (
                      <option key={status} value={status}>
                        {statusLabels[status]}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="space-y-1 text-xs uppercase tracking-[0.18em] text-slate-500">
                <span>{t("workers.modal.preferredShiftsLabel")}</span>
                <div className="flex flex-wrap gap-2">
                  {shiftOptions.map((shift) => {
                    const isActive = form.preferredShifts.includes(shift);
                    return (
                      <button
                        key={shift}
                        type="button"
                        onClick={() => toggleShift(shift)}
                        className={`inline-flex items-center gap-2 rounded-2xl border px-3 py-2 text-sm font-semibold transition ${
                          isActive
                            ? "border-slate-900 bg-slate-900 text-white"
                            : "border-border/70 bg-white text-slate-700 hover:border-slate-300"
                        }`}
                      >
                        {shift === "day"
                          ? t("workers.modal.preferredShiftsDay")
                          : t("workers.modal.preferredShiftsNight")}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="space-y-1 text-xs uppercase tracking-[0.18em] text-slate-500">
                  <span>{t("workers.modal.hoursPlannedLabel")}</span>
                  <input
                    value={form.hoursPlanned}
                    onChange={(event) =>
                      setForm((prev) => ({
                        ...prev,
                        hoursPlanned: event.target.value,
                      }))
                    }
                    type="number"
                    min={0}
                    className="w-full rounded-2xl border border-border/70 bg-slate-50 px-3 py-2 text-sm text-slate-900 outline-none focus:border-sky-200"
                  />
                </label>
                <label className="space-y-1 text-xs uppercase tracking-[0.18em] text-slate-500">
                  <span>{t("workers.modal.hoursCompletedLabel")}</span>
                  <input
                    value={form.hoursCompleted}
                    onChange={(event) =>
                      setForm((prev) => ({
                        ...prev,
                        hoursCompleted: event.target.value,
                      }))
                    }
                    type="number"
                    min={0}
                    className="w-full rounded-2xl border border-border/70 bg-slate-50 px-3 py-2 text-sm text-slate-900 outline-none focus:border-sky-200"
                  />
                </label>
              </div>

              <div className="flex flex-wrap gap-3">
                <button
                  type="submit"
                  disabled={isSaveDisabled}
                  className="inline-flex items-center gap-2 rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white shadow transition hover:-translate-y-[1px] hover:shadow-sm disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {t("workers.modal.save")}
                </button>
                <button
                  type="button"
                  onClick={closeModal}
                  className="inline-flex items-center rounded-2xl border border-border/70 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:border-slate-400 hover:text-slate-900"
                >
                  {t("workers.modal.cancel")}
                </button>
              </div>
            </form>
          </Card>
        </div>
      )}
    </div>
  );
}
