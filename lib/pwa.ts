/* Browser-only helpers for PWA registration and push notification setup. */

export const VAPID_PUBLIC_KEY = normalizeVapidKey(
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
);

export function isPwaSupported() {
  return typeof window !== "undefined" && "serviceWorker" in navigator;
}

export async function registerServiceWorker() {
  if (!isPwaSupported()) return null;

  try {
    const registration = await navigator.serviceWorker.register("/sw.js", {
      scope: "/",
    });
    return registration;
  } catch (error) {
    console.error("[PWA] Service worker registration failed:", error);
    return null;
  }
}

export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (typeof window === "undefined" || !("Notification" in window)) {
    return "denied";
  }
  if (Notification.permission !== "default") {
    return Notification.permission;
  }
  return Notification.requestPermission();
}

export async function ensurePushSubscription(
  registration: ServiceWorkerRegistration,
  publicKey = VAPID_PUBLIC_KEY
) {
  if (typeof window === "undefined") return null;
  const normalizedKey = normalizeVapidKey(publicKey);
  if (!normalizedKey) {
    throw new Error("VAPID public key nije postavljen (NEXT_PUBLIC_VAPID_PUBLIC_KEY).");
  }
  if (!("pushManager" in registration)) {
    throw new Error("Push API nije podržan u ovom pregledaču.");
  }

  const permission =
    Notification.permission === "granted"
      ? "granted"
      : await requestNotificationPermission();

  if (permission !== "granted") {
    throw new Error("Push nije omogućen. Prihvatite permission dijalog (Allow notifications).");
  }

  const existing = await registration.pushManager.getSubscription();
  if (existing) return existing;

  let applicationServerKey: Uint8Array;
  try {
    applicationServerKey = urlBase64ToUint8Array(normalizedKey);
  } catch (error) {
    throw new Error(
      "VAPID public key je u pogrešnom formatu. Ukloni navodnike ili razmake i pokušaj ponovo."
    );
  }

  return registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey,
  });
}

export async function saveSubscription(
  subscription: PushSubscription,
  deviceLabel?: string
) {
  const payload = {
    subscription: subscription.toJSON(),
    deviceLabel,
  };

  const res = await fetch("/api/pwa/subscribe", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    throw new Error("Ne mogu sačuvati push subscription.");
  }
}

function normalizeVapidKey(raw?: string | null) {
  if (!raw) return raw ?? undefined;
  return raw.trim().replace(/^"+|"+$/g, "").replace(/\s+/g, "");
}

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}
