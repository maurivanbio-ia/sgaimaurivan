import { QueryClient, QueryCache, MutationCache, QueryFunction } from "@tanstack/react-query";

function handle401() {
  // Clear all cached data and redirect to login
  queryClient.clear();
  if (window.location.pathname !== "/login" && window.location.pathname !== "/portal/login") {
    window.location.href = "/login";
  }
}

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    if (res.status === 401) {
      handle401();
    }
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  const res = await fetch(url, {
    method,
    headers: data ? { "Content-Type": "application/json" } : {},
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include",
  });

  await throwIfResNotOk(res);
  return res;
}

export async function apiRequestFormData(
  method: string,
  url: string,
  formData: FormData,
): Promise<Response> {
  const res = await fetch(url, {
    method,
    body: formData,
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
    });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    if (res.status === 401 && unauthorizedBehavior !== "returnNull") {
      handle401();
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

export const queryClient = new QueryClient({
  queryCache: new QueryCache({
    onError: (error: any) => {
      if (error?.message?.startsWith("401:")) {
        handle401();
      }
    },
  }),
  mutationCache: new MutationCache({
    onError: (error: any) => {
      if (error?.message?.startsWith("401:")) {
        handle401();
      }
    },
  }),
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: true,
      staleTime: 2 * 60 * 1000, // 2 minutes — balances freshness vs network requests
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
