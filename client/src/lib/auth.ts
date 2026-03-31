import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, getQueryFn } from "./queryClient";
import { queryClient } from "./queryClient";

export interface User {
  id: number;
  email: string;
  nome?: string;
  cargo?: string;
  role?: string;
  unidade?: string;
}

export interface LoginData {
  email: string;
  password: string;
}

export function useAuth() {
  // Use returnNull for auth check — App.tsx routing handles redirect to login
  const { data: user, isLoading } = useQuery<User | null>({
    queryKey: ["/api/auth/user"],
    queryFn: getQueryFn({ on401: "returnNull" }),
    retry: false,
  });

  return {
    user,
    isLoading,
    isAuthenticated: !!user,
  };
}

export function useLogin() {
  return useMutation({
    mutationFn: async (loginData: LoginData) => {
      const response = await apiRequest("POST", "/api/auth/login", loginData);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
    },
  });
}

export function useLogout() {
  return useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/auth/logout");
    },
    onSuccess: () => {
      // Remove o usuário do cache e invalida todas as queries
      queryClient.setQueryData(["/api/auth/user"], null);
      queryClient.clear(); // Limpa todo o cache para evitar dados stale
    },
  });
}
