import { QueryClient, QueryFunction } from "@tanstack/react-query";

/**
 * エラー応答から利用者に見せる文言だけを取り出す。
 *
 * サーバーは {"message":"..."} を返すため、本文をそのまま Error.message に
 * 入れると画面に `400: {"message":"..."}` と JSON が露出していた
 * （client 2026-10: エラー表示のスタイルがおかしい）。
 * JSON として読めれば message を、読めなければステータスを添えて返す。
 */
function errorMessageFrom(status: number, statusText: string, body: string): string {
  const trimmed = body.trim();
  if (trimmed && !trimmed.startsWith("<")) {
    try {
      const parsed = JSON.parse(trimmed);
      if (parsed && typeof parsed === "object") {
        const value = (parsed as Record<string, unknown>).message
          ?? (parsed as Record<string, unknown>).error;
        if (typeof value === "string" && value.trim()) return value.trim();
      }
    } catch {
      // JSON でなければ本文をそのまま見せる。
      return trimmed;
    }
  }
  return `${status}: ${statusText || "エラーが発生しました"}`;
}

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = await res.text();
    throw new Error(errorMessageFrom(res.status, res.statusText, text));
  }
}

// サポーター厳格モードでは、既存APIの呼び出しに確認済み家族IDの明示が必要になる。
// モバイルと同様に X-Family-Id ヘッダで送る。通常モードではサーバー側で無視される
// ため、常時付与しても既存動作に影響はない（2026-10 有効化準備）。
function familyHeaders(): Record<string, string> {
  try {
    const fid = localStorage.getItem("familyId");
    return fid ? { "X-Family-Id": fid } : {};
  } catch {
    return {};
  }
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  const res = await fetch(url, {
    method,
    headers: {
      ...(data ? { "Content-Type": "application/json" } : {}),
      ...familyHeaders(),
    },
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include",
  });

  await throwIfResNotOk(res);
  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const res = await fetch(queryKey.join("/") as string, {
      credentials: "include",
      headers: familyHeaders(),
    });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
