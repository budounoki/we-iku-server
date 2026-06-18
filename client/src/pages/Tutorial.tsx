import { useState, useRef, useCallback, useEffect } from "react";
import { motion, AnimatePresence, PanInfo } from "framer-motion";
import {
  PieChart, Smartphone, Sparkles, Moon, Phone, Syringe, Gift,
  Baby, Clock, Star,
} from "lucide-react";
import { Button } from "@/components/ui/button";

interface TutorialProps {
  onComplete: () => void;
}

const SLIDES = [
  {
    icon: PieChart,
    iconBg: "bg-purple-100",
    iconColor: "text-purple-600",
    secondaryIcons: [
      { Icon: Baby, color: "text-pink-400", pos: "top-2 right-6" },
      { Icon: Star, color: "text-amber-400", pos: "bottom-4 left-8" },
    ],
    headline: "ふたりの育児をすべて可視化",
    subheadline: "負担割合・時給換算・名もなき育児も記録",
  },
  {
    icon: Smartphone,
    iconBg: "bg-blue-50",
    iconColor: "text-blue-500",
    secondaryIcons: [
      { Icon: Sparkles, color: "text-amber-400", pos: "top-4 right-4" },
    ],
    headline: "AIがお子さまに合わせた情報だけ表示",
    subheadline: "予防接種も成長記録も、今必要なものだけ。\n終わったら自動で消える",
  },
  {
    icon: Sparkles,
    iconBg: "bg-amber-50",
    iconColor: "text-amber-500",
    secondaryIcons: [
      { Icon: Baby, color: "text-pink-300", pos: "top-6 left-4" },
      { Icon: Star, color: "text-amber-300", pos: "bottom-2 right-6" },
    ],
    headline: "育児するたびポイントが貯まる",
    subheadline: "おむつ替えも、夜中の授乳も、全部ポイントに。\nパートナーからの「ありがとう」でボーナスも",
    bounce: true,
  },
  {
    icon: Moon,
    iconBg: "bg-indigo-50",
    iconColor: "text-indigo-500",
    secondaryIcons: [
      { Icon: Clock, color: "text-indigo-300", pos: "bottom-4 right-4" },
      { Icon: Star, color: "text-amber-300", pos: "top-2 left-6" },
    ],
    headline: "そろそろお昼寝の時間です",
    subheadline: "AIが覚醒時間から最適な寝かしつけタイミングを予測してお知らせ",
  },
  {
    icon: Phone,
    iconBg: "bg-red-50",
    iconColor: "text-red-500",
    secondaryIcons: [
      { Icon: Sparkles, color: "text-purple-300", pos: "top-4 left-8" },
    ],
    headline: "泣き止まない？AIに聞いて",
    subheadline: "月齢・時間帯・最後の授乳からAIが解決策を提案。\n困った夜の味方",
  },
  {
    icon: Syringe,
    iconBg: "bg-cyan-50",
    iconColor: "text-cyan-600",
    secondaryIcons: [
      { Icon: Clock, color: "text-cyan-300", pos: "bottom-6 left-6" },
    ],
    headline: "次の予防接種、AIが教えてくれる",
    subheadline: "接種記録を入れるだけで次回のおすすめ日を自動計算。\nもう悩まない",
  },
  {
    icon: Gift,
    iconBg: "bg-pink-50",
    iconColor: "text-pink-500",
    secondaryIcons: [
      { Icon: Sparkles, color: "text-amber-400", pos: "top-0 right-4" },
      { Icon: Star, color: "text-pink-300", pos: "bottom-0 left-4" },
    ],
    headline: "ポイントを貯めてご褒美と交換",
    subheadline: "毎日の育児が、ちょっとしたご褒美に変わる",
  },
];

const SWIPE_THRESHOLD = 50;

export default function Tutorial({ onComplete }: TutorialProps) {
  const [currentPage, setCurrentPage] = useState(0);
  const [direction, setDirection] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const isLast = currentPage === SLIDES.length - 1;

  const finish = useCallback(() => {
    localStorage.setItem("we_iku_tutorial_done", "true");
    onComplete();
  }, [onComplete]);

  const goTo = useCallback((page: number) => {
    if (page < 0 || page >= SLIDES.length) return;
    setDirection(page > currentPage ? 1 : -1);
    setCurrentPage(page);
  }, [currentPage]);

  const handleDragEnd = useCallback((_: any, info: PanInfo) => {
    if (info.offset.x < -SWIPE_THRESHOLD && currentPage < SLIDES.length - 1) {
      goTo(currentPage + 1);
    } else if (info.offset.x > SWIPE_THRESHOLD && currentPage > 0) {
      goTo(currentPage - 1);
    }
  }, [currentPage, goTo]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" && currentPage < SLIDES.length - 1) goTo(currentPage + 1);
      if (e.key === "ArrowLeft" && currentPage > 0) goTo(currentPage - 1);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [currentPage, goTo]);

  const slide = SLIDES[currentPage];
  const SlideIcon = slide.icon;

  const variants = {
    enter: (d: number) => ({ x: d > 0 ? "100%" : "-100%", opacity: 0 }),
    center: { x: 0, opacity: 1 },
    exit: (d: number) => ({ x: d > 0 ? "-100%" : "100%", opacity: 0 }),
  };

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 z-50 flex flex-col overflow-hidden"
      style={{ backgroundColor: "#F8F6F3" }}
      data-testid="tutorial-screen"
    >
      <div className="flex justify-end p-4 pt-[env(safe-area-inset-top,12px)]">
        <button
          onClick={finish}
          className="text-sm text-gray-400 font-medium px-3 py-1.5 rounded-full active:bg-gray-100 transition-colors"
          data-testid="button-tutorial-skip"
        >
          スキップ
        </button>
      </div>

      <div className="flex-1 relative overflow-hidden">
        <AnimatePresence mode="wait" custom={direction}>
          <motion.div
            key={currentPage}
            custom={direction}
            variants={variants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ type: "tween", duration: 0.3, ease: "easeInOut" }}
            drag="x"
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={0.2}
            onDragEnd={handleDragEnd}
            className="absolute inset-0 flex flex-col items-center justify-center px-8"
          >
            <div className="relative w-44 h-44 mb-10">
              <motion.div
                className={`w-full h-full rounded-full ${slide.iconBg} flex items-center justify-center shadow-lg`}
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.1, duration: 0.4 }}
              >
                <motion.div
                  animate={slide.bounce ? {
                    y: [0, -8, 0],
                  } : {}}
                  transition={slide.bounce ? {
                    repeat: Infinity,
                    duration: 2,
                    ease: "easeInOut",
                  } : {}}
                >
                  <SlideIcon className={`w-20 h-20 ${slide.iconColor}`} strokeWidth={1.5} />
                </motion.div>
              </motion.div>

              {slide.secondaryIcons.map(({ Icon, color, pos }, i) => (
                <motion.div
                  key={i}
                  className={`absolute ${pos}`}
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ delay: 0.3 + i * 0.15, type: "spring", stiffness: 200 }}
                >
                  <Icon className={`w-8 h-8 ${color}`} strokeWidth={1.5} />
                </motion.div>
              ))}
            </div>

            <motion.h1
              className="text-2xl font-black text-gray-800 text-center mb-3 leading-tight"
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.2, duration: 0.4 }}
            >
              {slide.headline}
            </motion.h1>

            <motion.p
              className="text-sm text-gray-500 text-center leading-relaxed whitespace-pre-line max-w-[280px]"
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.3, duration: 0.4 }}
            >
              {slide.subheadline}
            </motion.p>
          </motion.div>
        </AnimatePresence>
      </div>

      <div className="pb-[env(safe-area-inset-bottom,24px)] px-8 space-y-6 mb-4">
        <div className="flex justify-center gap-2" data-testid="tutorial-dots">
          {SLIDES.map((_, i) => (
            <button
              key={i}
              onClick={() => goTo(i)}
              className="p-1"
              data-testid={`tutorial-dot-${i}`}
            >
              <motion.div
                className="rounded-full"
                animate={{
                  width: i === currentPage ? 10 : 7,
                  height: i === currentPage ? 10 : 7,
                  backgroundColor: i === currentPage ? "#7B2D8E" : "#D1D5DB",
                }}
                transition={{ duration: 0.2 }}
              />
            </button>
          ))}
        </div>

        <AnimatePresence>
          {isLast && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              className="flex justify-center"
            >
              <motion.div
                animate={{ scale: [1, 1.03, 1] }}
                transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
                className="w-[80%]"
              >
                <Button
                  onClick={finish}
                  className="w-full h-14 rounded-full text-lg font-black text-white shadow-lg"
                  style={{ backgroundColor: "#7B2D8E" }}
                  data-testid="button-tutorial-start"
                >
                  はじめる
                </Button>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
