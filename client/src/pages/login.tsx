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
import logoEcoBrasil from "@assets/Logo-padrao-a_1760382841154.png";
import loginBackground from "@assets/login-background-correct.jpg";

/**
 * EcoGestor — Tela de Login
 * Tema: Escuro elegante, realista e ambiental. Cinemático.
 * Card com 90% de transparência real e fundo tratado profissionalmente.
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
        description: "Bem-vindo ao sistema EcoGestor.",
      });

      rememberMe
        ? localStorage.setItem("savedEmail", email)
        : localStorage.removeItem("savedEmail");

      setLocation("/selecionar-unidade");
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
        description: "Verifique sua caixa de entrada para redefinir a senha.",
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
    <div className="relative min-h-screen flex items-center justify-center overflow-hidden">
      {/* Fundo florestal tratado (cinematográfico e profissional) */}
      <div
        className="absolute inset-0 z-0"
        style={{
          backgroundImage: `url(${loginBackground})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
          backgroundRepeat: "no-repeat",
          filter:
            "contrast(1.15) brightness(0.85) saturate(1.2)",
        }}
      >
        <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-black/10 to-black/20" />
      </div>

      {/* Luz ambiental suave */}
      <div
        aria-hidden
        className="pointer-events-none absolute -inset-[20%] blur-[80px] opacity-50"
        style={{
          background:
            "radial-gradient(40% 60% at 20% 30%, rgba(0,89,156,0.25), transparent 60%), radial-gradient(40% 60% at 80% 70%, rgba(30,97,70,0.25), transparent 60%)",
          animation: "ecoLightSweep 45s ease-in-out infinite alternate",
        }}
      />

      <style>
        {`
          @keyframes ecoLightSweep {
            0% { transform: translateX(-8%) translateY(-4%); }
            100% { transform: translateX(8%) translateY(6%); }
          }
          @keyframes ecoFadeUp {
            0% { opacity: 0; transform: translateY(36px); }
            100% { opacity: 1; transform: translateY(0); }
          }
        `}
      </style>

      {/* Card com 90% de transparência */}
      <Card
        className="relative z-10 w-[92%] max-w-md rounded-3xl border shadow-2xl
                   bg-white/10 backdrop-blur-xl backdrop-saturate-[180%]
                   border-white/10
                   shadow-[0_8px_32px_rgba(0,0,0,0.3)]
                   animate-[ecoFadeUp_700ms_ease-out]"
      >
        {/* Brilho e reflexo sutil */}
        <div
          className="absolute inset-0 rounded-3xl bg-gradient-to-br from-white/5 to-transparent opacity-60 pointer-events-none"
          style={{
            backdropFilter: "blur(25px) saturate(200%) brightness(1.15)",
          }}
        />

        <CardContent className="p-8 md:p-10 relative z-10">
          {/* Logo */}
          <div className="flex justify-center mb-8">
            <img
              src={logoEcoBrasil}
              alt="EcoBrasil Consultoria"
              className="w-52 h-auto md:w-56 select-none drop-shadow-[0_0_25px_rgba(30,97,70,0.25)]"
              draggable={false}
            />
          </div>

          {/* Título */}
          <div className="text-center mb-8">
            <h1
              className="text-4xl font-extrabold tracking-tight bg-clip-text text-transparent
                         [background-image:linear-gradient(90deg,#1E6146,#00599C)]"
            >
              EcoGestor
            </h1>
            <p className="text-sm text-neutral-300/90">
              Sistema de Gestão Ambiental Integrada
            </p>
          </div>

          {/* Formulário */}
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <Label
                htmlFor="email"
                className="mb-2 block text-[0.9rem] font-medium text-neutral-200"
              >
                E-mail corporativo
              </Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="seu@ecobrasil.bio.br"
                className="bg-white/5 border-white/10 text-neutral-50 placeholder:text-neutral-400
                           focus-visible:ring-2 focus-visible:ring-[#1E6146]/50 focus-visible:border-[#1E6146]/40"
                required
              />
            </div>

            <div>
              <Label
                htmlFor="password"
                className="mb-2 block text-[0.9rem] font-medium text-neutral-200"
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
                  className="pr-11 bg-white/5 border-white/10 text-neutral-50 placeholder:text-neutral-400
                             focus-visible:ring-2 focus-visible:ring-[#00599C]/50 focus-visible:border-[#00599C]/40"
                  required
                />
                <button
                  type="button"
                  aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-2.5 text-neutral-400 hover:text-neutral-200 transition"
                >
                  {showPassword ? (
                    <EyeOff className="h-5 w-5" />
                  ) : (
                    <Eye className="h-5 w-5" />
                  )}
                </button>
              </div>
            </div>

            {/* Opções */}
            <div className="flex items-center justify-between text-neutral-300">
              <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
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
                className="text-[#1E6146] hover:text-[#1E6146]/90 font-medium transition"
              >
                Esqueceu a senha?
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
            <p className="text-sm text-neutral-400 mb-2">
              Ainda não tem uma conta?
            </p>
            <button
              type="button"
              onClick={() => setLocation("/register")}
              className="text-[#00599C] hover:text-[#00599C]/90 font-medium transition"
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
