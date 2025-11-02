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
import loginBackground from "@assets/image_1762101182539.png";

/**
 * EcoGestor . Tela de Login
 * Estilo: Escuro elegante . Realista e ambiental . Cinemático
 * Paleta institucional: #1E6146 (verde) . #00599C (azul)
 * Iluminação dinâmica: gradiente que se desloca lentamente + caustics em SVG
 * Acessibilidade: labels, foco visível, redução de animação respeitada
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
        description: "Bem-vindo ao sistema.",
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
    <div className="relative min-h-screen flex items-center justify-center overflow-hidden bg-[#0D1714]">
      {/* Imagem de fundo */}
      <div
        aria-hidden
        className="absolute inset-0 bg-cover bg-center bg-no-repeat"
        style={{
          backgroundImage: `url(${loginBackground})`,
        }}
      >
        <div className="absolute inset-0 bg-black/30" />
      </div>

      {/* Camada 2. “Caustics” aquáticas em SVG com animação lenta */}
      <svg
        className="pointer-events-none absolute inset-0 opacity-[0.10] mix-blend-screen"
        aria-hidden
      >
        <defs>
          <filter id="eco-caustics">
            <feTurbulence
              type="fractalNoise"
              baseFrequency="0.008"
              numOctaves="2"
              seed="3"
              result="noise"
            />
            <feColorMatrix
              in="noise"
              type="matrix"
              values="
                1 0 0 0 0
                0 1 0 0 0
                0 0 1 0 0
                0 0 0 0.7 0"
              result="softNoise"
            />
            <feDisplacementMap in="SourceGraphic" in2="softNoise" scale="20" />
          </filter>
        </defs>
        <rect
          width="100%"
          height="100%"
          fill="url(#eco-gradient)"
          filter="url(#eco-caustics)"
        />
        <defs>
          <linearGradient id="eco-gradient" x1="0" x2="1" y1="0" y2="1">
            <stop offset="0%" stopColor="#1E6146" stopOpacity="0.55" />
            <stop offset="100%" stopColor="#00599C" stopOpacity="0.55" />
          </linearGradient>
        </defs>
      </svg>

      {/* Camada 3. “Foco” de luz se movendo lentamente (cinematográfico) */}
      <div
        aria-hidden
        className="pointer-events-none absolute -inset-[20%] blur-[80px] opacity-60"
        style={{
          background:
            "radial-gradient(40% 60% at 20% 30%, rgba(0,89,156,0.25), transparent 60%), radial-gradient(40% 60% at 80% 70%, rgba(30,97,70,0.28), transparent 60%)",
          animation: "ecoLightSweep 40s ease-in-out infinite alternate",
        }}
      />

      {/* Respeito a prefers-reduced-motion */}
      <style>
        {`
          @media (prefers-reduced-motion: reduce) {
            .reduce-motion\\:none { animation: none !important; transition: none !important; }
          }
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

      {/* Cartão. Glassmorphism natural com borda institucional - Mais transparente */}
      <Card
        className="relative z-10 w-[92%] max-w-md rounded-3xl border shadow-2xl
                   bg-white/3 backdrop-blur-xl 
                   border-[color:rgba(30,97,70,0.25)]
                   [box-shadow:0_0_0_1px_rgba(0,89,156,0.08),0_25px_80px_rgba(0,0,0,0.35)]
                   animate-[ecoFadeUp_700ms_ease-out] reduce-motion:none"
      >
        <CardContent className="p-8 md:p-10">
          {/* Logo com realce sutil */}
          <div className="flex justify-center mb-7">
            <div className="relative">
              <img
                src={logoEcoBrasil}
                alt="EcoBrasil Consultoria"
                className="w-52 h-auto md:w-56 select-none"
                draggable={false}
              />
              <div
                className="pointer-events-none absolute inset-0 rounded-xl opacity-35 blur-2xl"
                style={{
                  background:
                    "linear-gradient(90deg, rgba(30,97,70,0.55), rgba(0,89,156,0.55))",
                }}
                aria-hidden
              />
            </div>
          </div>

          {/* Título e subtítulo */}
          <div className="text-center mb-8">
            <h1
              className="text-3xl md:text-4xl font-extrabold tracking-tight 
                         bg-clip-text text-transparent
                         [background-image:linear-gradient(90deg,#1E6146,#00599C)]"
            >
              EcoGestor
            </h1>
            <p className="text-sm text-neutral-300/90">
              Sistema de Gestão Ambiental
            </p>
          </div>

          {/* Formulário */}
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* E-mail */}
            <div className="transition-transform duration-300 hover:scale-[1.01]">
              <Label
                htmlFor="email"
                className="mb-2 block text-[0.9rem] font-medium text-neutral-200"
              >
                E-mail corporativo
              </Label>
              <Input
                id="email"
                type="email"
                inputMode="email"
                autoComplete="username"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="seu@ecobrasil.bio.br"
                className="bg-white/10 border-white/15 text-neutral-50 placeholder:text-neutral-400
                           focus-visible:ring-2 focus-visible:ring-[#1E6146]/50 focus-visible:border-[#1E6146]/40"
                data-testid="input-email"
                required
              />
            </div>

            {/* Senha */}
            <div className="transition-transform duration-300 hover:scale-[1.01]">
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
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="pr-11 bg-white/10 border-white/15 text-neutral-50 placeholder:text-neutral-400
                             focus-visible:ring-2 focus-visible:ring-[#00599C]/50 focus-visible:border-[#00599C]/40"
                  data-testid="input-password"
                  required
                />
                <button
                  type="button"
                  aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-2.5 text-neutral-400 hover:text-neutral-200 transition-colors"
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
                className="text-[#1E6146] hover:text-[#1E6146]/90 font-medium transition-colors"
              >
                Esqueceu a senha?
              </button>
            </div>

            {/* Erro */}
            {error && (
              <div className="text-red-300 bg-red-900/20 border border-red-800/60 px-4 py-2 rounded-lg text-sm">
                {error}
              </div>
            )}

            {/* Botão principal */}
            <Button
              type="submit"
              disabled={login.isPending}
              className="w-full py-6 text-base font-semibold
                         text-white
                         [background-image:linear-gradient(90deg,#1E6146,#00599C)]
                         hover:brightness-110 transition-all duration-300
                         shadow-[0_0_0_1px_rgba(255,255,255,0.06),0_10px_40px_rgba(0,0,0,0.35)]"
              data-testid="button-login"
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

            {/* Cadastro */}
            <div className="text-center">
              <p className="text-sm text-neutral-400 mb-2">
                Ainda não tem uma conta?
              </p>
              <button
                type="button"
                onClick={() => setLocation("/register")}
                className="text-[#00599C] hover:text-[#00599C]/90 font-medium transition-colors"
                data-testid="link-register"
              >
                Criar nova conta
              </button>
            </div>
          </form>

          {/* Rodapé */}
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
            <DialogTitle className="font-semibold [color:#1E6146]">
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
            className="bg-white/10 border-white/15 text-neutral-50 placeholder:text-neutral-400
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
