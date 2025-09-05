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
        backgroundImage: `linear-gradient(rgba(0, 0, 0, 0.5), rgba(0, 0, 0, 0.5)), url(${amazonBackground})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat'
      }}
    >
      <Card className="w-full max-w-md shadow-2xl backdrop-blur-sm bg-white/95 border-0">
        <CardContent className="pt-8 pb-8 px-8">
          <div className="text-center mb-8">
            <img 
              src="http://ecobrasil.bio.br/wp-content/uploads/2017/02/Logo-padrao-a.png" 
              alt="EcoBrasil Logo" 
              className="mx-auto h-16 mb-4 bg-white rounded-lg px-3 py-1"
            />
            <h1 className="text-3xl font-bold text-primary mb-2">LicençaFácil</h1>
            <p className="text-muted-foreground">Sistema de Gestão de Licenças Ambientais</p>
            <div className="w-16 h-1 bg-primary mx-auto mt-3 rounded-full"></div>
          </div>
          
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <Label htmlFor="email" className="block text-sm font-medium text-card-foreground mb-2">
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
            
            <div>
              <Label htmlFor="password" className="block text-sm font-medium text-card-foreground mb-2">
                Senha
              </Label>
              <Input
                type="password"
                id="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                placeholder="••••••••"
                className="w-full"
                data-testid="input-password"
              />
            </div>
            
            {error && (
              <div className="text-destructive text-sm" data-testid="text-error">
                {error}
              </div>
            )}
            
            <Button 
              type="submit" 
              disabled={login.isPending}
              className="w-full font-medium bg-primary hover:bg-primary/90"
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
            <div className="text-xs text-muted-foreground bg-muted/50 rounded-lg p-3">
              <p className="font-medium mb-1">Demonstração</p>
              
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
