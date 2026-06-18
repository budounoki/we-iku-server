import { useState, useCallback, useEffect, useRef, useSyncExternalStore } from "react";
import { useChildren, useCreateChild } from "@/hooks/use-app-data";
import { useToast } from "@/hooks/use-toast";

let activeChildIdCache: number | null = (() => {
  const stored = localStorage.getItem("activeChildId");
  return stored ? parseInt(stored) : null;
})();

let pendingSwitchId: number | null = null;

const listeners = new Set<() => void>();

function notifyListeners() {
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot() {
  return activeChildIdCache;
}

export function setActiveChildIdGlobal(id: number | null) {
  activeChildIdCache = id;
  pendingSwitchId = id;
  if (id !== null) {
    localStorage.setItem("activeChildId", String(id));
  }
  notifyListeners();
}

export function useActiveChild(familyId: string, settings?: any) {
  const { data: childrenList = [], isLoading, isFetching } = useChildren(familyId);
  const createChild = useCreateChild();
  const { toast } = useToast();
  const creatingRef = useRef(false);

  const activeChildId = useSyncExternalStore(subscribe, getSnapshot);

  useEffect(() => {
    if (isLoading || createChild.isPending || creatingRef.current) return;

    if (childrenList.length === 0 && settings && settings.babyName && settings.babyName !== "赤ちゃんのなまえ") {
      creatingRef.current = true;
      createChild.mutate({
        familyId,
        name: settings.babyName,
        birthday: settings.babyBirthday || undefined,
        color: "#805AAA",
        silent: true,
      });
      return;
    }

    if (childrenList.length > 0) {
      creatingRef.current = false;
      if (activeChildId === null) {
        const first = childrenList[0];
        setActiveChildIdGlobal(first.id);
        if (first.birthday) {
          localStorage.setItem("activeChildBirthday", first.birthday);
        } else {
          localStorage.removeItem("activeChildBirthday");
        }
      } else if (!childrenList.find((c: any) => c.id === activeChildId)) {
        if (!isFetching) {
          const first = childrenList[0];
          setActiveChildIdGlobal(first.id);
          if (first.birthday) {
            localStorage.setItem("activeChildBirthday", first.birthday);
          } else {
            localStorage.removeItem("activeChildBirthday");
          }
        }
      }
    }
  }, [childrenList, isLoading, isFetching, activeChildId, settings, familyId, createChild.isPending]);

  const switchChild = useCallback((id: number) => {
    const child = childrenList.find((c: any) => c.id === id);
    setActiveChildIdGlobal(id);
    if (child?.birthday) {
      localStorage.setItem("activeChildBirthday", child.birthday);
    } else {
      localStorage.removeItem("activeChildBirthday");
    }
    if (child) {
      toast({
        title: `${child.name}に切り替えました`,
        className: "bg-purple-50 border-purple-100 text-purple-900",
      });
    }
  }, [childrenList, toast]);

  const matchedChild = childrenList.find((c: any) => c.id === activeChildId) || null;
  const fallbackChild = childrenList[0] || null;

  if (matchedChild && pendingSwitchId === activeChildId) {
    pendingSwitchId = null;
  }

  const resolvedChild = matchedChild || (pendingSwitchId !== null ? null : fallbackChild);

  useEffect(() => {
    if (resolvedChild?.birthday) {
      localStorage.setItem("activeChildBirthday", resolvedChild.birthday);
    } else if (resolvedChild) {
      localStorage.removeItem("activeChildBirthday");
    }
  }, [resolvedChild?.id, resolvedChild?.birthday]);

  return {
    children: childrenList,
    childrenList,
    activeChild: resolvedChild,
    activeChildId: resolvedChild ? resolvedChild.id : activeChildId,
    switchChild,
    isLoading,
  };
}
