import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { Eye, EyeOff, Loader2, ArrowRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

import logoEcoBrasil from "@assets/Logo-padrao-a_1760382841154.png";
import loginBackground from "@assets/register-background-puma.png";

const loginSchema = z.object({
  email: z
    .string()
    .min(1, "E-mail obrigatório")
    .email("E-mail inválido")
    .refine((v) => v.toLowerCase().endsWith("@ecobrasil.bio.br"), {
      message: "Use seu e-mail corporativo (@ecobrasil.bio.br)",
    }),
  password: z.string().min(1, "Senha obrigatória"),
});

type LoginValues = z.infer<typeof loginSchema>;

export default function Login() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
    },
    mode: "onChange",
  });

  const email = form.watch("email");
  const password = form.watch("password");

  const canSubmit = useMemo(() => {
    return Boolean(email?.trim()) && Boolean(password?.trim()) && form.formState.isValid;
  }, [email, password, form.formState.isValid]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        form.clearErrors();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [form]);

  const onSubmit = async (values: LoginValues) => {
    if (isSubmitting) return;
    setIsSubmitting(true);

    try {
      await apiRequest("POST", "/api/auth/login", {
        email: values.email.trim().toLowerCase(),
        password: values.password,
      });

      toast({
        title: "Login realizado",
        description: "Bem-vindo ao sistema.",
      });

      setLocation("/");
    } catch (error: any) {
      const message =
        error?.message ||
        "Não foi possível entrar. Verifique e-mail e senha e tente novamente.";

      toast({
        title: "Falha no login",
        description: message,
        variant: "destructive",
      });

      form.setError("password", { message: "Verifique sua senha" });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="relative min-h-screen flex items-center justify-center p-4 overflow-hidden">
      {/* Fundo */}
      <div
        className="absolute inset-0 z-0"
        style={{
          backgroundImage: `url(${loginBackground})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
          backgroundRepeat: "no-repeat",
          filter: "contrast(1.1) brightness(0.9) saturate(1.15)",
        }}
      >
        <div className="absolute inset-0 bg-gradient-to-b from-black/35 via-black/25 to-black/45" />
      </div>

      <div className="relative z-10 w-full max-w-md">
        <Card className="w-full shadow-2xl backdrop-blur-lg bg-white/20 dark:bg-white/10 border border-white/30 dark:border-white/20">
          <CardContent className="pt-8 pb-8 px-8">
            <div className="text-center mb-8">
              <div className="bg-white/90 backdrop-blur-sm rounded-2xl p-4 mx-auto w-fit mb-6 shadow-lg">
                <img src={logoEcoBrasil} alt="EcoBrasil Logo" className="h-14 mx-auto" />
              </div>

              <p className="text-white/90 font-medium drop-shadow">Acessar o sistema</p>
              <div className="w-20 h-1 bg-gradient-to-r from-[#00599C] to-[#B2CDE1] mx-auto mt-4 rounded-full shadow-sm" />
            </div>

            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <div>
                <Label
                  htmlFor="email"
                  className="block text-sm font-medium text-white mb-2 drop-shadow"
                >
                  E-mail corporativo
                </Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="seu@ecobrasil.bio.br"
                  className="w-full bg-white/20 backdrop-blur-sm border-white/30 text-white placeholder:text-white/70 focus:bg-white/30 focus:border-white/50"
                  autoComplete="email"
                  inputMode="email"
                  {...form.register("email")}
                  data-testid="input-login-email"
                />
                {form.formState.errors.email?.message ? (
                  <p className="mt-2 text-xs text-red-200">
                    {form.formState.errors.email.message}
                  </p>
                ) : null}
              </div>

              <div>
                <Label
                  htmlFor="password"
                  className="block text-sm font-medium text-white mb-2 drop-shadow"
                >
                  Senha
                </Label>

                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    className="w-full bg-white/20 backdrop-blur-sm border-white/30 text-white placeholder:text-white/70 focus:bg-white/30 focus:border-white/50 pr-10"
                    autoComplete="current-password"
                    {...form.register("password")}
                    data-testid="input-login-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((s) => !s)}
                    className="absolute right-3 top-2.5 text-white/80 hover:text-white"
                    aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                    data-testid="button-toggle-login-password"
                  >
                    {showPassword ? (
                      <EyeOff className="h-5 w-5" />
                    ) : (
                      <Eye className="h-5 w-5" />
                    )}
                  </button>
                </div>

                {form.formState.errors.password?.message ? (
                  <p className="mt-2 text-xs text-red-200">
                    {form.formState.errors.password.message}
                  </p>
                ) : null}
              </div>

              <Button
                type="submit"
                disabled={!canSubmit || isSubmitting}
                className="w-full font-medium bg-gradient-to-r from-[#00599C] to-[#204A2E] hover:from-[#004577] hover:to-[#15351F] text-white shadow-lg border-0 transition-all duration-300 hover:shadow-xl disabled:opacity-70"
                data-testid="button-login"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Entrando...
                  </>
                ) : (
                  <>
                    Entrar
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </>
                )}
              </Button>

              <div className="flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setLocation("/register")}
                  className="text-sm text-[#B2CDE1] hover:text-white underline"
                  data-testid="link-go-register"
                >
                  Criar conta
                </button>

                <button
                  type="button"
                  onClick={() => toast({ title: "Recuperação de senha", description: "Fale com o administrador para redefinir sua senha." })}
                  className="text-sm text-[#B2CDE1] hover:text-white underline"
                  data-testid="link-forgot-password"
                >
                  Esqueci minha senha
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
