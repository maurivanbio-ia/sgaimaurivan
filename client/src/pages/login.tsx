import { useState, useEffect } from "react";
import { useLogin } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Eye, EyeOff } from "lucide-react";
import amazonBackground from "@assets/ChatGPT Image 5 de set. de 2025, 10_28_07_1757078897714.png";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export default function Login() {
  // Estados principais
  const [email, setEmail] = useState("ecobrasil@ecobrasil.bio.br");
  const [password, setPassword] = useState("123456");
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  // Recuperação de senha
  const [isForgotOpen, setIsForgotOpen] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [isSending, setIsSending] = useState(false);

  const login = useLogin();
  const { toast } = useToast();

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
        description: "Bem-vindo ao LicençaFácil!",
      });

      // Salva e-mail se a opção estiver marcada
      if (rememberMe) {
        localStorage.setItem("savedEmail", email);
      } else {
        localStorage.removeItem("savedEmail");
      }
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
    <div
      className="min-h-screen flex items-center justify-center p-4 relative"
      style={{
        background: `
          linear-gradient(135deg, 
            rgba(0, 89, 156, 0.1) 0%, 
            rgba(178, 205, 225, 0.15) 25%,
            rgba(21, 53, 31, 0.1) 50%,
            rgba(32, 74, 46, 0.15) 75%,
            rgba(0, 89, 156, 0.1) 100%
          ),
          linear-gradient(45deg, 
            rgba(0, 89, 156, 0.05) 0%, 
            rgba(178, 205, 225, 0.1) 100%
          ),
          url(${amazonBackground})
        `,
        backgroundSize: "cover, cover, cover",
        backgroundPosition: "center, center, center",
        backgroundRepeat: "no-repeat, no-repeat, no-repeat",
      }}
    >
      {/* Login Form Card */}
      <div className="w-full max-w-md">
        <Card className="w-full shadow-2xl backdrop-blur-lg bg-white/20 dark:bg-white/10 border border-white/30 dark:border-white/20">
          <CardContent className="pt-8 pb-8 px-8">
            <div className="text-center mb-8">
              <div className="bg-white/90 backdrop-blur-sm rounded-2xl p-4 mx-auto w-fit mb-6 shadow-lg">
                <img
                  src="http://ecobrasil.bio.br/wp-content/uploads/2017/02/Logo-padrao-a.png"
                  alt="EcoBrasil Logo"
                  className="h-14 mx-auto"
                />
              </div>
              <h1 className="text-3xl font-bold text-white mb-2 drop-shadow-lg">
                LicençaFácil
              </h1>
              <p className="text-white/90 font-medium drop-shadow">
                Sistema de Gestão de Licenças Ambientais
              </p>
              <div className="w-20 h-1 bg-gradient-to-r from-[#00599C] to-[#B2CDE1] mx-auto mt-4 rounded-full shadow-sm"></div>
            </div>

            {/* Formulário de Login */}
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
                  placeholder="seu@ecobrasil.bio.br"
                  className="w-full bg-white/20 backdrop-blur-sm border-white/30 text-white placeholder:text-white/70 focus:bg-white/30 focus:border-white/50"
                />
              </div>

              {/* Campo de senha com botão de visualização */}
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
                    placeholder="••••••••"
                    className="w-full bg-white/20 backdrop-blur-sm border-white/30 text-white placeholder:text-white/70 focus:bg-white/30 focus:border-white/50 pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-2.5 text-white/80 hover:text-white"
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
              <div className="flex items-center justify-between text-white/90">
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="accent-[#00599C] w-4 h-4"
                  />
                  <span className="text-sm">Lembrar login</span>
                </label>

                <button
                  type="button"
                  onClick={() => setIsForgotOpen(true)}
                  className="text-sm text-[#B2CDE1] hover:text-white underline"
                >
                  Esqueceu a senha?
                </button>
              </div>

              {/* Mensagem de erro */}
              {error && (
                <div className="text-red-200 text-sm bg-red-500/20 backdrop-blur-sm border border-red-400/30 rounded-lg p-3">
                  {error}
                </div>
              )}

              {/* Botão de login */}
              <Button
                type="submit"
                disabled={login.isPending}
                className="w-full font-medium bg-gradient-to-r from-[#00599C] to-[#204A2E] hover:from-[#004577] hover:to-[#15351F] text-white shadow-lg border-0 transition-all duration-300 hover:shadow-xl"
              >
                {login.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Entrando...
                  </>
                ) : (
                  "Entrar no Sistema"
                )}
              </Button>
            </form>

            {/* Rodapé */}
            <div className="mt-6 text-center">
              <div className="text-xs text-white/80 bg-white/10 backdrop-blur-sm rounded-lg p-3 border border-white/20">
                <p className="font-medium">Criado por Maurivan Vaz Ribeiro</p>
              </div>
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
