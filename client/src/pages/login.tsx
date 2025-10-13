import { useState } from "react";
import { useLogin } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";
import amazonBackground from "@assets/ChatGPT Image 5 de set. de 2025, 10_28_07_1757078897714.png";

export default function Login() {
  const [email, setEmail] = useState("ecobrasil@ecobrasil.bio.br");
  const [password, setPassword] = useState("123456");
  const [error, setError] = useState("");
  
  const login = useLogin();
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    try {
      await login.mutateAsync({ email, password });
      toast({
        title: "Login realizado",
        description: "Bem-vindo ao LicençaFácil!",
      });
    } catch (error: any) {
      const message = error.message.includes("401") 
        ? "Usuário ou senha inválidos" 
        : "Erro ao fazer login. Tente novamente.";
      setError(message);
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
        backgroundSize: 'cover, cover, cover',
        backgroundPosition: 'center, center, center',
        backgroundRepeat: 'no-repeat, no-repeat, no-repeat'
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
            <h1 className="text-3xl font-bold text-white mb-2 drop-shadow-lg">LicençaFácil</h1>
            <p className="text-white/90 font-medium drop-shadow">Sistema de Gestão de Licenças Ambientais</p>
            <div className="w-20 h-1 bg-gradient-to-r from-[#00599C] to-[#B2CDE1] mx-auto mt-4 rounded-full shadow-sm"></div>
          </div>
          
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <Label htmlFor="email" className="block text-sm font-medium text-white mb-2 drop-shadow">
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
                data-testid="input-email"
              />
            </div>
            
            <div>
              <Label htmlFor="password" className="block text-sm font-medium text-white mb-2 drop-shadow">
                Senha
              </Label>
              <Input
                type="password"
                id="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                placeholder="••••••••"
                className="w-full bg-white/20 backdrop-blur-sm border-white/30 text-white placeholder:text-white/70 focus:bg-white/30 focus:border-white/50"
                data-testid="input-password"
              />
            </div>
            
            {error && (
              <div className="text-red-200 text-sm bg-red-500/20 backdrop-blur-sm border border-red-400/30 rounded-lg p-3" data-testid="text-error">
                {error}
              </div>
            )}
            
            <Button 
              type="submit" 
              disabled={login.isPending}
              className="w-full font-medium bg-gradient-to-r from-[#00599C] to-[#204A2E] hover:from-[#004577] hover:to-[#15351F] text-white shadow-lg border-0 transition-all duration-300 hover:shadow-xl"
              data-testid="button-login"
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
          
          <div className="mt-6 text-center">
            <div className="text-xs text-white/80 bg-white/10 backdrop-blur-sm rounded-lg p-3 border border-white/20">
              <p className="font-medium">Criado por Mauirvan Ribeiro</p>
            </div>
          </div>
        </CardContent>
        </Card>
      </div>
    </div>
  );
}
