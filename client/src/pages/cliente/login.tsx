import { useState } from "react";
import { useLocation } from "wouter";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Building2, Lock, Mail, Loader2 } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import logoEcoBrasil from "@assets/Logo-padrao-a_1760382841154.png";

export default function ClienteLogin() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const loginMutation = useMutation({
    mutationFn: async (data: { email: string; password: string }) => {
      const response = await apiRequest("POST", "/api/cliente-auth/login", data);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Login realizado",
        description: "Bem-vindo ao Portal do Cliente!",
      });
      navigate("/cliente");
    },
    onError: (error: any) => {
      toast({
        title: "Erro no login",
        description: error?.message || "Email ou senha inválidos",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loginMutation.mutate({ email, password });
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-900 via-green-800 to-emerald-900 p-4">
      <Card className="w-full max-w-md bg-white/95 backdrop-blur-xl shadow-2xl">
        <CardHeader className="text-center space-y-4">
          <div className="flex justify-center">
            <img src={logoEcoBrasil} alt="EcoBrasil" className="h-16 w-auto" />
          </div>
          <div className="space-y-2">
            <CardTitle className="text-2xl font-bold text-gray-800">
              Portal do Cliente
            </CardTitle>
            <CardDescription className="text-gray-600">
              Acompanhe seus projetos e licenças ambientais
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-gray-700">Email</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  id="email"
                  type="email"
                  placeholder="seu@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-10"
                  required
                  data-testid="input-email"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="password" className="text-gray-700">Senha</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-10"
                  required
                  data-testid="input-password"
                />
              </div>
            </div>
            <Button 
              type="submit" 
              className="w-full bg-green-600 hover:bg-green-700"
              disabled={loginMutation.isPending}
              data-testid="button-login"
            >
              {loginMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Entrando...
                </>
              ) : (
                <>
                  <Building2 className="mr-2 h-4 w-4" />
                  Entrar
                </>
              )}
            </Button>
          </form>
          <div className="mt-6 text-center">
            <p className="text-sm text-gray-500">
              Acesso exclusivo para clientes ECOBRASIL
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
