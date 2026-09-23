import { useEffect, useState } from "react";
import { Link } from "wouter";
import {
  ArrowRight,
  Building2,
  Check,
  Copy,
  ExternalLink,
  ShieldAlert,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";

type Persona = "parent" | "facility";
type DevelopmentStatus = {
  enabled: boolean;
  message?: string;
  session?: {
    authenticated: boolean;
    persona: Persona | null;
    displayName?: string;
  };
  fixture?: {
    familyId: string;
    publicCode: string;
    inviteAddress: string;
    displayName: string;
  };
};

const FIXTURE = {
  publicCode: "BUDOUNOKI-DEV",
  inviteAddress: "BUDOUNOKI-DEV",
  displayName: "ぶどうの木",
};

export default function SupporterDevelopment() {
  const [status, setStatus] = useState<DevelopmentStatus>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [switching, setSwitching] = useState<Persona>();
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/supporter/development/status", {
      credentials: "include",
      headers: { Accept: "application/json" },
    })
      .then(async (response) => {
        const body = (await response.json().catch(() => ({}))) as DevelopmentStatus;
        if (cancelled) return;
        setStatus(body);
        if (!response.ok && response.status !== 404) {
          setError(body.message || "開発用ワークベンチの状態を確認できません。");
        }
      })
      .catch(() => {
        if (!cancelled) setError("開発用ワークベンチの状態を確認できません。");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const enter = async (persona: Persona) => {
    setSwitching(persona);
    setError("");
    try {
      const response = await fetch("/api/supporter/development/session", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ persona }),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.message || `切り替えに失敗しました（${response.status}）。`);
      }
      // The server responds with a 303 after saving the regenerated session.
      // Fetch follows it; navigate explicitly so the SPA route takes over.
      window.location.assign(persona === "parent" ? "/supporter/manage" : "/supporter");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "切り替えに失敗しました。");
      setSwitching(undefined);
    }
  };

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(FIXTURE.inviteAddress);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setError("公開コードをクリップボードへコピーできませんでした。");
    }
  };

  const enabled = status?.enabled === true;
  const fixture = status?.fixture || FIXTURE;

  return (
    <main className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-green-50 px-4 py-8">
      <div className="mx-auto max-w-2xl space-y-5">
        <header className="rounded-3xl border border-amber-200 bg-amber-50 p-5 shadow-sm">
          <div className="flex items-start gap-3">
            <ShieldAlert className="mt-0.5 h-6 w-6 shrink-0 text-amber-700" />
            <div>
              <p className="text-xs font-black uppercase tracking-widest text-amber-700">
                Developer-only workbench
              </p>
              <h1 className="mt-1 text-2xl font-black text-amber-950">
                サポーター手動検証
              </h1>
              <p className="mt-2 text-sm leading-6 text-amber-900">
                これは開発用の固定テスト役割を選ぶ画面です。Googleログインや
                新しい認証プロバイダではありません。本番のログイン情報は扱いません。
              </p>
            </div>
          </div>
        </header>

        {loading && (
          <section className="rounded-2xl border bg-white p-5 text-sm text-gray-500">
            利用条件を確認しています…
          </section>
        )}

        {!loading && !enabled && (
          <section className="rounded-2xl border border-red-200 bg-red-50 p-5">
            <h2 className="font-black text-red-900">ワークベンチは無効です</h2>
            <p className="mt-2 text-sm leading-6 text-red-800">
              NODE_ENV=development、3つの開発フラグ、指定された開発用
              PostgreSQLデータベース名がすべて一致した場合だけ利用できます。
            </p>
            <p className="mt-3 rounded-xl bg-white/70 p-3 text-xs font-bold text-red-800">
              {status?.message || error || "開発用環境でのみ利用できます。"}
            </p>
          </section>
        )}

        {enabled && (
          <>
            <section className="rounded-2xl border bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <div>
                <h2 className="font-black text-gray-900">テスト役割を選択</h2>
                  <p className="mt-1 text-sm text-gray-500">
                    選択すると通常のセッションを再生成します。
                  </p>
                </div>
                {status.session?.persona && (
                  <span className="rounded-full bg-purple-100 px-3 py-1 text-xs font-bold text-purple-800">
                    現在: {status.session.persona === "parent" ? "保護者" : "施設"}
                  </span>
                )}
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <Button
                  className="h-auto justify-between rounded-2xl p-4"
                  disabled={!!switching}
                  onClick={() => enter("parent")}
                >
                  <span className="flex items-center gap-3 text-left">
                    <Users className="h-5 w-5" />
                    <span>
                      <span className="block font-black">保護者として入る</span>
                      <span className="block text-xs font-normal opacity-80">
                        招待・受け入れ管理
                      </span>
                    </span>
                  </span>
                  <ArrowRight className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  className="h-auto justify-between rounded-2xl border-2 p-4"
                  disabled={!!switching}
                  onClick={() => enter("facility")}
                >
                  <span className="flex items-center gap-3 text-left">
                    <Building2 className="h-5 w-5 text-purple-600" />
                    <span>
                      <span className="block font-black text-gray-900">施設として入る</span>
                      <span className="block text-xs font-normal text-gray-500">
                        招待の受け入れ・記録
                      </span>
                    </span>
                  </span>
                  <ArrowRight className="h-4 w-4 text-purple-600" />
                </Button>
              </div>
              {switching && (
                <p className="mt-3 text-xs text-gray-500">セッションを切り替えています…</p>
              )}
            </section>

            <section className="rounded-2xl border bg-white p-5 shadow-sm">
              <h2 className="font-black text-gray-900">固定の施設アカウント</h2>
              <dl className="mt-3 space-y-2 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-gray-500">表示名</dt>
                  <dd className="font-bold">{fixture.displayName}</dd>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-gray-500">公開コード / 招待先</dt>
                  <dd className="flex items-center gap-2 font-mono text-xs font-bold">
                    {fixture.publicCode}
                    <button
                      type="button"
                      className="rounded-lg p-1.5 text-purple-600 hover:bg-purple-50"
                      onClick={copyCode}
                      aria-label="公開コードをコピー"
                    >
                      {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                    </button>
                  </dd>
                </div>
              </dl>
              <p className="mt-3 text-xs leading-5 text-gray-500">
                招待を作るときはこの文字列をそのまま入力してください。これは
                メールアドレスでも秘密情報でもありません。
              </p>
            </section>

            <section className="rounded-2xl border bg-white p-5 shadow-sm">
              <h2 className="font-black text-gray-900">検証の流れ</h2>
              <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm leading-6 text-gray-600">
                <li>
                  保護者で入り、通常の「サポーター管理」画面から子どもを選び、
                  施設アカウントへ招待を作成します。
                </li>
                <li>施設で入り、通常のサポーターポータルから招待を受け入れます。</li>
                <li>記録の表示範囲、アレルギー・引き継ぎ情報、記録の追加と訂正を確認します。</li>
              </ol>
              <div className="mt-4 flex flex-wrap gap-2 text-sm">
                <Link href="/supporter/manage">
                  <Button variant="outline" size="sm">
                    管理画面 <ExternalLink className="ml-1 h-3.5 w-3.5" />
                  </Button>
                </Link>
                <Link href="/supporter">
                  <Button variant="outline" size="sm">
                    ポータル <ExternalLink className="ml-1 h-3.5 w-3.5" />
                  </Button>
                </Link>
              </div>
              <p className="mt-4 rounded-xl bg-blue-50 p-3 text-xs leading-5 text-blue-900">
                2つのタブで切り替える場合、Cookieは同じブラウザ全体で共有されるため
                同時に別々の役割にはなりません。保護者用と施設用は、別ブラウザ
                コンテキスト（または別ブラウザ）で順番に確認してください。
              </p>
            </section>
          </>
        )}

        {error && (
          <p className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {error}
          </p>
        )}
      </div>
    </main>
  );
}