import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, Eye, EyeOff } from "lucide-react";
import amazonBackground from "@assets/ChatGPT Image 5 de set. de 2025, 10_28_07_1757078897714.png";

export default function ResetPassword() {
  const { toast } = useToast();

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  // Token normalmente vem via URL: /reset-password?token=XYZ
  const token = new URLSearchParams(window.location.search).get("token");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!password || !confirmPassword) {
      setError("Por favor, preencha todos os campos.");
      return;
    }

    if (password !== confirmPassword) {
      setError("As senhas não coincidem.");
      return;
    }

    try {
      setIsSubmitting(true);

      // Chamada à API real de redefinição
      const response = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });

      if (!response.ok) {
        throw new Error("Falha na redefinição de senha");
      }

      toast({
        title: "Senha redefinida com sucesso",
        description: "Agora você pode fazer login com sua nova senha.",
      });

      setPassword("");
      setConfirmPassword("");
    } catch {
      setError("Erro ao redefinir senha. O link pode ter expirado.");
    } finally {
      setIsSubmitting(false);
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
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
      }}
    >
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
                Redefinir Senha
              </h1>
              <p className="text-white/90 font-medium drop-shadow">
                Digite sua nova senha para continuar
              </p>
              <div className="w-20 h-1 bg-gradient-to-r from-[#00599C] to-[#B2CDE1] mx-auto mt-4 rounded-full shadow-sm"></div>
            </div>

            {/* Formulário de redefinição */}
            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <Label
                  htmlFor="password"
                  className="block text-sm font-medium text-white mb-2 drop-shadow"
                >
                  Nova senha
                </Label>
                <div className="relative">
                  <Input
                    type={showPassword ? "text" : "password"}
                    id="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    required
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

              <div>
                <Label
                  htmlFor="confirm-password"
                  className="block text-sm font-medium text-white mb-2 drop-shadow"
                >
                  Confirmar nova senha
                </Label>
                <div className="relative">
                  <Input
                    type={showConfirm ? "text" : "password"}
                    id="confirm-password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    className="w-full bg-white/20 backdrop-blur-sm border-white/30 text-white placeholder:text-white/70 focus:bg-white/30 focus:border-white/50 pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirm(!showConfirm)}
                    className="absolute right-3 top-2.5 text-white/80 hover:text-white"
                  >
                    {showConfirm ? (
                      <EyeOff className="h-5 w-5" />
                    ) : (
                      <Eye className="h-5 w-5" />
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
                disabled={isSubmitting}
                className="w-full font-medium bg-gradient-to-r from-[#00599C] to-[#204A2E] hover:from-[#004577] hover:to-[#15351F] text-white shadow-lg border-0 transition-all duration-300 hover:shadow-xl"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Redefinindo...
                  </>
                ) : (
                  "Redefinir Senha"
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
    </div>
  );
}
