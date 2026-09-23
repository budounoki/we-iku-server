import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { ArrowLeft, Users, FileText, Heart, MessageSquare, Loader2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { ja } from "date-fns/locale";
import { useState } from "react";
import { Input } from "@/components/ui/input";

interface AdminStatsData {
  totalFamilies: number;
  totalLogs: number;
  todayLogs: number;
  papaFamilies: number;
  mamaFamilies: number;
  pairedFamilies: number;
  feedbackCount: number;
}

interface FeedbackItem {
  id: number;
  familyId: string;
  userId: string;
  message: string;
  createdAt: string;
}

function StatCard({ label, value, icon: Icon, sub }: { label: string; value: number; icon: typeof Users; sub?: string }) {
  return (
    <Card className="p-5 rounded-[24px]">
      <div className="flex items-center gap-3 mb-2">
        <div className="w-10 h-10 rounded-2xl bg-purple-100 flex items-center justify-center">
          <Icon className="w-5 h-5 text-purple-600" />
        </div>
        <span className="text-sm font-medium text-muted-foreground">{label}</span>
      </div>
      <p className="text-3xl font-black text-foreground" data-testid={`stat-${label}`}>{value}</p>
      {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
    </Card>
  );
}

export default function AdminStats() {
  const [keyInput, setKeyInput] = useState("");
  const [access, setAccess] = useState<{ key: string; scope: string }>();
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState("");
  if (access) return <AuthorizedAdminStats adminKey={access.key} scope={access.scope} />;
  return <main className="mx-auto max-w-md p-6">
    <h1 className="mb-4 text-xl font-bold">管理者統計</h1>
    <form className="space-y-4" onSubmit={async (event) => {
      event.preventDefault();
      if (checking) return;
      setChecking(true);
      setError("");
      try {
        const response = await fetch("/api/admin/stats", {
          headers: { "x-admin-key": keyInput.trim() }, cache: "no-store",
        });
        if (!response.ok) throw new Error("管理者権限を確認できませんでした。");
        setAccess({ key: keyInput.trim(), scope: crypto.randomUUID() });
        setKeyInput("");
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "通信に失敗しました。");
      } finally { setChecking(false); }
    }}>
      <label htmlFor="admin-stats-key">既存の管理者キー</label>
      <Input id="admin-stats-key" type="password" autoComplete="off" required
        value={keyInput} onChange={(event) => setKeyInput(event.target.value)} />
      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
      <Button disabled={checking} type="submit">{checking ? "確認中…" : "統計を開く"}</Button>
    </form>
  </main>;
}

function AuthorizedAdminStats({ adminKey, scope }: { adminKey: string; scope: string }) {
  async function load<T,>(path: string): Promise<T> {
    const response = await fetch(path, { headers: { "x-admin-key": adminKey }, cache: "no-store" });
    if (!response.ok) throw new Error("管理者権限または通信状態を確認してください。");
    return response.json();
  }
  const { data, isLoading, error } = useQuery<AdminStatsData>({
    queryKey: ["/api/admin/stats", scope],
    queryFn: () => load<AdminStatsData>("/api/admin/stats"),
    gcTime: 0,
    refetchInterval: 10000,
  });
  const { data: feedbackList = [] } = useQuery<FeedbackItem[]>({
    queryKey: ["/api/admin/feedbacks", scope],
    queryFn: () => load<FeedbackItem[]>("/api/admin/feedbacks"),
    gcTime: 0,
    refetchInterval: 30000,
  });

  if (error) return <p role="alert" className="p-6">{error.message}</p>;
  if (isLoading || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-50 via-white to-green-50">
        <Loader2 className="w-8 h-8 animate-spin text-purple-400" />
      </div>
    );
  }

  const totalUsers = data.papaFamilies + data.mamaFamilies;

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-green-50">
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-sm border-b px-4 py-3">
        <div className="max-w-lg mx-auto flex items-center gap-3">
          <Link href="/">
            <Button variant="ghost" size="icon" data-testid="button-admin-back">
              <ArrowLeft className="w-5 h-5" />
            </Button>
          </Link>
          <h1 className="text-lg font-black text-foreground">Admin Stats</h1>
        </div>
      </header>

      <main className="max-w-lg mx-auto p-4 space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <StatCard
            label="登録ファミリー数"
            value={data.totalFamilies}
            icon={Users}
          />
          <StatCard
            label="ペアリング済み"
            value={data.pairedFamilies}
            icon={Heart}
            sub="両親が使用中"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <StatCard
            label="累計ユーザー数"
            value={totalUsers}
            icon={Users}
            sub={`パパ ${data.papaFamilies} / ママ ${data.mamaFamilies}`}
          />
          <StatCard
            label="フィードバック"
            value={data.feedbackCount}
            icon={MessageSquare}
          />
        </div>

        <StatCard
          label="累計ログ数"
          value={data.totalLogs}
          icon={FileText}
        />

        <Card className="p-5 rounded-[24px] text-white" style={{ backgroundColor: "#805AAA" }}>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-2xl bg-white/20 flex items-center justify-center">
              <FileText className="w-5 h-5 text-white" />
            </div>
            <span className="text-sm font-medium text-white/70">今日のログ数</span>
          </div>
          <p className="text-4xl font-black" data-testid="stat-today-logs">{data.todayLogs}</p>
          <p className="text-xs text-white/60 mt-1">本日のアクティビティ</p>
        </Card>

        {feedbackList.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 pt-2">
              <MessageSquare className="w-5 h-5 text-purple-500" />
              <h2 className="text-base font-black text-foreground">改善フィードバック（{feedbackList.length}件）</h2>
            </div>
            {feedbackList.map((fb) => (
              <Card key={fb.id} className="p-4 rounded-[20px]" data-testid={`feedback-item-${fb.id}`}>
                <div className="flex items-start justify-between gap-2 mb-2">
                  <span className="text-xs font-bold text-purple-600 bg-purple-50 px-2 py-0.5 rounded-full">
                    {fb.userId === "papa" ? "パパ" : fb.userId === "mama" ? "ママ" : fb.userId}
                  </span>
                  <span className="text-[10px] text-muted-foreground shrink-0">
                    {format(new Date(fb.createdAt), "M/d HH:mm", { locale: ja })}
                  </span>
                </div>
                <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap" data-testid={`feedback-message-${fb.id}`}>
                  {fb.message}
                </p>
                <p className="text-[10px] text-muted-foreground mt-2">
                  Family: {fb.familyId.slice(0, 12)}...
                </p>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
