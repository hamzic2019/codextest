import { createServiceSupabaseClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

type Payload = {
  subscription?: PushSubscriptionJSON;
  deviceLabel?: string;
};

export async function POST(req: Request) {
  const { subscription, deviceLabel }: Payload = await req.json().catch(() => ({}));

  if (
    !subscription?.endpoint ||
    !subscription.keys?.p256dh ||
    !subscription.keys?.auth
  ) {
    return NextResponse.json(
      { error: "Subscription payload je nepotpun." },
      { status: 400 }
    );
  }

  const supabase = createServiceSupabaseClient();
  const { error } = await supabase.from("push_subscriptions").upsert(
    {
      endpoint: subscription.endpoint,
      p256dh: subscription.keys.p256dh,
      auth: subscription.keys.auth,
      device_label: deviceLabel?.slice(0, 120) ?? null,
      user_agent: req.headers.get("user-agent"),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "endpoint" }
  );

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
