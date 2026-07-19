import { useState } from "react";
import { motion } from "framer-motion";
import { Grape, Loader2, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface InvitationCodeProps {
  onVerified: () => void;
}

export default function InvitationCode({ onVerified }: InvitationCodeProps) {
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!code.trim()) {
      setError("招待コードを入力してください");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/auth/verify-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ code: code.trim().toUpperCase() }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.message || "エラーが発生しました");
        setLoading(false);
        return;
      }

      localStorage.setItem("invitation_verified", "true");
      onVerified();
    } catch {
      setError("通信エラーが発生しました。もう一度お試しください。");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-green-50 flex items-center justify-center px-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-sm"
      >
        <div className="flex flex-col items-center mb-8">
          <div className="w-20 h-20 rounded-full bg-gradient-to-br from-purple-100 to-green-50 flex items-center justify-center shadow-sm border-4 border-white mb-4">
            <Grape className="w-10 h-10 text-purple-500" />
          </div>
          <h1 className="text-2xl font-black text-purple-700 mb-1" data-testid="text-invitation-title">
            We育
          </h1>
          <p className="text-sm font-bold text-purple-400">
            ふたりで育てる、ふたりで楽しむ
          </p>
        </div>

        <div className="bg-white/80 backdrop-blur-sm rounded-[24px] p-6 shadow-sm border border-purple-100">
          <div className="flex items-center gap-2 mb-5">
            <ShieldCheck className="w-5 h-5 text-purple-500" />
            <h2 className="text-base font-black text-gray-800" data-testid="text-code-prompt">
              招待コードを入力してください
            </h2>
          </div>

          <Input
            value={code}
            onChange={(e) => {
              setCode(e.target.value.toUpperCase());
              if (error) setError("");
            }}
            placeholder="例: BUDOU-A3K9"
            className="rounded-xl border-2 text-center text-lg font-bold tracking-wider h-14 mb-3"
            maxLength={20}
            onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
            data-testid="input-invitation-code"
          />

          {error && (
            <motion.p
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-sm font-bold text-red-500 text-center mb-3"
              data-testid="text-invitation-error"
            >
              {error}
            </motion.p>
          )}

          <Button
            onClick={handleSubmit}
            disabled={loading || !code.trim()}
            className="w-full h-14 rounded-[20px] font-black text-base"
            style={{ backgroundColor: "#805AAA" }}
            data-testid="button-verify-code"
          >
            {loading ? (
              <Loader2 className="w-5 h-5 animate-spin mr-2" />
            ) : null}
            確認
          </Button>
        </div>

        <p className="text-xs text-gray-400 text-center mt-6 leading-relaxed px-4" data-testid="text-invitation-help">
          招待コードをお持ちでない方は、We育のLINE公式アカウントにお問い合わせください
        </p>

        <button
          onClick={() => {
            localStorage.clear();
            sessionStorage.clear();
            fetch("/api/auth/logout", { method: "POST" }).finally(() => {
              window.location.href = "/";
            });
          }}
          className="block mx-auto mt-4 text-xs font-bold text-purple-400 underline px-3 py-2"
          data-testid="button-back-to-login"
        >
          最初の画面に戻る
        </button>
      </motion.div>
    </div>
  );
}
