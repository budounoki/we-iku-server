import { Header } from "@/components/Header";
import { BottomNav } from "@/components/Navigation";
import { useActiveChild } from "@/hooks/use-active-child";
import { useSettings } from "@/hooks/use-app-data";
import { useState, useMemo, useRef, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  ArrowLeft, Check, AlertTriangle, Circle, Plus, Search, CalendarDays, EyeOff, Eye, ChevronDown, ChevronUp, Pencil, Trash2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

import { FOOD_CATEGORIES } from "@/lib/food-categories";

type IngredientStatus = "not_tried" | "ok" | "caution";

interface FoodIngredient {
  id: number;
  familyId: string;
  childId: number | null;
  ingredientName: string;
  category: string;
  status: string;
  firstTriedDate: string | null;
  notes: string | null;
  isCustom: boolean;
}

function getHiddenStorageKey(familyId: string, childId: number) {
  return `food_hidden_${familyId}_${childId}`;
}

function loadHiddenSet(familyId: string, childId: number): Set<string> {
  try {
    const raw = localStorage.getItem(getHiddenStorageKey(familyId, childId));
    if (!raw) return new Set();
    return new Set(JSON.parse(raw));
  } catch {
    return new Set();
  }
}

function saveHiddenSet(familyId: string, childId: number, set: Set<string>) {
  localStorage.setItem(getHiddenStorageKey(familyId, childId), JSON.stringify(Array.from(set)));
}

const LONG_PRESS_MS = 600;

export default function FoodTracker() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const familyId = localStorage.getItem("familyId") || "default";
  const { data: settings } = useSettings(familyId);
  const { activeChild, activeChildId } = useActiveChild(familyId, settings);

  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [addCustomOpen, setAddCustomOpen] = useState(false);
  const [customName, setCustomName] = useState("");
  const [customCategory, setCustomCategory] = useState("other");

  const [sheetItem, setSheetItem] = useState<{ name: string; category: string } | null>(null);
  const [sheetStatus, setSheetStatus] = useState<IngredientStatus | null>(null);
  const [sheetDate, setSheetDate] = useState("");
  const [sheetNote, setSheetNote] = useState("");

  const [contextTarget, setContextTarget] = useState<{ name: string; category: string; isHidden: boolean; isCustom?: boolean; id?: number } | null>(null);
  const [confirmHide, setConfirmHide] = useState<{ name: string; category: string } | null>(null);
  const [showHiddenSection, setShowHiddenSection] = useState(false);
  const [editCustomOpen, setEditCustomOpen] = useState(false);
  const [editCustomId, setEditCustomId] = useState<number | null>(null);
  const [editCustomName, setEditCustomName] = useState("");
  const [editCustomCategory, setEditCustomCategory] = useState("other");
  const [confirmDeleteCustom, setConfirmDeleteCustom] = useState<{ id: number; name: string } | null>(null);

  const childId = activeChildId ?? 0;

  const [hiddenItems, setHiddenItems] = useState<Set<string>>(() =>
    childId ? loadHiddenSet(familyId, childId) : new Set()
  );

  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressActivated = useRef(false);

  const startLongPress = useCallback((name: string, category: string, isHidden: boolean, isCustom?: boolean, id?: number) => {
    longPressActivated.current = false;
    longPressTimer.current = setTimeout(() => {
      longPressActivated.current = true;
      setContextTarget({ name, category, isHidden, isCustom, id });
    }, LONG_PRESS_MS);
  }, []);

  const cancelLongPress = useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  }, []);

  const hideItem = (category: string, name: string) => {
    const key = `${category}:${name}`;
    const next = new Set(hiddenItems);
    next.add(key);
    setHiddenItems(next);
    saveHiddenSet(familyId, childId, next);
    setConfirmHide(null);
    toast({ title: `${name} を非表示にしました`, className: "bg-gray-50 border-gray-100 text-gray-800" });
  };

  const showItem = (category: string, name: string) => {
    const key = `${category}:${name}`;
    const next = new Set(hiddenItems);
    next.delete(key);
    setHiddenItems(next);
    saveHiddenSet(familyId, childId, next);
    setContextTarget(null);
    toast({ title: `${name} を再表示しました`, className: "bg-purple-50 border-purple-100 text-purple-800" });
  };

  const { data: savedIngredients = [] } = useQuery<FoodIngredient[]>({
    queryKey: ["/api/families/:familyId/food-ingredients/:childId", familyId, childId],
    queryFn: async () => {
      if (!childId) return [];
      const res = await fetch(`/api/families/${familyId}/food-ingredients/${childId}`);
      return res.json();
    },
    enabled: !!childId,
  });

  const savedMap = useMemo(() => {
    const m = new Map<string, FoodIngredient>();
    savedIngredients.forEach((ing) => m.set(`${ing.category}:${ing.ingredientName}`, ing));
    return m;
  }, [savedIngredients]);

  const upsertMutation = useMutation({
    mutationFn: async (data: {
      childId: number;
      ingredientName: string;
      category: string;
      status: string;
      firstTriedDate?: string | null;
      notes?: string | null;
      isCustom?: boolean;
    }) => {
      const res = await fetch(`/api/families/${familyId}/food-ingredients`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...data, familyId }),
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["/api/families/:familyId/food-ingredients/:childId", familyId, childId],
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, ...data }: { id: number; ingredientName?: string; category?: string }) => {
      const res = await fetch(`/api/families/${familyId}/food-ingredients/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("更新に失敗しました");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["/api/families/:familyId/food-ingredients/:childId", familyId, childId],
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/families/${familyId}/food-ingredients/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("削除に失敗しました");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["/api/families/:familyId/food-ingredients/:childId", familyId, childId],
      });
    },
  });

  const allItems = useMemo(() => {
    const builtIn: { name: string; category: string; isCustom: boolean }[] = [];
    FOOD_CATEGORIES.forEach((cat) => cat.items.forEach((name) => builtIn.push({ name, category: cat.id, isCustom: false })));
    const customItems = savedIngredients
      .filter((ing) => ing.isCustom)
      .map((ing) => ({ name: ing.ingredientName, category: ing.category, isCustom: true }));
    const allMap = new Map<string, { name: string; category: string; isCustom: boolean }>();
    [...builtIn, ...customItems].forEach((item) => allMap.set(`${item.category}:${item.name}`, item));
    return Array.from(allMap.values());
  }, [savedIngredients]);

  const visibleItems = useMemo(() => {
    return allItems.filter((item) => {
      if (!item.isCustom && hiddenItems.has(`${item.category}:${item.name}`)) return false;
      const matchCat = selectedCategory === "all" || item.category === selectedCategory;
      const matchSearch = !searchQuery || item.name.includes(searchQuery);
      return matchCat && matchSearch;
    });
  }, [allItems, selectedCategory, searchQuery, hiddenItems]);

  const hiddenVisibleItems = useMemo(() => {
    return allItems.filter((item) => {
      if (item.isCustom) return false;
      if (!hiddenItems.has(`${item.category}:${item.name}`)) return false;
      const matchCat = selectedCategory === "all" || item.category === selectedCategory;
      const matchSearch = !searchQuery || item.name.includes(searchQuery);
      return matchCat && matchSearch;
    });
  }, [allItems, selectedCategory, searchQuery, hiddenItems]);

  const stats = useMemo(() => {
    const total = allItems.length;
    let tried = 0;
    let caution = 0;
    allItems.forEach((item) => {
      const saved = savedMap.get(`${item.category}:${item.name}`);
      if (saved?.status === "ok") tried++;
      if (saved?.status === "caution") caution++;
    });
    return { total, tried, caution };
  }, [allItems, savedMap]);

  const getStatus = (category: string, name: string): IngredientStatus => {
    const saved = savedMap.get(`${category}:${name}`);
    return (saved?.status as IngredientStatus) || "not_tried";
  };

  const openSheet = (category: string, name: string) => {
    if (longPressActivated.current) return;
    const current = getStatus(category, name);
    const saved = savedMap.get(`${category}:${name}`);
    setSheetItem({ name, category });
    setSheetStatus(current === "not_tried" ? null : current);
    setSheetDate(saved?.firstTriedDate || "");
    setSheetNote(saved?.notes || "");
  };

  const closeSheet = () => {
    setSheetItem(null);
    setSheetStatus(null);
    setSheetDate("");
    setSheetNote("");
  };

  const handleStatusSelect = (status: IngredientStatus) => {
    if (status === "not_tried") {
      setSheetStatus("not_tried");
    } else {
      setSheetStatus(status);
    }
  };

  const handleSheetSave = () => {
    if (!sheetItem) return;
    if (sheetStatus === null) {
      closeSheet();
      return;
    }
    if (sheetStatus === "not_tried") {
      upsertMutation.mutate({
        childId,
        ingredientName: sheetItem.name,
        category: sheetItem.category,
        status: "not_tried",
        firstTriedDate: null,
        notes: null,
      });
      toast({
        title: `${sheetItem.name} を未試行に戻しました`,
        className: "bg-gray-50 border-gray-100 text-gray-800",
      });
    } else if (sheetStatus === "ok") {
      upsertMutation.mutate({
        childId,
        ingredientName: sheetItem.name,
        category: sheetItem.category,
        status: "ok",
        firstTriedDate: sheetDate || null,
        notes: null,
      });
      toast({
        title: `${sheetItem.name} を記録しました`,
        description: "食べた食材として記録しました",
        className: "bg-green-50 border-green-100 text-green-900",
      });
    } else if (sheetStatus === "caution") {
      upsertMutation.mutate({
        childId,
        ingredientName: sheetItem.name,
        category: sheetItem.category,
        status: "caution",
        firstTriedDate: sheetDate || null,
        notes: sheetNote || null,
      });
      toast({
        title: `${sheetItem.name} を要注意に設定`,
        description: "アレルギー要確認として記録しました",
        className: "bg-orange-50 border-orange-100 text-orange-900",
      });
    }
    closeSheet();
  };

  const handleAddCustom = () => {
    if (!customName.trim()) return;
    upsertMutation.mutate({
      childId,
      ingredientName: customName.trim(),
      category: customCategory,
      status: "ok",
      firstTriedDate: format(new Date(), "yyyy-MM-dd"),
      isCustom: true,
    });
    setCustomName("");
    setAddCustomOpen(false);
    toast({
      title: "カスタム食材を追加しました",
      className: "bg-purple-50 border-purple-100 text-purple-900",
    });
  };

  const progressPercent = stats.total > 0 ? Math.round(((stats.tried + stats.caution) / stats.total) * 100) : 0;

  const FoodItemButton = ({
    item,
    isHidden = false,
  }: {
    item: { name: string; category: string; isCustom: boolean };
    isHidden?: boolean;
  }) => {
    const status = getStatus(item.category, item.name);
    const saved = savedMap.get(`${item.category}:${item.name}`);
    return (
      <button
        key={`${item.category}:${item.name}`}
        data-testid={`button-food-${item.name}`}
        onContextMenu={(e) => e.preventDefault()}
        onPointerDown={() => {
          startLongPress(item.name, item.category, isHidden, item.isCustom, saved?.id);
        }}
        onPointerUp={() => { cancelLongPress(); }}
        onPointerLeave={() => { cancelLongPress(); }}
        onPointerCancel={() => { cancelLongPress(); }}
        onClick={() => {
          if (!isHidden) openSheet(item.category, item.name);
        }}
        className={cn(
          "flex items-center gap-2 p-2.5 rounded-2xl border-2 text-left transition-all w-full",
          isHidden
            ? "bg-gray-50 border-gray-100 opacity-60"
            : status === "ok" ? "bg-green-50 border-green-200"
            : status === "caution" ? "bg-orange-50 border-orange-200"
            : "bg-white border-gray-200"
        )}
      >
        <div className={cn(
          "shrink-0 w-6 h-6 rounded-full flex items-center justify-center",
          isHidden
            ? "bg-gray-200 text-gray-400"
            : status === "ok" ? "bg-green-500 text-white"
            : status === "caution" ? "bg-orange-400 text-white"
            : "bg-gray-200 text-gray-400"
        )}>
          {!isHidden && status === "ok" && <Check className="w-3.5 h-3.5" />}
          {!isHidden && status === "caution" && <AlertTriangle className="w-3.5 h-3.5" />}
          {(isHidden || status === "not_tried") && <Circle className="w-3 h-3" />}
        </div>
        <div className="min-w-0 flex-1">
          <p className={cn(
            "text-xs font-bold truncate",
            isHidden
              ? "text-gray-400"
              : status === "ok" ? "text-green-700"
              : status === "caution" ? "text-orange-700"
              : "text-gray-600"
          )}>
            {item.name}
          </p>
          {!isHidden && saved?.firstTriedDate && (
            <p className="text-[10px] text-gray-400 font-medium">{saved.firstTriedDate}</p>
          )}
        </div>
        {item.isCustom ? (
          <Pencil className="w-3 h-3 shrink-0 text-purple-300" />
        ) : (
          <EyeOff className={cn("w-3 h-3 shrink-0 opacity-0 group-hover:opacity-100", isHidden ? "text-gray-400 opacity-60" : "text-gray-300")} />
        )}
      </button>
    );
  };

  if (!childId) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-purple-50 via-white to-green-50 pb-24">
        <Header />
        <div className="max-w-lg mx-auto px-4 pt-6">
          <Card className="p-6 rounded-3xl text-center">
            <p className="text-gray-500 font-bold">お子さまを登録してください</p>
          </Card>
        </div>
        <BottomNav />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-purple-50 via-white to-green-50 pb-24">
      <Header />
      <div className="max-w-lg mx-auto px-4 pt-4 space-y-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate("/")}
            className="p-2 rounded-full bg-white shadow-sm"
            data-testid="button-food-tracker-back"
          >
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </button>
          <h1 className="text-xl font-black text-gray-800">
            食材チェックリスト
          </h1>
        </div>

        {activeChild && (
          <p className="text-sm font-bold text-purple-500 -mt-2 ml-12">
            {activeChild.name}
          </p>
        )}

        <Card className="p-4 rounded-3xl border-none shadow-sm" data-testid="card-food-progress">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-bold text-gray-700">進捗</span>
            <span className="text-sm font-black text-purple-600">
              {stats.tried + stats.caution} / {stats.total} 食材
            </span>
          </div>
          <Progress value={progressPercent} className="h-3 rounded-full" />
          <div className="flex gap-4 mt-2 text-xs font-bold">
            <span className="text-green-600 flex items-center gap-1">
              <Check className="w-3 h-3" /> {stats.tried} 食べた
            </span>
            <span className="text-orange-500 flex items-center gap-1">
              <AlertTriangle className="w-3 h-3" /> {stats.caution} 要注意
            </span>
          </div>
        </Card>

        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              data-testid="input-food-search"
              placeholder="食材を検索..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 rounded-2xl h-10 text-sm border-gray-200"
            />
          </div>
          <Button
            data-testid="button-add-custom-food"
            onClick={() => setAddCustomOpen(true)}
            className="h-10 rounded-2xl bg-purple-500 text-white font-bold text-xs px-3"
          >
            <Plus className="w-4 h-4 mr-1" />
            食材追加
          </Button>
        </div>

        <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1 no-scrollbar">
          <button
            data-testid="button-filter-all"
            onClick={() => setSelectedCategory("all")}
            className={cn(
              "shrink-0 px-3 py-1.5 rounded-full text-xs font-bold border-2 transition-colors",
              selectedCategory === "all"
                ? "bg-purple-500 text-white border-purple-500"
                : "bg-white text-gray-500 border-gray-200"
            )}
          >
            すべて
          </button>
          {FOOD_CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              data-testid={`button-filter-${cat.id}`}
              onClick={() => setSelectedCategory(cat.id)}
              className={cn(
                "shrink-0 px-3 py-1.5 rounded-full text-xs font-bold border-2 transition-colors",
                selectedCategory === cat.id
                  ? "bg-purple-500 text-white border-purple-500"
                  : "bg-white text-gray-500 border-gray-200"
              )}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {(selectedCategory === "all" ? FOOD_CATEGORIES : FOOD_CATEGORIES.filter((c) => c.id === selectedCategory)).map((cat) => {
          const catItems = visibleItems.filter((i) => i.category === cat.id);
          if (catItems.length === 0) return null;
          return (
            <Card key={cat.id} className="rounded-3xl border-none shadow-sm overflow-hidden" data-testid={`card-category-${cat.id}`}>
              <div className="bg-purple-50 px-4 py-2.5 border-b border-purple-100">
                <h3 className="text-sm font-black text-purple-700">{cat.label}</h3>
              </div>
              <div className="p-3">
                <div className="grid grid-cols-2 gap-2">
                  {catItems.map((item) => (
                    <FoodItemButton key={`${item.category}:${item.name}`} item={item} />
                  ))}
                </div>
              </div>
            </Card>
          );
        })}

        {hiddenVisibleItems.length > 0 && (
          <div>
            <button
              data-testid="button-toggle-hidden"
              onClick={() => setShowHiddenSection((v) => !v)}
              className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-2xl bg-white border-2 border-dashed border-gray-200 text-gray-400 text-xs font-bold hover:border-gray-300 transition-colors"
            >
              {showHiddenSection ? (
                <><ChevronUp className="w-3.5 h-3.5" />非表示の食材を隠す</>
              ) : (
                <><Eye className="w-3.5 h-3.5" />非表示の食材を見る（{hiddenVisibleItems.length}件）</>
              )}
            </button>

            {showHiddenSection && (
              <Card className="mt-2 rounded-3xl border-none shadow-sm overflow-hidden" data-testid="card-hidden-items">
                <div className="bg-gray-50 px-4 py-2.5 border-b border-gray-100 flex items-center gap-2">
                  <EyeOff className="w-3.5 h-3.5 text-gray-400" />
                  <h3 className="text-sm font-black text-gray-400">非表示の食材</h3>
                </div>
                <div className="p-3">
                  <div className="grid grid-cols-2 gap-2">
                    {hiddenVisibleItems.map((item) => (
                      <FoodItemButton key={`${item.category}:${item.name}`} item={item} isHidden />
                    ))}
                  </div>
                </div>
              </Card>
            )}
          </div>
        )}
      </div>

      {/* ─── コンテキストメニュー ─── */}
      <Dialog open={!!contextTarget} onOpenChange={(o) => { if (!o) setContextTarget(null); }}>
        <DialogContent className="sm:max-w-xs rounded-[2rem] border-none px-4 py-5">
          <DialogHeader>
            <DialogTitle className="text-base font-black text-center text-gray-800">
              {contextTarget?.name}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-2 pt-1">
            {contextTarget?.isCustom ? (
              <>
                <Button
                  data-testid="button-context-edit"
                  onClick={() => {
                    if (!contextTarget) return;
                    setEditCustomId(contextTarget.id ?? null);
                    setEditCustomName(contextTarget.name);
                    const saved = savedMap.get(`${contextTarget.category}:${contextTarget.name}`);
                    setEditCustomCategory(saved?.category || contextTarget.category);
                    setEditCustomOpen(true);
                    setContextTarget(null);
                  }}
                  className="w-full h-12 rounded-2xl bg-purple-500 text-white font-bold"
                >
                  <Pencil className="w-4 h-4 mr-2" />
                  名前・カテゴリを編集
                </Button>
                <Button
                  data-testid="button-context-delete"
                  onClick={() => {
                    if (!contextTarget || !contextTarget.id) return;
                    setConfirmDeleteCustom({ id: contextTarget.id, name: contextTarget.name });
                    setContextTarget(null);
                  }}
                  variant="outline"
                  className="w-full h-12 rounded-2xl border-2 border-red-200 text-red-500 font-bold"
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  削除する
                </Button>
              </>
            ) : (
              contextTarget?.isHidden ? (
                <Button
                  data-testid="button-context-show"
                  onClick={() => {
                    if (contextTarget) showItem(contextTarget.category, contextTarget.name);
                  }}
                  className="w-full h-12 rounded-2xl bg-purple-500 text-white font-bold"
                >
                  <Eye className="w-4 h-4 mr-2" />
                  再表示する
                </Button>
              ) : (
                <Button
                  data-testid="button-context-hide"
                  onClick={() => {
                    setConfirmHide(contextTarget);
                    setContextTarget(null);
                  }}
                  variant="outline"
                  className="w-full h-12 rounded-2xl border-2 border-gray-200 text-gray-600 font-bold"
                >
                  <EyeOff className="w-4 h-4 mr-2" />
                  非表示にする
                </Button>
              )
            )}
            <Button
              data-testid="button-context-cancel"
              variant="ghost"
              onClick={() => setContextTarget(null)}
              className="w-full h-10 rounded-2xl text-gray-400 font-bold text-sm"
            >
              キャンセル
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ─── 非表示確認ダイアログ ─── */}
      <Dialog open={!!confirmHide} onOpenChange={(o) => { if (!o) setConfirmHide(null); }}>
        <DialogContent className="sm:max-w-xs rounded-[2rem] border-none px-4 py-5">
          <DialogHeader>
            <DialogTitle className="text-base font-black text-center text-gray-800">
              非表示にしますか？
            </DialogTitle>
          </DialogHeader>
          <div className="pt-1 space-y-3">
            <p className="text-sm text-gray-500 text-center leading-relaxed">
              「{confirmHide?.name}」を非表示にします。<br />
              アレルギー警告は引き続き機能します。
            </p>
            <Button
              data-testid="button-confirm-hide"
              onClick={() => {
                if (confirmHide) hideItem(confirmHide.category, confirmHide.name);
              }}
              className="w-full h-12 rounded-2xl bg-gray-700 text-white font-bold"
            >
              <EyeOff className="w-4 h-4 mr-2" />
              非表示にする
            </Button>
            <Button
              data-testid="button-confirm-cancel"
              variant="ghost"
              onClick={() => setConfirmHide(null)}
              className="w-full h-10 rounded-2xl text-gray-400 font-bold text-sm"
            >
              キャンセル
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ─── ステータス変更ドロワー ─── */}
      <Drawer open={!!sheetItem} onOpenChange={(open) => { if (!open) closeSheet(); }}>
        <DrawerContent className="pb-safe max-h-[90vh]">
          <DrawerHeader className="pb-0">
            <DrawerTitle className="text-center text-base font-black text-gray-800">
              {sheetItem?.name}
            </DrawerTitle>
          </DrawerHeader>

          <div className="px-4 py-4 space-y-3 overflow-y-auto">
            <button
              data-testid="button-status-not-tried"
              onClick={() => handleStatusSelect("not_tried")}
              className={cn(
                "w-full flex items-center gap-3 p-4 rounded-2xl border-2 transition-all text-left",
                sheetStatus === "not_tried"
                  ? "bg-gray-50 border-gray-400"
                  : "bg-white border-gray-200"
              )}
            >
              <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center shrink-0">
                <Circle className="w-4 h-4 text-gray-500" />
              </div>
              <div>
                <p className="font-black text-sm text-gray-700">まだ食べていない</p>
                <p className="text-xs text-gray-400 font-medium">未試行に戻す・日付をクリア</p>
              </div>
            </button>

            <button
              data-testid="button-status-ok"
              onClick={() => handleStatusSelect("ok")}
              className={cn(
                "w-full flex flex-col gap-3 p-4 rounded-2xl border-2 transition-all text-left",
                sheetStatus === "ok"
                  ? "bg-green-50 border-green-400"
                  : "bg-white border-gray-200"
              )}
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-green-500 flex items-center justify-center shrink-0">
                  <Check className="w-4 h-4 text-white" />
                </div>
                <div>
                  <p className="font-black text-sm text-green-700">食べた（問題なし）</p>
                  <p className="text-xs text-gray-400 font-medium">はじめて食べた日を記録（任意）</p>
                </div>
              </div>
              {sheetStatus === "ok" && (
                <div
                  className="flex items-center gap-2 bg-white rounded-xl px-3 py-2 border border-green-200"
                  onClick={(e) => e.stopPropagation()}
                >
                  <CalendarDays className="w-4 h-4 text-green-500 shrink-0" />
                  <input
                    data-testid="input-ok-date"
                    type="date"
                    value={sheetDate}
                    onChange={(e) => setSheetDate(e.target.value)}
                    className="flex-1 text-sm font-bold text-gray-700 bg-transparent outline-none"
                  />
                </div>
              )}
            </button>

            <button
              data-testid="button-status-caution"
              onClick={() => handleStatusSelect("caution")}
              className={cn(
                "w-full flex flex-col gap-3 p-4 rounded-2xl border-2 transition-all text-left",
                sheetStatus === "caution"
                  ? "bg-orange-50 border-orange-400"
                  : "bg-white border-gray-200"
              )}
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-orange-400 flex items-center justify-center shrink-0">
                  <AlertTriangle className="w-4 h-4 text-white" />
                </div>
                <div>
                  <p className="font-black text-sm text-orange-700">要注意（アレルギー反応あり）</p>
                  <p className="text-xs text-gray-400 font-medium">症状やメモを記録</p>
                </div>
              </div>
              {sheetStatus === "caution" && (
                <div
                  className="space-y-2"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="flex items-center gap-2 bg-white rounded-xl px-3 py-2 border border-orange-200">
                    <CalendarDays className="w-4 h-4 text-orange-400 shrink-0" />
                    <input
                      data-testid="input-caution-date"
                      type="date"
                      value={sheetDate}
                      onChange={(e) => setSheetDate(e.target.value)}
                      className="flex-1 text-sm font-bold text-gray-700 bg-transparent outline-none"
                    />
                  </div>
                  <Textarea
                    data-testid="input-caution-note"
                    placeholder="症状やメモ（例: 口の周りが赤くなった）"
                    value={sheetNote}
                    onChange={(e) => setSheetNote(e.target.value)}
                    className="rounded-xl border-orange-200 min-h-[72px] text-sm bg-white"
                    onClick={(e) => e.stopPropagation()}
                  />
                </div>
              )}
            </button>

            <Button
              data-testid="button-sheet-save"
              onClick={handleSheetSave}
              disabled={sheetStatus === null || upsertMutation.isPending}
              className={cn(
                "w-full h-13 rounded-2xl font-black text-base transition-all",
                sheetStatus === "not_tried" ? "bg-gray-500 hover:bg-gray-600 text-white" :
                sheetStatus === "ok" ? "bg-green-500 hover:bg-green-600 text-white" :
                sheetStatus === "caution" ? "bg-orange-500 hover:bg-orange-600 text-white" :
                "bg-gray-200 text-gray-400"
              )}
            >
              保存する
            </Button>
          </div>
        </DrawerContent>
      </Drawer>

      {/* ─── カスタム食材追加ダイアログ ─── */}
      <Dialog open={addCustomOpen} onOpenChange={setAddCustomOpen}>
        <DialogContent className="sm:max-w-md rounded-[2.5rem] border-none">
          <DialogHeader>
            <DialogTitle className="text-lg font-black text-center">
              カスタム食材を追加
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4 px-2">
            <div className="space-y-2">
              <label className="text-xs font-bold text-gray-500">食材名</label>
              <Input
                data-testid="input-custom-food-name"
                placeholder="食材名を入力"
                value={customName}
                onChange={(e) => setCustomName(e.target.value)}
                maxLength={30}
                className="rounded-xl border-gray-200 text-sm"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold text-gray-500">カテゴリ</label>
              <div className="grid grid-cols-2 gap-1.5">
                {FOOD_CATEGORIES.map((cat) => (
                  <button
                    key={cat.id}
                    data-testid={`button-custom-category-${cat.id}`}
                    onClick={() => setCustomCategory(cat.id)}
                    className={cn(
                      "px-2 py-1.5 rounded-xl text-xs font-bold border-2 transition-colors",
                      customCategory === cat.id
                        ? "bg-purple-50 border-purple-300 text-purple-600"
                        : "bg-white border-gray-200 text-gray-500"
                    )}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>
            </div>
            <Button
              data-testid="button-custom-food-submit"
              onClick={handleAddCustom}
              disabled={!customName.trim() || upsertMutation.isPending}
              className="w-full rounded-2xl h-12 bg-purple-500 text-white font-bold"
            >
              追加する
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ─── カスタム食材編集ダイアログ ─── */}
      <Dialog open={editCustomOpen} onOpenChange={(o) => { if (!o) setEditCustomOpen(false); }}>
        <DialogContent className="sm:max-w-md rounded-[2.5rem] border-none">
          <DialogHeader>
            <DialogTitle className="text-lg font-black text-center">
              食材を編集
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4 px-2">
            <div className="space-y-2">
              <label className="text-xs font-bold text-gray-500">食材名</label>
              <Input
                data-testid="input-edit-custom-food-name"
                placeholder="食材名を入力"
                value={editCustomName}
                onChange={(e) => setEditCustomName(e.target.value)}
                maxLength={30}
                className="rounded-xl border-gray-200 text-sm"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold text-gray-500">カテゴリ</label>
              <div className="grid grid-cols-2 gap-1.5">
                {FOOD_CATEGORIES.map((cat) => (
                  <button
                    key={cat.id}
                    data-testid={`button-edit-category-${cat.id}`}
                    onClick={() => setEditCustomCategory(cat.id)}
                    className={cn(
                      "px-2 py-1.5 rounded-xl text-xs font-bold border-2 transition-colors",
                      editCustomCategory === cat.id
                        ? "bg-purple-50 border-purple-300 text-purple-600"
                        : "bg-white border-gray-200 text-gray-500"
                    )}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>
            </div>
            <Button
              data-testid="button-edit-custom-food-submit"
              onClick={() => {
                if (!editCustomName.trim() || !editCustomId) return;
                updateMutation.mutate(
                  { id: editCustomId, ingredientName: editCustomName.trim(), category: editCustomCategory },
                  {
                    onSuccess: () => {
                      setEditCustomOpen(false);
                      toast({ title: "食材を更新しました", className: "bg-purple-50 border-purple-100 text-purple-900" });
                    },
                  }
                );
              }}
              disabled={!editCustomName.trim() || updateMutation.isPending}
              className="w-full rounded-2xl h-12 bg-purple-500 text-white font-bold"
            >
              保存する
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ─── カスタム食材削除確認ダイアログ ─── */}
      <Dialog open={!!confirmDeleteCustom} onOpenChange={(o) => { if (!o) setConfirmDeleteCustom(null); }}>
        <DialogContent className="sm:max-w-xs rounded-[2rem] border-none px-4 py-5">
          <DialogHeader>
            <DialogTitle className="text-base font-black text-center text-gray-800">
              削除しますか？
            </DialogTitle>
          </DialogHeader>
          <div className="pt-1 space-y-3">
            <p className="text-sm text-gray-500 text-center leading-relaxed">
              「{confirmDeleteCustom?.name}」を削除します。<br />
              この操作は元に戻せません。
            </p>
            <Button
              data-testid="button-confirm-delete-custom"
              onClick={() => {
                if (!confirmDeleteCustom) return;
                deleteMutation.mutate(confirmDeleteCustom.id, {
                  onSuccess: () => {
                    setConfirmDeleteCustom(null);
                    toast({ title: `${confirmDeleteCustom.name} を削除しました`, className: "bg-gray-50 border-gray-100 text-gray-800" });
                  },
                });
              }}
              disabled={deleteMutation.isPending}
              className="w-full h-12 rounded-2xl bg-red-500 text-white font-bold"
            >
              <Trash2 className="w-4 h-4 mr-2" />
              削除する
            </Button>
            <Button
              data-testid="button-confirm-delete-cancel"
              variant="ghost"
              onClick={() => setConfirmDeleteCustom(null)}
              className="w-full h-10 rounded-2xl text-gray-400 font-bold text-sm"
            >
              キャンセル
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <BottomNav />
    </div>
  );
}
