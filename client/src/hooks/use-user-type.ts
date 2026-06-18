import { useSyncExternalStore, useCallback } from "react";

let userTypeCache: string = localStorage.getItem("userType") || "papa";

const listeners = new Set<() => void>();

function notifyListeners() {
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot() {
  return userTypeCache;
}

export function setUserTypeGlobal(val: string) {
  userTypeCache = val;
  localStorage.setItem("userType", val);
  notifyListeners();
}

export function useUserType() {
  const userType = useSyncExternalStore(subscribe, getSnapshot);
  const setUserType = useCallback((val: string) => {
    setUserTypeGlobal(val);
  }, []);
  return { userType, setUserType };
}
