import type { PoolClient } from "pg";
export class PhotoError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
export type ChildAccess = {
  id: number; name: string; birthday: string | null; family_id: string; can_edit: boolean;
  starts_at: Date | null; ends_at: Date | null;
};
export async function photoChildren(db: PoolClient, userId: number): Promise<ChildAccess[]> {
  const { rows } = await db.query<ChildAccess>(`
    SELECT c.id,c.name,c.birthday::text,c.family_id,true AS can_edit,NULL::timestamp AS starts_at,NULL::timestamp AS ends_at
    FROM children c JOIN parent_access p ON p.family_id=c.family_id
    WHERE p.user_id=$1 AND p.verified_at IS NOT NULL AND p.role IN ('mama','papa')
      AND NOT EXISTS(SELECT 1 FROM supporter_accounts s WHERE s.user_id=$1)
    UNION ALL
    SELECT c.id,c.name,c.birthday::text,c.family_id,false,g.starts_at,g.ends_at
    FROM children c JOIN supporter_grants g ON g.child_id=c.id AND g.family_id=c.family_id
    JOIN supporter_accounts s ON s.id=g.supporter_account_id
    WHERE s.user_id=$1 AND s.is_active=true AND g.revoked_at IS NULL AND g.accepted_at IS NOT NULL
      AND g.starts_at<=clock_timestamp() AND g.ends_at>clock_timestamp()
    ORDER BY id`, [userId]);
  return rows;
}
export async function photoAccess(db: PoolClient, userId: number, childId: number, edit = false) {
  // Serialize child and permission changes with photo writes.
  await db.query("SELECT id FROM children WHERE id=$1 FOR SHARE", [childId]);
  await db.query("SELECT id FROM parent_access WHERE user_id=$1 FOR SHARE", [userId]);
  await db.query("SELECT id FROM supporter_accounts WHERE user_id=$1 FOR SHARE", [userId]);
  await db.query(`SELECT g.id FROM supporter_grants g JOIN supporter_accounts s ON s.id=g.supporter_account_id
    WHERE s.user_id=$1 AND g.child_id=$2 FOR SHARE OF g`, [userId, childId]);
  const rows = (await photoChildren(db, userId)).filter(c => c.id === childId);
  if (!rows.length || (edit && !rows.some(c => c.can_edit))) throw new PhotoError(403, "この写真を操作する権限がありません。");
  return rows;
}
export function visibleAt(access: ChildAccess[], timestamp: Date | null) {
  if (access.some(a => a.can_edit)) return true;
  return !!timestamp && access.some(a => a.starts_at && a.ends_at && timestamp >= a.starts_at && timestamp < a.ends_at);
}
