import { useState } from "react";
import { useLogin } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";

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
    <div className="min-h-screen bg-gradient-to-br from-primary to-accent flex items-center justify-center p-4">
      <Card className="w-full max-w-md shadow-2xl">
        <CardContent className="pt-8 pb-8 px-8">
          <div className="text-center mb-8">
            <img 
              src="http://ecobrasil.bio.br/wp-content/uploads/2017/02/Logo-padrao-a.png" 
              alt="EcoBrasil Logo" 
              className="mx-auto h-16 mb-4"
            />
            <h1 className="text-2xl font-bold text-card-foreground">Acesso ao LicençaFácil</h1>
            <p className="text-muted-foreground mt-2">Sistema de Gestão de Licenças Ambientais</p>
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
              className="w-full font-medium"
              data-testid="button-login"
            >
              {login.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Entrando...
                </>
              ) : (
                "Entrar"
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
