import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { BellRing, Loader2, X } from "lucide-react";
import { useLocation } from "wouter";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

export function SosButton() {
  const [isOpen, setIsOpen] = useState(false);
  const [, setLocation] = useLocation();

  const handleRescue = () => {
    setLocation("/rescue");
  };

  return (
    <>
      <div className="flex justify-center py-10 px-6">
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 200, damping: 15 }}
          className="relative group"
        >
          {/* Pulsing effect behind button */}
          <div className="absolute inset-0 bg-primary/20 rounded-full blur-2xl group-hover:bg-primary/30 transition-all duration-500 animate-pulse" />
          
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setIsOpen(true)}
            className="
              relative w-64 h-64 rounded-full
              bg-gradient-to-br from-primary to-[#6B4D8A]
              text-white shadow-glow flex flex-col items-center justify-center
              border-8 border-white/20 backdrop-blur-sm
              group-hover:shadow-[0_0_40px_rgba(128,90,170,0.5)]
              transition-shadow duration-300
            "
          >
            <div className="bg-white/10 p-4 rounded-full mb-4 backdrop-blur-md">
              <BellRing className="w-12 h-12 text-white fill-white/20" />
            </div>
            <span className="text-2xl font-black tracking-wider">
              泣き止み<br/>レスキュー
            </span>
            <span className="text-xs font-bold text-white/80 mt-2 bg-black/10 px-3 py-1 rounded-full">
              🚨 SOS
            </span>
          </motion.button>
        </motion.div>
      </div>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="sm:max-w-md rounded-[32px] border-none shadow-2xl p-0 overflow-hidden bg-white">
          <div className="bg-purple-50 p-8 flex flex-col items-center text-center">
            <div className="w-20 h-20 bg-purple-100 rounded-full flex items-center justify-center mb-4 animate-bounce">
              <span className="text-4xl">🚨</span>
            </div>
            <DialogHeader>
              <DialogTitle className="text-2xl font-black text-purple-900 mb-2 text-center">
                レスキューを開始しますか？
              </DialogTitle>
              <DialogDescription className="text-purple-700 font-medium text-center">
                消去法ナビでお子様のご様子をひとつずつ確認してまいりましょう。おそばにおりますよ。
              </DialogDescription>
            </DialogHeader>
          </div>

          <DialogFooter className="p-6 gap-3 sm:gap-0 bg-white">
            <Button
              variant="outline"
              onClick={() => setIsOpen(false)}
              className="flex-1 rounded-2xl h-14 text-base font-bold border-2 border-gray-100 hover:bg-gray-50 hover:text-gray-900"
            >
              キャンセル
            </Button>
            <Button
              onClick={handleRescue}
              className="flex-1 rounded-2xl h-14 text-base font-bold bg-primary hover:bg-primary/90 text-white shadow-lg shadow-purple-200"
            >
              レスキュー開始！
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
