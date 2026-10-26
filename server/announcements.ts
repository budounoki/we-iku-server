/**
 * App-wide announcement push notifications.
 *
 * Lets an admin broadcast a push notification to every user (e.g. "新機能が
 * 追加されました"). Protected by the existing x-admin-key header so only the
 * operator can send. The actual fan-out lives in push.ts (sendBroadcastPush).
 *
 * This is the backend for the "update/new-feature notification" feature. A
 * self-serve admin UI can be layered on top later by calling this same route.
 */
import type { Express, Request, Response } from "express";
import { db } from "./db";
import { sendBroadcastPush } from "./push";
import { isVerifiedAdminRequest } from "./supporter";

export function registerAnnouncementRoutes(app: Express) {
  // POST /api/admin/announce  { title, body, data? }  (header: x-admin-key)
  app.post("/api/admin/announce", async (req: Request, res: Response) => {
    if (!isVerifiedAdminRequest(req)) {
      return res.status(401).json({ error: "unauthorized" });
    }

    const title = typeof req.body?.title === "string" ? req.body.title.trim() : "";
    const body = typeof req.body?.body === "string" ? req.body.body.trim() : "";
    const data =
      req.body?.data && typeof req.body.data === "object" && !Array.isArray(req.body.data)
        ? (req.body.data as Record<string, unknown>)
        : undefined;

    if (!title || !body) {
      return res.status(400).json({ error: "title and body are required" });
    }

    try {
      const result = await sendBroadcastPush(db, title, body, data);
      console.log(
        `[announce] broadcast "${title}" -> ${result.tokens} tokens, ` +
          `${result.batches} batches, ${result.failedBatches} failed`,
      );
      res.json({ ok: true, ...result });
    } catch (err) {
      console.error("[announce] failed:", err);
      res.status(500).json({ error: "failed to send announcement" });
    }
  });
}
