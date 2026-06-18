import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, CheckCircle2, ChevronRight, Timer, AlertCircle, Info, Baby, Milk, Apple } from "lucide-react";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { useSettings, useCreateLog, useLogs } from "@/hooks/use-app-data";
import { useActiveChild } from "@/hooks/use-active-child";
import { differenceInMonths, differenceInMinutes, format, parseISO } from "date-fns";

export default function Rescue() {
  const [, setLocation] = useLocation();
  const familyId = localStorage.getItem("familyId") || "default";
  const { data: settings } = useSettings(familyId);
  const { mutate: createLog } = useCreateLog();
  const { activeChild } = useActiveChild(familyId);
  const { data: allLogs } = useLogs(familyId);
  const [step, setStep] = useState(0);
  const [showTimer, setShowTimer] = useState(false);
  const [timeLeft, setTimeLeft] = useState(15 * 60);

  const months = settings?.babyBirthday ? differenceInMonths(new Date(), parseISO(settings.babyBirthday)) : 0;

  const recentFeedingLogs = useMemo(() => {
    if (!allLogs) return [];
    const childId = activeChild?.id;
    return (allLogs as any[])
      .filter((l) => {
        const isFeeding = l.type === "milk" || l.type === "food";
        const matchesChild = !childId || !l.childId || l.childId === childId;
        return isFeeding && matchesChild;
      })
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 4);
  }, [allLogs, activeChild]);

  const infantSteps = [
    { title: "おむつ確認", desc: "まずは一番多い理由から確認しましょう。おむつは濡れていませんか？" },
    { title: "お腹の確認", desc: "前回のミルクや授乳から時間が空いていませんか？お腹が空いているかもしれません。" },
    { title: "ゲップ・ガス", desc: "お腹に空気が溜まって苦しいのかもしれません。やさしく縦抱きにしてみましょう。" },
    { title: "刺激のリセット", desc: "テレビを消して、お部屋を少し暗くして、静かな環境を整えてみましょう。" },
    { title: "睡眠スケジュール", desc: "最後に起きてから1.5時間以上経っていませんか？疲れすぎて眠れないのかもしれません。" },
    { title: "温度・環境", desc: "暑すぎたり寒すぎたりしていませんか？背中にそっと手を入れて確認してみましょう。" },
    { title: "全身チェック", desc: "お洋服のタグが肌に当たっていたり、小さな指に髪の毛が絡まったりしていませんか？" },
  ];

  const toddlerSteps = [
    { title: "環境チェンジ", desc: "お部屋の景色を変えてみましょう。窓の外を見せたり、ベランダでお外の空気を感じさせてあげましょう。" },
    { title: "おもちゃ・音", desc: `少し退屈しているのかもしれません。${settings?.specialTrick || "ビニール袋の音"}を聞かせてみましょう。` },
    { title: "ふれあい遊び", desc: "やさしく体を使って遊んでみましょう。そっとこちょこちょしたり、お歌を歌ってあげましょう。" },
    { title: "歯ぐずりの確認", desc: "よだれが増えていませんか？歯が生え始めてむずがゆいのかもしれません。" },
    { title: "悔しさへの共感", desc: "何かやりたいことがあるのかもしれません。そっと手を添えてお手伝いしてあげましょう。" },
    { title: "メンタルリープ", desc: "今は大きく成長している時期かもしれません。そばに寄り添うだけで十分です。" },
    { title: "担当交代", desc: "パートナーにバトンタッチするのも大事な作戦です。おふたりの連携で乗り越えましょう。" },
  ];

  const steps = months >= 4 ? toddlerSteps : infantSteps;

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (showTimer && timeLeft > 0) {
      timer = setInterval(() => setTimeLeft((t) => t - 1), 1000);
    }
    return () => clearInterval(timer);
  }, [showTimer, timeLeft]);

  const handleComplete = () => {
    createLog({ type: "sos", message: "レスキュー成功！" });
    setLocation("/");
  };

  const handleNext = () => {
    if (step < steps.length - 1) {
      setStep(step + 1);
    } else {
      setShowTimer(true);
      createLog({ type: "sos", message: "抱っこリレー開始！応援要請！" });
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="min-h-screen font-sans transition-colors duration-500 bg-[#F8F5FF] text-[#805AAA]">
      <div className="max-w-md mx-auto px-6 py-8 h-screen flex flex-col">
        <div className="flex items-center gap-4 mb-8">
          <Link href="/">
            <Button variant="ghost" size="icon" className="rounded-full hover:bg-black/5">
              <ArrowLeft className="w-6 h-6" />
            </Button>
          </Link>
          <h1 className="text-xl font-black">泣き止みレスキュー</h1>
        </div>

        <div className="flex-1 flex flex-col justify-center gap-6">
          <AnimatePresence mode="wait">
            {!showTimer ? (
              <motion.div
                key={step}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
                <div className="flex items-center gap-4 mb-2">
                  <div className="w-12 h-12 rounded-full bg-purple-100 flex items-center justify-center border-2 border-white shadow-sm">
                    <AlertCircle className="w-6 h-6 text-purple-500" />
                  </div>
                  <div>
                    <p className="text-sm font-black">ステップ {step + 1} / {steps.length}</p>
                  </div>
                </div>

                <div className="bg-white border-purple-200 text-purple-900 rounded-[32px] rounded-tl-none p-8 shadow-soft border-2 transition-all duration-300">
                  <h2 className="text-2xl font-black mb-4">{steps[step].title}</h2>
                  <p className="text-lg opacity-90 leading-relaxed font-bold">{steps[step].desc}</p>

                  {steps[step].title === "お腹の確認" && (
                    <div className="mt-5 space-y-2">
                      <p className="text-xs font-black text-purple-400 uppercase tracking-widest mb-3">直近の授乳・ミルク記録</p>
                      {recentFeedingLogs.length === 0 ? (
                        <p className="text-sm text-gray-400 font-bold text-center py-2">記録がありません</p>
                      ) : recentFeedingLogs.map((log: any, i: number) => {
                        const logDate = new Date(log.createdAt);
                        const minsAgo = differenceInMinutes(new Date(), logDate);
                        const hoursAgo = Math.floor(minsAgo / 60);
                        const remainMins = minsAgo % 60;
                        const elapsed = hoursAgo > 0
                          ? `${hoursAgo}時間${remainMins > 0 ? remainMins + "分" : ""}前`
                          : `${minsAgo}分前`;
                        const urgency = minsAgo >= 180 ? "text-rose-500 bg-rose-50 border-rose-100"
                          : minsAgo >= 120 ? "text-amber-600 bg-amber-50 border-amber-100"
                          : "text-green-600 bg-green-50 border-green-100";
                        const subType = log.subType || "";
                        const label = log.type === "food" ? "離乳食" : subType === "breast" ? "母乳" : subType === "formula" ? "ミルク" : "授乳";
                        const Icon = log.type === "food" ? Apple : subType === "breast" ? Baby : Milk;
                        return (
                          <div key={log.id ?? i} className={`flex items-center gap-3 rounded-2xl border px-3 py-2 ${urgency}`}>
                            <Icon className="w-4 h-4 shrink-0" />
                            <div className="flex-1 min-w-0">
                              <span className="font-black text-sm">{label}</span>
                              <span className="text-xs font-bold ml-2 opacity-70">{format(logDate, "HH:mm")}</span>
                            </div>
                            <span className="text-xs font-black shrink-0">{i === 0 ? elapsed : elapsed}</span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <Button onClick={handleComplete} variant="outline" className="h-16 rounded-2xl border-2 font-black border-green-500 text-green-600 hover:bg-green-50 active:scale-95 transition-transform">
                    <CheckCircle2 className="w-5 h-5 mr-2" /> 解決！
                  </Button>
                  <Button 
                    onClick={handleNext} 
                    className="h-16 rounded-2xl font-black shadow-lg active:scale-95 transition-transform bg-primary hover:bg-primary/90"
                  >
                    {step === steps.length - 1 ? "リレー要請" : "次へ"} <ChevronRight className="w-5 h-5 ml-1" />
                  </Button>
                </div>
                
                <div className="flex items-center gap-2 p-4 bg-yellow-50 rounded-2xl border border-yellow-100 mt-4">
                  <Info className="w-5 h-5 text-yellow-600 shrink-0" />
                  <p className="text-[10px] text-yellow-800 font-bold leading-tight">
                    全ての項目を確認しても泣き止まず、「熱がある」「ぐったりしている」「異常な泣き方」の場合は、すみやかに医療機関に相談してください。
                  </p>
                </div>
              </motion.div>
            ) : (
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="text-center space-y-8"
              >
                <div className="bg-red-50 p-8 rounded-[40px] border-4 border-red-200 shadow-xl">
                  <div className="flex justify-center mb-6">
                    <div className="bg-red-500 p-5 rounded-full animate-pulse shadow-lg shadow-red-200">
                      <Timer className="w-12 h-12 text-white" />
                    </div>
                  </div>
                  <h2 className="text-3xl font-black text-red-600 mb-2">抱っこリレー開始！</h2>
                  <p className="text-red-900 font-bold opacity-70 mb-6 leading-relaxed">
                    パートナーの画面に「応援要請」を表示しました。<br/>
                    あと少し、交代して乗り切りましょう！
                  </p>
                  <div className="text-6xl font-black text-red-600 font-mono tracking-tighter tabular-nums">
                    {formatTime(timeLeft)}
                  </div>
                </div>
                <Button onClick={() => setLocation("/")} variant="ghost" className="font-black text-gray-500 hover:bg-gray-100 h-12 rounded-xl">
                  ホームに戻る
                </Button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="flex items-center justify-center gap-2 py-6">
          {steps.map((_, i) => (
            <div key={i} className={`h-2 rounded-full transition-all duration-300 ${i === step ? "w-8 bg-current" : "w-2 bg-current/20"}`} />
          ))}
        </div>
      </div>
    </div>
  );
}
