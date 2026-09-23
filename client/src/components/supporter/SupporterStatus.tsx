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
    return (
      <main className="min-h-screen bg-slate-50 px-4 py-12">
        <section className="max-w-xl mx-auto bg-white border rounded-2xl p-6 shadow-sm">
          <AlertCircle className="w-7 h-7 text-amber-600 mb-3" />
          <h1 className="font-bold text-lg text-gray-800">サポーター機能は利用準備中です</h1>
          <p className="text-sm text-gray-600 mt-3 leading-relaxed">
            {error || status?.message || "このアカウントにはサポーター機能の利用権限がありません。"}
          </p>
          <p className="text-xs text-gray-500 mt-4 leading-relaxed">
             サポーター機能は、既存の認証済みアカウントと対象のお子さまに付与された利用権限を組み合わせて利用します。WebはLINEログインのみ、iOS/AndroidアプリはLINE・Google・Appleに対応しています。WebでメールログインやGuestログインを追加したり、この画面から新しいアカウントを発行したりすることはありません。施設の共用端末では、施設の既存の共通アカウントでログインしてください。
          </p>
           {import.meta.env.DEV && <Link className="mt-4 inline-block text-sm font-medium text-purple-700 underline" href="/supporter/development">開発用の架空アカウント切替</Link>}
        </section>
      </main>
    );
  }
  return <>{children}</>;
}