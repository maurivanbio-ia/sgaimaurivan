import { useState, useEffect } from "react";
import { useLogin } from "@/lib/auth";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Eye, EyeOff } from "lucide-react";
import logoEcoBrasil from "@assets/Logo-padrao-a_1760382841154.png";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export default function Login() {
  // Estados principais
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  // Recuperação de senha
  const [isForgotOpen, setIsForgotOpen] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [isSending, setIsSending] = useState(false);

  const login = useLogin();
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  // Recupera e-mail salvo, se houver
  useEffect(() => {
    const savedEmail = localStorage.getItem("savedEmail");
    if (savedEmail) {
      setEmail(savedEmail);
      setRememberMe(true);
    }
  }, []);

  // Função principal de login
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    try {
      await login.mutateAsync({ email, password });

      toast({
        title: "Login realizado",
        description: "Bem-vindo ao sistema!",
      });

      // Salva e-mail se a opção estiver marcada
      if (rememberMe) {
        localStorage.setItem("savedEmail", email);
      } else {
        localStorage.removeItem("savedEmail");
      }

      // Redireciona para seleção de unidade
      setLocation("/selecionar-unidade");
    } catch (error: any) {
      const message = error.message?.includes("401")
        ? "Usuário ou senha inválidos"
        : "Erro ao fazer login. Tente novamente.";
      setError(message);
    }
  };

  // Função para envio de recuperação de senha
  const handleSendResetLink = async () => {
    if (!forgotEmail) return;

    setIsSending(true);
    try {
      // Exemplo de chamada de API (substitua pela sua rota real)
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
    } catch {
      toast({
        title: "Erro",
        description:
          "Não foi possível enviar o e-mail. Verifique o endereço informado.",
        variant: "destructive",
      });
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 dark:from-black dark:via-gray-900 dark:to-black">
      <div className="w-full max-w-md">
        <Card className="w-full shadow-2xl backdrop-blur-2xl bg-white/80 dark:bg-gray-900/80 border-2 border-white/30 dark:border-white/10 rounded-3xl">
          <CardContent className="pt-8 pb-8 px-8">
            {/* Logo centrado e maior */}
            <div className="flex justify-center mb-6">
              <img
                src={logoEcoBrasil}
                alt="EcoBrasil Consultoria"
                className="h-auto w-56"
                loading="eager"
              />
            </div>

            {/* Título */}
            <div className="text-center mb-8">
              <h1 className="text-3xl font-bold bg-gradient-to-r from-green-600 to-emerald-600 bg-clip-text text-transparent dark:from-green-400 dark:to-emerald-400 mb-2">
                Bem-vindo ao EcoGestor
              </h1>
              <p className="text-sm text-gray-600 dark:text-gray-400 font-medium">
                Sistema de Gestão Ambiental
              </p>
            </div>

            {/* Formulário de Login */}
            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <Label
                  htmlFor="email"
                  className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
                >
                  E-mail corporativo
                </Label>
                <Input
                  type="email"
                  id="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  placeholder="seu@ecobrasil.bio.br"
                  className="w-full"
                  data-testid="input-email"
                />
              </div>

              {/* Campo de senha com botão de visualização */}
              <div>
                <Label
                  htmlFor="password"
                  className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
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
                    placeholder="••••••••"
                    className="w-full pr-10"
                    data-testid="input-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-2.5 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                  >
                    {showPassword ? (
                      <EyeOff className="h-5 w-5" />
                    ) : (
                      <Eye className="h-5 w-5" />
                    )}
                  </button>
                </div>
              </div>

              {/* Checkbox e link de recuperação */}
              <div className="flex items-center justify-between text-gray-700 dark:text-gray-300">
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="accent-green-600 w-4 h-4"
                  />
                  <span className="text-sm">Lembrar login</span>
                </label>

                <button
                  type="button"
                  onClick={() => setIsForgotOpen(true)}
                  className="text-sm text-green-600 hover:text-green-700 dark:text-green-500 dark:hover:text-green-400 font-medium"
                >
                  Esqueceu a senha?
                </button>
              </div>

              {/* Mensagem de erro */}
              {error && (
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 px-4 py-3 rounded-lg text-sm">
                  {error}
                </div>
              )}

              {/* Botão de login */}
              <Button
                type="submit"
                disabled={login.isPending}
                className="w-full font-semibold bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white shadow-lg hover:shadow-xl transition-all duration-300 py-6 text-base"
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

              {/* Link para criar conta */}
              <div className="text-center">
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">Ainda não tem uma conta?</p>
                <button
                  type="button"
                  onClick={() => setLocation("/register")}
                  className="text-sm text-green-600 hover:text-green-700 dark:text-green-500 dark:hover:text-green-400 font-medium"
                  data-testid="link-register"
                >
                  Criar nova conta
                </button>
              </div>
            </form>

            {/* Rodapé */}
            <div className="mt-6 text-center">
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Criado por Maurivan Vaz Ribeiro
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Modal de recuperação de senha */}
      <Dialog open={isForgotOpen} onOpenChange={setIsForgotOpen}>
        <DialogContent className="bg-white/10 backdrop-blur-lg border border-white/20 text-white">
          <DialogHeader>
            <DialogTitle>Recuperar senha</DialogTitle>
          </DialogHeader>
          <p className="text-sm mb-4 text-white/80">
            Digite seu e-mail corporativo para receber o link de redefinição.
          </p>
          <Input
            type="email"
            value={forgotEmail}
            onChange={(e) => setForgotEmail(e.target.value)}
            placeholder="seu@ecobrasil.bio.br"
            className="bg-white/20 text-white placeholder:text-white/60"
          />
          <Button
            onClick={handleSendResetLink}
            disabled={isSending}
            className="w-full mt-4 bg-gradient-to-r from-[#00599C] to-[#204A2E]"
          >
            {isSending ? "Enviando..." : "Enviar link de recuperação"}
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}
