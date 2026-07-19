import { useState } from "react";
import { Shield, Key, Users, TicketCheck, ArrowLeft, Copy, Loader2, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";

export default function AdminDashboard() {
  const [adminKey, setAdminKey] = useState("");
  const [authenticated, setAuthenticated] = useState(false);
  const [codes, setCodes] = useState<any[]>([]);
  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [generateCount, setGenerateCount] = useState(10);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const headers = { "Content-Type": "application/json", "x-admin-key": adminKey.trim() };

  const authenticate = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/invitation-codes", { headers });
      if (res.ok) {
        localStorage.setItem("admin_key", adminKey);
        setAuthenticated(true);
        const data = await res.json();
        setCodes(data);
        const usersRes = await fetch("/api/admin/users", { headers });
        if (usersRes.ok) setAllUsers(await usersRes.json());
      } else {
        alert("管理キーが無効です");
      }
    } catch {
      alert("接続エラー");
    }
    setLoading(false);
  };

  const generateCodes = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/generate-codes", {
        method: "POST",
        headers,
        body: JSON.stringify({ count: generateCount, prefix: "BUDOU" }),
      });
      if (res.ok) {
        const codesRes = await fetch("/api/admin/invitation-codes", { headers });
        if (codesRes.ok) setCodes(await codesRes.json());
      }
    } catch {
      alert("生成エラー");
    }
    setLoading(false);
  };

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedId(code);
    setTimeout(() => setCopiedId(null), 1500);
  };

  if (!authenticated) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-6">
        <Card className="w-full max-w-sm p-6 rounded-[24px]">
          <div className="flex items-center gap-2 mb-4">
            <Shield className="w-5 h-5 text-purple-500" />
            <h1 className="text-lg font-black" data-testid="text-admin-title">管理者ログイン</h1>
          </div>
          <Input
            type="password"
            value={adminKey}
            onChange={(e) => setAdminKey(e.target.value)}
            placeholder="管理キーを入力"
            className="rounded-xl mb-3"
            onKeyDown={(e) => e.key === "Enter" && authenticate()}
            data-testid="input-admin-key"
          />
          <Button
            onClick={authenticate}
            disabled={loading || !adminKey}
            className="w-full rounded-[20px]"
            style={{ backgroundColor: "#805AAA" }}
            data-testid="button-admin-login"
          >
            {loading && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
            ログイン
          </Button>
        </Card>
      </div>
    );
  }

  const unusedCodes = codes.filter((c) => !c.isUsed && !c.is_used);
  const usedCodes = codes.filter((c) => c.isUsed || c.is_used);

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <div className="bg-white border-b px-4 py-3 flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => window.location.href = "/"} data-testid="button-admin-back">
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <h1 className="text-lg font-black" data-testid="text-admin-dashboard-title">管理ダッシュボード</h1>
      </div>

      <div className="px-4 py-4 space-y-4 max-w-lg mx-auto">
        <Card className="p-4 rounded-[24px]">
          <div className="flex items-center gap-2 mb-3">
            <Key className="w-5 h-5 text-purple-500" />
            <h2 className="font-black" data-testid="text-generate-title">招待コード生成</h2>
          </div>
          <div className="flex gap-2 mb-3">
            <Input
              type="number"
              value={generateCount}
              onChange={(e) => setGenerateCount(parseInt(e.target.value) || 1)}
              min={1}
              max={200}
              className="rounded-xl w-24"
              data-testid="input-generate-count"
            />
            <Button
              onClick={generateCodes}
              disabled={loading}
              className="rounded-[16px] flex-1"
              style={{ backgroundColor: "#805AAA" }}
              data-testid="button-generate-codes"
            >
              {loading && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              生成
            </Button>
          </div>
          <p className="text-xs text-gray-500" data-testid="text-code-stats">
            未使用: {unusedCodes.length} / 使用済み: {usedCodes.length} / 合計: {codes.length}
          </p>
        </Card>

        <Card className="p-4 rounded-[24px]">
          <div className="flex items-center gap-2 mb-3">
            <TicketCheck className="w-5 h-5 text-green-500" />
            <h2 className="font-black" data-testid="text-unused-title">未使用コード ({unusedCodes.length})</h2>
          </div>
          <div className="space-y-1 max-h-60 overflow-y-auto">
            {unusedCodes.map((c) => (
              <div key={c.id} className="flex items-center justify-between py-1.5 px-2 bg-green-50 rounded-xl">
                <span className="font-mono font-bold text-sm" data-testid={`text-code-${c.id}`}>{c.code}</span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => copyCode(c.code)}
                  data-testid={`button-copy-${c.id}`}
                >
                  {copiedId === c.code ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
                </Button>
              </div>
            ))}
            {unusedCodes.length === 0 && <p className="text-sm text-gray-400 text-center py-2">未使用コードなし</p>}
          </div>
        </Card>

        <Card className="p-4 rounded-[24px]">
          <div className="flex items-center gap-2 mb-3">
            <Users className="w-5 h-5 text-blue-500" />
            <h2 className="font-black" data-testid="text-users-title">登録ユーザー ({allUsers.length})</h2>
          </div>
          <div className="space-y-2 max-h-60 overflow-y-auto">
            {allUsers.map((u) => (
              <div key={u.id} className="flex items-center gap-2 py-1.5 px-2 bg-gray-50 rounded-xl">
                {u.pictureUrl && <img src={u.pictureUrl} className="w-7 h-7 rounded-full" alt="" />}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold truncate" data-testid={`text-user-${u.id}`}>{u.displayName || "名前なし"}</p>
                  <p className="text-xs text-gray-400">{u.role || "未設定"} · {u.invitationVerified || u.invitation_verified ? "認証済" : "未認証"}</p>
                </div>
              </div>
            ))}
            {allUsers.length === 0 && <p className="text-sm text-gray-400 text-center py-2">ユーザーなし</p>}
          </div>
        </Card>
      </div>
    </div>
  );
}
