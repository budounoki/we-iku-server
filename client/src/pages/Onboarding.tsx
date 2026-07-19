import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Grape, User, Crown, ChevronRight, Cake, Baby, Link2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useUpdateSettings } from "@/hooks/use-app-data";

const LIFF_ID = import.meta.env.VITE_LIFF_ID;

interface OnboardingProps {
  onComplete: () => void;
}

export default function Onboarding({ onComplete }: OnboardingProps) {
  const [step, setStep] = useState(0);
  const [hasCode, setHasCode] = useState<boolean | null>(null);
  const [pairingCode, setPairingCode] = useState("");
  const [babyName, setBabyName] = useState("");
  const [babyBirthday, setBabyBirthday] = useState("");
  const [userType, setUserType] = useState<"papa" | "mama" | "">("");
  const [pairingError, setPairingError] = useState("");
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const { mutate, isPending } = useUpdateSettings();

  useEffect(() => {
    if (!LIFF_ID) return;
    let cancelled = false;
    (async () => {
      try {
        const liff = (await import("@line/liff")).default;
        await liff.init({ liffId: LIFF_ID });
        if (cancelled) return;
        if (!liff.isLoggedIn()) return;
        const accessToken = liff.getAccessToken();
        if (!accessToken) return;
        const res = await fetch("/api/auth/line-liff", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ accessToken }),
        });
        if (!res.ok) return;
        const data = await res.json();
        if (cancelled || !data.authenticated || !data.familyId) return;
        localStorage.setItem("familyId", data.familyId);
        if (data.role) localStorage.setItem("userType", data.role);
        if (data.displayName) localStorage.setItem("lineDisplayName", data.displayName);
        if (data.pictureUrl) localStorage.setItem("linePictureUrl", data.pictureUrl);
        if (data.invitationVerified) localStorage.setItem("invitation_verified", "true");
        localStorage.setItem("onboarding_done", "true");
        window.location.reload();
      } catch (err) {
        console.error("LIFF init error:", err);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const handleLineLogin = async (e: React.MouseEvent) => {
    e.preventDefault();
    if (isLoggingIn) return;
    setIsLoggingIn(true);
    if (LIFF_ID) {
      try {
        const liff = (await import("@line/liff")).default;
        try { await liff.init({ liffId: LIFF_ID }); } catch {}
        liff.login({ redirectUri: window.location.origin + "/" });
        return;
      } catch (err) {
        console.error("LIFF login error, falling back:", err);
      }
    }
    window.location.href = "/api/auth/line";
  };

  const handleFinishNew = () => {
    const familyId = `family-${Date.now().toString(36)}`;
    localStorage.setItem("familyId", familyId);
    localStorage.setItem("userType", userType);
    localStorage.setItem("onboarding_done", "true");

    mutate(
      {
        familyId,
        babyName: babyName || "赤ちゃん",
        babyBirthday: babyBirthday || undefined,
        currentCaregiver: userType === "papa" ? "パパ" : "ママ",
      },
      {
        onSettled: () => onComplete(),
      }
    );
  };

  const handleFinishJoin = () => {
    const code = pairingCode.trim();
    if (!code) {
      setPairingError("コードを入力してください");
      return;
    }
    localStorage.setItem("familyId", code);
    localStorage.setItem("userType", userType);
    localStorage.setItem("onboarding_done", "true");
    onComplete();
  };

  const totalSteps = hasCode ? 3 : 4;

  const pageTransition = {
    initial: { opacity: 0, y: 20 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -20 },
  };

  return (
    <div className="fixed inset-0 z-[100] bg-gradient-to-br from-purple-50 via-white to-green-50 overflow-auto">
      <div className="max-w-md mx-auto min-h-screen flex flex-col items-center justify-center px-8 py-12">
        <AnimatePresence mode="wait">
          {step === 0 && (
            <motion.div
              key="welcome"
              {...pageTransition}
              className="flex flex-col items-center text-center w-full"
            >
              <div className="w-28 h-28 rounded-full bg-gradient-to-br from-purple-100 to-green-50 flex items-center justify-center shadow-lg border-4 border-white mb-6">
                <Grape className="w-14 h-14 text-purple-500" />
              </div>
              <h1 className="text-3xl font-black text-purple-700 tracking-tight mb-2" data-testid="text-onboarding-title">
                We育
              </h1>
              <p className="text-sm font-bold text-purple-400 mb-6">
                ふたりで育てる、ふたりで楽しむ
              </p>
              <div className="w-12 h-px bg-purple-200 mb-4" />
              <p className="text-[10px] font-bold text-purple-300 tracking-widest uppercase mb-1">
                Produced by
              </p>
              <p className="text-sm font-black text-purple-500 mb-8">
                産前産後ケアホテル ぶどうの木
              </p>
              <div className="bg-white/80 backdrop-blur-sm rounded-3xl p-6 border-2 border-purple-100 shadow-sm w-full mb-8">
                <p className="text-base font-bold text-purple-700 leading-relaxed">
                  最強のチーム作りを
                  <br />
                  サポートします
                </p>
                <p className="text-xs text-gray-500 mt-3 leading-relaxed">
                  育児の記録・共有・振り返りを通じて、パパとママが最高のチームになるためのアプリです。
                </p>
              </div>
              <a
                href="/api/auth/line"
                onClick={handleLineLogin}
                aria-disabled={isLoggingIn}
                className={`w-full h-14 rounded-2xl text-lg font-black shadow-lg flex items-center justify-center gap-3 text-white bg-[#06C755] active:bg-[#05a648] transition-colors ${isLoggingIn ? "opacity-70 pointer-events-none" : ""}`}
                data-testid="button-line-login"
              >
                <svg viewBox="0 0 24 24" className="w-6 h-6 fill-current">
                  <path d="M19.365 9.863c.349 0 .63.285.63.631 0 .345-.281.63-.63.63H17.61v1.125h1.755c.349 0 .63.283.63.63 0 .344-.281.629-.63.629h-2.386c-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.627-.63h2.386c.349 0 .63.285.63.63 0 .349-.281.63-.63.63H17.61v1.125h1.755zm-3.855 3.016c0 .27-.174.51-.432.596-.064.021-.133.031-.199.031-.211 0-.391-.09-.51-.25l-2.443-3.317v2.94c0 .344-.279.629-.631.629-.346 0-.626-.285-.626-.629V8.108c0-.27.173-.51.43-.595.06-.023.136-.033.194-.033.195 0 .375.104.495.254l2.462 3.33V8.108c0-.345.282-.63.63-.63.345 0 .63.285.63.63v4.771zm-5.741 0c0 .344-.282.629-.631.629-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.627-.63.349 0 .631.285.631.63v4.771zm-2.466.629H4.917c-.345 0-.63-.285-.63-.629V8.108c0-.345.285-.63.63-.63.348 0 .63.285.63.63v4.141h1.756c.348 0 .629.283.629.63 0 .344-.282.629-.629.629M24 10.314C24 4.943 18.615.572 12 .572S0 4.943 0 10.314c0 4.811 4.27 8.842 10.035 9.608.391.082.923.258 1.058.59.12.301.079.766.038 1.08l-.164 1.02c-.045.301-.24 1.186 1.049.645 1.291-.539 6.916-4.078 9.436-6.975C23.176 14.393 24 12.458 24 10.314" />
                </svg>
                LINEでログイン
              </a>
              <p className="text-xs text-gray-400 mt-4 text-center">
                LINEアカウントでログインしてご利用ください
              </p>
            </motion.div>
          )}

          {step === 1 && (
            <motion.div
              key="pairing-choice"
              {...pageTransition}
              className="flex flex-col items-center w-full"
            >
              <div className="w-20 h-20 rounded-full bg-purple-100 flex items-center justify-center mb-6">
                <Link2 className="w-10 h-10 text-purple-500" />
              </div>
              <h2 className="text-2xl font-black text-gray-800 mb-2" data-testid="text-pairing-question">
                ペアリングコード
              </h2>
              <p className="text-sm text-gray-500 mb-8 text-center leading-relaxed">
                パートナーからペアリングコードを
                <br />
                もらっていますか？
              </p>

              <div className="w-full space-y-4">
                <button
                  onClick={() => {
                    setHasCode(true);
                    setStep(2);
                  }}
                  className="w-full flex items-center gap-4 p-5 rounded-3xl border-2 border-gray-100 bg-white transition-all duration-200 active:scale-[0.98]"
                  data-testid="button-has-pairing-code"
                >
                  <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center shrink-0">
                    <Link2 className="w-6 h-6 text-green-600" />
                  </div>
                  <div className="text-left">
                    <p className="text-base font-black text-gray-800">コードを持っている</p>
                    <p className="text-xs text-gray-400 mt-0.5">パートナーの家族に参加します</p>
                  </div>
                  <ChevronRight className="w-5 h-5 text-gray-300 ml-auto" />
                </button>

                <button
                  onClick={() => {
                    setHasCode(false);
                    setStep(2);
                  }}
                  className="w-full flex items-center gap-4 p-5 rounded-3xl border-2 border-gray-100 bg-white transition-all duration-200 active:scale-[0.98]"
                  data-testid="button-no-pairing-code"
                >
                  <div className="w-12 h-12 rounded-full bg-purple-100 flex items-center justify-center shrink-0">
                    <Plus className="w-6 h-6 text-purple-600" />
                  </div>
                  <div className="text-left">
                    <p className="text-base font-black text-gray-800">新しくはじめる</p>
                    <p className="text-xs text-gray-400 mt-0.5">家族を新規登録します</p>
                  </div>
                  <ChevronRight className="w-5 h-5 text-gray-300 ml-auto" />
                </button>
              </div>
            </motion.div>
          )}

          {step === 2 && hasCode && (
            <motion.div
              key="enter-code"
              {...pageTransition}
              className="flex flex-col items-center w-full"
            >
              <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center mb-6">
                <Link2 className="w-10 h-10 text-green-500" />
              </div>
              <h2 className="text-2xl font-black text-gray-800 mb-2">コードを入力</h2>
              <p className="text-sm text-gray-500 mb-8 text-center">
                パートナーから共有されたコードを
                <br />
                貼り付けてください
              </p>

              <div className="w-full space-y-5">
                <div>
                  <Label htmlFor="ob-code" className="text-sm font-bold text-gray-600 mb-1.5 block">
                    ペアリングコード
                  </Label>
                  <Input
                    id="ob-code"
                    value={pairingCode}
                    onChange={(e) => {
                      setPairingCode(e.target.value);
                      setPairingError("");
                    }}
                    className="rounded-xl border-2 border-gray-100 h-12 text-base font-mono"
                    placeholder="family-xxxxxxxx"
                    data-testid="input-pairing-code"
                  />
                  {pairingError && (
                    <p className="text-xs text-red-500 mt-1.5 font-bold">{pairingError}</p>
                  )}
                </div>

                <div className="pt-2">
                  <h3 className="text-sm font-black text-gray-800 mb-2">あなたの役割</h3>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      onClick={() => setUserType("papa")}
                      className={`flex flex-col items-center justify-center py-6 rounded-2xl border-2 transition-all duration-300 ${
                        userType === "papa"
                          ? "border-purple-400 bg-purple-50 shadow-md scale-[1.02]"
                          : "border-gray-100 bg-white"
                      }`}
                      data-testid="button-onboarding-papa"
                    >
                      <div className={`w-12 h-12 rounded-full flex items-center justify-center mb-2 ${
                        userType === "papa" ? "bg-purple-200" : "bg-gray-100"
                      }`}>
                        <User className={`w-6 h-6 ${userType === "papa" ? "text-purple-600" : "text-gray-400"}`} />
                      </div>
                      <span className={`text-base font-black ${userType === "papa" ? "text-purple-700" : "text-gray-600"}`}>
                        パパ
                      </span>
                    </button>

                    <button
                      onClick={() => setUserType("mama")}
                      className={`flex flex-col items-center justify-center py-6 rounded-2xl border-2 transition-all duration-300 ${
                        userType === "mama"
                          ? "border-pink-400 bg-pink-50 shadow-md scale-[1.02]"
                          : "border-gray-100 bg-white"
                      }`}
                      data-testid="button-onboarding-mama"
                    >
                      <div className={`w-12 h-12 rounded-full flex items-center justify-center mb-2 ${
                        userType === "mama" ? "bg-pink-200" : "bg-gray-100"
                      }`}>
                        <Crown className={`w-6 h-6 ${userType === "mama" ? "text-pink-600" : "text-gray-400"}`} />
                      </div>
                      <span className={`text-base font-black ${userType === "mama" ? "text-pink-700" : "text-gray-600"}`}>
                        ママ
                      </span>
                    </button>
                  </div>
                </div>
              </div>

              <Button
                onClick={handleFinishJoin}
                disabled={!pairingCode.trim() || !userType || isPending}
                className="w-full h-14 rounded-2xl text-lg font-black shadow-lg mt-8"
                data-testid="button-onboarding-join"
              >
                参加する
              </Button>

              <button
                onClick={() => { setStep(1); setHasCode(null); }}
                className="mt-4 text-sm font-bold text-purple-400"
                data-testid="button-onboarding-back-pairing"
              >
                戻る
              </button>
            </motion.div>
          )}

          {step === 2 && hasCode === false && (
            <motion.div
              key="baby"
              {...pageTransition}
              className="flex flex-col items-center w-full"
            >
              <div className="w-20 h-20 rounded-full bg-purple-100 flex items-center justify-center mb-6">
                <Baby className="w-10 h-10 text-purple-500" />
              </div>
              <h2 className="text-2xl font-black text-gray-800 mb-2">赤ちゃんの情報</h2>
              <p className="text-sm text-gray-500 mb-8">アプリの主役を教えてください</p>

              <div className="w-full space-y-5">
                <div>
                  <Label htmlFor="ob-name" className="text-sm font-bold text-gray-600 mb-1.5 block">
                    お名前
                  </Label>
                  <Input
                    id="ob-name"
                    value={babyName}
                    onChange={(e) => setBabyName(e.target.value)}
                    className="rounded-xl border-2 border-gray-100 h-12 text-lg"
                    placeholder="例: はなちゃん、りくくん"
                    data-testid="input-onboarding-baby-name"
                  />
                </div>
                <div>
                  <Label htmlFor="ob-birthday" className="text-sm font-bold text-gray-600 mb-1.5 flex items-center gap-1.5">
                    <Cake className="w-4 h-4 text-purple-400" />
                    <span>生年月日</span>
                  </Label>
                  <Input
                    id="ob-birthday"
                    type="date"
                    value={babyBirthday}
                    onChange={(e) => setBabyBirthday(e.target.value)}
                    className="rounded-xl border-2 border-gray-100 h-12 text-lg"
                    data-testid="input-onboarding-birthday"
                  />
                </div>
              </div>

              <Button
                onClick={() => setStep(3)}
                disabled={!babyName}
                className="w-full h-14 rounded-2xl text-lg font-black shadow-lg mt-8"
                data-testid="button-onboarding-next"
              >
                次へ
                <ChevronRight className="w-5 h-5 ml-1" />
              </Button>

              <button
                onClick={() => { setStep(1); setHasCode(null); }}
                className="mt-4 text-sm font-bold text-purple-400"
                data-testid="button-onboarding-back-baby"
              >
                戻る
              </button>
            </motion.div>
          )}

          {step === 3 && hasCode === false && (
            <motion.div
              key="role"
              {...pageTransition}
              className="flex flex-col items-center w-full"
            >
              <h2 className="text-2xl font-black text-gray-800 mb-2">あなたの役割</h2>
              <p className="text-sm text-gray-500 mb-8">どちらで参加しますか？</p>

              <div className="grid grid-cols-2 gap-4 w-full mb-8">
                <button
                  onClick={() => setUserType("papa")}
                  className={`flex flex-col items-center justify-center py-8 rounded-3xl border-2 transition-all duration-300 ${
                    userType === "papa"
                      ? "border-purple-400 bg-purple-50 shadow-lg scale-[1.02]"
                      : "border-gray-100 bg-white"
                  }`}
                  data-testid="button-onboarding-papa"
                >
                  <div className={`w-16 h-16 rounded-full flex items-center justify-center mb-3 ${
                    userType === "papa" ? "bg-purple-200" : "bg-gray-100"
                  }`}>
                    <User className={`w-8 h-8 ${userType === "papa" ? "text-purple-600" : "text-gray-400"}`} />
                  </div>
                  <span className={`text-lg font-black ${userType === "papa" ? "text-purple-700" : "text-gray-600"}`}>
                    パパ
                  </span>
                </button>

                <button
                  onClick={() => setUserType("mama")}
                  className={`flex flex-col items-center justify-center py-8 rounded-3xl border-2 transition-all duration-300 ${
                    userType === "mama"
                      ? "border-pink-400 bg-pink-50 shadow-lg scale-[1.02]"
                      : "border-gray-100 bg-white"
                  }`}
                  data-testid="button-onboarding-mama"
                >
                  <div className={`w-16 h-16 rounded-full flex items-center justify-center mb-3 ${
                    userType === "mama" ? "bg-pink-200" : "bg-gray-100"
                  }`}>
                    <Crown className={`w-8 h-8 ${userType === "mama" ? "text-pink-600" : "text-gray-400"}`} />
                  </div>
                  <span className={`text-lg font-black ${userType === "mama" ? "text-pink-700" : "text-gray-600"}`}>
                    ママ
                  </span>
                </button>
              </div>

              <Button
                onClick={handleFinishNew}
                disabled={!userType || isPending}
                className="w-full h-14 rounded-2xl text-lg font-black shadow-lg"
                data-testid="button-onboarding-finish"
              >
                {isPending ? "登録中..." : "We育をはじめる"}
              </Button>
            </motion.div>
          )}
        </AnimatePresence>

        {step > 0 && (
          <div className="flex gap-2 mt-8">
            {Array.from({ length: totalSteps - 1 }).map((_, i) => (
              <div
                key={i}
                className={`w-2.5 h-2.5 rounded-full transition-all duration-300 ${
                  i === step - 1 ? "bg-purple-500 scale-125" : "bg-purple-200"
                }`}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
