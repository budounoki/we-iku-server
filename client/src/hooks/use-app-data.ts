import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, buildUrl } from "@shared/routes";
import { useToast } from "@/hooks/use-toast";
import { LOG_TYPE_LABELS } from "@/lib/phases";

export function useChildren(familyId: string) {
  return useQuery({
    queryKey: [api.children.list.path, familyId],
    queryFn: async () => {
      const res = await fetch(buildUrl(api.children.list.path, { familyId }));
      return res.json();
    },
    refetchInterval: 5000,
  });
}

export function useCreateChild() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (data: { familyId: string; name: string; birthday?: string; gender?: string; color?: string; silent?: boolean }) => {
      const { silent, ...body } = data;
      const res = await fetch(api.children.create.path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const result = await res.json();
      result._silent = silent;
      return result;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: [api.children.list.path] });
      if (!data._silent) {
        toast({
          title: `${data.name}を追加しました`,
          description: "パートナーにも自動で同期されます",
          className: "bg-purple-50 border-purple-100 text-purple-900",
        });
      }
    },
  });
}

export function useUpdateChild() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...data }: { id: number; name?: string; birthday?: string; gender?: string; color?: string; bloodType?: string; sleepTrainingEnabled?: boolean; rotavirusVaccineType?: string | null }) => {
      const res = await fetch(`/api/children/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.children.list.path] });
    },
  });
}

export function useDeleteChild() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/children/${id}`, { method: "DELETE" });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.children.list.path] });
    },
  });
}

export function useSettings(familyId: string) {
  return useQuery({
    queryKey: [api.settings.get.path, familyId],
    queryFn: async () => {
      const res = await fetch(buildUrl(api.settings.get.path, { familyId }));
      if (!res.ok) throw new Error("Failed to fetch settings");
      return res.json();
    },
    refetchInterval: 5000,
  });
}

export function useUpdateSettings() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch(api.settings.update.path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.settings.get.path] });
      toast({ title: "設定を更新しました", description: "家族との共有が有効です" });
    },
  });
}

export function useLogs(familyId: string) {
  return useQuery({
    queryKey: [api.logs.list.path, familyId],
    queryFn: async () => {
      const res = await fetch(buildUrl(api.logs.list.path, { familyId }));
      return res.json();
    },
    refetchInterval: 3000,
  });
}

export function useCreateLog() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (data: any) => {
      const familyId = localStorage.getItem("familyId") || "default";
      const userId = localStorage.getItem("userType") || "papa";
      const childId = localStorage.getItem("activeChildId");
      const res = await fetch(api.logs.create.path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...data, familyId, userId, childId: childId ? parseInt(childId) : undefined }),
      });
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: [api.logs.list.path] });
      window.dispatchEvent(new CustomEvent('new-log-pts', { 
        detail: { points: data.points, type: data.type } 
      }));
      
      const typeLabel = LOG_TYPE_LABELS[data.type] || '記録';
      toast({
        title: `ナイス連携！${data.points}pt獲得！`,
        description: `${typeLabel}を記録しました。お疲れ様です！`,
        className: "bg-purple-50 border-purple-100 text-purple-900",
        duration: 2000,
      });
    },
  });
}

export function useEvents(familyId: string) {
  return useQuery({
    queryKey: [api.events.list.path, familyId],
    queryFn: async () => {
      const res = await fetch(buildUrl(api.events.list.path, { familyId }));
      if (!res.ok) throw new Error("Failed to fetch events");
      return res.json();
    },
    refetchInterval: 5000,
  });
}

export function useCreateEvent() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch(api.events.create.path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.events.list.path] });
      toast({ title: "予定を追加しました", className: "bg-purple-50 border-purple-100 text-purple-900" });
    },
  });
}

export function useCompleteEvent() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async ({ id, completedBy }: { id: number; completedBy: string }) => {
      const res = await fetch(`/api/events/${id}/complete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ completedBy }),
      });
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: [api.events.list.path] });
      queryClient.invalidateQueries({ queryKey: [api.logs.list.path] });
      toast({
        title: `${data.title} 完了！ +10pt`,
        description: "お疲れ様です！",
        className: "bg-purple-50 border-purple-100 text-purple-900",
      });
    },
  });
}

export function useDeleteEvent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/events/${id}`, { method: "DELETE" });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.events.list.path] });
    },
  });
}

export function useCoupons(familyId: string) {
  return useQuery({
    queryKey: [api.coupons.list.path, familyId],
    queryFn: async () => {
      const res = await fetch(buildUrl(api.coupons.list.path, { familyId }));
      return res.json();
    },
    refetchInterval: 5000,
  });
}

export function useUserCoupons(familyId: string) {
  return useQuery({
    queryKey: [api.coupons.userCoupons.path, familyId],
    queryFn: async () => {
      const res = await fetch(buildUrl(api.coupons.userCoupons.path, { familyId }));
      return res.json();
    },
    refetchInterval: 5000,
  });
}

export function useExchangeCoupon() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (data: { familyId: string; couponId: number; couponTitle: string; cost: number; ownerId: string }) => {
      const res = await fetch(api.coupons.exchange.path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message);
      }
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: [api.coupons.userCoupons.path] });
      queryClient.invalidateQueries({ queryKey: [api.logs.list.path] });
      toast({
        title: `『${data.couponTitle}』をゲット！`,
        description: "マイクーポンから使えます",
        className: "bg-purple-50 border-purple-100 text-purple-900",
      });
    },
  });
}

export function useRedeemCoupon() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async ({ id, userId, familyId }: { id: number; userId: string; familyId: string }) => {
      const res = await fetch(`/api/user-coupons/${id}/redeem`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, familyId }),
      });
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: [api.coupons.userCoupons.path] });
      toast({
        title: `『${data.couponTitle}』を使用しました！`,
        description: "パートナーに通知しました",
        className: "bg-orange-50 border-orange-100 text-orange-900",
      });
    },
  });
}

export function useCreateCoupon() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (data: { familyId: string; title: string; cost: number; isCustom: boolean; createdBy: string }) => {
      const res = await fetch(api.coupons.create.path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.coupons.list.path] });
      toast({
        title: "カスタムクーポンを追加しました！",
        className: "bg-purple-50 border-purple-100 text-purple-900",
      });
    },
  });
}

export function useUpdateCoupon() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (data: { id: number; title?: string; cost?: number }) => {
      const res = await fetch(`/api/coupons/${data.id}/update`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: data.title, cost: data.cost }),
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.coupons.list.path] });
      toast({
        title: "クーポンを更新しました",
        className: "bg-purple-50 border-purple-100 text-purple-900",
      });
    },
  });
}

export function useDeleteCoupon() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/coupons/${id}`, { method: "DELETE" });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.coupons.list.path] });
    },
  });
}

export function useNotifications(familyId: string, targetUser: string) {
  return useQuery({
    queryKey: [api.notifications.list.path, familyId, targetUser],
    queryFn: async () => {
      const res = await fetch(buildUrl(api.notifications.list.path, { familyId, targetUser }));
      return res.json();
    },
    refetchInterval: 5000,
  });
}

export function useMarkNotificationRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/notifications/${id}/read`, { method: "POST" });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ predicate: (query) => {
        const key = query.queryKey;
        return Array.isArray(key) && key[0] === api.notifications.list.path;
      }});
    },
  });
}

export function useSleepChecklist(familyId: string, date: string) {
  return useQuery({
    queryKey: [api.sleep.checklist.get.path, familyId, date],
    queryFn: async () => {
      const res = await fetch(buildUrl(api.sleep.checklist.get.path, { familyId, date }));
      return res.json();
    },
    refetchInterval: 5000,
  });
}

export function useUpdateSleepChecklist() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch(api.sleep.checklist.update.path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ predicate: (query) => {
        const key = query.queryKey;
        return Array.isArray(key) && key[0] === api.sleep.checklist.get.path;
      }});
    },
  });
}

export function useSleepRoutines(familyId: string) {
  return useQuery({
    queryKey: [api.sleep.routines.list.path, familyId],
    queryFn: async () => {
      const res = await fetch(buildUrl(api.sleep.routines.list.path, { familyId }));
      const json = await res.json();
      if (!res.ok) throw new Error(json?.message || "ルーティン取得エラー");
      return json;
    },
    refetchInterval: 5000,
  });
}

export function useCreateSleepRoutine() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch(api.sleep.routines.create.path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.message || "追加に失敗しました");
      return json;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.sleep.routines.list.path] });
      toast({ title: "ルーティンを追加しました", className: "bg-indigo-50 border-indigo-100 text-indigo-900" });
    },
    onError: (err: Error) => {
      toast({ title: "エラー", description: err.message, variant: "destructive" });
    },
  });
}

export function useDeleteSleepRoutine() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/sleep/routines/${id}`, { method: "DELETE" });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.sleep.routines.list.path] });
    },
  });
}

export function useSleepRoutineLogs(familyId: string, date: string) {
  return useQuery({
    queryKey: [api.sleep.routineLogs.list.path, familyId, date],
    queryFn: async () => {
      const res = await fetch(buildUrl(api.sleep.routineLogs.list.path, { familyId, date }));
      const json = await res.json();
      if (!res.ok) throw new Error(json?.message || "ルーティンログ取得エラー");
      return Array.isArray(json) ? json : [];
    },
    refetchInterval: 3000,
  });
}

export function useCompleteSleepRoutineStep() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (data: { familyId: string; routineId: number; date: string; completedBy: string }) => {
      const res = await fetch(api.sleep.routineLogs.complete.path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json?.message || "エラーが発生しました");
      }
      return json;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: [api.sleep.routineLogs.list.path] });
      queryClient.invalidateQueries({ queryKey: [api.logs.list.path] });
      if (data.allDone) {
        toast({
          title: "ルーティン全完了！+30pt！",
          description: "チーム3倍ポイント獲得！最高の連携っす！",
          className: "bg-indigo-50 border-indigo-100 text-indigo-900",
        });
      } else {
        toast({
          title: "ステップ完了！",
          description: "パートナーに通知しました",
          className: "bg-indigo-50 border-indigo-100 text-indigo-900",
        });
      }
    },
    onError: (err: Error) => {
      toast({
        title: "エラー",
        description: err.message,
        variant: "destructive",
      });
    },
  });
}

export function useGrowthRecords(familyId: string) {
  return useQuery({
    queryKey: [api.growth.list.path, familyId],
    queryFn: async () => {
      const res = await fetch(buildUrl(api.growth.list.path, { familyId }));
      return res.json();
    },
    refetchInterval: 10000,
  });
}

export function useSleepSessions(familyId: string) {
  return useQuery({
    queryKey: [api.sleepSessions.list.path, familyId],
    queryFn: async () => {
      const res = await fetch(buildUrl(api.sleepSessions.list.path, { familyId }));
      return res.json();
    },
    refetchInterval: 5000,
  });
}

export function useDeleteSleepSession() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/sleep-sessions/${id}`, {
        method: "DELETE",
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.sleepSessions.list.path] });
      queryClient.invalidateQueries({ queryKey: [api.sleepSessions.active.path] });
      queryClient.invalidateQueries({ queryKey: [api.logs.list.path] });
      toast({
        title: "睡眠記録を削除しました",
        className: "bg-red-50 border-red-100 text-red-900",
      });
    },
  });
}

export function useActiveSleepSession(familyId: string, childId?: number | null) {
  return useQuery({
    queryKey: [api.sleepSessions.active.path, familyId, childId],
    queryFn: async () => {
      const url = buildUrl(api.sleepSessions.active.path, { familyId });
      const fullUrl = childId ? `${url}?childId=${childId}` : url;
      const res = await fetch(fullUrl);
      return res.json();
    },
    refetchInterval: 3000,
  });
}

export function useStartSleepSession() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (data: { familyId: string; createdBy: string; childId?: number; startedAt?: string; settlingMethod?: string; sleepLocation?: string; sleepNote?: string }) => {
      const childId = data.childId || (localStorage.getItem("activeChildId") ? parseInt(localStorage.getItem("activeChildId")!) : undefined);
      const res = await fetch(api.sleepSessions.start.path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...data, childId }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message);
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.sleepSessions.active.path] });
      queryClient.invalidateQueries({ queryKey: [api.sleepSessions.list.path] });
      toast({
        title: "おやすみなさい",
        description: "ねんねタイマーを開始しました",
        className: "bg-indigo-50 border-indigo-100 text-indigo-900",
      });
    },
  });
}

export function useEndSleepSession() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async ({ id, endedAt }: { id: number; endedAt?: string }) => {
      const res = await fetch(`/api/sleep-sessions/${id}/end`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(endedAt ? { endedAt } : {}),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Failed to end sleep session");
      }
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: [api.sleepSessions.active.path] });
      queryClient.invalidateQueries({ queryKey: [api.sleepSessions.list.path] });
      queryClient.invalidateQueries({ queryKey: [api.logs.list.path] });
      toast({
        title: `おはよう！${data.durationMin}分ねんねしました`,
        description: "ねんねを記録しました",
        className: "bg-indigo-50 border-indigo-100 text-indigo-900",
      });
    },
  });
}

export function useUpdateSleepTime() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, startedAt, endedAt }: { id: number; startedAt: string; endedAt?: string }) => {
      const res = await fetch(`/api/sleep-sessions/${id}/update-time`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ startedAt, endedAt }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Failed to update sleep time");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.refetchQueries({ queryKey: [api.sleepSessions.active.path] });
      queryClient.refetchQueries({ queryKey: [api.sleepSessions.list.path] });
    },
  });
}

export function useManualSleepSession() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (data: { familyId: string; createdBy: string; childId?: number; durationMin: number; startedAt: string; settlingMethod?: string; sleepLocation?: string; sleepNote?: string }) => {
      const childId = data.childId || (localStorage.getItem("activeChildId") ? parseInt(localStorage.getItem("activeChildId")!) : undefined);
      const res = await fetch(api.sleepSessions.manual.path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...data, childId }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message);
      }
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: [api.sleepSessions.active.path] });
      queryClient.invalidateQueries({ queryKey: [api.sleepSessions.list.path] });
      queryClient.invalidateQueries({ queryKey: [api.logs.list.path] });
      toast({
        title: `${data.durationMin}分のねんねを記録しました`,
        description: "手入力で記録しました",
        className: "bg-indigo-50 border-indigo-100 text-indigo-900",
      });
    },
  });
}

export function useSkillCompletions(familyId: string) {
  return useQuery({
    queryKey: [api.skills.list.path, familyId],
    queryFn: async () => {
      const res = await fetch(buildUrl(api.skills.list.path, { familyId }));
      return res.json();
    },
    refetchInterval: 5000,
  });
}

export function useCompleteSkill() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (data: { familyId: string; userId: string; skillId: string }) => {
      const res = await fetch(api.skills.complete.path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.skills.list.path] });
      toast({
        title: "スキル習得おめでとうございます！",
        className: "bg-purple-50 border-purple-100 text-purple-900",
      });
    },
  });
}

export function useUncompleteSkill() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: { familyId: string; userId: string; skillId: string }) => {
      const res = await fetch(api.skills.uncomplete.path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.skills.list.path] });
    },
  });
}

export function useCreateGrowthRecord() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch(api.growth.create.path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message);
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.growth.list.path] });
      toast({
        title: "身体測定を記録しました！",
        description: "成長曲線に反映されます",
        className: "bg-green-50 border-green-100 text-green-900",
      });
    },
  });
}

export function useUpdateGrowthRecord() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async ({ id, data }: { id: number; data: any }) => {
      const res = await fetch(`/api/growth/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to update");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.growth.list.path] });
      toast({ title: "測定記録を更新しました", className: "bg-green-50 border-green-100 text-green-900" });
    },
  });
}

export function useDeleteGrowthRecord() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/growth/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.growth.list.path] });
      toast({ title: "測定記録を削除しました", className: "bg-red-50 border-red-100 text-red-900" });
    },
  });
}

export function useWeBoardMessages(familyId: string) {
  return useQuery({
    queryKey: [api.weBoard.list.path, familyId],
    queryFn: async () => {
      const res = await fetch(api.weBoard.list.path.replace(":familyId", familyId));
      if (!res.ok) throw new Error("Failed to fetch we-board");
      return res.json();
    },
    refetchInterval: 5000,
  });
}

export function useCreateWeBoardMessage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch(api.weBoard.create.path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message);
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.weBoard.list.path] });
    },
  });
}

export function useHealthRecords(familyId: string) {
  return useQuery({
    queryKey: [api.healthRecords.list.path, familyId],
    queryFn: async () => {
      const res = await fetch(api.healthRecords.list.path.replace(":familyId", familyId));
      if (!res.ok) throw new Error("Failed to fetch health records");
      return res.json();
    },
    refetchInterval: 5000,
  });
}

export function useCreateHealthRecord() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: { familyId: string; childId?: number; type: string; title: string; detail?: string; recordedAt?: string }) => {
      const res = await fetch(api.healthRecords.create.path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.healthRecords.list.path] });
    },
  });
}

export function useDeleteHealthRecord() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(api.healthRecords.delete.path.replace(":id", String(id)), {
        method: "DELETE",
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.healthRecords.list.path] });
    },
  });
}

export function useUpdateHealthRecord() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...data }: { id: number; title?: string; detail?: string | null; recordedAt?: string | null }) => {
      const res = await fetch(`/api/health-records/${id}/update`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.healthRecords.list.path] });
    },
  });
}

export function useUpdateLog() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...data }: { id: number; createdAt?: string; message?: string; bodyTemperature?: number | null; symptoms?: string | null; symptomNote?: string | null }) => {
      const res = await fetch(`/api/logs/${id}/update`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/logs/:familyId"] });
    },
  });
}

export function useDeleteLog() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/logs/${id}`, {
        method: "DELETE",
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.logs.list.path] });
      toast({
        title: "記録を削除しました",
        className: "bg-red-50 border-red-100 text-red-900",
      });
    },
  });
}

export function useBulkDeleteLogs() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (ids: number[]) => {
      const res = await fetch("/api/logs/bulk-delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids }),
      });
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: [api.logs.list.path] });
      toast({
        title: `${data.deleted}件の記録を削除しました`,
        className: "bg-red-50 border-red-100 text-red-900",
      });
    },
  });
}

export function useVaccinationRecords(familyId: string, childId?: number | null) {
  const path = childId
    ? `/api/vaccination-records/${familyId}/${childId}`
    : `/api/vaccination-records/${familyId}`;
  return useQuery({
    queryKey: ["/api/vaccination-records", familyId, childId],
    queryFn: async () => {
      const res = await fetch(path);
      return res.json();
    },
    enabled: !!familyId,
    refetchInterval: 5000,
  });
}

export function useCreateVaccinationRecord() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: { familyId: string; childId?: number | null; vaccineId: string; administeredDate: string; note?: string | null }) => {
      const res = await fetch("/api/vaccination-records", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/vaccination-records"] });
      queryClient.invalidateQueries({ queryKey: ["/api/logs"] });
    },
  });
}

export function useUpdateVaccinationRecord() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async ({ id, ...data }: { id: number; administeredDate?: string; note?: string | null }) => {
      const res = await fetch(`/api/vaccination-records/${id}/update`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.refetchQueries({ queryKey: ["/api/vaccination-records"] });
      queryClient.invalidateQueries({ queryKey: ["/api/logs"] });
      toast({
        title: "接種日を変更しました",
        className: "bg-cyan-50 border-cyan-100 text-cyan-900",
      });
    },
  });
}

export function useDeleteVaccinationRecord() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/vaccination-records/${id}`, {
        method: "DELETE",
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/vaccination-records"] });
      queryClient.invalidateQueries({ queryKey: ["/api/logs"] });
      toast({
        title: "接種記録を削除しました",
        className: "bg-red-50 border-red-100 text-red-900",
      });
    },
  });
}

export function useCustomVaccines(familyId: string, childId?: number | null) {
  const path = childId
    ? `/api/custom-vaccines/${familyId}/${childId}`
    : `/api/custom-vaccines/${familyId}`;
  return useQuery({
    queryKey: ["/api/custom-vaccines", familyId, childId],
    queryFn: async () => {
      const res = await fetch(path);
      return res.json();
    },
    enabled: !!familyId,
  });
}

export function useCreateCustomVaccine() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (data: { familyId: string; childId?: number | null; name: string }) => {
      const res = await fetch("/api/custom-vaccines", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/custom-vaccines"] });
      toast({
        title: "カスタムワクチンを追加しました",
        className: "bg-cyan-50 border-cyan-100 text-cyan-900",
      });
    },
  });
}

export function useDeleteCustomVaccine() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/custom-vaccines/${id}`, {
        method: "DELETE",
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/custom-vaccines"] });
      toast({
        title: "カスタムワクチンを削除しました",
        className: "bg-red-50 border-red-100 text-red-900",
      });
    },
  });
}

export function useCustomChildcareItems(familyId: string) {
  return useQuery({
    queryKey: ["/api/families", familyId, "custom-childcare-items"],
    queryFn: async () => {
      const res = await fetch(`/api/families/${familyId}/custom-childcare-items`);
      return res.json();
    },
    refetchInterval: 5000,
  });
}

export function useCreateCustomChildcareItem() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (data: { familyId: string; itemName: string; icon: string; createdBy?: string }) => {
      const res = await fetch(`/api/families/${data.familyId}/custom-childcare-items`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to create item");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/families"] });
      toast({
        title: "カスタム項目を追加しました",
        className: "bg-purple-50 border-purple-100 text-purple-900",
      });
    },
  });
}

export function useUpdateCustomChildcareItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...data }: { id: number; itemName?: string; icon?: string; isActive?: boolean }) => {
      const familyId = localStorage.getItem("familyId") || "default";
      const res = await fetch(`/api/families/${familyId}/custom-childcare-items/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/families"] });
    },
  });
}

export function useTodayMamaHealthLog() {
  return useQuery({
    queryKey: ["/api/mama-health-logs/today"],
    queryFn: async () => {
      const res = await fetch("/api/mama-health-logs/today");
      if (!res.ok) return null;
      return res.json();
    },
    refetchInterval: 30000,
  });
}

export function useMamaHealthLogs() {
  return useQuery({
    queryKey: ["/api/mama-health-logs"],
    queryFn: async () => {
      const res = await fetch("/api/mama-health-logs");
      if (!res.ok) return [];
      return res.json();
    },
    refetchInterval: 60000,
  });
}

export function useSaveMamaHealthLog() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: Record<string, any>) => {
      const res = await fetch("/api/mama-health-logs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/mama-health-logs/today"] });
      queryClient.invalidateQueries({ queryKey: ["/api/mama-health-logs"] });
    },
  });
}

export function useDeleteCustomChildcareItem() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (id: number) => {
      const familyId = localStorage.getItem("familyId") || "default";
      const res = await fetch(`/api/families/${familyId}/custom-childcare-items/${id}`, {
        method: "DELETE",
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/families"] });
      toast({
        title: "カスタム項目を削除しました",
        className: "bg-gray-50 border-gray-100 text-gray-900",
      });
    },
  });
}
