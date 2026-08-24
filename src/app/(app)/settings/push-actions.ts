"use server";

import { createClient } from "@/lib/supabase/server";

export type PushState = { error: string | null; enabled: boolean };

/**
 * Remembers a device that has agreed to be notified.
 *
 * Keyed on the endpoint the browser issues, so re-subscribing on the same
 * phone replaces its row rather than adding another. Only ever writes the
 * caller's own row; row level security enforces the same thing underneath.
 */
export async function saveSubscription(input: {
  endpoint: string;
  p256dh: string;
  auth: string;
  userAgent: string | null;
}): Promise<PushState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "A sessão expirou.", enabled: false };

  if (!input.endpoint || !input.p256dh || !input.auth) {
    return { error: "O navegador não deu uma subscrição válida.", enabled: false };
  }

  const { error } = await supabase.from("push_subscriptions").upsert(
    {
      endpoint: input.endpoint,
      user_id: user.id,
      p256dh: input.p256dh,
      auth: input.auth,
      user_agent: input.userAgent?.slice(0, 200) ?? null,
    },
    { onConflict: "endpoint" },
  );

  if (error) return { error: "Não deu para guardar. Tenta outra vez.", enabled: false };
  return { error: null, enabled: true };
}

/** Forgets this device. */
export async function removeSubscription(endpoint: string): Promise<PushState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "A sessão expirou.", enabled: false };

  await supabase
    .from("push_subscriptions")
    .delete()
    .eq("endpoint", endpoint)
    .eq("user_id", user.id);

  return { error: null, enabled: false };
}
