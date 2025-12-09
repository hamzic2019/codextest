"use client";

import { useEffect } from "react";
import { registerServiceWorker } from "@/lib/pwa";

export function PwaClient() {
  useEffect(() => {
    let cancelled = false;

    registerServiceWorker().then((registration) => {
      if (!registration || cancelled) return;

      if (process.env.NODE_ENV === "development") {
        console.debug("[PWA] Service worker ready:", registration.scope);
      }
    });

    return () => {
      cancelled = true;
    };
  }, []);

  return null;
}
