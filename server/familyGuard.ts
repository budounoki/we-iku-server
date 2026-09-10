// Guard for creation-type routes ("POST something new into a family").
// Ported from originwebapp (server/familyGuard.ts, 2026-09-10).
//
// familyId is effectively a bearer credential in this app (whoever has the
// code can join the family), so the main defense is making sure IDs are
// unguessable and rate-limiting how many distinct familyIds a single IP can
// probe. A real household only ever uses one familyId, so even a modest
// limit never affects legitimate use.

interface IpWindow {
  familyIds: Map<string, number>; // familyId -> last-seen epoch ms
}

const WINDOW_MS = Number(process.env.FAMILY_ENUM_WINDOW_MS || 10 * 60 * 1000);
const LIMIT = Number(process.env.FAMILY_ENUM_LIMIT || 30);

const ipWindows = new Map<string, IpWindow>();
let lastSweep = 0;

function clientIp(req: any): string {
  const xff = req.headers?.["x-forwarded-for"];
  if (typeof xff === "string" && xff.length > 0) return xff.split(",")[0].trim();
  return req.ip || req.socket?.remoteAddress || "unknown";
}

function sweep(now: number) {
  if (now - lastSweep < WINDOW_MS) return;
  lastSweep = now;
  ipWindows.forEach((w, ip) => {
    w.familyIds.forEach((seen, fid) => {
      if (now - seen > WINDOW_MS) w.familyIds.delete(fid);
    });
    if (w.familyIds.size === 0) ipWindows.delete(ip);
  });
}

/**
 * Express middleware for creation/rotation routes. Requires an explicit
 * familyId in body, query, or route params, and rate-limits how many
 * distinct familyIds a single IP may target.
 */
export function familyCreateGuard(req: any, res: any, next: any) {
  const sources = [req.params?.familyId, req.body?.familyId, req.query?.familyId]
    .filter((v: unknown): v is string => typeof v === "string" && v.trim().length > 0)
    .map((v: string) => v.trim());
  const familyId = sources[0] ?? "";
  if (!familyId) {
    return res.status(400).json({ message: "familyId is required" });
  }
  if (sources.some((v: string) => v !== familyId)) {
    return res.status(403).json({ message: "familyIdが一致しません" });
  }
  if (familyId.length > 64) {
    return res.status(400).json({ message: "familyId is invalid" });
  }

  const now = Date.now();
  sweep(now);
  const ip = clientIp(req);
  let w = ipWindows.get(ip);
  if (!w) {
    w = { familyIds: new Map() };
    ipWindows.set(ip, w);
  }
  w.familyIds.forEach((seen, fid) => {
    if (now - seen > WINDOW_MS) w!.familyIds.delete(fid);
  });
  const known = w.familyIds.has(familyId);
  if (!known && w.familyIds.size >= LIMIT) {
    return res
      .status(429)
      .json({ message: "リクエストが多すぎます。しばらくしてからお試しください" });
  }
  w.familyIds.set(familyId, now);
  next();
}
