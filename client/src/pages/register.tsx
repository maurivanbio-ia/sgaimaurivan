import { useMemo, useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Eye, EyeOff, ArrowLeft, UserCircle } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import logoEcoBrasil from "@assets/Logo-padrao-a_1760382841154.png";
import registerBackground from "@assets/register-background-puma.png";

const DEFAULT_UNIDADE = "salvador";

// Se quiser liberar qualquer domínio, deixe [].
// Para restringir ao corporativo, mantenha como abaixo.
const ALLOWED_DOMAINS = ["ecobrasil.bio.br"] as const;

const normalizeEmail = (v: string) => v.trim().toLowerCase();

const getDomain = (email: string) => {
  const at = email.lastIndexOf("@");
  return at >= 0 ? email.slice(at + 1) : "";
};

// Política mínima: 10 chars + 3/4 classes (min/mai/número/símbolo)
const validatePassword = (password: string) => {
  const minLen = 10;
  if (password.length < minLen) return `A senha deve ter no mínimo ${minLen} caracteres`;

  const hasLower = /[a-z]/.test(password);
  const hasUpper = /[A-Z]/.test(password);
  const hasNumber = /\d/.test(password);
  const hasSymbol = /[^A-Za-z0-9]/.test(password);

  const score = [hasLower, hasUpper, hasNumber, hasSymbol].filter(Boolean).length;
  if (score < 3) return "Use pelo menos 3 destes: minúscula, maiúscula, número, símbolo";

  return null;
};

export default function Register() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const [email, setEmail] = useState("");
  const normalizedEmail = useMemo(() => normalizeEmail(email), [email]);

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  // Segurança: auto-registro não deve permitir perfis elevados.
  // Ideal: backend ignora "cargo" vindo do cliente e define "colaborador".
  // Aqui: travo o front para "colaborador".
  const [cargo] = useState<string>("colaborador");

  // Unidade fixa: removi estado e input hidden redundante.
  const unidade = DEFAULT_UNIDADE;

  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const passwordHint = useMemo(() => validatePassword(password), [password]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    const finalEmail = normalizeEmail(email);
    if (!finalEmail || !finalEmail.includes("@")) {
      setError("Informe um e-mail válido");
      return;
    }

    if (ALLOWED_DOMAINS.length > 0) {
      const domain = getDomain(finalEmail);
      if (!ALLOWED_DOMAINS.includes(domain as any)) {
        setError(`Use seu e-mail corporativo (@${ALLOWED_DOMAINS[0]})`);
        return;
      }
    }

    const pwdError = validatePassword(password);
    if (pwdError) {
      setError(pwdError);
      return;
    }

    if (password !== confirmPassword) {
      setError("As senhas não coincidem");
      return;
    }

    setIsLoading(true);
    try {
      await apiRequest("POST", "/api/auth/register", {
        email: finalEmail,
        password,
        unidade,
        cargo: cargo || "colaborador",
      });

      toast({
        title: "Conta criada com sucesso!",
        description: "Bem-vindo ao sistema!",
      });

      setLocation("/");
    } catch (err: any) {
      const message = err?.message || "Erro ao criar conta. Tente novamente.";
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen flex items-center justify-center p-4 overflow-hidden">
      <div
        className="absolute inset-0 z-0"
        style={{
          backgroundImage: `url(${registerBackground})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
          backgroundRepeat: "no-repeat",
          filter: "contrast(1.1) brightness(0.9) saturate(1.15)",
        }}
      >
        <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-black/20 to-black/40" />
      </div>

      <div className="absolute bottom-4 right-4 z-20 text-right">
        <p className="text-white/90 text-xs drop-shadow-[0_1px_3px_rgba(0,0,0,0.9)]">
          <em>Puma concolor</em> . onça-parda
        </p>
        <p className="text-white/80 text-xs drop-shadow-[0_1px_3px_rgba(0,0,0,0.9)]">
          Foto: Patrick Rodrigues
        </p>
      </div>

      <div className="relative z-10 w-full max-w-md">
        <Card className="w-full shadow-2xl backdrop-blur-lg bg-white/20 dark:bg-white/10 border border-white/30 dark:border-white/20">
          <CardContent className="pt-8 pb-8 px-8">
            <div className="text-center mb-8">
              <div className="bg-white/90 backdrop-blur-sm rounded-2xl p-4 mx-auto w-fit mb-6 shadow-lg">
                <img src={logoEcoBrasil} alt="EcoBrasil Logo" className="h-14 mx-auto" />
              </div>
              <p className="text-white/90 font-medium drop-shadow">Criar Nova Conta</p>
              <div className="w-20 h-1 bg-gradient-to-r from-[#00599C] to-[#B2CDE1] mx-auto mt-4 rounded-full shadow-sm" />
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <Label
                  htmlFor="email"
                  className="block text-sm font-medium text-white mb-2 drop-shadow"
                >
                  E-mail corporativo
                </Label>
                <Input
                  type="email"
                  id="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={isLoading}
                  placeholder={`seu@${ALLOWED_DOMAINS[0] ?? "empresa.com.br"}`}
                  className="w-full bg-white/20 backdrop-blur-sm border-white/30 text-white placeholder:text-white/70 focus:bg-white/30 focus:border-white/50"
                  data-testid="input-email"
                />
                {email && (
                  <p className="text-xs text-white/70 mt-2">
                    Será registrado como:{" "}
                    <span className="font-medium text-white/90">{normalizedEmail}</span>
                  </p>
                )}
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
                    type={showPassword ? "text" : "password"}
                    id="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    disabled={isLoading}
                    placeholder="••••••••••"
                    className="w-full bg-white/20 backdrop-blur-sm border-white/30 text-white placeholder:text-white/70 focus:bg-white/30 focus:border-white/50 pr-10"
                    data-testid="input-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-3 top-2.5 text-white/80 hover:text-white"
                    aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                    aria-pressed={showPassword}
                    disabled={isLoading}
                    data-testid="button-toggle-password"
                  >
                    {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                </div>

                {passwordHint ? (
                  <p className="text-xs text-white/80 mt-2">{passwordHint}</p>
                ) : password ? (
                  <p className="text-xs text-emerald-200 mt-2">Senha forte o suficiente</p>
                ) : (
                  <p className="text-xs text-white/70 mt-2">
                    Mínimo 10 caracteres. Use 3 destes: minúscula, maiúscula, número, símbolo.
                  </p>
                )}
              </div>

              <div>
                <Label
                  htmlFor="confirmPassword"
                  className="block text-sm font-medium text-white mb-2 drop-shadow"
                >
                  Confirmar Senha
                </Label>
                <div className="relative">
                  <Input
                    type={showConfirmPassword ? "text" : "password"}
                    id="confirmPassword"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    disabled={isLoading}
                    placeholder="••••••••••"
                    className="w-full bg-white/20 backdrop-blur-sm border-white/30 text-white placeholder:text-white/70 focus:bg-white/30 focus:border-white/50 pr-10"
                    data-testid="input-confirm-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword((v) => !v)}
                    className="absolute right-3 top-2.5 text-white/80 hover:text-white"
                    aria-label={showConfirmPassword ? "Ocultar confirmação de senha" : "Mostrar confirmação de senha"}
                    aria-pressed={showConfirmPassword}
                    disabled={isLoading}
                    data-testid="button-toggle-confirm-password"
                  >
                    {showConfirmPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                </div>
              </div>

              <div>
                <Label
                  htmlFor="cargo"
                  className="block text-sm font-medium text-white mb-2 drop-shadow"
                >
                  <UserCircle className="h-4 w-4 inline mr-2" />
                  Cargo
                </Label>

                {/* Travado por segurança: auto-registro apenas colaborador */}
                <Select value={cargo} onValueChange={() => {}} disabled>
                  <SelectTrigger
                    className="w-full bg-white/20 backdrop-blur-sm border-white/30 text-white focus:bg-white/30 focus:border-white/50"
                    data-testid="select-cargo"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="colaborador">Colaborador(a)</SelectItem>
                  </SelectContent>
                </Select>

                <p className="text-xs text-white/70 mt-2">
                  Perfis avançados devem ser atribuídos pelo administrador.
                </p>
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
                data-testid="button-register"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Criando conta...
                  </>
                ) : (
                  "Criar Conta"
                )}
              </Button>

              <div className="text-center">
                <button
                  type="button"
                  onClick={() => setLocation("/login")}
                  className="text-sm text-[#B2CDE1] hover:text-white inline-flex items-center gap-2 underline"
                  disabled={isLoading}
                  data-testid="link-back-to-login"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Voltar para o login
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
