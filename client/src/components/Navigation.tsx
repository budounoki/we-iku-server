import { Link, useLocation } from "wouter";
import { Home, Settings, CalendarDays, Gift, Grape, Clock } from "lucide-react";
import { cn } from "@/lib/utils";

export function BottomNav() {
  const [location] = useLocation();

  const navItems = [
    { href: "/", icon: Home, label: "ホーム" },
    { href: "/calendar", icon: CalendarDays, label: "カレンダー" },
    { href: "/timeline", icon: Clock, label: "きろく" },
    { href: "/shop", icon: Gift, label: "ご褒美" },
    { href: "/settings", icon: Settings, label: "設定" },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white/90 dark:bg-[hsl(240_10%_8%/0.97)] backdrop-blur-lg border-t border-purple-100 dark:border-purple-900/30 shadow-lg shadow-purple-900/5 pb-safe">
      <div className="flex items-center justify-center pt-1">
        <div className="flex items-center gap-1" data-testid="brand-footer">
          <Grape className="w-2.5 h-2.5 text-purple-300" />
          <span className="text-[8px] font-bold text-purple-300 tracking-wider">
            Produced by ぶどうの木
          </span>
        </div>
      </div>
      <div className="flex justify-around items-center h-18 max-w-md mx-auto px-4 pb-1">
        {navItems.map((item) => {
          const isActive = location === item.href;
          return (
            <Link key={item.href} href={item.href} className="flex-1">
              <div 
                className={cn(
                  "flex flex-col items-center justify-center space-y-1 py-2 rounded-2xl transition-all duration-300",
                  isActive 
                    ? "text-primary transform -translate-y-1" 
                    : "text-muted-foreground hover:text-purple-400"
                )}
              >
                <div className={cn(
                  "p-2 rounded-2xl transition-all duration-300",
                  isActive ? "bg-purple-50" : "bg-transparent"
                )}>
                  <item.icon className={cn("w-5 h-5", isActive ? "stroke-[2.5px]" : "stroke-2")} />
                </div>
                <span className="text-[9px] font-bold tracking-wide">{item.label}</span>
              </div>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
