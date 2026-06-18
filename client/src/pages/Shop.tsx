import { useState, useMemo } from "react";
import { useUserLabels } from "@/hooks/use-user-labels";
import { BottomNav } from "@/components/Navigation";
import { useLogs, useCoupons, useUserCoupons, useExchangeCoupon, useRedeemCoupon, useCreateCoupon, useUpdateCoupon, useDeleteCoupon, useNotifications, useMarkNotificationRead } from "@/hooks/use-app-data";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Gift, Gem, ShoppingBag, Ticket, Plus, Trash2, Pencil, Bath, Moon, UtensilsCrossed, Hand, Sparkles, Zap, Bell, X, Check, Loader2 } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { Coupon, UserCoupon, Notification } from "@shared/schema";

const COUPON_ICONS: Record<string, typeof Bath> = {
  "お風呂": Bath,
  "眠れる": Moon,
  "ランチ": UtensilsCrossed,
  "マッサージ": Hand,
};

function getCouponIcon(title: string) {
  for (const [key, Icon] of Object.entries(COUPON_ICONS)) {
    if (title.includes(key)) return Icon;
  }
  return Sparkles;
}

export default function Shop() {
  const familyId = localStorage.getItem("familyId") || "default";
  const userId = localStorage.getItem("userType") || "papa";
  const { getLabel } = useUserLabels();
  const userLabel = getLabel(userId);

  const { data: allLogs = [] } = useLogs(familyId);
  const activeChildId = localStorage.getItem("activeChildId") ? parseInt(localStorage.getItem("activeChildId")!) : null;
  const logs = useMemo(() => {
    if (!activeChildId) return allLogs;
    return allLogs.filter((l: any) => !l.childId || l.childId === activeChildId);
  }, [allLogs, activeChildId]);
  const { data: couponList = [] } = useCoupons(familyId);
  const { data: userCouponList = [] } = useUserCoupons(familyId);
  const { data: notifList = [] } = useNotifications(familyId, userId);
  const exchangeMutation = useExchangeCoupon();
  const redeemMutation = useRedeemCoupon();
  const createCouponMutation = useCreateCoupon();
  const updateCouponMutation = useUpdateCoupon();
  const deleteCouponMutation = useDeleteCoupon();
  const markReadMutation = useMarkNotificationRead();

  const [tab, setTab] = useState<"shop" | "my">("shop");
  const [showCustomForm, setShowCustomForm] = useState(false);
  const [customTitle, setCustomTitle] = useState("");
  const [customCost, setCustomCost] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [showNotifs, setShowNotifs] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editCost, setEditCost] = useState("");

  const userLogs = logs.filter((l: any) => l.userId === userId);
  const totalEarned = userLogs.reduce((sum: number, l: any) => sum + (l.points || 0), 0);
  const myOwnedCoupons = userCouponList.filter((uc: UserCoupon) => uc.ownerId === userId);
  const totalSpent = myOwnedCoupons.reduce((sum: number, uc: UserCoupon) => sum + (uc.cost || 0), 0);
  const currentPoints = totalEarned - totalSpent;

  const myCouponsOwned = myOwnedCoupons.filter((uc: UserCoupon) => uc.status === "owned");
  const myCouponsUsed = myOwnedCoupons.filter((uc: UserCoupon) => uc.status === "used");
  const unreadNotifs = notifList.filter((n: Notification) => !n.read);

  const handleExchange = (coupon: Coupon) => {
    setErrorMsg("");
    if (currentPoints < coupon.cost) {
      setErrorMsg(`あと${coupon.cost - currentPoints}pt足りないっす！次のタスクで稼ぐっすよ！`);
      return;
    }
    exchangeMutation.mutate({
      familyId,
      couponId: coupon.id,
      couponTitle: coupon.title,
      cost: coupon.cost,
      ownerId: userId,
    }, {
      onError: (err: any) => setErrorMsg(err.message),
    });
  };

  const handleRedeem = (uc: UserCoupon) => {
    redeemMutation.mutate({ id: uc.id, userId, familyId });
  };

  const handleCreateCustom = () => {
    if (!customTitle.trim() || !customCost.trim()) return;
    const cost = parseInt(customCost);
    if (isNaN(cost) || cost <= 0) return;
    createCouponMutation.mutate({
      familyId,
      title: customTitle.trim(),
      cost,
      isCustom: true,
      createdBy: userId,
    }, {
      onSuccess: () => {
        setCustomTitle("");
        setCustomCost("");
        setShowCustomForm(false);
      }
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50/50 via-white to-green-50/50 pb-24 font-sans">
      <div className="max-w-md mx-auto px-6 py-8">
        <div className="flex items-center gap-3 mb-6">
          <Link href="/">
            <Button variant="ghost" size="icon" className="rounded-full" data-testid="button-back-home">
              <ArrowLeft className="w-5 h-5" />
            </Button>
          </Link>
          <div className="flex-1">
            <h1 className="text-2xl font-black text-gray-800 flex items-center gap-2">
              <Gift className="w-6 h-6 text-purple-500" />
              ご褒美ショップ
            </h1>
            <p className="text-xs text-muted-foreground">{userLabel}のポイントでクーポンと交換</p>
          </div>
          <div className="relative">
            <Button
              variant="ghost"
              size="icon"
              className="rounded-full relative"
              onClick={() => setShowNotifs(!showNotifs)}
              data-testid="button-notifications"
            >
              <Bell className="w-5 h-5" />
              {unreadNotifs.length > 0 && (
                <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full text-[10px] text-white font-bold flex items-center justify-center">
                  {unreadNotifs.length}
                </span>
              )}
            </Button>
          </div>
        </div>

        <AnimatePresence>
          {showNotifs && notifList.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="mb-4"
            >
              <Card className="p-4 border-purple-200 bg-purple-50/80">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-bold text-gray-700 flex items-center gap-1">
                    <Bell className="w-4 h-4 text-purple-500" /> お知らせ
                  </h3>
                  <Button variant="ghost" size="icon" onClick={() => setShowNotifs(false)} className="rounded-full h-7 w-7">
                    <X className="w-3.5 h-3.5" />
                  </Button>
                </div>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {notifList.slice(0, 10).map((n: Notification) => (
                    <div
                      key={n.id}
                      className={`flex items-start gap-2 p-2 rounded-xl text-xs ${n.read ? "bg-white/50 text-gray-400" : "bg-white text-gray-700 font-medium"}`}
                      data-testid={`notification-${n.id}`}
                    >
                      <Zap className={`w-3.5 h-3.5 mt-0.5 shrink-0 ${n.read ? "text-gray-300" : "text-purple-500"}`} />
                      <span className="flex-1">{n.message}</span>
                      {!n.read && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 rounded-full shrink-0"
                          onClick={() => markReadMutation.mutate(n.id)}
                          data-testid={`button-mark-read-${n.id}`}
                        >
                          <Check className="w-3 h-3" />
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>

        <Card className="p-5 mb-6 bg-gradient-to-r from-purple-500 to-green-400 border-0 text-white rounded-3xl shadow-lg overflow-visible">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider opacity-80">保有ポイント</p>
              <p className="text-4xl font-black tracking-tight" data-testid="text-current-points">{currentPoints}</p>
              <p className="text-xs opacity-80">pt</p>
            </div>
            <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-sm">
              <Gem className="w-8 h-8 text-white" />
            </div>
          </div>
        </Card>

        <div className="flex gap-2 mb-5">
          <Button
            variant={tab === "shop" ? "default" : "outline"}
            className="flex-1 rounded-2xl font-bold"
            onClick={() => setTab("shop")}
            data-testid="tab-shop"
          >
            <ShoppingBag className="w-4 h-4 mr-1.5" /> ショップ
          </Button>
          <Button
            variant={tab === "my" ? "default" : "outline"}
            className="flex-1 rounded-2xl font-bold"
            onClick={() => setTab("my")}
            data-testid="tab-my-coupons"
          >
            <Ticket className="w-4 h-4 mr-1.5" /> マイクーポン
            {myCouponsOwned.length > 0 && (
              <Badge variant="secondary" className="ml-1.5 text-[10px] px-1.5 py-0">{myCouponsOwned.length}</Badge>
            )}
          </Button>
        </div>

        <AnimatePresence>
          {errorMsg && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="mb-4"
            >
              <Card className="p-4 border-blue-200 bg-blue-50/80 rounded-2xl">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center shrink-0">
                    <Zap className="w-5 h-5 text-blue-500" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-blue-700 mb-0.5">エラー</p>
                    <p className="text-sm text-blue-600" data-testid="text-error-message">{errorMsg}</p>
                  </div>
                  <Button variant="ghost" size="icon" className="rounded-full h-7 w-7 shrink-0" onClick={() => setErrorMsg("")}>
                    <X className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>

        {tab === "shop" && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3">
            {couponList.map((coupon: Coupon) => {
              const IconComp = getCouponIcon(coupon.title);
              const canAfford = currentPoints >= coupon.cost;
              const isEditing = editingId === coupon.id;
              return (
                <Card
                  key={coupon.id}
                  className="p-4 rounded-2xl border border-gray-100 bg-white/80 backdrop-blur-sm"
                  data-testid={`coupon-card-${coupon.id}`}
                >
                  {isEditing ? (
                    <div className="space-y-3">
                      <Input
                        value={editTitle}
                        onChange={(e) => setEditTitle(e.target.value)}
                        placeholder="クーポンの内容"
                        className="rounded-xl"
                        data-testid={`input-edit-title-${coupon.id}`}
                      />
                      <Input
                        type="number"
                        value={editCost}
                        onChange={(e) => setEditCost(e.target.value)}
                        placeholder="必要ポイント"
                        className="rounded-xl"
                        data-testid={`input-edit-cost-${coupon.id}`}
                      />
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          className="flex-1 rounded-xl"
                          onClick={() => setEditingId(null)}
                          data-testid={`button-cancel-edit-${coupon.id}`}
                        >
                          キャンセル
                        </Button>
                        <Button
                          className="flex-1 rounded-xl bg-purple-500 text-white font-bold"
                          disabled={updateCouponMutation.isPending || !editTitle.trim() || !editCost.trim()}
                          onClick={() => {
                            const cost = parseInt(editCost);
                            if (isNaN(cost) || cost <= 0) return;
                            updateCouponMutation.mutate({ id: coupon.id, title: editTitle.trim(), cost }, {
                              onSuccess: () => setEditingId(null),
                            });
                          }}
                          data-testid={`button-save-edit-${coupon.id}`}
                        >
                          {updateCouponMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "保存"}
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-2xl bg-purple-50 flex items-center justify-center shrink-0">
                        <IconComp className="w-6 h-6 text-purple-500" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-gray-800 text-sm" data-testid={`coupon-title-${coupon.id}`}>{coupon.title}</p>
                        <div className="flex items-center gap-1.5">
                          <Gem className="w-3 h-3 text-purple-400" />
                          <span className="text-xs font-bold text-purple-600" data-testid={`coupon-cost-${coupon.id}`}>{coupon.cost} pt</span>
                          {coupon.isCustom && (
                            <Badge variant="outline" className="text-[9px] px-1.5 py-0 ml-1">カスタム</Badge>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="rounded-full h-8 w-8"
                          onClick={() => {
                            setEditingId(coupon.id);
                            setEditTitle(coupon.title);
                            setEditCost(String(coupon.cost));
                          }}
                          data-testid={`button-edit-coupon-${coupon.id}`}
                        >
                          <Pencil className="w-3.5 h-3.5 text-gray-400" />
                        </Button>
                        {coupon.isCustom && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="rounded-full h-8 w-8"
                            onClick={() => deleteCouponMutation.mutate(coupon.id)}
                            data-testid={`button-delete-coupon-${coupon.id}`}
                          >
                            <Trash2 className="w-3.5 h-3.5 text-gray-400" />
                          </Button>
                        )}
                        <Button
                          onClick={() => handleExchange(coupon)}
                          disabled={exchangeMutation.isPending}
                          className={`rounded-2xl text-xs font-bold px-4 ${canAfford ? "bg-purple-500 text-white" : "bg-gray-100 text-gray-400"}`}
                          data-testid={`button-exchange-${coupon.id}`}
                        >
                          {exchangeMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "交換する"}
                        </Button>
                      </div>
                    </div>
                  )}
                </Card>
              );
            })}

            <Card className="p-4 rounded-2xl border-dashed border-2 border-purple-200 bg-purple-50/30">
              {!showCustomForm ? (
                <Button
                  variant="ghost"
                  className="w-full rounded-2xl text-purple-500 font-bold"
                  onClick={() => setShowCustomForm(true)}
                  data-testid="button-show-custom-form"
                >
                  <Plus className="w-4 h-4 mr-1.5" /> カスタムクーポンを追加
                </Button>
              ) : (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3">
                  <p className="text-sm font-bold text-gray-700">カスタムクーポン作成</p>
                  <Input
                    placeholder="クーポンの内容（例：映画デート券）"
                    value={customTitle}
                    onChange={(e) => setCustomTitle(e.target.value)}
                    className="rounded-xl"
                    data-testid="input-custom-title"
                  />
                  <Input
                    type="number"
                    placeholder="必要ポイント（例：500）"
                    value={customCost}
                    onChange={(e) => setCustomCost(e.target.value)}
                    className="rounded-xl"
                    data-testid="input-custom-cost"
                  />
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      className="flex-1 rounded-xl"
                      onClick={() => { setShowCustomForm(false); setCustomTitle(""); setCustomCost(""); }}
                      data-testid="button-cancel-custom"
                    >
                      キャンセル
                    </Button>
                    <Button
                      className="flex-1 rounded-xl bg-purple-500 text-white font-bold"
                      onClick={handleCreateCustom}
                      disabled={createCouponMutation.isPending || !customTitle.trim() || !customCost.trim()}
                      data-testid="button-create-custom"
                    >
                      {createCouponMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "追加する"}
                    </Button>
                  </div>
                </motion.div>
              )}
            </Card>
          </motion.div>
        )}

        {tab === "my" && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
            {myCouponsOwned.length > 0 && (
              <div className="space-y-2">
                <h3 className="text-sm font-bold text-gray-600 flex items-center gap-1.5">
                  <Ticket className="w-4 h-4 text-purple-400" /> 使えるクーポン
                </h3>
                {myCouponsOwned.map((uc: UserCoupon) => {
                  const IconComp = getCouponIcon(uc.couponTitle);
                  return (
                    <Card
                      key={uc.id}
                      className="p-4 rounded-2xl border-purple-100 bg-gradient-to-r from-purple-50 to-white"
                      data-testid={`my-coupon-${uc.id}`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-purple-100 flex items-center justify-center shrink-0">
                          <IconComp className="w-5 h-5 text-purple-500" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-gray-800 text-sm">{uc.couponTitle}</p>
                          <p className="text-[10px] text-gray-400">{uc.cost}ptで交換</p>
                        </div>
                        <Button
                          onClick={() => handleRedeem(uc)}
                          disabled={redeemMutation.isPending}
                          className="rounded-2xl text-xs font-bold px-4 bg-green-500 text-white"
                          data-testid={`button-redeem-${uc.id}`}
                        >
                          {redeemMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "使用する"}
                        </Button>
                      </div>
                    </Card>
                  );
                })}
              </div>
            )}

            {myCouponsUsed.length > 0 && (
              <div className="space-y-2">
                <h3 className="text-sm font-bold text-gray-400 flex items-center gap-1.5">
                  <Check className="w-4 h-4" /> 使用済み
                </h3>
                {myCouponsUsed.map((uc: UserCoupon) => {
                  const IconComp = getCouponIcon(uc.couponTitle);
                  return (
                    <Card
                      key={uc.id}
                      className="p-3 rounded-2xl border-gray-100 bg-gray-50/50 opacity-60"
                      data-testid={`used-coupon-${uc.id}`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center shrink-0">
                          <IconComp className="w-4 h-4 text-gray-400" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-gray-500 text-xs line-through">{uc.couponTitle}</p>
                        </div>
                        <Badge variant="secondary" className="text-[9px]">使用済み</Badge>
                      </div>
                    </Card>
                  );
                })}
              </div>
            )}

            {myCouponsOwned.length === 0 && myCouponsUsed.length === 0 && (
              <div className="text-center py-12 space-y-3">
                <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto">
                  <Ticket className="w-8 h-8 text-gray-300" />
                </div>
                <p className="text-sm text-gray-400 font-medium">まだクーポンを持っていません</p>
                <Button
                  variant="outline"
                  className="rounded-2xl text-sm"
                  onClick={() => setTab("shop")}
                  data-testid="button-go-to-shop"
                >
                  <ShoppingBag className="w-4 h-4 mr-1.5" /> ショップで交換する
                </Button>
              </div>
            )}
          </motion.div>
        )}
      </div>
      <BottomNav />
    </div>
  );
}
