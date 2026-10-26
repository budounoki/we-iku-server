import { ReactNode } from "react";
import { AlertCircle, Loader2 } from "lucide-react";
import { Link } from "wouter";
import { SupporterStatus } from "@/lib/supporter";

export function SupporterStatusPanel({
  status,
  loading,
  error,
  children,
  manage = false,
}: {
  status?: SupporterStatus;
  loading: boolean;
  error?: string;
  children: ReactNode;
  manage?: boolean;
}) {
  if (loading) {
    return <main className="min-h-screen grid place-items-center text-gray-500"><Loader2 className="w-6 h-6 animate-spin mr-2" />確認しています…</main>;
  }
  const unavailable = !status?.enabled || !status.authenticated || (manage ? !status.canManage : !status.isSupporter);
  if (unavailable) {
    // 状態ごとに見出しと説明を分ける。以前は未ログインでも「利用準備中です／この
    // アカウントには権限がありません」と出ており、ログインすれば使える状態なのに
    // 機能が未完成だと誤解された（client 2026-10: 準備中と表示される）。
    const notLoggedIn = !!status?.enabled && !status.authenticated;
    const wrongAccount = !!status?.enabled && !!status.authenticated;
    const title = error || !status?.enabled
      ? "サポーター機能は利用準備中です"
      : notLoggedIn
        ? "ログインしてください"
        : manage
          ? "この画面はパパ・ママのアカウントで利用できます"
          : "このアカウントはサポーターとして登録されていません";
    const message = error || status?.message || (notLoggedIn
      ? "管理画面でサポーター（施設）として登録したアカウントで、下のリンクからログインしてください。"
      : manage
        ? "お子さまのいるご家族のアカウントでログインしてください。"
        : "管理画面でサポーター（施設）として登録したアカウントでログインし直してください。別のアカウントでログインしている場合は、一度ログアウトしてください。");
    return (
      <main className="min-h-screen bg-slate-50 px-4 py-12">
        <section className="max-w-xl mx-auto bg-white border rounded-2xl p-6 shadow-sm">
          <AlertCircle className="w-7 h-7 text-amber-600 mb-3" />
          <h1 className="font-bold text-lg text-gray-800">{title}</h1>
          <p className="text-sm text-gray-600 mt-3 leading-relaxed">{message}</p>
          {wrongAccount && (
            <button
              type="button"
              className="mt-3 text-sm font-medium text-purple-700 underline"
              onClick={async () => {
                try { await fetch("/api/auth/logout", { method: "POST", credentials: "include" }); } catch { /* reload anyway */ }
                window.location.reload();
              }}
            >
              ログアウトして別のアカウントでログインする
            </button>
          )}
          <p className="text-xs text-gray-500 mt-4 leading-relaxed">
             サポーター機能は、既存の認証済みアカウントと対象のお子さまに付与された利用権限を組み合わせて利用します。WebはLINE・Googleログイン、iOS/AndroidアプリはLINE・Google・Appleに対応しています。WebでメールログインやGuestログインを追加したり、この画面から新しいアカウントを発行したりすることはありません。施設の共用端末では、施設の既存の共通アカウントでログインしてください。
          </p>
          {!status?.authenticated && (
            <div className="mt-4 flex flex-col gap-2">
              <a className="inline-block text-sm font-medium text-purple-700 underline" href="/api/auth/google/native?web=true">Googleアカウントでログイン（施設向け）</a>
              <a className="inline-block text-sm font-medium text-purple-700 underline" href="/api/auth/line">LINEでログイン</a>
            </div>
          )}
           {/* 開発用の架空アカウント切替リンクはクライアントに表示しない（dev専用ツール。
               本番は dev モードで動いており import.meta.env.DEV が true になり漏れていたため撤去。
               開発時は /supporter/development に直接アクセスする。2026-10） */}
        </section>
      </main>
    );
  }
  return <>{children}</>;
}