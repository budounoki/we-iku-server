import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { Grape } from "lucide-react";
import { useTheme } from "@/hooks/use-theme";
import { FloatingBreastTimer } from "@/components/FloatingBreastTimer";

import Home from "./pages/Home";
import Settings from "./pages/Settings";
import Rescue from "./pages/Rescue";
import Calendar from "./pages/Calendar";
import Shop from "./pages/Shop";
import SleepTraining from "./pages/SleepTraining";
import Health from "./pages/Health";
import SkillTree from "./pages/SkillTree";
import Dashboard from "./pages/Dashboard";
import Timeline from "./pages/Timeline";
import Onboarding from "./pages/Onboarding";
import AdminStats from "./pages/AdminStats";
import AdminDashboard from "./pages/AdminDashboard";
import ChildProfile from "./pages/ChildProfile";
import InvitationCode from "./pages/InvitationCode";
import Tutorial from "./pages/Tutorial";
import Legal from "./pages/Legal";
import Tips from "./pages/Tips";
import FoodTracker from "./pages/FoodTracker";
import LogReview from "./pages/LogReview";
import DailyStats from "./pages/DailyStats";
import NotFound from "./pages/not-found";

function ThemeInitializer() {
  useTheme();
  return null;
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/settings" component={Settings} />
      <Route path="/rescue" component={Rescue} />
      <Route path="/calendar" component={Calendar} />
      <Route path="/shop" component={Shop} />
      <Route path="/sleep-training" component={SleepTraining} />
      <Route path="/health" component={Health} />
      <Route path="/skills" component={SkillTree} />
      <Route path="/dashboard" component={Dashboard} />
      <Route path="/timeline" component={Timeline} />
      <Route path="/child-profile" component={ChildProfile} />
      <Route path="/admin" component={AdminDashboard} />
      <Route path="/legal" component={Legal} />
      <Route path="/tips" component={Tips} />
      <Route path="/food-tracker" component={FoodTracker} />
      <Route path="/log-review" component={LogReview} />
      <Route path="/daily-stats" component={DailyStats} />
      <Route component={NotFound} />
    </Switch>
  );
}

function SplashScreen({ onComplete }: { onComplete: () => void }) {
  useEffect(() => {
    const timer = setTimeout(onComplete, 1400);
    return () => clearTimeout(timer);
  }, [onComplete]);

  return (
    <motion.div
      initial={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.5 }}
      className="fixed inset-0 z-[200] flex flex-col items-center justify-center bg-gradient-to-br from-purple-50 via-white to-green-50"
      data-testid="splash-screen"
    >
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 0.2, duration: 0.6, ease: "easeOut" }}
        className="flex flex-col items-center gap-6"
      >
        <div className="w-24 h-24 rounded-full bg-gradient-to-br from-purple-100 to-green-50 flex items-center justify-center shadow-soft border-4 border-white">
          <Grape className="w-12 h-12 text-purple-500" />
        </div>

        <motion.div
          initial={{ y: 10, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.5, duration: 0.5 }}
          className="text-center"
        >
          <h1 className="text-3xl font-black text-purple-700 tracking-tight mb-1">
            We育
          </h1>
          <p className="text-sm font-bold text-purple-400 mb-4">
            ふたりで育てる、ふたりで楽しむ
          </p>
        </motion.div>

        <motion.div
          initial={{ y: 10, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.9, duration: 0.5 }}
          className="flex flex-col items-center gap-2"
        >
          <div className="w-12 h-px bg-purple-200" />
          <p className="text-[10px] font-bold text-purple-300 tracking-widest uppercase">
            Produced by
          </p>
          <p className="text-sm font-black text-purple-500">
            産前産後ケアホテル ぶどうの木
          </p>
        </motion.div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.5, duration: 0.5 }}
        className="absolute bottom-12"
      >
        <div className="flex gap-1">
          {[0, 1, 2].map((i) => (
            <motion.div
              key={i}
              className="w-2 h-2 rounded-full bg-purple-300"
              animate={{ scale: [1, 1.3, 1], opacity: [0.5, 1, 0.5] }}
              transition={{ repeat: Infinity, duration: 1, delay: i * 0.2 }}
            />
          ))}
        </div>
      </motion.div>
    </motion.div>
  );
}

const LIFF_ID = import.meta.env.VITE_LIFF_ID;

async function authenticateWithBackend(data: {
  authenticated?: boolean;
  familyId?: string;
  role?: string;
  displayName?: string;
  pictureUrl?: string;
  invitationVerified?: boolean;
}) {
  if (!data || !data.authenticated || !data.familyId) return false;
  localStorage.setItem("familyId", data.familyId);
  if (data.role) localStorage.setItem("userType", data.role);
  if (data.displayName) localStorage.setItem("lineDisplayName", data.displayName);
  if (data.pictureUrl) localStorage.setItem("linePictureUrl", data.pictureUrl);
  if (data.invitationVerified) localStorage.setItem("invitation_verified", "true");
  localStorage.setItem("onboarding_done", "true");
  return true;
}

async function tryLiffAutoLogin(): Promise<boolean> {
  if (!LIFF_ID) return false;
  try {
    const liff = (await import("@line/liff")).default;
    await liff.init({ liffId: LIFF_ID });
    if (!liff.isLoggedIn()) return false;
    const accessToken = liff.getAccessToken();
    if (!accessToken) return false;
    const res = await fetch("/api/auth/line-liff", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ accessToken }),
    });
    if (!res.ok) return false;
    const data = await res.json();
    return await authenticateWithBackend(data);
  } catch (err) {
    console.error("LIFF auto-login error:", err);
    return false;
  }
}

function useLineLoginCallback() {
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("login_success") === "1") {
      const familyId = params.get("familyId");
      const role = params.get("role");
      const displayName = params.get("displayName");
      const pictureUrl = params.get("pictureUrl");
      const invitationVerified = params.get("invitationVerified");

      if (familyId) localStorage.setItem("familyId", familyId);
      if (role) localStorage.setItem("userType", role);
      if (displayName) localStorage.setItem("lineDisplayName", displayName);
      if (pictureUrl) localStorage.setItem("linePictureUrl", pictureUrl);
      if (invitationVerified === "true") localStorage.setItem("invitation_verified", "true");
      localStorage.setItem("onboarding_done", "true");

      window.history.replaceState({}, "", "/");
      window.location.reload();
      return;
    }

    (async () => {
      if (!localStorage.getItem("onboarding_done")) {
        try {
          const res = await fetch("/api/auth/me", { credentials: "include" });
          const data = await res.json();
          if (await authenticateWithBackend(data)) {
            window.location.reload();
            return;
          }
        } catch {}

        if (await tryLiffAutoLogin()) {
          window.location.reload();
        }
      }
    })();
  }, []);
}

function App() {
  const [location] = useLocation();
  const isAdminPage = location === "/admin-stats" || location === "/admin-stats/";
  const isAdminDashboard = location === "/admin" || location === "/admin/";
  const isTipsPage = location === "/tips" || location === "/tips/";
  const isLegalPage = location === "/legal" || location === "/legal/";

  useLineLoginCallback();

  const [showSplash, setShowSplash] = useState(() => {
    const shown = sessionStorage.getItem("splash_shown");
    return !shown;
  });

  const [showOnboarding, setShowOnboarding] = useState(() => {
    const done = localStorage.getItem("onboarding_done");
    const familyId = localStorage.getItem("familyId");
    return !done && !familyId;
  });

  const [needsInvitation, setNeedsInvitation] = useState(() => {
    const verified = localStorage.getItem("invitation_verified");
    const onboardingDone = localStorage.getItem("onboarding_done");
    return onboardingDone === "true" && verified !== "true";
  });

  const [showTutorial, setShowTutorial] = useState(() => {
    const tutorialDone = localStorage.getItem("we_iku_tutorial_done");
    const onboardingDone = localStorage.getItem("onboarding_done");
    const verified = localStorage.getItem("invitation_verified");
    return !tutorialDone && onboardingDone === "true" && verified === "true";
  });

  const handleSplashComplete = () => {
    setShowSplash(false);
    sessionStorage.setItem("splash_shown", "true");
  };

  const handleOnboardingComplete = () => {
    setShowOnboarding(false);
    const verified = localStorage.getItem("invitation_verified");
    if (verified !== "true") {
      setNeedsInvitation(true);
    }
  };

  const handleInvitationVerified = () => {
    setNeedsInvitation(false);
    const tutorialDone = localStorage.getItem("we_iku_tutorial_done");
    if (!tutorialDone) {
      setShowTutorial(true);
    }
  };

  const handleTutorialComplete = () => {
    setShowTutorial(false);
  };

  if (isAdminPage) {
    return (
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <ThemeInitializer />
          <AdminStats />
          <Toaster />
        </TooltipProvider>
      </QueryClientProvider>
    );
  }

  if (isAdminDashboard) {
    return (
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <ThemeInitializer />
          <AdminDashboard />
          <Toaster />
        </TooltipProvider>
      </QueryClientProvider>
    );
  }

  if (isTipsPage || isLegalPage) {
    return (
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <ThemeInitializer />
          <Router />
          <Toaster />
        </TooltipProvider>
      </QueryClientProvider>
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <ThemeInitializer />
        <AnimatePresence>
          {showSplash && <SplashScreen onComplete={handleSplashComplete} />}
        </AnimatePresence>
        {showOnboarding ? (
          <Onboarding onComplete={handleOnboardingComplete} />
        ) : needsInvitation ? (
          <InvitationCode onVerified={handleInvitationVerified} />
        ) : showTutorial ? (
          <Tutorial onComplete={handleTutorialComplete} />
        ) : (
          <Router />
        )}
        <FloatingBreastTimer />
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
