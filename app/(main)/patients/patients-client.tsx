"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { PatientList } from "@/components/patients/patient-list";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, Sparkles, X } from "lucide-react";
import { useTranslations } from "@/components/i18n/language-provider";
import type { Patient } from "@/types";

type PatientForm = {
  name: string;
  city: string;
  level: string;
  notes: string;
};

type PatientListMeta = {
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
};

type PatientsClientProps = {
  initialPatients: Patient[];
  initialMeta: PatientListMeta;
  pageSize: number;
};

const createEmptyForm = (): PatientForm => ({
  name: "",
  city: "",
  level: "Pflegegrad 3",
  notes: "",
});

const formFromPatient = (patient: Patient): PatientForm => ({
  name: patient.name ?? "",
  city: patient.city ?? "",
  level: patient.level ?? "Pflegegrad 3",
  notes: patient.notes ?? "",
});

export function PatientsClient({ initialPatients, initialMeta, pageSize }: PatientsClientProps) {
  const { t } = useTranslations();
  const [patientsState, setPatientsState] = useState<Patient[]>(initialPatients);
  const [meta, setMeta] = useState<PatientListMeta>(initialMeta);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [form, setForm] = useState<PatientForm>(createEmptyForm);
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isPaginating, setIsPaginating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [modalError, setModalError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const hasHydrated = useRef(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search.trim());
    }, 250);
    return () => clearTimeout(timer);
  }, [search]);

  const modalTitle = useMemo(() => {
    if (!selectedPatient) return t("patients.modal.title");
    if (isEditing) return t("patients.modal.editTitle");
    return t("patients.modal.viewTitle");
  }, [isEditing, selectedPatient, t]);

  const modalSubtitle = useMemo(() => {
    if (!selectedPatient) return t("patients.modal.subtitle");
    if (isEditing) return t("patients.modal.editSubtitle");
    return t("patients.modal.viewSubtitle");
  }, [isEditing, selectedPatient, t]);

  const fetchPatientsPage = async ({ offset, append }: { offset: number; append: boolean }) => {
    if (append) {
      setIsPaginating(true);
    } else {
      setIsLoading(true);
    }
    setError(null);
    try {
      const response = await fetch(
        `/api/patients?limit=${pageSize}&offset=${offset}&search=${encodeURIComponent(debouncedSearch)}`
      );
      const json = await response.json();
      if (!response.ok) {
        throw new Error(json.error || "Failed to load patients");
      }
      const incoming: Patient[] = json.data ?? [];
      setPatientsState((prev) => (append ? [...prev, ...incoming] : incoming));

      const nextMeta = json.meta ?? { total: incoming.length, limit: pageSize, offset };
      const total = nextMeta.total ?? incoming.length;
      const hasMore = nextMeta.hasMore ?? offset + incoming.length < total;
      setMeta({
        total,
        limit: nextMeta.limit ?? pageSize,
        offset: nextMeta.offset ?? offset,
        hasMore,
      });
    } catch (err) {
      console.error(err);
      setError(t("patients.error"));
    } finally {
      setIsLoading(false);
      setIsPaginating(false);
    }
  };

  useEffect(() => {
    if (!hasHydrated.current) {
      hasHydrated.current = true;
      return;
    }
    fetchPatientsPage({ offset: 0, append: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch]);

  const openCreateModal = () => {
    setSelectedPatient(null);
    setForm(createEmptyForm());
    setModalError(null);
    setDeleteConfirm(false);
    setIsEditing(true);
    setIsModalOpen(true);
  };

  const openViewModal = (patient: Patient) => {
    setSelectedPatient(patient);
    setForm(formFromPatient(patient));
    setModalError(null);
    setDeleteConfirm(false);
    setIsEditing(false);
    setIsModalOpen(true);
  };

  const openEditModal = (patient: Patient) => {
    setSelectedPatient(patient);
    setForm(formFromPatient(patient));
    setModalError(null);
    setDeleteConfirm(false);
    setIsEditing(true);
    setIsModalOpen(true);
  };

  const openDeletePrompt = (patient: Patient) => {
    setSelectedPatient(patient);
    setForm(formFromPatient(patient));
    setModalError(null);
    setDeleteConfirm(true);
    setIsEditing(false);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setSelectedPatient(null);
    setForm(createEmptyForm());
    setIsEditing(false);
    setDeleteConfirm(false);
    setModalError(null);
    setIsModalOpen(false);
  };

  const isSaveDisabled = !form.name.trim() || !form.city.trim() || isSaving;

  const handleSave = async () => {
    if (isSaveDisabled) return;
    setModalError(null);
    setIsSaving(true);

    const payload = {
      name: form.name.trim(),
      city: form.city.trim(),
      level: form.level.trim() || "Pflegegrad 3",
      notes: form.notes.trim() || null,
    };

    try {
      const method = selectedPatient ? "PUT" : "POST";
      const endpoint = selectedPatient
        ? `/api/patients/${selectedPatient.id}`
        : "/api/patients";
      const response = await fetch(endpoint, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(await response.text());
      }

      const json = await response.json();
      const saved: Patient = json.data;

      if (selectedPatient) {
        setPatientsState((prev) => prev.map((item) => (item.id === saved.id ? saved : item)));
      } else {
        setPatientsState((prev) => [saved, ...prev]);
        setMeta((prev) => {
          const total = (prev?.total ?? prev.limit ?? patientsState.length) + 1;
          const countAfterInsert = patientsState.length + 1;
          return { ...prev, total, hasMore: total > countAfterInsert };
        });
      }

      setSelectedPatient(saved);
      setIsEditing(false);
      setDeleteConfirm(false);
    } catch (err) {
      console.error(err);
      setModalError(t("patients.saveError"));
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedPatient) return;
    setModalError(null);
    if (!deleteConfirm) {
      setDeleteConfirm(true);
      return;
    }
    setIsDeleting(true);
    try {
      const response = await fetch(`/api/patients/${selectedPatient.id}`, {
        method: "DELETE",
      });
      if (!response.ok) throw new Error(await response.text());
      setPatientsState((prev) => prev.filter((item) => item.id !== selectedPatient.id));
      setMeta((prev) => {
        const total = Math.max(0, (prev?.total ?? prev.limit ?? patientsState.length) - 1);
        const remaining = Math.max(0, patientsState.length - 1);
        return { ...prev, total, hasMore: total > remaining };
      });
      closeModal();
    } catch (err) {
      console.error(err);
      setModalError(t("patients.deleteError"));
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
              {t("patients.title")}
            </p>
            <h1 className="text-xl font-semibold text-slate-900">
              {t("patients.subtitle")}
            </h1>
            <p className="mt-2 text-sm text-slate-600">{t("patients.description")}</p>
          </div>
          <button
            type="button"
            onClick={openCreateModal}
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:-translate-y-[1px] hover:shadow"
          >
            <Plus className="h-4 w-4" />
            {t("patients.add")}
          </button>
        </div>
      </Card>

      <PatientList
        patients={patientsState}
        isLoading={isLoading && !isPaginating}
        isSearching={isLoading && !isPaginating}
        isLoadingMore={isPaginating}
        hasMore={meta.hasMore}
        searchValue={search}
        onSearchChange={setSearch}
        error={error}
        onView={openViewModal}
        onEdit={openEditModal}
        onDelete={openDeletePrompt}
        onLoadMore={() => fetchPatientsPage({ offset: patientsState.length, append: true })}
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
              aria-label={t("patients.modal.cancel")}
              className="absolute right-4 top-4 inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-500 shadow-sm transition hover:border-slate-300 hover:text-slate-700"
            >
              <X className="h-4 w-4" />
            </button>

            <div className="grid gap-6 md:grid-cols-[1.05fr_1fr]">
              <div className="space-y-3 rounded-2xl border border-slate-100 bg-gradient-to-br from-sky-50 via-white to-emerald-50 p-5 shadow-inner shadow-slate-100">
                <p className="text-[11px] uppercase tracking-[0.22em] text-slate-500">
                  {modalTitle}
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-2xl font-semibold text-slate-900">
                    {form.name || t("patients.modal.namePlaceholder")}
                  </h2>
                  <Badge variant="sky">
                    {form.city || t("patients.modal.cityPlaceholder")}
                  </Badge>
                  <Badge variant="emerald">{form.level || "Pflegegrad 3"}</Badge>
                </div>
                <p className="text-sm text-slate-600">{modalSubtitle}</p>

                <div className="space-y-2 rounded-2xl bg-white/70 p-4 shadow-sm shadow-slate-100">
                  <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.2em] text-slate-500">
                    <Sparkles className="h-3.5 w-3.5 text-emerald-500" />
                    {t("patients.modal.notesLabel")}
                  </div>
                  <p className="text-sm text-slate-700">
                    {form.notes?.trim()
                      ? form.notes
                      : t("patients.modal.notesPlaceholder")}
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
                    <span>{t("patients.modal.nameLabel")}</span>
                    <input
                      value={form.name}
                      placeholder={t("patients.modal.namePlaceholder")}
                      onChange={(event) =>
                        setForm((prev) => ({ ...prev, name: event.target.value }))
                      }
                      readOnly={!isEditing}
                      className={`w-full rounded-2xl border px-3 py-2 text-sm text-slate-900 outline-none transition ${
                        isEditing
                          ? "border-border/70 bg-white focus:border-sky-200 focus:ring-2 focus:ring-sky-50"
                          : "border-slate-100 bg-slate-50 text-slate-700"
                      }`}
                    />
                  </label>
                  <label className="space-y-1 text-[11px] uppercase tracking-[0.18em] text-slate-500">
                    <span>{t("patients.modal.cityLabel")}</span>
                    <input
                      value={form.city}
                      placeholder={t("patients.modal.cityPlaceholder")}
                      onChange={(event) =>
                        setForm((prev) => ({ ...prev, city: event.target.value }))
                      }
                      readOnly={!isEditing}
                      className={`w-full rounded-2xl border px-3 py-2 text-sm text-slate-900 outline-none transition ${
                        isEditing
                          ? "border-border/70 bg-white focus:border-sky-200 focus:ring-2 focus:ring-sky-50"
                          : "border-slate-100 bg-slate-50 text-slate-700"
                      }`}
                    />
                  </label>
                </div>
                <label className="space-y-1 text-[11px] uppercase tracking-[0.18em] text-slate-500">
                  <span>{t("patients.modal.levelLabel")}</span>
                  <input
                    value={form.level}
                    placeholder={t("patients.modal.levelPlaceholder")}
                    onChange={(event) =>
                      setForm((prev) => ({ ...prev, level: event.target.value }))
                    }
                    readOnly={!isEditing}
                    className={`w-full rounded-2xl border px-3 py-2 text-sm text-slate-900 outline-none transition ${
                      isEditing
                        ? "border-border/70 bg-white focus:border-sky-200 focus:ring-2 focus:ring-sky-50"
                        : "border-slate-100 bg-slate-50 text-slate-700"
                    }`}
                  />
                </label>
                <label className="space-y-1 text-[11px] uppercase tracking-[0.18em] text-slate-500">
                  <span>{t("patients.modal.notesLabel")}</span>
                  <textarea
                    value={form.notes}
                    placeholder={t("patients.modal.notesPlaceholder")}
                    onChange={(event) =>
                      setForm((prev) => ({ ...prev, notes: event.target.value }))
                    }
                    readOnly={!isEditing}
                    rows={4}
                    className={`w-full rounded-2xl border px-3 py-3 text-sm text-slate-900 outline-none transition ${
                      isEditing
                        ? "border-border/70 bg-white focus:border-sky-200 focus:ring-2 focus:ring-sky-50"
                        : "border-slate-100 bg-slate-50 text-slate-700"
                    }`}
                  />
                </label>

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
                        className="inline-flex items-center gap-2 rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white shadow transition hover:-translate-y-[1px] hover:shadow-sm disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {isSaving
                          ? t("patients.modal.saving")
                          : selectedPatient
                            ? t("patients.modal.update")
                            : t("patients.modal.save")}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (selectedPatient) {
                            setIsEditing(false);
                            setForm(formFromPatient(selectedPatient));
                          } else {
                            closeModal();
                          }
                        }}
                        className="inline-flex items-center rounded-2xl border border-border/70 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:border-slate-400 hover:text-slate-900"
                      >
                        {t("patients.modal.cancel")}
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setIsEditing(true)}
                      className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-800 transition hover:-translate-y-[1px] hover:border-sky-200 hover:bg-sky-50"
                    >
                      {t("patients.list.edit")}
                    </button>
                  )}

                  {selectedPatient ? (
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
                        ? t("patients.modal.deleting")
                        : deleteConfirm
                          ? t("patients.modal.confirmDelete")
                          : t("patients.list.delete")}
                    </button>
                  ) : null}
                </div>
                {deleteConfirm ? (
                  <p className="text-sm font-semibold text-red-600">
                    {t("patients.modal.deleteHint")}
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
