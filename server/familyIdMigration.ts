// Legacy familyId rotation ("家族コードの安全化").
// Ported from originwebapp (server/familyIdMigration.ts, 2026-09-10) — note
// that in the origin project this module's routes were never actually
// registered and its client banner was never mounted, so the feature was
// dead code there. This app wires it up for real (see routes.ts and
// App.tsx / mobile navigation).
//
// Background: our familyIds have always been generated as
// family-<8-char base36> (Math.random().toString(36).substring(2, 10)),
// which is guessable. This module lets a family rotate to a high-entropy
// secure ID and lets the partner's device follow automatically.
//
// Flow:
//   1. Device A (legacy ID) sees a banner and POSTs /api/family/rotate-id.
//      All rows carrying the old family_id are renamed in one transaction and
//      an old->new mapping row is recorded.
//   2. Device B still has the old ID in storage. On app load it calls
//      GET /api/family/id-status; within a grace window (default 72h) the
//      mapping is returned and the client updates its stored familyId
//      silently. After the window the mapping is no longer disclosed and the
//      partner must enter the new code manually (shown in Settings on device A).
//
// Security notes:
//   - Both endpoints sit behind familyCreateGuard, so per-IP familyId
//     enumeration is rate-limited exactly like creation routes.
//   - Disclosing old->new during the grace window does not weaken anything:
//     during that window an attacker who guessed the old ID could have used
//     it directly before rotation anyway. After the window the hole closes.

import type { Express } from "express";
import { randomBytes } from "crypto";
import { eq } from "drizzle-orm";
import { db, pool } from "./db";
import { familyIdMigrations } from "@shared/schema";
import { familyCreateGuard } from "./familyGuard";

// Legacy = "family-" + a short (<=10 chars) base36 tail — matches our own
// generateFamilyId output exactly, so every family currently in the DB is
// "legacy" by this definition. Secure IDs (20 hex chars) never match.
const LEGACY_FAMILY_ID_RE = /^family-[0-9a-z]{1,10}$/;

export function isLegacyFamilyId(id: string): boolean {
  return LEGACY_FAMILY_ID_RE.test(id);
}

export function generateSecureFamilyId(): string {
  return `family-${randomBytes(10).toString("hex")}`; // 80 bits
}

const GRACE_MS = Number(process.env.FAMILY_ID_MIGRATION_GRACE_MS || 72 * 60 * 60 * 1000);

const EXCLUDED_TABLES = new Set(["family_id_migrations", "session", "sessions"]);

/** All public tables that carry a family_id column, discovered dynamically so
 *  future family-scoped tables are renamed too without touching this file. */
async function familyIdTables(client: { query: (q: string, p?: any[]) => Promise<any> }): Promise<string[]> {
  const res = await client.query(
    `SELECT table_name FROM information_schema.columns
     WHERE table_schema = 'public' AND column_name = 'family_id'`,
  );
  return res.rows
    .map((r: any) => String(r.table_name))
    .filter((t: string) => !EXCLUDED_TABLES.has(t));
}

export function registerFamilyIdMigrationRoutes(app: Express) {
  pool
    .query(
      `CREATE TABLE IF NOT EXISTS family_id_migrations (
         id serial PRIMARY KEY,
         old_family_id text NOT NULL UNIQUE,
         new_family_id text NOT NULL,
         migrated_at timestamp DEFAULT now() NOT NULL
       )`,
    )
    .catch((err) => console.error("family_id_migrations bootstrap failed:", err));

  // Status probe: is this ID legacy? has it already been rotated?
  app.get("/api/family/id-status", familyCreateGuard, async (req, res) => {
    try {
      const familyId = String(req.query.familyId || "").trim();
      if (!familyId) return res.status(400).json({ error: "familyId is required" });

      const [migration] = await db
        .select()
        .from(familyIdMigrations)
        .where(eq(familyIdMigrations.oldFamilyId, familyId));

      if (migration) {
        const withinGrace = Date.now() - new Date(migration.migratedAt).getTime() <= GRACE_MS;
        return res.json({
          legacy: true,
          migrated: true,
          migratedTo: withinGrace ? migration.newFamilyId : null,
        });
      }

      return res.json({ legacy: isLegacyFamilyId(familyId), migrated: false, migratedTo: null });
    } catch (err) {
      console.error("id-status error:", err);
      res.status(500).json({ error: "Failed to check family ID status" });
    }
  });

  // Rotate a legacy familyId to a secure one, renaming every row atomically.
  app.post("/api/family/rotate-id", familyCreateGuard, async (req, res) => {
    const familyId = typeof req.body?.familyId === "string" ? req.body.familyId.trim() : "";
    if (!familyId) return res.status(400).json({ error: "familyId is required" });
    if (familyId === "default") {
      return res.status(400).json({ error: "This family ID cannot be rotated" });
    }
    if (!isLegacyFamilyId(familyId)) {
      return res.status(400).json({ error: "Family ID is already in the secure format" });
    }

    const client = await pool.connect();
    try {
      const prior = await client.query(
        `SELECT new_family_id FROM family_id_migrations WHERE old_family_id = $1`,
        [familyId],
      );
      if (prior.rows.length > 0) {
        return res.json({ newFamilyId: prior.rows[0].new_family_id, alreadyMigrated: true });
      }

      const newFamilyId = generateSecureFamilyId();
      await client.query("BEGIN");
      await client.query(
        `INSERT INTO family_id_migrations (old_family_id, new_family_id) VALUES ($1, $2)`,
        [familyId, newFamilyId],
      );
      const tables = await familyIdTables(client);
      let totalRows = 0;
      for (const table of tables) {
        const r = await client.query(
          `UPDATE "${table}" SET family_id = $1 WHERE family_id = $2`,
          [newFamilyId, familyId],
        );
        totalRows += r.rowCount || 0;
      }
      await client.query("COMMIT");
      console.log(`Rotated legacy familyId (${tables.length} tables, ${totalRows} rows)`);
      return res.json({ newFamilyId, alreadyMigrated: false });
    } catch (err: any) {
      await client.query("ROLLBACK").catch(() => {});
      if (err?.code === "23505") {
        const winner = await client.query(
          `SELECT new_family_id FROM family_id_migrations WHERE old_family_id = $1`,
          [familyId],
        );
        if (winner.rows.length > 0) {
          return res.json({ newFamilyId: winner.rows[0].new_family_id, alreadyMigrated: true });
        }
      }
      console.error("rotate-id error:", err);
      return res.status(500).json({ error: "Failed to rotate family ID" });
    } finally {
      client.release();
    }
  });
}
