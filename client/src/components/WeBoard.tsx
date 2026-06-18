import { useState, useRef, useEffect } from "react";
import { useUserLabels } from "@/hooks/use-user-labels";
import { motion, AnimatePresence } from "framer-motion";
import { MessageSquare, Send, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useWeBoardMessages, useCreateWeBoardMessage } from "@/hooks/use-app-data";
import { format } from "date-fns";
import { ja } from "date-fns/locale";

const QUICK_MESSAGES = [
  "おつかれさま！",
  "ありがとう",
  "まかせて！",
  "帰るよ〜",
  "お風呂わかした",
  "寝かしつけ完了！",
];

export function WeBoard({ familyId }: { familyId: string }) {
  const { data: messages = [] } = useWeBoardMessages(familyId);
  const { getLabel } = useUserLabels();
  const createMessage = useCreateWeBoardMessage();
  const userId = localStorage.getItem("userType") || "papa";
  const [text, setText] = useState("");
  const [expanded, setExpanded] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const recentMessages = (messages as any[]).slice(0, expanded ? 20 : 3);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, expanded]);

  const handleSend = (msg?: string) => {
    const content = msg || text.trim();
    if (!content) return;
    createMessage.mutate({
      familyId,
      userId,
      message: content,
    });
    setText("");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="px-8 mb-6 w-full">
      <div className="bg-white/80 backdrop-blur-sm rounded-3xl border-2 border-purple-100 shadow-sm overflow-hidden" data-testid="card-we-board">
        <div className="px-4 pt-4 pb-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-purple-100 flex items-center justify-center">
              <MessageSquare className="w-4 h-4 text-purple-600" />
            </div>
            <div>
              <p className="font-black text-sm text-gray-800">Weボード</p>
              <p className="text-[9px] text-gray-400">パートナーへのひとこと</p>
            </div>
          </div>
          {(messages as any[]).length > 3 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setExpanded(!expanded)}
              className="text-xs text-purple-500 rounded-xl"
              data-testid="button-we-board-expand"
            >
              {expanded ? (
                <>
                  閉じる <ChevronUp className="w-3 h-3 ml-1" />
                </>
              ) : (
                <>
                  もっと見る <ChevronDown className="w-3 h-3 ml-1" />
                </>
              )}
            </Button>
          )}
        </div>

        <div
          ref={scrollRef}
          className={`px-4 space-y-1.5 overflow-y-auto transition-all ${expanded ? "max-h-64" : "max-h-36"}`}
        >
          {recentMessages.length === 0 ? (
            <div className="py-4 text-center">
              <p className="text-xs text-gray-400">まだメッセージがありません</p>
              <p className="text-[10px] text-gray-300 mt-1">パートナーにひとこと送ってみましょう</p>
            </div>
          ) : (
            <AnimatePresence initial={false}>
              {[...recentMessages].reverse().map((msg: any) => {
                const isMine = msg.userId === userId;
                return (
                  <motion.div
                    key={msg.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`flex ${isMine ? "justify-end" : "justify-start"}`}
                    data-testid={`we-board-msg-${msg.id}`}
                  >
                    <div className={`max-w-[75%] ${isMine ? "items-end" : "items-start"}`}>
                      <p className={`text-[9px] font-bold mb-0.5 px-1 ${isMine ? "text-right text-purple-400" : "text-left text-green-500"}`}>
                        {getLabel(msg.userId)}
                      </p>
                      <div
                        className={`px-3 py-2 rounded-2xl text-sm ${
                          isMine
                            ? "bg-purple-100 text-purple-800 rounded-br-md"
                            : "bg-green-50 text-green-800 border border-green-100 rounded-bl-md"
                        }`}
                      >
                        {msg.message}
                      </div>
                      <p className={`text-[8px] text-gray-300 mt-0.5 px-1 ${isMine ? "text-right" : "text-left"}`}>
                        {msg.createdAt ? format(new Date(msg.createdAt), "M/d HH:mm", { locale: ja }) : ""}
                      </p>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          )}
        </div>

        <div className="px-3 py-2 border-t border-purple-50">
          <div className="flex gap-1.5 mb-2 overflow-x-auto pb-1 scrollbar-hide">
            {QUICK_MESSAGES.map((qm) => (
              <button
                key={qm}
                onClick={() => handleSend(qm)}
                disabled={createMessage.isPending}
                className="shrink-0 px-3 py-1.5 bg-purple-50 hover:bg-purple-100 text-purple-600 rounded-xl text-[11px] font-bold transition-colors"
                data-testid={`button-quick-msg-${qm}`}
              >
                {qm}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <Input
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="メッセージを入力..."
              className="rounded-xl border-purple-100 text-sm h-9"
              data-testid="input-we-board-message"
            />
            <Button
              onClick={() => handleSend()}
              disabled={!text.trim() || createMessage.isPending}
              size="icon"
              className="rounded-xl bg-purple-500 hover:bg-purple-600 h-9 w-10 shrink-0"
              data-testid="button-we-board-send"
            >
              <Send className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
