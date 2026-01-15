import { useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Eye, EyeOff, Mail, Lock } from "lucide-react";
import { useLogin } from "@/lib/auth";
import logoEcoBrasil from "@assets/Logo-padrao-a_1760382841154.png";
import registerBackground from "@assets/register-background-puma.png";

export default function Login() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const loginMutation = useLogin();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    const trimmedEmail = email.trim().toLowerCase();
    if (!trimmedEmail || !trimmedEmail.includes("@")) {
      setError("Informe um e-mail válido");
      return;
    }

    if (!password) {
      setError("Informe sua senha");
      return;
    }

    try {
      await loginMutation.mutateAsync({ email: trimmedEmail, password });
      toast({ title: "Login realizado!", description: "Bem-vindo ao sistema!" });
      setLocation("/");
    } catch (err: any) {
      const message = err?.message || "Credenciais inválidas";
      setError(message.includes("401") ? "Email ou senha incorretos" : message);
    }
  };

  const isLoading = loginMutation.isPending;

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden"
      style={{
        backgroundImage: `url(${registerBackground})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
      }}
    >
      <div className="absolute inset-0 bg-gradient-to-br from-[#00599C]/60 via-[#003d6b]/50 to-[#204A2E]/60 backdrop-blur-[2px]" />

      <div className="relative z-10 w-full max-w-md">
        <Card className="bg-white/10 backdrop-blur-xl border border-white/20 shadow-2xl">
          <CardContent className="pt-8 pb-6 px-8">
            <div className="flex flex-col items-center mb-8">
              <div className="w-28 h-28 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center mb-4 shadow-lg border border-white/30">
                <img
                  src={logoEcoBrasil}
                  alt="EcoBrasil"
                  className="w-24 h-24 object-contain"
                />
              </div>
              <h1 className="text-2xl font-bold text-white text-center">
                EcoGestor
              </h1>
              <p className="text-white/80 text-sm text-center mt-1">
                Sistema de Gestão Ambiental
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-white/90 font-medium">
                  E-mail
                </Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/50" />
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pl-10 bg-white/10 border-white/30 text-white placeholder:text-white/50 focus:border-white/50 focus:ring-white/20"
                    placeholder="seu.email@ecobrasil.bio.br"
                    disabled={isLoading}
                    data-testid="input-email"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="password" className="text-white/90 font-medium">
                  Senha
                </Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/50" />
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-10 pr-10 bg-white/10 border-white/30 text-white placeholder:text-white/50 focus:border-white/50 focus:ring-white/20"
                    placeholder="••••••••"
                    disabled={isLoading}
                    data-testid="input-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-white/50 hover:text-white/80 transition-colors"
                    tabIndex={-1}
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>

              {error && (
                <div className="text-red-200 text-sm bg-red-500/20 backdrop-blur-sm border border-red-400/30 rounded-lg p-3">
                  {error}
                </div>
              )}

              <Button
                type="submit"
                disabled={isLoading}
                className="w-full font-medium bg-gradient-to-r from-[#00599C] to-[#204A2E] hover:from-[#004577] hover:to-[#15351F] text-white shadow-lg border-0 transition-all duration-300 hover:shadow-xl"
                data-testid="button-login"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Entrando...
                  </>
                ) : (
                  "Entrar"
                )}
              </Button>

              <div className="text-center">
                <button
                  type="button"
                  onClick={() => setLocation("/register")}
                  className="text-sm text-[#B2CDE1] hover:text-white inline-flex items-center gap-2 underline"
                  disabled={isLoading}
                  data-testid="link-create-account"
                >
                  Não tem conta? Criar conta
                </button>
              </div>
            </form>

            <div className="mt-6 text-center">
              <div className="text-xs text-white/80 bg-white/10 backdrop-blur-sm rounded-lg p-3 border border-white/20">
                <p className="font-medium">Criado por Maurivan Vaz Ribeiro</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
