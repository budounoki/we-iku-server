import { useState, useMemo } from "react";
import { useUserLabels } from "@/hooks/use-user-labels";
import { Header } from "@/components/Header";
import { BottomNav } from "@/components/Navigation";
import { useSettings, useEvents, useCreateEvent, useCompleteEvent, useDeleteEvent, useLogs } from "@/hooks/use-app-data";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, isSameMonth, addMonths, subMonths, isToday, isBefore, parseISO, startOfWeek, endOfWeek, addWeeks, subWeeks } from "date-fns";
import { ja } from "date-fns/locale";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, ChevronRight, Plus, Check, Trash2, X, Milk, Baby, Moon, Heart, Thermometer, Stethoscope, Star, Gamepad2, Syringe, CalendarDays, ChevronDown, ChevronUp, MessageCircle, ThumbsUp, Palette, Award, Camera, Gift, Sparkles, Sun, Music, Trophy, Cake, GraduationCap, Footprints, TreePine, Utensils } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const WEEKDAYS = ["日", "月", "火", "水", "木", "金", "土"];

const LOG_TYPE_CONFIG: Record<string, { icon: any; label: string; bgColor: string; iconColor: string }> = {
  words: { icon: MessageCircle, label: "ことば", bgColor: "bg-green-50", iconColor: "text-green-600" },
  milestone: { icon: Star, label: "はじめて", bgColor: "bg-purple-50", iconColor: "text-purple-500" },
  discipline: { icon: ThumbsUp, label: "しつけ", bgColor: "bg-yellow-50", iconColor: "text-yellow-700" },
  hobby: { icon: Palette, label: "きょうみ", bgColor: "bg-fuchsia-50", iconColor: "text-fuchsia-600" },
  achievement: { icon: Award, label: "できた!", bgColor: "bg-emerald-50", iconColor: "text-emerald-600" },
  vaccination: { icon: Syringe, label: "予防接種", bgColor: "bg-cyan-50", iconColor: "text-cyan-600" },
  symptom: { icon: Stethoscope, label: "症状メモ", bgColor: "bg-rose-50", iconColor: "text-rose-500" },
  temperature: { icon: Thermometer, label: "体温", bgColor: "bg-amber-50", iconColor: "text-amber-500" },
  temp: { icon: Thermometer, label: "体温", bgColor: "bg-amber-50", iconColor: "text-amber-500" },
};

const EVENT_ICONS = [
  { name: "Baby",        Icon: Baby,        label: "赤ちゃん" },
  { name: "Star",        Icon: Star,        label: "スター" },
  { name: "Heart",       Icon: Heart,       label: "ハート" },
  { name: "Sparkles",    Icon: Sparkles,    label: "お祝い" },
  { name: "Gift",        Icon: Gift,        label: "プレゼント" },
  { name: "Cake",        Icon: Cake,        label: "ケーキ" },
  { name: "Camera",      Icon: Camera,      label: "写真" },
  { name: "Footprints",  Icon: Footprints,  label: "あんよ" },
  { name: "Syringe",     Icon: Syringe,     label: "予防接種" },
  { name: "Stethoscope", Icon: Stethoscope, label: "健診" },
  { name: "Utensils",    Icon: Utensils,    label: "食事" },
  { name: "TreePine",    Icon: TreePine,    label: "お出かけ" },
  { name: "Sun",         Icon: Sun,         label: "晴れ" },
  { name: "Music",       Icon: Music,       label: "音楽" },
  { name: "GraduationCap", Icon: GraduationCap, label: "入学" },
  { name: "CalendarDays",  Icon: CalendarDays,  label: "予定" },
];

const EVENT_COLORS = [
  { name: "pink",   dot: "bg-pink-400",   bg: "bg-pink-500",   iconBg: "bg-pink-100",   iconText: "text-pink-500",   ring: "ring-pink-300",   label: "ピンク" },
  { name: "rose",   dot: "bg-rose-400",   bg: "bg-rose-500",   iconBg: "bg-rose-100",   iconText: "text-rose-500",   ring: "ring-rose-300",   label: "ローズ" },
  { name: "purple", dot: "bg-purple-400", bg: "bg-purple-500", iconBg: "bg-purple-100", iconText: "text-purple-500", ring: "ring-purple-300", label: "パープル" },
  { name: "violet", dot: "bg-violet-400", bg: "bg-violet-500", iconBg: "bg-violet-100", iconText: "text-violet-500", ring: "ring-violet-300", label: "バイオレット" },
  { name: "sky",    dot: "bg-sky-400",    bg: "bg-sky-500",    iconBg: "bg-sky-100",    iconText: "text-sky-500",    ring: "ring-sky-300",    label: "スカイ" },
  { name: "teal",   dot: "bg-teal-400",   bg: "bg-teal-500",   iconBg: "bg-teal-100",   iconText: "text-teal-500",   ring: "ring-teal-300",   label: "ティール" },
  { name: "green",  dot: "bg-green-400",  bg: "bg-green-500",  iconBg: "bg-green-100",  iconText: "text-green-500",  ring: "ring-green-300",  label: "グリーン" },
  { name: "amber",  dot: "bg-amber-400",  bg: "bg-amber-500",  iconBg: "bg-amber-100",  iconText: "text-amber-500",  ring: "ring-amber-300",  label: "アンバー" },
  { name: "orange", dot: "bg-orange-400", bg: "bg-orange-500", iconBg: "bg-orange-100", iconText: "text-orange-500", ring: "ring-orange-300", label: "オレンジ" },
  { name: "red",    dot: "bg-red-400",    bg: "bg-red-500",    iconBg: "bg-red-100",    iconText: "text-red-500",    ring: "ring-red-300",    label: "レッド" },
];

const getEventColorDef = (color?: string | null) =>
  EVENT_COLORS.find((c) => c.name === color) ?? EVENT_COLORS[2];

const getEventIconDef = (icon?: string | null) =>
  EVENT_ICONS.find((i) => i.name === icon) ?? EVENT_ICONS.find((i) => i.name === "CalendarDays")!;

const MILESTONE_PRESETS = [
  { title: "お宮参り",        icon: "Baby",      color: "pink"   },
  { title: "生後100日",       icon: "Sparkles",  color: "amber"  },
  { title: "お食い初め",      icon: "Utensils",  color: "orange" },
  { title: "ハーフバースデー", icon: "Cake",      color: "rose"   },
  { title: "初節句",          icon: "TreePine",  color: "green"  },
  { title: "初誕生日",        icon: "Gift",      color: "violet" },
  { title: "七五三",          icon: "Star",      color: "amber"  },
  { title: "初めてのあんよ",  icon: "Footprints", color: "teal"  },
  { title: "健診",            icon: "Stethoscope", color: "sky"  },
  { title: "予防接種",        icon: "Syringe",   color: "teal"   },
];

export default function Calendar() {
  const { papaLabel, mamaLabel } = useUserLabels();
  const familyId = localStorage.getItem("familyId") || "default";
  const { data: settings } = useSettings(familyId);
  const { data: events = [], isLoading } = useEvents(familyId);
  const { data: allLogs = [] } = useLogs(familyId);

  const activeChildId = localStorage.getItem("activeChildId") ? parseInt(localStorage.getItem("activeChildId")!) : null;
  const logs = useMemo(() => {
    if (!activeChildId) return allLogs;
    return allLogs.filter((l: any) => !l.childId || l.childId === activeChildId);
  }, [allLogs, activeChildId]);

  const createEvent = useCreateEvent();
  const completeEvent = useCompleteEvent();
  const deleteEvent = useDeleteEvent();

  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newTime, setNewTime] = useState("");
  const [newAssignee, setNewAssignee] = useState("未定");
  const [newMemo, setNewMemo] = useState("");
  const [calendarMode, setCalendarMode] = useState<"month" | "week">("month");
  const [newIcon, setNewIcon] = useState("CalendarDays");
  const [newColor, setNewColor] = useState("purple");

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const monthDays = eachDayOfInterval({ start: monthStart, end: monthEnd });
  const startDayOfWeek = monthStart.getDay();
  const paddingDays = Array.from({ length: startDayOfWeek }, (_, i) => i);

  const weekStart = startOfWeek(selectedDate, { weekStartsOn: 0 });
  const weekEnd = endOfWeek(selectedDate, { weekStartsOn: 0 });
  const weekDays = eachDayOfInterval({ start: weekStart, end: weekEnd });

  const getEventsForDate = (date: Date) => {
    return events.filter((e: any) => {
      const eventDate = parseISO(e.date);
      return isSameDay(eventDate, date);
    });
  };

  const CALENDAR_LOG_TYPES = ["words", "milestone", "discipline", "hobby", "achievement", "vaccination", "symptom", "temperature", "temp"];

  const getLogsForDate = (date: Date) => {
    return logs.filter((l: any) => {
      const logDate = new Date(l.createdAt);
      return isSameDay(logDate, date) && CALENDAR_LOG_TYPES.includes(l.type);
    });
  };

  const hasDataForDate = (date: Date) => {
    return getEventsForDate(date).length > 0 || getLogsForDate(date).length > 0;
  };

  const hasSymptomForDate = (date: Date) => {
    return logs.some((l: any) => {
      const logDate = new Date(l.createdAt);
      return isSameDay(logDate, date) && (l.type === "symptom" || ((l.type === "temp" || l.type === "temperature") && l.bodyTemperature >= 37.5));
    });
  };

  const selectedDateEvents = getEventsForDate(selectedDate);
  const selectedDateLogs = getLogsForDate(selectedDate);

  const timelineItems = useMemo(() => {
    const items: Array<{
      id: string;
      time: Date;
      timeStr: string;
      type: "log" | "event";
      logType?: string;
      title: string;
      userId?: string;
      completed?: boolean;
      eventId?: number;
      detail?: string;
      memo?: string;
      eventIcon?: string;
      eventColor?: string;
    }> = [];

    selectedDateLogs.forEach((log: any) => {
      const time = new Date(log.createdAt);
      const config = LOG_TYPE_CONFIG[log.type];
      let detail = "";
      if ((log.type === "temp" || log.type === "temperature") && log.bodyTemperature) detail = `${log.bodyTemperature}°C`;
      if (log.type === "milk" && log.subType) {
        detail = log.subType === "breast" ? "母乳" : log.subType === "formula" ? "ミルク" : "混合";
      }
      if (log.type === "diaper" && log.subType) {
        detail = log.subType === "pee" ? "おしっこ" : log.subType === "poop" ? "うんち" : "両方";
      }
      let memoText = log.message as string | undefined;
      if (log.type === "achievement" && memoText?.startsWith("できた!: ")) {
        memoText = memoText.slice("できた!: ".length);
      }
      if (log.type === "symptom" && memoText?.startsWith("症状: ")) {
        memoText = memoText.slice("症状: ".length);
      }
      const memo = ["milestone", "achievement", "words", "hobby", "play", "symptom"].includes(log.type) && memoText
        ? memoText
        : undefined;
      items.push({
        id: `log-${log.id}`,
        time,
        timeStr: format(time, "HH:mm"),
        type: "log",
        logType: log.type,
        title: config?.label || log.type,
        userId: log.userId,
        detail,
        memo,
      });
    });

    selectedDateEvents.forEach((event: any) => {
      const time = event.time
        ? new Date(`${event.date}T${event.time}`)
        : new Date(`${event.date}T09:00`);
      items.push({
        id: `event-${event.id}`,
        time,
        timeStr: event.time || "--:--",
        type: "event",
        title: event.title,
        userId: event.assignee === "パパ" ? "papa" : event.assignee === "ママ" ? "mama" : undefined,
        completed: event.completed,
        eventId: event.id,
        memo: event.memo || undefined,
        eventIcon: event.icon || "CalendarDays",
        eventColor: event.color || "purple",
      });
    });

    items.sort((a, b) => a.time.getTime() - b.time.getTime());
    return items;
  }, [selectedDateLogs, selectedDateEvents]);

  const handleAddEvent = () => {
    if (!newTitle.trim() || !selectedDate) return;
    createEvent.mutate({
      familyId,
      title: newTitle.trim(),
      date: format(selectedDate, "yyyy-MM-dd"),
      time: newTime || null,
      assignee: newAssignee,
      memo: newMemo || null,
      icon: newIcon,
      color: newColor,
    });
    setNewTitle("");
    setNewTime("");
    setNewAssignee("未定");
    setNewMemo("");
    setNewIcon("CalendarDays");
    setNewColor("purple");
    setShowAddDialog(false);
  };

  const applyPreset = (preset: typeof MILESTONE_PRESETS[0]) => {
    setNewTitle(preset.title);
    setNewIcon(preset.icon);
    setNewColor(preset.color);
  };

  const handleComplete = (eventId: number) => {
    const userId = localStorage.getItem("userType") || "papa";
    completeEvent.mutate({ id: eventId, completedBy: userId });
  };

  const handleDelete = (eventId: number) => {
    deleteEvent.mutate(eventId);
  };

  const renderDayCell = (day: Date, compact?: boolean) => {
    const dayEvents = getEventsForDate(day);
    const hasData = hasDataForDate(day);
    const hasSymptom = hasSymptomForDate(day);
    const allCompleted = dayEvents.length > 0 && dayEvents.every((e: any) => e.completed);
    const hasIncomplete = dayEvents.some((e: any) => !e.completed);
    const firstEventColor = dayEvents.length > 0 ? getEventColorDef(dayEvents[0].color) : null;
    const isSelected = isSameDay(day, selectedDate);
    const isPast = isBefore(day, new Date()) && !isToday(day);
    const dayOfWeek = day.getDay();
    const inMonth = isSameMonth(day, currentMonth);

    return (
      <motion.button
        key={day.toISOString()}
        whileTap={{ scale: 0.92 }}
        onClick={() => {
          setSelectedDate(day);
          if (!isSameMonth(day, currentMonth)) setCurrentMonth(day);
        }}
        data-testid={`button-day-${format(day, "yyyy-MM-dd")}`}
        className={cn(
          "rounded-2xl flex flex-col items-center justify-center relative transition-all",
          compact ? "h-10 w-full" : "aspect-square",
          isSelected
            ? "bg-purple-500 text-white shadow-lg shadow-purple-200"
            : isToday(day)
              ? "bg-purple-50 text-purple-600 ring-2 ring-purple-200"
              : !inMonth
                ? "text-gray-200"
                : isPast
                  ? "text-gray-300"
                  : "text-gray-700",
          dayOfWeek === 0 && !isSelected ? "text-red-400" : "",
          dayOfWeek === 6 && !isSelected ? "text-blue-400" : ""
        )}
      >
        <span className={cn("text-sm font-bold", isPast && !isSelected && "text-gray-300")}>
          {format(day, "d")}
        </span>
        {(hasData || hasSymptom) && (
          <div className="flex gap-0.5 mt-0.5">
            {allCompleted ? (
              <div className="w-1.5 h-1.5 rounded-full bg-green-400" />
            ) : hasIncomplete ? (
              <div className={cn(
                "w-1.5 h-1.5 rounded-full",
                isSelected ? "bg-white" : (firstEventColor ? firstEventColor.dot : "bg-purple-400")
              )} />
            ) : hasData ? (
              <div className={cn("w-1.5 h-1.5 rounded-full", isSelected ? "bg-white/60" : "bg-gray-300")} />
            ) : null}
            {hasSymptom && (
              <div className={cn("w-1.5 h-1.5 rounded-full", isSelected ? "bg-rose-200" : "bg-rose-400")} />
            )}
          </div>
        )}
      </motion.button>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50/50 via-white to-green-50/50 pb-24 font-sans">
      <div className="max-w-md mx-auto min-h-screen flex flex-col">
        <Header />

        <div className="px-6 pt-4 space-y-3">
          {calendarMode === "week" ? (
            <>
              <div className="flex items-center justify-between">
                <Button size="icon" variant="ghost" onClick={() => setSelectedDate(prev => subWeeks(prev, 1))} data-testid="button-prev-week">
                  <ChevronLeft className="w-5 h-5" />
                </Button>
                <button
                  onClick={() => setCalendarMode("month")}
                  className="flex items-center gap-1 text-sm font-black text-gray-700"
                  data-testid="button-expand-calendar"
                >
                  {format(selectedDate, "yyyy年 M月", { locale: ja })}
                  <ChevronDown className="w-4 h-4 text-gray-400" />
                </button>
                <Button size="icon" variant="ghost" onClick={() => setSelectedDate(prev => addWeeks(prev, 1))} data-testid="button-next-week">
                  <ChevronRight className="w-5 h-5" />
                </Button>
              </div>

              <div className="bg-white/80 backdrop-blur-md rounded-3xl p-3 border border-white shadow-sm">
                <div className="grid grid-cols-7 gap-1 mb-1">
                  {WEEKDAYS.map((day, i) => (
                    <div key={day} className={cn("text-center text-[10px] font-bold py-0.5", i === 0 ? "text-red-400" : i === 6 ? "text-blue-400" : "text-gray-400")}>
                      {day}
                    </div>
                  ))}
                </div>
                <div className="grid grid-cols-7 gap-1">
                  {weekDays.map((day) => renderDayCell(day, true))}
                </div>
              </div>
            </>
          ) : (
            <>
              <div className="flex items-center justify-between">
                <Button size="icon" variant="ghost" onClick={() => setCurrentMonth(subMonths(currentMonth, 1))} data-testid="button-prev-month">
                  <ChevronLeft className="w-5 h-5" />
                </Button>
                <button
                  onClick={() => setCalendarMode("week")}
                  className="flex items-center gap-1 text-sm font-black text-gray-700"
                  data-testid="button-collapse-calendar"
                >
                  {format(currentMonth, "yyyy年 M月", { locale: ja })}
                  <ChevronUp className="w-4 h-4 text-gray-400" />
                </button>
                <Button size="icon" variant="ghost" onClick={() => setCurrentMonth(addMonths(currentMonth, 1))} data-testid="button-next-month">
                  <ChevronRight className="w-5 h-5" />
                </Button>
              </div>

              <div className="bg-white/80 backdrop-blur-md rounded-3xl p-4 border border-white shadow-sm">
                <div className="grid grid-cols-7 gap-1 mb-2">
                  {WEEKDAYS.map((day, i) => (
                    <div key={day} className={cn("text-center text-[10px] font-bold py-1", i === 0 ? "text-red-400" : i === 6 ? "text-blue-400" : "text-gray-400")}>
                      {day}
                    </div>
                  ))}
                </div>
                <div className="grid grid-cols-7 gap-1">
                  {paddingDays.map((_, i) => <div key={`pad-${i}`} className="aspect-square" />)}
                  {monthDays.map((day) => renderDayCell(day))}
                </div>
              </div>
            </>
          )}

          <div className="flex items-center justify-between">
            <h3 className="font-bold text-gray-700" data-testid="text-selected-date">
              {format(selectedDate, "M月d日（E）", { locale: ja })}
            </h3>
            <Button
              size="sm"
              onClick={() => setShowAddDialog(true)}
              className="rounded-2xl bg-purple-500 text-white font-bold shadow-sm"
              data-testid="button-add-event"
            >
              <Plus className="w-4 h-4 mr-1" /> 予定を追加
            </Button>
          </div>

          {timelineItems.length === 0 ? (
            <div className="bg-white/60 backdrop-blur-sm rounded-3xl p-8 text-center border border-white shadow-sm">
              <CalendarDays className="w-10 h-10 text-gray-300 mx-auto mb-2" />
              <p className="text-gray-400 text-sm font-bold">この日の記録はありません</p>
            </div>
          ) : (
            <div className="bg-white/60 backdrop-blur-sm rounded-3xl border border-white shadow-sm overflow-hidden" data-testid="timeline-container">
              <div className="divide-y divide-gray-50">
                {timelineItems.map((item) => {
                  if (item.type === "event") {
                    const evColorDef = getEventColorDef(item.eventColor);
                    const evIconDef = getEventIconDef(item.eventIcon);
                    const EvIcon = evIconDef.Icon;
                    return (
                      <div
                        key={item.id}
                        className={cn(
                          "flex items-start gap-3 px-4 py-3",
                          item.completed ? "bg-green-50/30" : "bg-purple-50/20"
                        )}
                        data-testid={`timeline-item-${item.id}`}
                      >
                        <span className="text-xs font-mono font-bold text-gray-400 w-10 shrink-0 mt-1">{item.timeStr}</span>
                        <div className={cn(
                          "p-1.5 rounded-xl shrink-0 mt-0.5",
                          item.completed ? "bg-green-100" : evColorDef.iconBg
                        )}>
                          <EvIcon className={cn("w-3.5 h-3.5", item.completed ? "text-green-500" : evColorDef.iconText)} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className={cn("text-sm font-bold truncate", item.completed ? "text-gray-400 line-through" : "text-gray-700")}>
                            {item.title}
                          </p>
                          {item.memo && (
                            <p className="text-xs text-gray-400 truncate mt-0.5">{item.memo}</p>
                          )}
                        </div>
                        {item.userId && (
                          <span className={cn(
                            "text-[10px] font-bold px-1.5 py-0.5 rounded-full shrink-0 mt-0.5",
                            item.userId === "papa" ? "bg-blue-100 text-blue-600" : item.userId === "mama" ? "bg-pink-100 text-pink-600" : "bg-gray-100 text-gray-500"
                          )}>
                            {item.userId === "papa" ? papaLabel : item.userId === "mama" ? mamaLabel : "未定"}
                          </span>
                        )}
                        <div className="flex shrink-0 mt-0.5">
                          {!item.completed && item.eventId && (
                            <Button size="icon" variant="ghost" onClick={() => handleComplete(item.eventId!)} className="text-green-500 w-7 h-7" data-testid={`button-complete-${item.eventId}`}>
                              <Check className="w-3.5 h-3.5" />
                            </Button>
                          )}
                          {item.eventId && (
                            <Button size="icon" variant="ghost" onClick={() => handleDelete(item.eventId!)} className="text-gray-300 w-7 h-7" data-testid={`button-delete-${item.eventId}`}>
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          )}
                        </div>
                      </div>
                    );
                  }

                  const config = LOG_TYPE_CONFIG[item.logType || ""] || LOG_TYPE_CONFIG.milk;
                  const IconComponent = config.icon;
                  return (
                    <div key={item.id} className="flex items-center gap-3 px-4 py-3" data-testid={`timeline-item-${item.id}`}>
                      <span className="text-xs font-mono font-bold text-gray-400 w-10 shrink-0">{item.timeStr}</span>
                      <div className={cn("p-1.5 rounded-xl shrink-0", config.bgColor)}>
                        <IconComponent className={cn("w-3.5 h-3.5", config.iconColor)} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-gray-700 truncate">
                          {item.title}
                          {item.detail && <span className="text-gray-400 font-normal ml-1">{item.detail}</span>}
                        </p>
                        {item.memo && (
                          <p className="text-xs text-gray-500 truncate mt-0.5">{item.memo}</p>
                        )}
                      </div>
                      {item.userId && (
                        <span className={cn(
                          "text-[10px] font-bold px-1.5 py-0.5 rounded-full shrink-0",
                          item.userId === "papa" ? "bg-blue-100 text-blue-600" : "bg-pink-100 text-pink-600"
                        )}>
                          {item.userId === "papa" ? papaLabel : mamaLabel}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      <AnimatePresence>
        {showAddDialog && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black/40 backdrop-blur-sm flex items-end justify-center"
            onClick={(e) => { if (e.target === e.currentTarget) setShowAddDialog(false); }}
          >
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="w-full max-w-md bg-white rounded-t-[2rem] p-6 space-y-4 shadow-2xl max-h-[88vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between">
                <h3 className="font-black text-gray-700 text-lg">予定を追加</h3>
                <Button size="icon" variant="ghost" onClick={() => setShowAddDialog(false)} data-testid="button-close-dialog">
                  <X className="w-5 h-5" />
                </Button>
              </div>

              <div className="space-y-4">

                {/* Milestone presets */}
                <div>
                  <p className="text-xs font-bold text-gray-400 mb-2">よく使う記念日</p>
                  <div className="flex flex-wrap gap-1.5">
                    {MILESTONE_PRESETS.map((preset) => {
                      const pColor = getEventColorDef(preset.color);
                      const pIcon = getEventIconDef(preset.icon);
                      const PIcon = pIcon.Icon;
                      return (
                        <button
                          key={preset.title}
                          onClick={() => applyPreset(preset)}
                          data-testid={`preset-${preset.title}`}
                          className={cn(
                            "flex items-center gap-1 px-2.5 py-1.5 rounded-2xl text-xs font-bold border-2 transition-all",
                            newTitle === preset.title && newColor === preset.color
                              ? `${pColor.bg} text-white border-transparent`
                              : "bg-white text-gray-600 border-gray-100 hover:border-gray-200"
                          )}
                        >
                          <PIcon className={cn("w-3 h-3", newTitle === preset.title && newColor === preset.color ? "text-white" : pColor.iconText)} />
                          {preset.title}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Title input */}
                <div>
                  <label className="text-xs font-bold text-gray-400 block mb-1">タイトル</label>
                  <input
                    type="text"
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    placeholder="例：お宮参り、健診、誕生日"
                    className="w-full px-4 py-3 rounded-2xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-purple-200 focus:border-purple-300"
                    data-testid="input-event-title"
                  />
                </div>

                {/* Icon picker */}
                <div>
                  <p className="text-xs font-bold text-gray-400 mb-2">アイコン</p>
                  <div className="grid grid-cols-8 gap-1.5">
                    {EVENT_ICONS.map(({ name, Icon: Ico, label }) => {
                      const colorDef = getEventColorDef(newColor);
                      const isSelected = newIcon === name;
                      return (
                        <button
                          key={name}
                          title={label}
                          onClick={() => setNewIcon(name)}
                          data-testid={`icon-pick-${name}`}
                          className={cn(
                            "aspect-square rounded-2xl flex items-center justify-center border-2 transition-all",
                            isSelected
                              ? `${colorDef.bg} border-transparent`
                              : "bg-gray-50 border-transparent hover:border-gray-200"
                          )}
                        >
                          <Ico className={cn("w-4 h-4", isSelected ? "text-white" : "text-gray-400")} />
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Color picker */}
                <div>
                  <p className="text-xs font-bold text-gray-400 mb-2">カラー</p>
                  <div className="flex flex-wrap gap-2">
                    {EVENT_COLORS.map((c) => (
                      <button
                        key={c.name}
                        title={c.label}
                        onClick={() => setNewColor(c.name)}
                        data-testid={`color-pick-${c.name}`}
                        className={cn(
                          "w-7 h-7 rounded-full border-4 transition-all",
                          c.dot,
                          newColor === c.name ? "border-gray-400 scale-110" : "border-transparent"
                        )}
                      />
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-bold text-gray-400 block mb-1">時間（任意）</label>
                    <input
                      type="time"
                      value={newTime}
                      onChange={(e) => setNewTime(e.target.value)}
                      className="w-full px-4 py-3 rounded-2xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-purple-200 focus:border-purple-300"
                      data-testid="input-event-time"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-gray-400 block mb-1">担当</label>
                    <select
                      value={newAssignee}
                      onChange={(e) => setNewAssignee(e.target.value)}
                      className="w-full px-4 py-3 rounded-2xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-purple-200 focus:border-purple-300 bg-white"
                      data-testid="select-event-assignee"
                    >
                      <option value="未定">未定</option>
                      <option value="パパ">{papaLabel}</option>
                      <option value="ママ">{mamaLabel}</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="text-xs font-bold text-gray-400 block mb-1">メモ（任意）</label>
                  <input
                    type="text"
                    value={newMemo}
                    onChange={(e) => setNewMemo(e.target.value)}
                    placeholder="持ち物や注意点など"
                    className="w-full px-4 py-3 rounded-2xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-purple-200 focus:border-purple-300"
                    data-testid="input-event-memo"
                  />
                </div>

                {/* Preview + Submit */}
                <div className="flex items-center gap-3">
                  <div className={cn("p-2.5 rounded-2xl shrink-0", getEventColorDef(newColor).bg)}>
                    {(() => { const Ico = getEventIconDef(newIcon).Icon; return <Ico className="w-5 h-5 text-white" />; })()}
                  </div>
                  <Button
                    onClick={handleAddEvent}
                    disabled={!newTitle.trim() || createEvent.isPending}
                    className={cn("flex-1 rounded-2xl h-12 text-white font-black shadow-lg", getEventColorDef(newColor).bg)}
                    data-testid="button-submit-event"
                  >
                    {createEvent.isPending ? "追加中..." : newTitle.trim() ? `「${newTitle}」を追加する` : "この日に追加する"}
                  </Button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <BottomNav />
    </div>
  );
}
