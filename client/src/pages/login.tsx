import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useLogin } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import { Loader2, Eye, EyeOff } from "lucide-react";
import loginBackground from "@assets/bahia-de-todos-os-santos-grou-turismio_1776732662219.jpg";

/**
 * EcoGestor — Tela de Login (Card 100% Transparente)
 * Tema: Escuro, elegante e ambiental. Fundo cinematográfico realista.
 */
export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isForgotOpen, setIsForgotOpen] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [isSending, setIsSending] = useState(false);

  const login = useLogin();
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  useEffect(() => {
    const savedEmail = localStorage.getItem("savedEmail");
    if (savedEmail) {
      setEmail(savedEmail);
      setRememberMe(true);
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    try {
      await login.mutateAsync({ email, password });

      toast({
        title: "Login realizado",
        description: "Bem-vindo ao sistema SGAI.",
      });

      rememberMe
        ? localStorage.setItem("savedEmail", email)
        : localStorage.removeItem("savedEmail");

      setLocation("/dashboard");
    } catch (err: any) {
      setError(
        err?.message?.includes?.("401")
          ? "Usuário ou senha inválidos."
          : "Erro ao fazer login. Tente novamente."
      );
    }
  };

  const handleSendResetLink = async () => {
    if (!forgotEmail.trim()) return;
    setIsSending(true);
    try {
      await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: forgotEmail }),
      });

      toast({
        title: "E-mail enviado",
        description: "Verifique sua caixa de entrada.",
      });
      setIsForgotOpen(false);
      setForgotEmail("");
    } catch {
      toast({
        title: "Erro",
        description: "Não foi possível enviar o e-mail.",
        variant: "destructive",
      });
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="relative min-h-screen flex items-center justify-center overflow-hidden text-white">
      {/* Fundo florestal cinematográfico */}
      <div
        className="absolute inset-0 z-0"
        style={{
          backgroundImage: `url(${loginBackground})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
          filter: "contrast(1.2) brightness(0.8) saturate(1.2)",
        }}
      >
        <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-black/10 to-black/20" />
      </div>

      {/* Luz ambiental dinâmica */}
      <div
        aria-hidden
        className="pointer-events-none absolute -inset-[20%] blur-[80px] opacity-60"
        style={{
          background:
            "radial-gradient(40% 60% at 20% 30%, rgba(0,89,156,0.25), transparent 60%), radial-gradient(40% 60% at 80% 70%, rgba(30,97,70,0.25), transparent 60%)",
          animation: "ecoLightSweep 45s ease-in-out infinite alternate",
        }}
      />

      <style>
        {`
          @keyframes ecoLightSweep {
            0% { transform: translateX(-6%) translateY(-4%); }
            100% { transform: translateX(8%) translateY(6%); }
          }
          @keyframes ecoFadeUp {
            0% { opacity: 0; transform: translateY(36px); }
            100% { opacity: 1; transform: translateY(0); }
          }
        `}
      </style>

      {/* Card 100% transparente */}
      <Card
        className="relative z-10 w-[92%] max-w-md rounded-3xl border border-white/10
                   bg-transparent backdrop-blur-[20px] backdrop-saturate-[200%]
                   shadow-[0_10px_40px_rgba(0,0,0,0.4)]
                   animate-[ecoFadeUp_800ms_ease-out]"
      >
        {/* Contorno sutil luminoso */}
        <div className="absolute inset-0 rounded-3xl border border-white/10 backdrop-blur-2xl" />

        <CardContent className="p-8 md:p-10 relative z-10">
          {/* Título */}
          <div className="text-center mb-8">
            <h1
              className="text-4xl font-extrabold tracking-tight text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.8)]"
              style={{
                textShadow: "0 2px 10px rgba(0,0,0,0.9), 0 0 25px rgba(255,255,255,0.25)",
              }}
            >
              SGAI
            </h1>
            <p className="text-sm text-white/90 font-medium">
              Sistema de Gestão Ambiental Integrada
            </p>
          </div>

          {/* Formulário */}
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <Label
                htmlFor="email"
                className="mb-2 block text-[0.9rem] font-semibold text-white"
              >
                E-mail corporativo
              </Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="seu@ecobrasil.bio.br"
                className="bg-black/40 border-white/20 text-white placeholder:text-neutral-300
                           focus-visible:ring-2 focus-visible:ring-[#1E6146]/70 focus-visible:border-[#1E6146]/60"
                required
              />
            </div>

            <div>
              <Label
                htmlFor="password"
                className="mb-2 block text-[0.9rem] font-semibold text-white"
              >
                Senha
              </Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="pr-11 bg-black/40 border-white/20 text-white placeholder:text-neutral-300
                             focus-visible:ring-2 focus-visible:ring-[#00599C]/70 focus-visible:border-[#00599C]/60"
                  required
                />
                <button
                  type="button"
                  aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-2.5 text-white/80 hover:text-white transition"
                >
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
            </div>

            {/* Opções */}
            <div className="flex items-center justify-between text-white">
              <label className="flex items-center gap-2 text-sm cursor-pointer select-none font-medium">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="w-4 h-4 accent-[#1E6146]"
                />
                <span>Lembrar login</span>
              </label>
              <button
                type="button"
                onClick={() => setIsForgotOpen(true)}
                className="text-sm underline underline-offset-2 hover:text-neutral-200 transition font-medium"
              >
                Esqueci minha senha
              </button>
            </div>

            {error && (
              <div className="text-red-300 bg-red-900/20 border border-red-800/60 px-4 py-2 rounded-lg text-sm">
                {error}
              </div>
            )}

            {/* Botão principal */}
            <Button
              type="submit"
              disabled={login.isPending}
              className="w-full py-6 text-base font-semibold text-white
                         [background-image:linear-gradient(90deg,#1E6146,#00599C)]
                         hover:brightness-110 transition-all duration-300
                         shadow-[0_0_0_1px_rgba(255,255,255,0.06),0_10px_40px_rgba(0,0,0,0.35)]"
            >
              {login.isPending ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Entrando...
                </>
              ) : (
                "Entrar no Sistema"
              )}
            </Button>
          </form>

          <div className="text-center mt-6">
            <p className="text-sm text-white/90 mb-2">Ainda não tem uma conta?</p>
            <button
              type="button"
              onClick={() => setLocation("/register")}
              className="text-white font-semibold underline underline-offset-2 hover:text-neutral-200 transition"
            >
              Criar nova conta
            </button>
          </div>

          <div className="mt-8 text-center">
            <p className="text-[11px] tracking-wide text-neutral-400">
              Desenvolvido por <span className="text-neutral-200">Maurivan Vaz Ribeiro</span>
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Modal de recuperação */}
      <Dialog open={isForgotOpen} onOpenChange={setIsForgotOpen}>
        <DialogContent className="bg-[#0E1B17]/90 text-white border border-white/10 backdrop-blur-xl rounded-2xl">
          <DialogHeader>
            <DialogTitle className="font-semibold text-[#1E6146]">
              Recuperar senha
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm mb-4 text-neutral-300">
            Digite seu e-mail corporativo para receber o link de redefinição.
          </p>
          <Input
            type="email"
            value={forgotEmail}
            onChange={(e) => setForgotEmail(e.target.value)}
            placeholder="seu@ecobrasil.bio.br"
            className="bg-white/5 border-white/10 text-neutral-50 placeholder:text-neutral-400
                       focus-visible:ring-2 focus-visible:ring-[#1E6146]/50 focus-visible:border-[#1E6146]/40"
          />
          <Button
            onClick={handleSendResetLink}
            disabled={isSending}
            className="w-full mt-4 text-white
                       [background-image:linear-gradient(90deg,#00599C,#1E6146)]
                       hover:brightness-110 transition-all duration-300"
          >
            {isSending ? "Enviando..." : "Enviar link de recuperação"}
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}
