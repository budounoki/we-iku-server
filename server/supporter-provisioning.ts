import type { Express, Request, Response } from "express";
import { and, eq, isNotNull, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "./db";
import { isVerifiedAdminRequest, supporterFeatureEnabled } from "./supporter";
import { parentAccess, supporterAccounts, supporterAuditLogs, users } from "@shared/schema";

const accountProvisioningSchema = z.object({
  userId: z.number().int().positive(),
  publicCode: z.string().trim().min(1).max(80),
  displayName: z.string().trim().min(1).max(200).default("ぶどうの木"),
  kind: z.enum(["facility", "relative", "sitter"]),
}).strict();

const parentProvisioningSchema = z.object({
  userId: z.number().int().positive(),
  familyId: z.string().trim().min(1).max(200),
  role: z.enum(["papa", "mama"]),
  verificationConfirmed: z.literal(true),
  reason: z.string().trim().min(1).max(2_000),
}).strict();

type AccountProvisioningInput = z.infer<typeof accountProvisioningSchema>;
type ParentProvisioningInput = z.infer<typeof parentProvisioningSchema>;

type ProvisioningError = Error & { status?: number };

function provisioningError(message: string, status: number): ProvisioningError {
  const error = new Error(message) as ProvisioningError;
  error.status = status;
  return error;
}

function respondProvisioningError(res: Response, error: unknown) {
  // Do not echo parsed request data (which could contain an accidentally
  // supplied credential) or database error details to an HTTP client.
  if (error instanceof z.ZodError) {
    return res.status(400).json({ message: "入力内容を確認してください。" });
  }
  const status = typeof (error as ProvisioningError)?.status === "number"
    ? (error as ProvisioningError).status!
    : 500;
  const message = status >= 500
    ? "アカウント連携を処理できませんでした。"
    : error instanceof Error ? error.message : "入力内容を確認してください。";
  return res.status(status).json({ message });
}

function isUniqueViolation(error: unknown): boolean {
  return (error as { code?: string } | null)?.code === "23505";
}

function publicAccount(account: typeof supporterAccounts.$inferSelect) {
  // Keep this projection intentionally free of external identity fields.
  // userId is an internal existing-account reference, not a provider ID.
  return {
    id: account.id,
    userId: account.userId,
    publicCode: account.publicCode,
    displayName: account.displayName,
    kind: account.kind,
    isActive: account.isActive,
  };
}

function auditAccount(account: typeof supporterAccounts.$inferSelect) {
  return publicAccount(account);
}

async function requireAdminProvisioningAccess(req: Request, res: Response): Promise<boolean> {
  // Keep the constant-time admin guard first. In particular, a disabled
  // feature must not turn an invalid admin key into a feature-status oracle.
  if (!isVerifiedAdminRequest(req)) {
    res.status(403).json({ message: "Unauthorized" });
    return false;
  }
  if (!supporterFeatureEnabled()) {
    res.status(503).json({ message: "サポーター権限は現在有効ではありません。" });
    return false;
  }
  return true;
}

async function provisionAccount(input: AccountProvisioningInput) {
  return db.transaction(async (tx) => {
    // Lock matching rows before deciding whether this is a new link or a
    // same-user metadata update. Unique constraints remain the final race
    // protection for two concurrent first-time links.
    await tx.execute(sql`SELECT id FROM users WHERE id = ${input.userId} FOR SHARE`);
    await tx.execute(sql`SELECT id FROM supporter_accounts WHERE public_code = ${input.publicCode} FOR UPDATE`);
    await tx.execute(sql`SELECT id FROM supporter_accounts WHERE user_id = ${input.userId} FOR UPDATE`);

    const [user] = await tx.select({ id: users.id }).from(users)
      .where(eq(users.id, input.userId)).limit(1);
    if (!user) {
      throw provisioningError("既存のユーザーアカウントが見つかりません。", 404);
    }

    const [accountByCode] = await tx.select().from(supporterAccounts)
      .where(eq(supporterAccounts.publicCode, input.publicCode)).limit(1);
    const [accountByUser] = await tx.select().from(supporterAccounts)
      .where(eq(supporterAccounts.userId, input.userId)).limit(1);

    if (accountByCode?.userId !== null && accountByCode?.userId !== undefined
      && accountByCode.userId !== input.userId) {
      throw provisioningError("この公開コードは別のユーザーに連携済みです。", 409);
    }
    if (accountByCode && accountByUser && accountByCode.id !== accountByUser.id) {
      throw provisioningError("このユーザーには別のサポーターアカウントが連携済みです。", 409);
    }
    if (!accountByCode && accountByUser) {
      throw provisioningError("このユーザーには別のサポーターアカウントが連携済みです。", 409);
    }

    if (accountByCode) {
      const before = auditAccount(accountByCode);
      try {
        const [updated] = await tx.update(supporterAccounts).set({
          userId: input.userId,
          // inviteAddress is a routing identifier, never an email address.
          inviteAddress: input.publicCode,
          displayName: input.displayName,
          kind: input.kind,
        }).where(eq(supporterAccounts.id, accountByCode.id)).returning();
        await tx.insert(supporterAuditLogs).values({
          actorAccountId: null,
          supporterAccountId: updated.id,
          supporterGrantId: null,
          action: "admin_link_account",
          requestId: null,
          before,
          after: auditAccount(updated),
        });
        return { account: updated, created: false };
      } catch (error) {
        if (isUniqueViolation(error)) {
          throw provisioningError("この公開コードまたは招待先は別のアカウントに使用されています。", 409);
        }
        throw error;
      }
    }

    try {
      const [created] = await tx.insert(supporterAccounts).values({
        userId: input.userId,
        inviteAddress: input.publicCode,
        publicCode: input.publicCode,
        displayName: input.displayName,
        kind: input.kind,
      }).returning();
      await tx.insert(supporterAuditLogs).values({
        actorAccountId: null,
        supporterAccountId: created.id,
        supporterGrantId: null,
        action: "admin_link_account",
        requestId: null,
        before: null,
        after: auditAccount(created),
      });
      return { account: created, created: true };
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw provisioningError("この公開コードまたはユーザーは別のアカウントに連携済みです。", 409);
      }
      throw error;
    }
  });
}

async function provisionParent(input: ParentProvisioningInput) {
  return db.transaction(async (tx) => {
    // Lock the source user and compare the current authoritative family/role
    // in the same transaction. This endpoint never writes users.family_id or
    // users.role and never backfills any other family membership.
    await tx.execute(sql`SELECT id FROM users WHERE id = ${input.userId} FOR SHARE`);
    const [user] = await tx.select({
      id: users.id,
      familyId: users.familyId,
      role: users.role,
    }).from(users).where(eq(users.id, input.userId)).limit(1);
    if (!user) {
      throw provisioningError("既存のユーザーアカウントが見つかりません。", 404);
    }
    if (user.familyId !== input.familyId || user.role !== input.role) {
      throw provisioningError("ユーザーの現在の家族・役割と確認内容が一致しません。", 403);
    }

    await tx.execute(sql`SELECT id FROM parent_access
      WHERE user_id = ${input.userId} AND family_id = ${input.familyId} FOR UPDATE`);
    const [beforeRow] = await tx.select().from(parentAccess).where(and(
      eq(parentAccess.userId, input.userId),
      eq(parentAccess.familyId, input.familyId),
    )).limit(1);
    const verifiedAt = new Date();
    let access: typeof parentAccess.$inferSelect;
    if (beforeRow) {
      const [updated] = await tx.update(parentAccess).set({
        role: input.role,
        verifiedAt,
      }).where(eq(parentAccess.id, beforeRow.id)).returning();
      access = updated;
    } else {
      try {
        const [created] = await tx.insert(parentAccess).values({
          userId: input.userId,
          familyId: input.familyId,
          role: input.role,
          verifiedAt,
        }).returning();
        access = created;
      } catch (error) {
        if (isUniqueViolation(error)) {
          throw provisioningError("このユーザーには指定家族の確認済み親権限が既にあります。", 409);
        }
        throw error;
      }
    }

    await tx.insert(supporterAuditLogs).values({
      actorAccountId: null,
      supporterAccountId: null,
      supporterGrantId: null,
      action: "admin_verify_parent",
      requestId: null,
      before: beforeRow ? {
        id: beforeRow.id,
        userId: beforeRow.userId,
        familyId: beforeRow.familyId,
        role: beforeRow.role,
        verifiedAt: beforeRow.verifiedAt,
      } : null,
      after: {
        id: access.id,
        userId: access.userId,
        familyId: access.familyId,
        role: access.role,
        verifiedAt: access.verifiedAt,
        reason: input.reason,
      },
    });
    return access;
  });
}

/**
 * Register the admin-only provisioning API. This module deliberately has no
 * identity-provider integration and never creates a users row.
 *
 * The caller should mount this alongside the existing route modules. The
 * legacy strict guard must allow these exact admin methods before it reaches
 * the generic legacy API deny path:
 * GET /api/admin/supporter/accounts
 * POST /api/admin/supporter/accounts
 * POST /api/admin/supporter/parents
 */
export function registerSupporterProvisioningRoutes(app: Express) {
  app.use("/api/admin/supporter", (_req, res, next) => {
    res.setHeader("Cache-Control", "no-store");
    next();
  });

  app.get("/api/admin/supporter/accounts", async (req, res) => {
    if (!await requireAdminProvisioningAccess(req, res)) return;
    try {
      const accounts = await db.select({
        id: supporterAccounts.id,
        userId: supporterAccounts.userId,
        publicCode: supporterAccounts.publicCode,
        displayName: supporterAccounts.displayName,
        kind: supporterAccounts.kind,
        isActive: supporterAccounts.isActive,
      }).from(supporterAccounts).where(and(
        isNotNull(supporterAccounts.userId),
      ));
      res.json({ accounts });
    } catch (error) {
      respondProvisioningError(res, error);
    }
  });

  app.post("/api/admin/supporter/accounts", async (req, res) => {
    if (!await requireAdminProvisioningAccess(req, res)) return;
    try {
      const input = accountProvisioningSchema.parse(req.body);
      const result = await provisionAccount(input);
      res.status(result.created ? 201 : 200).json(publicAccount(result.account));
    } catch (error) {
      respondProvisioningError(res, error);
    }
  });

  app.post("/api/admin/supporter/parents", async (req, res) => {
    if (!await requireAdminProvisioningAccess(req, res)) return;
    try {
      const input = parentProvisioningSchema.parse(req.body);
      const access = await provisionParent(input);
      res.status(200).json({
        id: access.id,
        userId: access.userId,
        familyId: access.familyId,
        role: access.role,
        verifiedAt: access.verifiedAt,
      });
    } catch (error) {
      respondProvisioningError(res, error);
    }
  });
}
