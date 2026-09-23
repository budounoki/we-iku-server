import { FormEvent, useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type AccountKind = "facility" | "relative" | "sitter";

type LinkedAccount = {
  id: number;
  userId: number;
  publicCode: string;
  displayName: string;
  kind: AccountKind;
  isActive: boolean;
};

type AccountLinkingProps = {
  /** Kept in memory by the existing admin screen; never persisted here. */
  adminKey: string;
};

async function readResponse(response: Response) {
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(typeof body?.message === "string" ? body.message : "管理操作に失敗しました。");
  }
  return body;
}

export function AccountLinking({ adminKey }: AccountLinkingProps) {
  const [accounts, setAccounts] = useState<LinkedAccount[]>([]);
  const [accountForm, setAccountForm] = useState({
    userId: "",
    publicCode: "",
    displayName: "ぶどうの木",
    kind: "facility" as AccountKind,
  });
  const [parentForm, setParentForm] = useState({
    userId: "",
    familyId: "",
    role: "papa" as "papa" | "mama",
    verificationConfirmed: false,
    reason: "",
  });
  const [loading, setLoading] = useState(false);
  const [savingAccount, setSavingAccount] = useState(false);
  const [savingParent, setSavingParent] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const headers = useCallback(() => ({
    "Content-Type": "application/json",
    "x-admin-key": adminKey.trim(),
  }), [adminKey]);

  const loadAccounts = useCallback(async () => {
    if (!adminKey.trim()) {
      setAccounts([]);
      return;
    }
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/admin/supporter/accounts", { headers: headers() });
      const data = await readResponse(response);
      setAccounts(Array.isArray(data.accounts) ? data.accounts : []);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "連携済みアカウントを取得できません。");
    } finally {
      setLoading(false);
    }
  }, [adminKey, headers]);

  useEffect(() => {
    void loadAccounts();
  }, [loadAccounts]);

  const submitAccount = async (event: FormEvent) => {
    event.preventDefault();
    if (!accountForm.userId || !accountForm.publicCode || savingAccount) return;
    setSavingAccount(true);
    setMessage("");
    setError("");
    try {
      const response = await fetch("/api/admin/supporter/accounts", {
        method: "POST",
        headers: headers(),
        body: JSON.stringify({
          userId: Number(accountForm.userId),
          publicCode: accountForm.publicCode,
          displayName: accountForm.displayName || "ぶどうの木",
          kind: accountForm.kind,
        }),
      });
      await readResponse(response);
      setMessage("サポーターアカウントを連携しました。");
      await loadAccounts();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "アカウントを連携できません。");
    } finally {
      setSavingAccount(false);
    }
  };

  const submitParent = async (event: FormEvent) => {
    event.preventDefault();
    if (!parentForm.userId || !parentForm.familyId || !parentForm.reason || !parentForm.verificationConfirmed || savingParent) return;
    setSavingParent(true);
    setMessage("");
    setError("");
    try {
      const response = await fetch("/api/admin/supporter/parents", {
        method: "POST",
        headers: headers(),
        body: JSON.stringify({
          userId: Number(parentForm.userId),
          familyId: parentForm.familyId,
          role: parentForm.role,
          verificationConfirmed: true,
          reason: parentForm.reason,
        }),
      });
      await readResponse(response);
      setMessage("親権限の確認を記録しました。");
      setParentForm({ ...parentForm, reason: "", verificationConfirmed: false });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "親権限を確認できません。");
    } finally {
      setSavingParent(false);
    }
  };

  return (
    <section className="space-y-4" aria-label="サポーターアカウント連携">
      <div>
        <h2 className="text-lg font-black">サポーターアカウント連携</h2>
        <p className="text-xs text-gray-500">既存ユーザーだけを連携します。外部認証やメール送信は行いません。</p>
      </div>
      {message && <p className="rounded-lg bg-green-50 p-3 text-sm text-green-700" role="status">{message}</p>}
      {error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700" role="alert">{error}</p>}

      <form onSubmit={submitAccount} className="space-y-3 rounded-xl border bg-white p-4">
        <h3 className="font-bold">既存ユーザーを連携</h3>
        <div>
          <Label htmlFor="supporter-user-id">既存アカウント（ユーザー）ID</Label>
          <Input id="supporter-user-id" required type="number" min="1" step="1" value={accountForm.userId}
            onChange={(event) => setAccountForm({ ...accountForm, userId: event.target.value })} />
        </div>
        <div>
          <Label htmlFor="supporter-public-code">公開コード</Label>
          <Input id="supporter-public-code" required value={accountForm.publicCode}
            onChange={(event) => setAccountForm({ ...accountForm, publicCode: event.target.value })} />
        </div>
        <div>
          <Label htmlFor="supporter-display-name">表示名</Label>
          <Input id="supporter-display-name" value={accountForm.displayName}
            onChange={(event) => setAccountForm({ ...accountForm, displayName: event.target.value })} />
        </div>
        <div>
          <Label htmlFor="supporter-kind">種別</Label>
          <select id="supporter-kind" className="mt-1 w-full rounded-md border p-2" value={accountForm.kind}
            onChange={(event) => setAccountForm({ ...accountForm, kind: event.target.value as AccountKind })}>
            <option value="facility">施設</option>
            <option value="relative">親族</option>
            <option value="sitter">シッター</option>
          </select>
        </div>
        <Button type="submit" disabled={savingAccount || !adminKey.trim()}>
          {savingAccount ? "保存中…" : "アカウントを連携"}
        </Button>
      </form>

      <section className="rounded-xl border bg-white p-4">
        <h3 className="font-bold">連携済みアカウント</h3>
        {loading && <p className="mt-2 text-sm text-gray-500">読み込み中…</p>}
        {!loading && accounts.length === 0 && <p className="mt-2 text-sm text-gray-500">連携済みアカウントはありません。</p>}
        <div className="mt-2 space-y-2">
          {accounts.map((account) => (
            <div key={account.id} className="rounded-lg border p-3 text-sm">
              <p className="font-bold">{account.displayName}（{account.kind}）</p>
              <p className="text-gray-600">アカウントID: {account.id} · 公開コード: {account.publicCode}</p>
            </div>
          ))}
        </div>
      </section>

      <form onSubmit={submitParent} className="space-y-3 rounded-xl border bg-white p-4">
        <h3 className="font-bold">親権限の確認を記録</h3>
        <p className="text-xs text-amber-700">ユーザーの現在の家族ID・役割と一致することを確認したうえで記録してください。</p>
        <div>
          <Label htmlFor="parent-user-id">既存アカウント（ユーザー）ID</Label>
          <Input id="parent-user-id" required type="number" min="1" step="1" value={parentForm.userId}
            onChange={(event) => setParentForm({ ...parentForm, userId: event.target.value })} />
        </div>
        <div>
          <Label htmlFor="parent-family-id">現在の家族ID</Label>
          <Input id="parent-family-id" required value={parentForm.familyId}
            onChange={(event) => setParentForm({ ...parentForm, familyId: event.target.value })} />
        </div>
        <div>
          <Label htmlFor="parent-role">役割</Label>
          <select id="parent-role" className="mt-1 w-full rounded-md border p-2" value={parentForm.role}
            onChange={(event) => setParentForm({ ...parentForm, role: event.target.value as "papa" | "mama" })}>
            <option value="papa">パパ</option>
            <option value="mama">ママ</option>
          </select>
        </div>
        <div>
          <Label htmlFor="parent-reason">確認理由</Label>
          <Input id="parent-reason" required value={parentForm.reason}
            onChange={(event) => setParentForm({ ...parentForm, reason: event.target.value })} />
        </div>
        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" required checked={parentForm.verificationConfirmed}
            onChange={(event) => setParentForm({ ...parentForm, verificationConfirmed: event.target.checked })} />
          <span>ユーザーの現在の家族IDと役割を確認しました。</span>
        </label>
        <Button type="submit" disabled={savingParent || !adminKey.trim() || !parentForm.verificationConfirmed}>
          {savingParent ? "保存中…" : "確認済み親権限を記録"}
        </Button>
      </form>
    </section>
  );
}

export default AccountLinking;
