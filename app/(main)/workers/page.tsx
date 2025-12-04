"use client";

import { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { WorkerList } from "@/components/workers/worker-list";
import { Plus, Sparkles, X } from "lucide-react";
import { useTranslations } from "@/components/i18n/language-provider";
import type { Worker, WorkerStatus } from "@/types";

type WorkerForm = {
  name: string;
  city: string;
  status: WorkerStatus;
  hoursPlanned: string;
};

const statusOptions: WorkerStatus[] = [
  "radnik",
  "anarbeitung",
  "student",
  "externi",
  "pocetnik",
  "anerkennung",
];

const createEmptyForm = (): WorkerForm => ({
  name: "",
  city: "",
  status: "radnik",
  hoursPlanned: "",
});

const formFromWorker = (worker: Worker): WorkerForm => ({
  name: worker.name ?? "",
  city: worker.city ?? "",
  status: worker.status ?? "radnik",
  hoursPlanned: String(worker.hoursPlanned ?? 0),
});

export default function WorkersPage() {
  const { t } = useTranslations();
  const [workersState, setWorkersState] = useState<Worker[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [form, setForm] = useState<WorkerForm>(createEmptyForm);
  const [selectedWorker, setSelectedWorker] = useState<Worker | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [modalError, setModalError] = useState<string | null>(null);

  const statusLabels = useMemo(
    () => ({
      radnik: t("planner.worker.status.radnik"),
      anarbeitung: t("planner.worker.status.anarbeitung"),
      student: t("planner.worker.status.student"),
      externi: t("planner.worker.status.externi"),
      pocetnik: t("planner.worker.status.pocetnik"),
      anerkennung: t("planner.worker.status.anerkennung"),
    }),
    [t]
  );

  const fetchWorkers = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/workers");
      if (!response.ok) {
        throw new Error(await response.text());
      }
      const json = await response.json();
      setWorkersState(json.data ?? []);
    } catch (err) {
      console.error(err);
      setError(t("workers.error"));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchWorkers();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const modalTitle = useMemo(() => {
    if (!selectedWorker) return t("workers.modal.title");
    if (isEditing) return t("workers.modal.editTitle");
    return t("workers.modal.viewTitle");
  }, [isEditing, selectedWorker, t]);

  const modalSubtitle = useMemo(() => {
    if (!selectedWorker) return t("workers.modal.subtitle");
    if (isEditing) return t("workers.modal.editSubtitle");
    return t("workers.modal.viewSubtitle");
  }, [isEditing, selectedWorker, t]);

  const openCreateModal = () => {
    setSelectedWorker(null);
    setForm(createEmptyForm());
    setModalError(null);
    setDeleteConfirm(false);
    setIsEditing(true);
    setIsModalOpen(true);
  };

  const openViewModal = (worker: Worker) => {
    setSelectedWorker(worker);
    setForm(formFromWorker(worker));
    setModalError(null);
    setDeleteConfirm(false);
    setIsEditing(false);
    setIsModalOpen(true);
  };

  const openEditModal = (worker: Worker) => {
    setSelectedWorker(worker);
    setForm(formFromWorker(worker));
    setModalError(null);
    setDeleteConfirm(false);
    setIsEditing(true);
    setIsModalOpen(true);
  };

  const openDeletePrompt = (worker: Worker) => {
    setSelectedWorker(worker);
    setForm(formFromWorker(worker));
    setModalError(null);
    setDeleteConfirm(true);
    setIsEditing(false);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setSelectedWorker(null);
    setForm(createEmptyForm());
    setIsEditing(false);
    setDeleteConfirm(false);
    setModalError(null);
    setIsModalOpen(false);
  };

  const isSaveDisabled =
    !form.name.trim() ||
    !form.city.trim() ||
    form.hoursPlanned.trim() === "" ||
    Number.isNaN(Number(form.hoursPlanned)) ||
    isSaving;

  const handleSave = async () => {
    if (isSaveDisabled) return;
    setModalError(null);
    setIsSaving(true);

    const payload = {
      name: form.name.trim(),
      city: form.city.trim(),
      status: form.status,
      hoursPlanned: Number(form.hoursPlanned) || 0,
    };

    try {
      const method = selectedWorker ? "PUT" : "POST";
      const endpoint = selectedWorker ? `/api/workers/${selectedWorker.id}` : "/api/workers";
      const response = await fetch(endpoint, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(await response.text());
      }

      const json = await response.json();
      const saved: Worker = json.data;

      if (selectedWorker) {
        setWorkersState((prev) => prev.map((item) => (item.id === saved.id ? saved : item)));
      } else {
        setWorkersState((prev) => [saved, ...prev]);
      }

      setSelectedWorker(saved);
      setIsEditing(false);
      setDeleteConfirm(false);
    } catch (err) {
      console.error(err);
      setModalError(t("workers.saveError"));
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedWorker) return;
    setModalError(null);
    if (!deleteConfirm) {
      setDeleteConfirm(true);
      return;
    }
    setIsDeleting(true);
    try {
      const response = await fetch(`/api/workers/${selectedWorker.id}`, {
        method: "DELETE",
      });
      if (!response.ok) throw new Error(await response.text());
      setWorkersState((prev) => prev.filter((item) => item.id !== selectedWorker.id));
      closeModal();
    } catch (err) {
      console.error(err);
      setModalError(t("workers.deleteError"));
    } finally {
      setIsDeleting(false);
      setDeleteConfirm(false);
    }
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
            onClick={openCreateModal}
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-sky-500 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:-translate-y-[1px] hover:shadow"
          >
            <Plus className="h-4 w-4" />
            {t("workers.add")}
          </button>
        </div>
      </Card>

      <WorkerList
        workers={workersState}
        isLoading={isLoading}
        error={error}
        onView={openViewModal}
        onEdit={openEditModal}
        onDelete={openDeletePrompt}
      />

      {isModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 px-4 py-6"
        >
          <Card className="relative w-full max-w-4xl space-y-6 border border-slate-100/70 bg-white/95 p-6 shadow-[0_30px_80px_rgba(15,23,42,0.28)] backdrop-blur">
            <button
              type="button"
              onClick={closeModal}
              aria-label={t("workers.modal.cancel")}
              className="absolute right-4 top-4 inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-500 shadow-sm transition hover:border-slate-300 hover:text-slate-700"
            >
              <X className="h-4 w-4" />
            </button>

            <div className="grid gap-6 md:grid-cols-[1.05fr_1fr]">
              <div className="space-y-3 rounded-2xl border border-slate-100 bg-gradient-to-br from-emerald-50 via-white to-sky-50 p-5 shadow-inner shadow-slate-100">
                <p className="text-[11px] uppercase tracking-[0.22em] text-slate-500">
                  {modalTitle}
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-2xl font-semibold text-slate-900">
                    {form.name || t("workers.modal.namePlaceholder")}
                  </h2>
                  <Badge variant="emerald">
                    {statusLabels[form.status] ?? form.status}
                  </Badge>
                  <Badge variant="sky">{form.city || t("workers.modal.cityPlaceholder")}</Badge>
                </div>
                <p className="text-sm text-slate-600">{modalSubtitle}</p>

                <div className="space-y-2 rounded-2xl bg-white/70 p-4 shadow-sm shadow-slate-100">
                  <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.2em] text-slate-500">
                    <Sparkles className="h-3.5 w-3.5 text-emerald-500" />
                    {t("workers.modal.hoursPlannedLabel")}
                  </div>
                  <p className="text-lg font-semibold text-slate-900">
                    {Number(form.hoursPlanned) || 0}h
                  </p>
                  <p className="text-sm text-slate-600">
                    {t("workers.modal.hoursPlannedHelper")}
                  </p>
                </div>
              </div>

              <form
                className="space-y-4"
                onSubmit={(event) => {
                  event.preventDefault();
                  if (isEditing) handleSave();
                }}
              >
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="space-y-1 text-[11px] uppercase tracking-[0.18em] text-slate-500">
                    <span>{t("workers.modal.nameLabel")}</span>
                    <input
                      value={form.name}
                      placeholder={t("workers.modal.namePlaceholder")}
                      onChange={(event) =>
                        setForm((prev) => ({ ...prev, name: event.target.value }))
                      }
                      readOnly={!isEditing}
                      className={`w-full rounded-2xl border px-3 py-2 text-sm text-slate-900 outline-none transition ${
                        isEditing
                          ? "border-border/70 bg-white focus:border-emerald-200 focus:ring-2 focus:ring-emerald-50"
                          : "border-slate-100 bg-slate-50 text-slate-700"
                      }`}
                    />
                  </label>
                  <label className="space-y-1 text-[11px] uppercase tracking-[0.18em] text-slate-500">
                    <span>{t("workers.modal.cityLabel")}</span>
                    <input
                      value={form.city}
                      placeholder={t("workers.modal.cityPlaceholder")}
                      onChange={(event) =>
                        setForm((prev) => ({ ...prev, city: event.target.value }))
                      }
                      readOnly={!isEditing}
                      className={`w-full rounded-2xl border px-3 py-2 text-sm text-slate-900 outline-none transition ${
                        isEditing
                          ? "border-border/70 bg-white focus:border-emerald-200 focus:ring-2 focus:ring-emerald-50"
                          : "border-slate-100 bg-slate-50 text-slate-700"
                      }`}
                    />
                  </label>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="space-y-1 text-[11px] uppercase tracking-[0.18em] text-slate-500">
                    <span>{t("workers.modal.statusLabel")}</span>
                    <select
                      value={form.status}
                      onChange={(event) =>
                        setForm((prev) => ({
                          ...prev,
                          status: event.target.value as WorkerStatus,
                        }))
                      }
                      disabled={!isEditing}
                      className={`w-full rounded-2xl border px-3 py-2 text-sm text-slate-900 outline-none transition ${
                        isEditing
                          ? "border-border/70 bg-white focus:border-emerald-200 focus:ring-2 focus:ring-emerald-50"
                          : "border-slate-100 bg-slate-50 text-slate-700"
                      }`}
                    >
                      {statusOptions.map((status) => (
                        <option key={status} value={status}>
                          {statusLabels[status] ?? status}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="space-y-1 text-[11px] uppercase tracking-[0.18em] text-slate-500">
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
                      readOnly={!isEditing}
                      className={`w-full rounded-2xl border px-3 py-2 text-sm text-slate-900 outline-none transition ${
                        isEditing
                          ? "border-border/70 bg-white focus:border-emerald-200 focus:ring-2 focus:ring-emerald-50"
                          : "border-slate-100 bg-slate-50 text-slate-700"
                      }`}
                    />
                  </label>
                </div>

                {modalError ? (
                  <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">
                    {modalError}
                  </div>
                ) : null}

                <div className="flex flex-wrap gap-3">
                  {isEditing ? (
                    <>
                      <button
                        type="submit"
                        disabled={isSaveDisabled}
                        className="inline-flex items-center gap-2 rounded-2xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white shadow transition hover:-translate-y-[1px] hover:shadow-sm disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {isSaving
                          ? t("workers.modal.saving")
                          : selectedWorker
                            ? t("workers.modal.update")
                            : t("workers.modal.save")}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (selectedWorker) {
                            setIsEditing(false);
                            setForm(formFromWorker(selectedWorker));
                          } else {
                            closeModal();
                          }
                        }}
                        className="inline-flex items-center rounded-2xl border border-border/70 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:border-slate-400 hover:text-slate-900"
                      >
                        {t("workers.modal.cancel")}
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setIsEditing(true)}
                      className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-800 transition hover:-translate-y-[1px] hover:border-emerald-200 hover:bg-emerald-50"
                    >
                      {t("workers.list.edit")}
                    </button>
                  )}

                  {selectedWorker ? (
                    <button
                      type="button"
                      onClick={handleDelete}
                      disabled={isDeleting}
                      className={`inline-flex items-center gap-2 rounded-2xl border px-4 py-3 text-sm font-semibold transition ${
                        deleteConfirm
                          ? "border-red-300 bg-red-50 text-red-700"
                          : "border-red-200 bg-white text-red-700 hover:border-red-300 hover:bg-red-50"
                      } disabled:cursor-not-allowed disabled:opacity-60`}
                    >
                      {isDeleting
                        ? t("workers.modal.deleting")
                        : deleteConfirm
                          ? t("workers.modal.confirmDelete")
                          : t("workers.list.delete")}
                    </button>
                  ) : null}
                </div>
                {deleteConfirm ? (
                  <p className="text-sm font-semibold text-red-600">
                    {t("workers.modal.deleteHint")}
                  </p>
                ) : null}
              </form>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
