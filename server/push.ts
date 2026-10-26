/**
 * Expo Push Notifications helper.
 * Sends a push notification to a single Expo push token via the Expo Push API.
 * Tokens look like: ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]
 */

export interface PushMessage {
  to: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  sound?: "default" | null;
  badge?: number;
}

export async function sendPushNotification(
  expoPushToken: string,
  title: string,
  body: string,
  data?: Record<string, unknown>,
): Promise<void> {
  if (!expoPushToken || !expoPushToken.startsWith("ExponentPushToken[")) {
    return; // not a valid Expo push token — skip silently
  }

  const message: PushMessage = {
    to: expoPushToken,
    sound: "default",
    title,
    body,
    data: data ?? {},
  };

  try {
    const res = await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Accept-encoding": "gzip, deflate",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(message),
    });

    if (!res.ok) {
      console.error("[push] Expo API error:", await res.text());
    }
  } catch (err) {
    console.error("[push] Failed to send push notification:", err);
  }
}

/**
 * Send push notifications to all family members except the sender.
 * Queries the database for family members' push tokens.
 */
export async function sendFamilyPush(
  db: import("drizzle-orm/node-postgres").NodePgDatabase<typeof import("@shared/schema")>,
  familyId: string,
  excludeUserId: number | null,
  title: string,
  body: string,
  data?: Record<string, unknown>,
): Promise<void> {
  const { users } = await import("@shared/schema");
  const { eq, and, isNotNull, ne } = await import("drizzle-orm");

  const query = db
    .select({ id: users.id, pushToken: users.pushToken })
    .from(users)
    .where(
      excludeUserId != null
        ? and(eq(users.familyId, familyId), ne(users.id, excludeUserId), isNotNull(users.pushToken))
        : and(eq(users.familyId, familyId), isNotNull(users.pushToken)),
    );

  const members = await query;

  await Promise.all(
    members
      .filter((m) => m.pushToken)
      .map((m) => sendPushNotification(m.pushToken!, title, body, data)),
  );
}

/**
 * Broadcast a push notification to ALL users that have a push token.
 * Used for app-wide announcements (new features / updates). Unique, valid Expo
 * tokens are batched into groups of 100 (Expo's per-request limit) and each
 * batch is sent as a single request. Returns how many tokens were targeted and
 * how many batches failed (so the caller can report the result).
 */
export async function sendBroadcastPush(
  db: import("drizzle-orm/node-postgres").NodePgDatabase<typeof import("@shared/schema")>,
  title: string,
  body: string,
  data?: Record<string, unknown>,
): Promise<{ tokens: number; batches: number; failedBatches: number }> {
  const { users } = await import("@shared/schema");
  const { isNotNull } = await import("drizzle-orm");

  const rows = await db
    .select({ pushToken: users.pushToken })
    .from(users)
    .where(isNotNull(users.pushToken));

  const tokens = Array.from(
    new Set(
      rows
        .map((r) => r.pushToken)
        .filter((t): t is string => !!t && t.startsWith("ExponentPushToken[")),
    ),
  );

  let batches = 0;
  let failedBatches = 0;
  for (let i = 0; i < tokens.length; i += 100) {
    const messages: PushMessage[] = tokens.slice(i, i + 100).map((to) => ({
      to,
      sound: "default",
      title,
      body,
      data: data ?? {},
    }));
    batches++;
    try {
      const res = await fetch("https://exp.host/--/api/v2/push/send", {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Accept-encoding": "gzip, deflate",
          "Content-Type": "application/json",
        },
        body: JSON.stringify(messages),
      });
      if (!res.ok) {
        failedBatches++;
        console.error("[push] broadcast batch error:", await res.text());
      }
    } catch (err) {
      failedBatches++;
      console.error("[push] broadcast batch failed:", err);
    }
  }

  return { tokens: tokens.length, batches, failedBatches };
}
