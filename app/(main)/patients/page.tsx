"use client";

import { useEffect, useState } from "react";
import { PatientList } from "@/components/patients/patient-list";
import { Card } from "@/components/ui/card";
import { Plus, X } from "lucide-react";
import { useTranslations } from "@/components/i18n/language-provider";
import type { Patient } from "@/types";

type NewPatientForm = {
  name: string;
  address: string;
  level: string;
  notes: string;
};

const createEmptyForm = (): NewPatientForm => ({
  name: "",
  address: "",
  level: "",
  notes: "",
});

export default function PatientsPage() {
  const { t } = useTranslations();
  const [patientsState, setPatientsState] = useState<Patient[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [form, setForm] = useState<NewPatientForm>(createEmptyForm);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPatients = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/patients");
      if (!response.ok) {
        throw new Error(await response.text());
      }
      const json = await response.json();
      setPatientsState(json.data ?? []);
    } catch (err) {
      console.error(err);
      setError(t("patients.error"));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchPatients();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const resetForm = () => setForm(createEmptyForm());

  const openModal = () => {
    resetForm();
    setIsModalOpen(true);
  };

  const closeModal = () => {
    resetForm();
    setIsModalOpen(false);
  };

  const isSaveDisabled = !form.name.trim() || !form.address.trim();

  const handleSave = () => {
    if (isSaveDisabled) return;
    setError(null);

    const payload = {
      name: form.name.trim(),
      city: form.address.trim(),
      level: form.level.trim() || "Pflegegrad 3",
      notes: form.notes.trim() || null,
    };

    fetch("/api/patients", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    })
      .then(async (res) => {
        if (!res.ok) {
          throw new Error(await res.text());
        }
        const json = await res.json();
        const saved: Patient = json.data;
        setPatientsState((prev) => [saved, ...prev]);
        closeModal();
      })
      .catch((err) => {
        console.error(err);
        setError(t("patients.saveError"));
      });
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
            onClick={openModal}
            className="inline-flex items-center gap-2 rounded-xl bg-slate-900/90 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:-translate-y-[1px] hover:shadow"
          >
            <Plus className="h-4 w-4" />
            {t("patients.add")}
          </button>
        </div>
      </Card>

      <PatientList patients={patientsState} isLoading={isLoading} error={error} />

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
              aria-label={t("patients.modal.cancel")}
              className="absolute right-4 top-4 inline-flex h-9 w-9 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-500 shadow-sm transition hover:border-slate-300 hover:text-slate-700"
            >
              <X className="h-4 w-4" />
            </button>

            <div className="space-y-2 pt-2">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-500">
                {t("patients.modal.title")}
              </p>
              <h2 className="text-xl font-semibold text-slate-900">
                {t("patients.modal.subtitle")}
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
                  <span>{t("patients.modal.nameLabel")}</span>
                  <input
                    value={form.name}
                    placeholder={t("patients.modal.namePlaceholder")}
                    onChange={(event) =>
                      setForm((prev) => ({ ...prev, name: event.target.value }))
                    }
                    className="w-full rounded-2xl border border-border/70 bg-slate-50 px-3 py-2 text-sm text-slate-900 outline-none focus:border-sky-200"
                  />
                </label>
                <label className="space-y-1 text-xs uppercase tracking-[0.18em] text-slate-500">
                  <span>{t("patients.modal.addressLabel")}</span>
                  <input
                    value={form.address}
                    placeholder={t("patients.modal.addressPlaceholder")}
                    onChange={(event) =>
                      setForm((prev) => ({ ...prev, address: event.target.value }))
                    }
                    className="w-full rounded-2xl border border-border/70 bg-slate-50 px-3 py-2 text-sm text-slate-900 outline-none focus:border-sky-200"
                  />
                </label>
              </div>
              <label className="space-y-1 text-xs uppercase tracking-[0.18em] text-slate-500">
                <span>{t("patients.modal.levelLabel")}</span>
                <input
                  value={form.level}
                  placeholder={t("patients.modal.levelPlaceholder")}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, level: event.target.value }))
                  }
                  className="w-full rounded-2xl border border-border/70 bg-slate-50 px-3 py-2 text-sm text-slate-900 outline-none focus:border-sky-200"
                />
              </label>
              <label className="space-y-1 text-xs uppercase tracking-[0.18em] text-slate-500">
                <span>{t("patients.modal.notesLabel")}</span>
                <textarea
                  value={form.notes}
                  placeholder={t("patients.modal.notesPlaceholder")}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, notes: event.target.value }))
                  }
                  rows={3}
                  className="w-full rounded-2xl border border-border/70 bg-slate-50 px-3 py-2 text-sm text-slate-900 outline-none focus:border-sky-200"
                />
              </label>

              <div className="flex flex-wrap gap-3">
                <button
                  type="submit"
                  disabled={isSaveDisabled}
                  className="inline-flex items-center gap-2 rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white shadow transition hover:-translate-y-[1px] hover:shadow-sm disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {t("patients.modal.save")}
                </button>
                <button
                  type="button"
                  onClick={closeModal}
                  className="inline-flex items-center rounded-2xl border border-border/70 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:border-slate-400 hover:text-slate-900"
                >
                  {t("patients.modal.cancel")}
                </button>
              </div>
            </form>
          </Card>
        </div>
      )}
    </div>
  );
}
