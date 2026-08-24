import "server-only";

import webpush from "web-push";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Sending a notification to the other member's phone.
 *
 * This is the one thing one account does *to* another, so it runs with the
 * service role and is never reachable from the browser: nothing client-side
 * can address somebody else's device. The only message it ever sends is that
 * a session was finished, which the partner can already read anyway.
 *
 * Everything here is best effort. A gym application must not fail to record a
 * workout because a push service was slow, so every path swallows its errors
 * and the caller is never made to wait on the result.
 */

export const vapidPublicKey = () =>
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? null;

function configured(): boolean {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!publicKey || !privateKey) return false;

  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT ?? "mailto:gym@example.invalid",
    publicKey,
    privateKey,
  );
  return true;
}

export type Push = {
  title: string;
  body: string;
  /** Where tapping it should land. */
  url?: string;
  /** Replaces any earlier notification carrying the same tag. */
  tag?: string;
};

/**
 * Sends to every device belonging to `userId`.
 *
 * A subscription the push service rejects as gone is deleted: phones are
 * reinstalled and permissions revoked, and a dead endpoint would otherwise be
 * retried for ever.
 */
export async function sendTo(userId: string, message: Push): Promise<number> {
  if (!configured()) return 0;

  const admin = createAdminClient();
  const { data: subscriptions } = await admin
    .from("push_subscriptions")
    .select("endpoint, p256dh, auth")
    .eq("user_id", userId);

  if (!subscriptions?.length) return 0;

  let delivered = 0;

  await Promise.all(
    subscriptions.map(async (subscription) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: subscription.endpoint,
            keys: { p256dh: subscription.p256dh, auth: subscription.auth },
          },
          JSON.stringify(message),
          { TTL: 60 * 60 },
        );
        delivered += 1;
      } catch (error) {
        const status = (error as { statusCode?: number }).statusCode;
        // 404 and 410 mean the browser threw this subscription away.
        if (status === 404 || status === 410) {
          await admin
            .from("push_subscriptions")
            .delete()
            .eq("endpoint", subscription.endpoint);
        }
      }
    }),
  );

  return delivered;
}

/** Everyone except `userId` — in a household of two, the other one. */
export async function sendToPartnerOf(
  userId: string,
  message: Push,
): Promise<number> {
  if (!configured()) return 0;

  const admin = createAdminClient();
  const { data: others } = await admin
    .from("profiles")
    .select("id")
    .neq("id", userId);

  if (!others?.length) return 0;

  const counts = await Promise.all(
    others.map((profile) => sendTo(profile.id, message)),
  );
  return counts.reduce((total, count) => total + count, 0);
}
