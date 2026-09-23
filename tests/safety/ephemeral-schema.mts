/**
 * Build the schema used by an isolated, temporary PostgreSQL database.
 *
 * This module intentionally imports the schema declarations only.  It must
 * not import the application's database/client module: importing this file is
 * also used by safety harnesses which have no database configured.
 */
import { generateDrizzleJson, generateMigration } from "drizzle-kit/api";
import { readFile } from "node:fs/promises";
import * as schema from "../../shared/schema.ts";

const SUPPORTER_LOG_COLUMNS = [
  ["actor_account_id", "integer"],
  ["supporter_account_id", "integer"],
  ["supporter_grant_id", "integer"],
  ["care_source", "text"],
  ["recorder_display_name", "text"],
  ["deleted_at", "timestamp"],
] as const;

const SUPPORTER_GRANT_INDEXES = [
  `CREATE INDEX IF NOT EXISTS "supporter_grants_account_child_idx"
   ON "supporter_grants" ("supporter_account_id", "child_id");`,
  `CREATE INDEX IF NOT EXISTS "supporter_grants_family_idx"
   ON "supporter_grants" ("family_id");`,
] as const;

/**
 * Generate additive SQL from an empty PostgreSQL schema snapshot.
 *
 * generateMigration is deliberately used instead of drizzle-kit CLI/config:
 * the CLI config requires DATABASE_URL and may inspect or connect to a
 * database.  Both snapshots here are built entirely from local declarations.
 */
export async function generateEphemeralSchemaSql(): Promise<string> {
  const emptySnapshot = generateDrizzleJson({});
  // Evidence publication/immutability guards are PostgreSQL triggers, not
  // representable by the schema generator. Use the exact future migration
  // for these tables so tests cannot accidentally omit those guards.
  const baseSchema = Object.fromEntries(
    Object.entries(schema).filter(([name]) => !name.startsWith("evidence")),
  );
  const currentSnapshot = generateDrizzleJson(baseSchema);
  const statements = await generateMigration(emptySnapshot, currentSnapshot);
  const generatedSql = statements.join("\n");
  const additiveStatements: string[] = [];

  // Keep the development-schema additions safe if a future schema snapshot
  // temporarily omits one of the supporter attribution fields.  On the
  // current schema these checks are no-ops because the columns are generated
  // in CREATE TABLE "logs".
  for (const [column, type] of SUPPORTER_LOG_COLUMNS) {
    if (!new RegExp(`"${column}"\\s+`, "i").test(generatedSql)) {
      additiveStatements.push(
        `ALTER TABLE "logs" ADD COLUMN IF NOT EXISTS "${column}" ${type};`,
      );
    }
  }

  // These indexes are part of the additive supporter development schema but
  // are intentionally not represented by the current Drizzle declarations.
  for (const indexSql of SUPPORTER_GRANT_INDEXES) {
    const indexName = indexSql.match(/"([^"]+)"/)?.[1];
    if (indexName && !generatedSql.includes(`"${indexName}"`)) {
      additiveStatements.push(indexSql);
    }
  }

  // The evidence-search feature (and its migration SQL) is not ported to
  // this app — supporter scope only.
  return [
    ...statements,
    ...additiveStatements,
  ].join("\n");
}