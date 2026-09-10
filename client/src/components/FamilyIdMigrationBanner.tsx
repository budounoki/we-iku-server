// Detects a legacy (guessable) familyId in localStorage and either:
//  - silently follows an already-performed rotation (partner's device rotated
//    first): updates localStorage and reloads, or
//  - shows a banner prompting the user to rotate to a secure code.
// See server/familyIdMigration.ts for the server side and security notes.
// Ported from originwebapp 2026-09-10 — actually mounted here (see App.tsx),
// unlike the origin project where this component existed but was never used.
import { useEffect, useState } from "react";
import { ShieldAlert, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

const LEGACY_FAMILY_ID_RE = /^family-[0-9a-z]{1,10}$/;

type Status = "hidden" | "prompt" | "expired";

export default function FamilyIdMigrationBanner() {
  const [status, setStatus] = useState<Status>("hidden");
  const [rotating, setRotating] = useState(false);
  const [dismissed, setDismissed] = useState(
    () => sessionStorage.getItem("family_id_migration_dismissed") === "true",
  );
  const { toast } = useToast();

  useEffect(() => {
    const familyId = localStorage.getItem("familyId");
    if (!familyId || !LEGACY_FAMILY_ID_RE.test(familyId)) return;

    (async () => {
      try {
        const res = await fetch(
          `/api/family/id-status?familyId=${encodeURIComponent(familyId)}`,
        );
        if (!res.ok) return;
        const data = await res.json();
        if (data.migrated && data.migratedTo) {
          localStorage.setItem("familyId", data.migratedTo);
          window.location.reload();
          return;
        }
        if (data.migrated && !data.migratedTo) {
          setStatus("expired");
          return;
        }
        if (data.legacy) setStatus("prompt");
      } catch {
        // Network error: stay hidden, try again next load.
      }
    })();
  }, []);

  const handleRotate = async () => {
    const familyId = localStorage.getItem("familyId");
    if (!familyId) return;
    setRotating(true);
    try {
      const res = await fetch("/api/family/rotate-id", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ familyId }),
      });
      if (!res.ok) throw new Error("rotate failed");
      const data = await res.json();
      localStorage.setItem("familyId", data.newFamilyId);
      toast({
        title: "家族コードを更新しました",
        description:
          "パートナーの端末は3日以内にアプリを開くと自動で切り替わります。新しいコードは設定画面で確認できます。",
        className: "bg-green-50 border-green-100 text-green-900",
      });
      setTimeout(() => window.location.reload(), 1200);
    } catch {
      setRotating(false);
      toast({ title: "更新に失敗しました", description: "しばらくしてからもう一度お試しください", variant: "destructive" });
    }
  };

  if (status === "hidden" || dismissed) return null;

  const dismiss = () => {
    sessionStorage.setItem("family_id_migration_dismissed", "true");
    setDismissed(true);
  };

  return (
    <div
      className="fixed bottom-20 left-3 right-3 z-50 rounded-2xl border-2 border-amber-200 bg-amber-50 p-4 shadow-lg"
      data-testid="banner-family-id-migration"
    >
      <div className="flex items-start gap-3">
        <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
        {status === "prompt" ? (
          <div className="flex-1">
            <p className="text-sm font-bold text-amber-900">家族コードの更新をおすすめします</p>
            <p className="mt-1 text-xs text-amber-800">
              現在の家族コードは古い形式で、第三者に推測されやすい可能性があります。安全な新しいコードに更新しましょう。データはそのまま引き継がれます。
            </p>
            <div className="mt-3 flex gap-2">
              <Button
                size="sm"
                onClick={handleRotate}
                disabled={rotating}
                className="rounded-xl bg-amber-600 text-white hover:bg-amber-700"
                data-testid="button-rotate-family-id"
              >
                {rotating ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : null}
                今すぐ更新する
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={dismiss}
                className="rounded-xl text-amber-700"
                data-testid="button-dismiss-family-id-banner"
              >
                あとで
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex-1">
            <p className="text-sm font-bold text-amber-900">家族コードが更新されています</p>
            <p className="mt-1 text-xs text-amber-800">
              パートナーが家族コードを新しくしました。設定画面の「ペアリング」でパートナーの新しいコードを入力してください。
            </p>
            <Button
              size="sm"
              variant="ghost"
              onClick={dismiss}
              className="mt-2 rounded-xl text-amber-700"
              data-testid="button-dismiss-family-id-banner"
            >
              閉じる
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
