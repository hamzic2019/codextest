"use client";

import { VAPID_PUBLIC_KEY, ensurePushSubscription, registerServiceWorker, saveSubscription } from "@/lib/pwa";
import { Bell } from "lucide-react";
import { useState } from "react";

type Status = "idle" | "loading" | "success" | "error";

export function PushTestButton() {
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);

  const busy = status === "loading";

  const handleClick = async () => {
    setStatus("loading");
    setError(null);

    try {
      const registration = await registerServiceWorker();
      if (!registration) {
        throw new Error("Pregledač ne podržava service worker ili je zabranjen.");
      }

      const subscription = await ensurePushSubscription(registration, VAPID_PUBLIC_KEY);

      if (!subscription) {
        throw new Error("Push subscription nije kreiran.");
      }

      const deviceLabel = navigator.userAgent.slice(0, 150);
      await saveSubscription(subscription, deviceLabel);

      const res = await fetch("/api/pwa/send-test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      if (!res.ok) {
        const payload = await res.json().catch(() => null);
        const reason = payload?.error || payload?.message;
        throw new Error(reason ?? "Slanje test notifikacije nije uspjelo.");
      }

      setStatus("success");
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : "Greška pri slanju notifikacije.");
      setStatus("error");
    }
  };

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-3 text-sm text-slate-100">
      <div className="flex items-center gap-2 font-semibold">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/5">
          <Bell className="h-4 w-4" />
        </span>
        Push test
      </div>
      <p className="mt-2 text-xs text-slate-300">
        Klikni da pošalješ test notifikaciju na sve uređaje koji su dozvolili push.
      </p>
      <button
        type="button"
        onClick={handleClick}
        disabled={busy}
        className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-sky-400 to-indigo-500 px-3 py-2 text-sm font-semibold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
      >
        <Bell className="h-4 w-4" />
        {busy ? "Slanje..." : "Pošalji test"}
      </button>
      {status === "success" && (
        <p className="mt-2 text-xs text-emerald-300">Poslano. Provjeri telefon.</p>
      )}
      {error && (
        <p className="mt-2 text-xs text-amber-300" role="status">
          {error}
        </p>
      )}
    </div>
  );
}
