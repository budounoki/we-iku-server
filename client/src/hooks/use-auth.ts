import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";

interface AuthUser {
  authenticated: boolean;
  userId?: number;
  lineUserId?: string;
  familyId?: string;
  role?: string;
  displayName?: string;
  pictureUrl?: string;
}

export function useAuth() {
  const { data: user, isLoading } = useQuery<AuthUser>({
    queryKey: ["/api/auth/me"],
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: true,
  });

  const logoutMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/auth/logout");
    },
    onSuccess: () => {
      localStorage.removeItem("familyId");
      localStorage.removeItem("userType");
      localStorage.removeItem("onboarding_done");
      localStorage.removeItem("activeChildId");
      localStorage.removeItem("activeChildBirthday");
      queryClient.setQueryData(["/api/auth/me"], { authenticated: false });
      queryClient.clear();
      window.location.href = "/";
    },
  });

  const updateRoleMutation = useMutation({
    mutationFn: async (role: string) => {
      await apiRequest("POST", "/api/auth/update-role", { role });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
    },
  });

  const joinFamilyMutation = useMutation({
    mutationFn: async (familyId: string) => {
      await apiRequest("POST", "/api/auth/join-family", { familyId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
    },
  });

  return {
    user: user?.authenticated ? user : null,
    isAuthenticated: !!user?.authenticated,
    isLoading,
    logout: logoutMutation.mutate,
    updateRole: updateRoleMutation.mutate,
    joinFamily: joinFamilyMutation.mutate,
  };
}
