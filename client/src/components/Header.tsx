import { useState } from "react";
import { User, Crown, Settings, Baby, Grape, ChevronDown, Check } from "lucide-react";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { AnimatePresence, motion } from "framer-motion";
import { useActiveChild } from "@/hooks/use-active-child";
import { useSettings } from "@/hooks/use-app-data";
import { useUserType } from "@/hooks/use-user-type";
import { useUserLabels } from "@/hooks/use-user-labels";
import { differenceInDays, parseISO } from "date-fns";

export function Header() {
  const familyId = localStorage.getItem("familyId") || "default";
  const { data: settings } = useSettings(familyId);
  const { activeChild, childrenList, switchChild } = useActiveChild(familyId);
  const { userType } = useUserType();
  const { papaLabel, mamaLabel } = useUserLabels();

  const [showSwitcher, setShowSwitcher] = useState(false);
  const [, navigate] = useLocation();
  const hasMultipleChildren = childrenList.length > 1;
  const headerAccent = activeChild?.color || "#805AAA";
  const displayName = activeChild?.name || settings?.babyName || "赤ちゃん";
  const caregiver = userType === "mama" ? mamaLabel : userType === "other" ? "その他" : papaLabel;

  const birthdayStr = activeChild?.birthday || settings?.babyBirthday;
  const daysOld = birthdayStr ? Math.max(0, differenceInDays(new Date(), parseISO(birthdayStr))) + 1 : null;

  return (
    <header className="pt-6 pb-3 px-6 bg-transparent relative">
      <div
        className="absolute inset-0 opacity-[0.04] pointer-events-none rounded-b-[24px]"
        style={{ backgroundColor: headerAccent }}
      />
      <div className="flex items-center justify-center mb-3">
        <div className="flex items-center gap-1.5" data-testid="brand-header">
          <Grape className="w-3 h-3 text-purple-400" />
          <span className="text-[9px] font-bold text-purple-400 tracking-wider">
            Produced by 産前産後ケアホテル ぶどうの木
          </span>
        </div>
      </div>
      <div className="flex justify-between items-center">
        <div className="flex flex-col relative">
          <span className="text-xs font-bold text-muted-foreground tracking-widest uppercase mb-1">
            Baby
          </span>
          <button
            className="text-2xl font-black text-foreground tracking-tight flex items-center gap-2 text-left"
            onClick={() => {
              if (hasMultipleChildren) {
                setShowSwitcher(!showSwitcher);
              } else {
                navigate("/child-profile");
              }
            }}
            data-testid="button-child-switcher"
          >
            <div
              className="w-7 h-7 rounded-full flex items-center justify-center shrink-0"
              style={{ backgroundColor: headerAccent + "22", borderColor: headerAccent, borderWidth: 2 }}
            >
              <Baby className="w-4 h-4" style={{ color: headerAccent }} />
            </div>
            {displayName}
            {hasMultipleChildren && (
              <ChevronDown className="w-4 h-4 text-gray-400 ml-0.5" />
            )}
          </button>
          {daysOld !== null && (
            <span
              className="text-[11px] font-bold px-2 py-0.5 rounded-full mt-0.5 inline-block"
              style={{ backgroundColor: headerAccent + "18", color: headerAccent }}
              data-testid="text-days-old"
            >
              生後{daysOld}日目
            </span>
          )}

          <AnimatePresence>
            {showSwitcher && hasMultipleChildren && (
              <motion.div
                initial={{ opacity: 0, y: -8, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -8, scale: 0.95 }}
                transition={{ duration: 0.15 }}
                className="absolute top-full left-0 mt-2 bg-white rounded-2xl shadow-lg border border-gray-100 z-50 min-w-[200px] overflow-hidden"
                data-testid="child-switcher-dropdown"
              >
                {childrenList.map((child: any) => {
                  const isActive = activeChild?.id === child.id;
                  return (
                    <button
                      key={child.id}
                      className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors ${isActive ? "bg-purple-50" : "active:bg-gray-50"}`}
                      onClick={() => {
                        switchChild(child.id);
                        setShowSwitcher(false);
                      }}
                      data-testid={`button-switch-child-${child.id}`}
                    >
                      <div
                        className="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
                        style={{ backgroundColor: child.color + "22", borderColor: child.color, borderWidth: 2 }}
                      >
                        <Baby className="w-4 h-4" style={{ color: child.color }} />
                      </div>
                      <span className="text-sm font-bold text-gray-700 flex-1">{child.name}</span>
                      {isActive && <Check className="w-4 h-4 text-purple-500" />}
                    </button>
                  );
                })}
                <button
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-left border-t border-gray-100 active:bg-gray-50"
                  onClick={() => {
                    setShowSwitcher(false);
                    navigate("/child-profile");
                  }}
                  data-testid="button-child-profile-link"
                >
                  <Settings className="w-4 h-4 text-gray-400" />
                  <span className="text-xs font-bold text-gray-500">プロフィール設定</span>
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="flex items-center gap-3">
          <Link href="/settings">
            <Button variant="ghost" size="icon" className="rounded-full bg-white/60 backdrop-blur-sm border border-gray-100" data-testid="button-settings">
              <Settings className="w-5 h-5 text-gray-500" />
            </Button>
          </Link>
          <div className="flex items-center gap-2 px-4 py-2 bg-white rounded-full shadow-sm border border-purple-100/50 backdrop-blur-sm animate-in fade-in slide-in-from-top-4 duration-700">
            <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center text-secondary-foreground">
              {userType === "mama" ? <Crown size={16} /> : <User size={16} />}
            </div>
            <div className="flex flex-col">
              <span className="text-[10px] text-muted-foreground font-semibold leading-none">担当中</span>
              <span className="text-sm font-bold text-secondary-foreground leading-tight">{caregiver}</span>
            </div>
          </div>
        </div>
      </div>

      {showSwitcher && (
        <div className="fixed inset-0 z-40" onClick={() => setShowSwitcher(false)} />
      )}
    </header>
  );
}
