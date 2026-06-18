import { Header } from "@/components/Header";
import { BottomNav } from "@/components/Navigation";
import { useLogs, useCreateLog, useCustomChildcareItems, useCreateCustomChildcareItem } from "@/hooks/use-app-data";
import { useUserLabels } from "@/hooks/use-user-labels";
import { useActiveChild } from "@/hooks/use-active-child";
import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, Legend
} from "recharts";
import {
  Users, TrendingUp, Clock, AlertTriangle, Sparkles,
  Shirt, ShoppingCart, Trash2, Utensils, Zap, Plus, X,
  Milk, Baby, Moon, Heart, Bath, Droplets,
  Star, Stethoscope, Pill, Scissors, Brush, Bike, Package, Lamp, HandHeart, Thermometer
} from "lucide-react";
import { cn } from "@/lib/utils";
import { format, startOfDay, subDays, isSameDay, parseISO } from "date-fns";
import { ja } from "date-fns/locale";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

const ICON_MAP: Record<string, any> = {
  Star, Stethoscope, Pill, Scissors, Brush, Bike, Package, Lamp, HandHeart, Thermometer,
  Shirt, ShoppingCart, Trash2, Utensils, Bath, Droplets, Milk, Heart,
};

const PRESET_ICONS = [
  { name: "Star", icon: Star },
  { name: "Heart", icon: Heart },
  { name: "HandHeart", icon: HandHeart },
  { name: "Scissors", icon: Scissors },
  { name: "Brush", icon: Brush },
  { name: "Package", icon: Package },
  { name: "Lamp", icon: Lamp },
  { name: "Thermometer", icon: Thermometer },
  { name: "Pill", icon: Pill },
  { name: "Bike", icon: Bike },
];

const UNNAMED_CHORES = [
  { id: "laundry", title: "洗濯", icon: Shirt },
  { id: "bottle_wash", title: "哺乳瓶洗い", icon: Milk },
  { id: "shopping", title: "買い物", icon: ShoppingCart },
  { id: "trash", title: "ゴミ出し", icon: Trash2 },
  { id: "cooking", title: "食事の準備", icon: Utensils },
  { id: "bath_clean", title: "お風呂の掃除", icon: Bath },
  { id: "refill", title: "シャンプー・洗剤の入替", icon: Droplets },
];

const TYPE_LABELS: Record<string, string> = {
  milk: "ミルク",
  food: "離乳食",
  diaper: "おむつ",
  sleep: "ねんね",
  play: "あそび",
  sos: "レスキュー",
  thanks: "ありがとう",
  event_done: "予定完了",
  temp: "体温",
  symptom: "症状メモ",
  milestone: "マイルストーン",
  routine_complete: "ルーティン",
  chore: "名もなき育児",
};

const HOURLY_RATE = 1121;
const MINUTES_PER_TASK = 10;
const TASK_VALUE = Math.round(HOURLY_RATE * MINUTES_PER_TASK / 60);

const PAPA_COLOR = "#7C5CBF";
const MAMA_COLOR = "#E8A0BF";

export default function Dashboard() {
  const familyId = localStorage.getItem("familyId") || "default";
  const userId = localStorage.getItem("userType") || "papa";
  const { papaLabel, mamaLabel, getLabel: getUserLabel } = useUserLabels();
  const { data: allLogs = [] } = useLogs(familyId);
  const { activeChild } = useActiveChild(familyId);
  const createLog = useCreateLog();
  const { data: customItems = [] } = useCustomChildcareItems(familyId);
  const createCustomItem = useCreateCustomChildcareItem();

  const activeChildId = activeChild?.id ?? null;
  const logs = useMemo(() => {
    if (!activeChildId) return allLogs;
    return allLogs.filter((l: any) => !l.childId || l.childId === activeChildId);
  }, [allLogs, activeChildId]);
  const [choreDialogOpen, setChoreDialogOpen] = useState(false);
  const [addCustomDialogOpen, setAddCustomDialogOpen] = useState(false);
  const [newItemName, setNewItemName] = useState("");
  const [newItemIcon, setNewItemIcon] = useState("Star");
  const [selectedRange, setSelectedRange] = useState<"today" | "week" | "all">("today");
  const [chorePerformer, setChorePerformer] = useState<"mama" | "papa" | "other">(
    userId === "mama" ? "mama" : "papa"
  );

  const activeCustomItems = (customItems as any[]).filter((item: any) => item.isActive);

  const allChores = useMemo(() => {
    const base = UNNAMED_CHORES.map((c) => ({
      id: c.id,
      title: c.title,
      icon: c.icon,
      isCustom: false,
    }));
    const custom = activeCustomItems.map((item: any) => ({
      id: `custom_${item.id}`,
      title: item.itemName,
      icon: ICON_MAP[item.icon] || Star,
      isCustom: true,
    }));
    return [...base, ...custom];
  }, [activeCustomItems]);

  const filteredLogs = useMemo(() => {
    const now = new Date();
    const today = startOfDay(now);
    const weekAgo = subDays(today, 7);

    return (logs as any[]).filter((log: any) => {
      const logDate = new Date(log.createdAt);
      if (selectedRange === "today") return isSameDay(logDate, now);
      if (selectedRange === "week") return logDate >= weekAgo;
      return true;
    });
  }, [logs, selectedRange]);

  const papaLogs = filteredLogs.filter((l: any) => (l.performedBy || l.userId) === "papa");
  const mamaLogs = filteredLogs.filter((l: any) => (l.performedBy || l.userId) === "mama");

  const papaPoints = papaLogs.reduce((s: number, l: any) => s + (l.points || 0), 0);
  const mamaPoints = mamaLogs.reduce((s: number, l: any) => s + (l.points || 0), 0);
  const totalPoints = papaPoints + mamaPoints;

  const papaPercent = totalPoints > 0 ? Math.round((papaPoints / totalPoints) * 100) : 50;
  const mamaPercent = totalPoints > 0 ? 100 - papaPercent : 50;

  const isImbalanced = totalPoints > 0 && (papaPercent >= 80 || mamaPercent >= 80);
  const dominantUser = papaPercent > mamaPercent ? papaLabel : mamaLabel;
  const lesserUser = papaPercent > mamaPercent ? mamaLabel : papaLabel;

  const pieData = [
    { name: papaLabel, value: papaPoints || 1, fill: PAPA_COLOR },
    { name: mamaLabel, value: mamaPoints || 1, fill: MAMA_COLOR },
  ];

  const typeBreakdown = useMemo(() => {
    const types = new Set(filteredLogs.map((l: any) => l.type));
    return Array.from(types).map((type) => {
      const papaCount = filteredLogs.filter((l: any) => (l.performedBy || l.userId) === "papa" && l.type === type).length;
      const mamaCount = filteredLogs.filter((l: any) => (l.performedBy || l.userId) === "mama" && l.type === type).length;
      return {
        name: TYPE_LABELS[type as string] || type,
        [papaLabel]: papaCount,
        [mamaLabel]: mamaCount,
      };
    }).filter((d: any) => d[papaLabel] > 0 || d[mamaLabel] > 0).sort((a: any, b: any) => (b[papaLabel] + b[mamaLabel]) - (a[papaLabel] + a[mamaLabel]));
  }, [filteredLogs, papaLabel, mamaLabel]);

  const totalTasks = filteredLogs.length;
  const totalMinutes = totalTasks * MINUTES_PER_TASK;
  const totalHours = Math.floor(totalMinutes / 60);
  const remainMinutes = totalMinutes % 60;
  const totalValue = totalTasks * TASK_VALUE;

  const recentChores = useMemo(() => {
    return (logs as any[])
      .filter((l: any) => l.type === "chore")
      .sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 8);
  }, [logs]);

  const handleChore = (choreId: string, choreTitle?: string) => {
    const title = choreTitle || UNNAMED_CHORES.find((c) => c.id === choreId)?.title || "名もなき育児";
    createLog.mutate({
      type: "chore",
      message: `${title}を完了`,
      subType: choreId,
      performedBy: chorePerformer,
    });
    setChoreDialogOpen(false);
  };

  const handleAddCustomItem = () => {
    if (!newItemName.trim() || newItemName.length > 20) return;
    if (activeCustomItems.length >= 10) return;
    createCustomItem.mutate({
      familyId,
      itemName: newItemName.trim(),
      icon: newItemIcon,
      createdBy: userId,
    }, {
      onSuccess: () => {
        setNewItemName("");
        setNewItemIcon("Star");
        setAddCustomDialogOpen(false);
      },
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-purple-50 via-white to-green-50 pb-32">
      <Header />

      <div className="max-w-md mx-auto px-4 pt-4 space-y-5">
        <div className="text-center">
          <h2 className="text-xl font-black text-purple-800" data-testid="text-dashboard-title">
            貢献度ダッシュボード
          </h2>
          <p className="text-xs text-purple-500 mt-1">ふたりの育児をデータで可視化</p>
        </div>

        <div className="flex gap-2">
          {(["today", "week", "all"] as const).map((range) => (
            <Button
              key={range}
              variant={selectedRange === range ? "default" : "outline"}
              className="flex-1 rounded-2xl text-xs font-bold"
              onClick={() => setSelectedRange(range)}
              data-testid={`button-range-${range}`}
            >
              {range === "today" ? "今日" : range === "week" ? "1週間" : "全期間"}
            </Button>
          ))}
        </div>

        <Card className="p-5 rounded-3xl border-purple-100">
          <h3 className="text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">
            <Users className="w-4 h-4 text-purple-500" />
            負担割合
          </h3>
          <div className="flex items-center gap-4">
            <div className="w-32 h-32 relative">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    dataKey="value"
                    cx="50%"
                    cy="50%"
                    innerRadius={30}
                    outerRadius={55}
                    strokeWidth={2}
                    stroke="#fff"
                  >
                    {pieData.map((entry, idx) => (
                      <Cell key={idx} fill={entry.fill} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-xs font-bold text-gray-500">{totalPoints}pt</span>
              </div>
            </div>
            <div className="flex-1 space-y-3">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: PAPA_COLOR }} />
                <span className="text-sm font-bold text-gray-700 flex-1">{papaLabel}</span>
                <span className="text-sm font-bold" style={{ color: PAPA_COLOR }}>{papaPercent}%</span>
              </div>
              <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{ width: `${papaPercent}%`, backgroundColor: PAPA_COLOR }}
                />
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: MAMA_COLOR }} />
                <span className="text-sm font-bold text-gray-700 flex-1">{mamaLabel}</span>
                <span className="text-sm font-bold" style={{ color: MAMA_COLOR }}>{mamaPercent}%</span>
              </div>
              <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{ width: `${mamaPercent}%`, backgroundColor: MAMA_COLOR }}
                />
              </div>
            </div>
          </div>
        </Card>

        <AnimatePresence>
          {isImbalanced && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
            >
              <Card className="p-4 rounded-3xl border-amber-200 bg-amber-50" data-testid="alert-imbalance">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-amber-100 flex items-center justify-center shrink-0">
                    <Sparkles className="w-5 h-5 text-amber-600" />
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-amber-600 mb-1">お知らせ</p>
                    <p className="text-xs text-amber-800 leading-relaxed font-medium">
                      {lesserUser}さん、{dominantUser}さんの負担が大きくなっています。
                      今はバトンタッチのタイミングかもしれません。
                      おふたりで助け合うことが、何よりの力になります。
                    </p>
                  </div>
                </div>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>

        {typeBreakdown.length > 0 && (
          <Card className="p-5 rounded-3xl border-gray-100">
            <h3 className="text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-purple-500" />
              タスク別の内訳
            </h3>
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={typeBreakdown} layout="vertical" margin={{ left: 60, right: 10 }}>
                  <XAxis type="number" hide />
                  <YAxis
                    type="category"
                    dataKey="name"
                    tick={{ fontSize: 11, fill: "#6B7280" }}
                    width={55}
                  />
                  <Tooltip
                    contentStyle={{
                      borderRadius: "16px",
                      border: "1px solid #E5E7EB",
                      fontSize: "12px",
                    }}
                  />
                  <Bar dataKey={papaLabel} stackId="a" fill={PAPA_COLOR} radius={[0, 0, 0, 0]} />
                  <Bar dataKey={mamaLabel} stackId="a" fill={MAMA_COLOR} radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="flex items-center justify-center gap-4 mt-2">
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: PAPA_COLOR }} />
                <span className="text-[10px] font-bold text-gray-500">{papaLabel}</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: MAMA_COLOR }} />
                <span className="text-[10px] font-bold text-gray-500">{mamaLabel}</span>
              </div>
            </div>
          </Card>
        )}

        <Card className="p-5 rounded-3xl border-green-100 bg-gradient-to-br from-green-50 to-white">
          <h3 className="text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">
            <Clock className="w-4 h-4 text-green-500" />
            時給換算
          </h3>
          <div className="text-center space-y-2">
            <p className="text-3xl font-black text-green-700" data-testid="text-total-value">
              {totalValue.toLocaleString()}円
            </p>
            <p className="text-xs text-green-600">
              {totalTasks}件 x {MINUTES_PER_TASK}分 = {totalHours > 0 ? `${totalHours}時間${remainMinutes > 0 ? `${remainMinutes}分` : ""}` : `${remainMinutes}分`}（時給{HOURLY_RATE}円換算）
            </p>
          </div>
          <div className="bg-green-100/50 rounded-2xl p-3 mt-3">
            <div className="flex items-start gap-2">
              <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center shrink-0">
                <Zap className="w-4 h-4 text-green-600" />
              </div>
              <p className="text-xs text-green-700 leading-relaxed font-medium">
                もしこれを外注（ベビーシッター等）したら、
                {selectedRange === "today" ? "今日" : selectedRange === "week" ? "この1週間" : "今まで"}
                のおふたりの働きは<span className="font-black"> {totalValue.toLocaleString()}円分 </span>
                の価値があるっす！
              </p>
            </div>
          </div>
        </Card>

        <Card className="p-5 rounded-3xl border-purple-100">
          <h3 className="text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">
            <Heart className="w-4 h-4 text-purple-500" />
            名もなき育児を記録
          </h3>
          <p className="text-xs text-gray-500 mb-3">
            洗濯や哺乳瓶洗いなど、見えにくい家事もしっかり記録できます。
          </p>
          <Button
            onClick={() => setChoreDialogOpen(true)}
            className="w-full rounded-2xl font-bold"
            data-testid="button-open-chore-dialog"
          >
            <Plus className="w-4 h-4 mr-2" />
            名もなき育児を記録する
          </Button>

          {recentChores.length > 0 && (
            <div className="mt-4 space-y-1.5">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">最近の記録</p>
              {recentChores.map((log: any) => {
                const choreInfo = allChores.find(c => c.id === log.subType);
                const ChoreIcon = choreInfo?.icon ?? Heart;
                const performer = log.performedBy || log.userId;
                const performerLabel = performer === "other" ? "その他" : getUserLabel(performer);
                const logDate = new Date(log.createdAt);
                const isToday = isSameDay(logDate, new Date());
                const timeStr = isToday
                  ? format(logDate, "HH:mm")
                  : format(logDate, "M/d HH:mm", { locale: ja });
                return (
                  <div key={log.id} className="flex items-center gap-2.5 py-1.5 px-2 rounded-xl bg-purple-50/60" data-testid={`chore-log-${log.id}`}>
                    <ChoreIcon className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                    <span className="text-xs font-bold text-gray-700 flex-1 truncate">
                      {choreInfo?.title ?? log.message}
                    </span>
                    {performerLabel && (
                      <span className="text-[10px] font-black text-purple-500 bg-purple-100 px-1.5 py-0.5 rounded-lg shrink-0">
                        {performerLabel}
                      </span>
                    )}
                    <span className="text-[10px] font-bold text-gray-400 shrink-0 tabular-nums">
                      {timeStr}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      </div>

      <Dialog open={choreDialogOpen} onOpenChange={setChoreDialogOpen}>
        <DialogContent className="sm:max-w-md rounded-[32px] border-none shadow-2xl bg-white max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-lg font-black text-purple-800 text-center">
              名もなき育児を記録
            </DialogTitle>
            <DialogDescription className="text-xs text-purple-500 text-center">
              見えない頑張りもしっかりポイントに
            </DialogDescription>
          </DialogHeader>
          <div className="px-4 pb-1">
            <p className="text-[11px] font-bold text-gray-500 mb-2">だれがやった？</p>
            <div className="grid grid-cols-3 gap-2">
              {(["mama", "papa", "other"] as const).map((p) => {
                const label = getUserLabel(p);
                const isSelected = chorePerformer === p;
                return (
                  <button
                    key={p}
                    type="button"
                    data-testid={`button-chore-performer-${p}`}
                    onClick={() => setChorePerformer(p)}
                    className={`py-2 rounded-xl text-xs font-black border-2 transition-all ${
                      isSelected
                        ? "bg-purple-500 border-purple-500 text-white"
                        : "bg-white border-gray-200 text-gray-500"
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 p-4 pt-3">
            {allChores.map((chore) => {
              const ChoreIcon = chore.icon;
              return (
                <Button
                  key={chore.id}
                  variant="outline"
                  onClick={() => handleChore(chore.id, chore.title)}
                  className="h-20 rounded-2xl flex flex-col items-center gap-2 border-2 border-gray-100"
                  disabled={createLog.isPending}
                  data-testid={`button-chore-${chore.id}`}
                >
                  <ChoreIcon className="w-6 h-6 text-purple-500" />
                  <span className="text-xs font-bold">{chore.title}</span>
                </Button>
              );
            })}
            {activeCustomItems.length < 10 && (
              <Button
                variant="outline"
                onClick={() => {
                  setChoreDialogOpen(false);
                  setAddCustomDialogOpen(true);
                }}
                className="h-20 rounded-2xl flex flex-col items-center gap-2 border-2 border-dashed border-purple-200"
                data-testid="button-add-custom-chore"
              >
                <Plus className="w-6 h-6 text-purple-400" />
                <span className="text-xs font-bold text-purple-400">カスタム追加</span>
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={addCustomDialogOpen} onOpenChange={setAddCustomDialogOpen}>
        <DialogContent className="sm:max-w-md rounded-[32px] border-none shadow-2xl bg-white">
          <DialogHeader>
            <DialogTitle className="text-lg font-black text-purple-800 text-center">
              カスタム項目を追加
            </DialogTitle>
            <DialogDescription className="text-xs text-purple-500 text-center">
              最大10個まで追加できます（{activeCustomItems.length}/10）
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 p-4">
            <div>
              <label className="text-xs font-bold text-gray-500 mb-1.5 block">項目名（最大20文字）</label>
              <Input
                value={newItemName}
                onChange={(e) => setNewItemName(e.target.value.slice(0, 20))}
                placeholder="例: 保育園の準備"
                className="rounded-xl border-2"
                data-testid="input-custom-chore-name"
              />
              <p className="text-[10px] text-gray-400 mt-1 text-right">{newItemName.length}/20</p>
            </div>
            <div>
              <label className="text-xs font-bold text-gray-500 mb-1.5 block">アイコン</label>
              <div className="grid grid-cols-5 gap-2">
                {PRESET_ICONS.map((preset) => {
                  const PresetIcon = preset.icon;
                  return (
                    <button
                      key={preset.name}
                      type="button"
                      onClick={() => setNewItemIcon(preset.name)}
                      className={`w-10 h-10 rounded-xl flex items-center justify-center border-2 transition-all ${newItemIcon === preset.name ? "border-purple-500 bg-purple-50" : "border-gray-100"}`}
                      data-testid={`button-icon-${preset.name}`}
                    >
                      <PresetIcon className={`w-5 h-5 ${newItemIcon === preset.name ? "text-purple-500" : "text-gray-400"}`} />
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => setAddCustomDialogOpen(false)}
                className="flex-1 rounded-xl"
              >
                キャンセル
              </Button>
              <Button
                onClick={handleAddCustomItem}
                disabled={!newItemName.trim() || createCustomItem.isPending}
                className="flex-1 rounded-xl"
                data-testid="button-confirm-add-custom-chore"
              >
                <Plus className="w-4 h-4 mr-1" />
                追加
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <BottomNav />
    </div>
  );
}
