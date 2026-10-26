import { and, eq, ne } from "drizzle-orm";
import { db } from "./db";
import { parentAccess } from "@shared/schema";

/**
 * `parent_access` を users の家族所属に追従させる。
 *
 * サポーター機能（/api/supporter/*）は親側の権限を users.family_id ではなく
 * `parent_access` の確認済み行から判定する（verifiedParentFamilies）。ところが
 * この表に行を作るのは管理者プロビジョニングと開発フィクスチャだけで、通常の
 * サインアップ・招待コード・家族参加では一切作られていなかった。そのため
 * 2026-09-23 の一括バックフィル以降に登録した利用者には行が無く、
 * サポーターを招待できない（2026-10-14 時点で 335 人中 2 人が欠落）。
 *
 * ここで同期することで、以降は家族が確定・変更された時点で必ず行が揃う。
 *
 * 方針:
 * - papa / mama のみ（parent_access_role_check に合わせる）。
 * - WeApp では 1 ユーザー = 1 家族なので、別家族の古い行は削除する。
 *   残すと家族を移った後も前の家族の記録にアクセスできてしまう。
 * - 失敗してもログインや家族参加そのものは壊さない（fail-soft）。権限同期の
 *   失敗で利用者が締め出される方が重大なため、例外は飲み込んでログに残す。
 */
export async function ensureParentAccess(
  userId: number | null | undefined,
  familyId: string | null | undefined,
  role: string | null | undefined,
): Promise<void> {
  if (!userId || !familyId) return;
  const normalizedRole = role === "papa" || role === "mama" ? role : null;
  if (!normalizedRole) return;

  try {
    const [existing] = await db
      .select()
      .from(parentAccess)
      .where(and(eq(parentAccess.userId, userId), eq(parentAccess.familyId, familyId)))
      .limit(1);

    // 変化が無ければ何も書かない。/api/auth/me から毎回呼ばれるため、
    // 通常時は SELECT 1 回だけで終わるようにする。
    if (existing && existing.role === normalizedRole) return;

    if (existing) {
      await db.update(parentAccess)
        .set({ role: normalizedRole })
        .where(eq(parentAccess.id, existing.id));
    } else {
      await db.insert(parentAccess).values({
        userId,
        familyId,
        role: normalizedRole,
        verifiedAt: new Date(),
      });
    }

    // 家族を移った場合、前の家族の権限が残らないようにする。
    await db.delete(parentAccess)
      .where(and(eq(parentAccess.userId, userId), ne(parentAccess.familyId, familyId)));
  } catch (error) {
    console.error("[parent-access] sync failed", { userId, familyId, role: normalizedRole }, error);
  }
}
