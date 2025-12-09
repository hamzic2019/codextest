import { createServiceSupabaseClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/types";
import { NextResponse } from "next/server";
import webpush, { WebPushError } from "web-push";

const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;
const vapidContact = process.env.VAPID_CONTACT_EMAIL ?? "mailto:hello@pflegeki.app";

type Payload = {
  title?: string;
  body?: string;
  url?: string;
};

type PushSubRow = Database["public"]["Tables"]["push_subscriptions"]["Row"];

export async function POST(req: Request) {
  if (!vapidPublicKey || !vapidPrivateKey) {
    return NextResponse.json(
      { error: "Nedostaju VAPID ključevi u env fajlu." },
      { status: 500 }
    );
  }

  const supabase = createServiceSupabaseClient();
  const { data: subs, error: fetchError } = await supabase
    .from("push_subscriptions")
    .select("id,endpoint,auth,p256dh");

  if (fetchError) {
    return NextResponse.json({ error: fetchError.message }, { status: 500 });
  }

  const subscriptions: Pick<PushSubRow, "id" | "endpoint" | "auth" | "p256dh">[] = subs ?? [];

  if (!subscriptions.length) {
    return NextResponse.json({ ok: true, sent: 0, pruned: 0 });
  }

  const body: Payload = await req.json().catch(() => ({}));
  const payload = JSON.stringify({
    title: body.title ?? "PflegeKI",
    body: body.body ?? "Test notifikacija sa desktopa.",
    url: body.url ?? "/",
  });

  webpush.setVapidDetails(vapidContact, vapidPublicKey, vapidPrivateKey);

  const staleIds: string[] = [];

  await Promise.all(
    subscriptions.map(async (sub) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { auth: sub.auth, p256dh: sub.p256dh },
          },
          payload
        );
      } catch (err: unknown) {
        if (err instanceof WebPushError && [404, 410].includes(err.statusCode)) {
          staleIds.push(sub.id);
          return;
        }
        console.error("[PWA] push send failed", err);
      }
    })
  );

  if (staleIds.length) {
    await supabase.from("push_subscriptions").delete().in("id", staleIds);
  }

  return NextResponse.json({
    ok: true,
    sent: subs.length,
    pruned: staleIds.length,
  });
}
