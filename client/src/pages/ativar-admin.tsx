import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { ShieldCheck, Lock, CheckCircle, Loader2 } from "lucide-react";

export default function AtivarAdminPage() {
  const { toast } = useToast();
  const [password, setPassword] = useState("");
  const [success, setSuccess] = useState(false);

  const mutation = useMutation({
    mutationFn: async (pwd: string) => {
      const res = await apiRequest("POST", "/api/auth/promote-admin", { password: pwd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Erro ao ativar");
      return data;
    },
    onSuccess: (data) => {
      setSuccess(true);
      toast({ title: "Sucesso!", description: data.message });
    },
    onError: (err: Error) => {
      toast({ title: "Senha incorreta", description: err.message, variant: "destructive" });
    },
  });

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-100 to-green-50 px-4">
      <Card className="w-full max-w-md shadow-lg border-0">
        <CardHeader className="text-center pb-4">
          <div className="flex justify-center mb-3">
            <div className="p-3 bg-green-100 rounded-full">
              <ShieldCheck className="w-8 h-8 text-green-600" />
            </div>
          </div>
          <CardTitle className="text-xl">Ativar Perfil de Administrador</CardTitle>
          <CardDescription>
            Insira a senha de ativação para promover sua conta a administrador
          </CardDescription>
        </CardHeader>
        <CardContent>
          {success ? (
            <div className="text-center space-y-4 py-4">
              <div className="flex justify-center">
                <CheckCircle className="w-16 h-16 text-green-500" />
              </div>
              <p className="font-semibold text-green-700 text-lg">Perfil ativado com sucesso!</p>
              <p className="text-sm text-slate-500">
                Faça logout e login novamente para que as permissões de administrador sejam aplicadas.
              </p>
              <Button
                className="w-full bg-green-600 hover:bg-green-700"
                onClick={() => window.location.href = "/"}
              >
                Ir para o início
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="senha" className="flex items-center gap-2">
                  <Lock className="w-4 h-4" />
                  Senha de Ativação
                </Label>
                <Input
                  id="senha"
                  type="password"
                  placeholder="Digite a senha de ativação"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && password.trim()) mutation.mutate(password);
                  }}
                  autoFocus
                />
                <p className="text-xs text-slate-400">
                  Esta senha está nas configurações do sistema (ADMIN_UNLOCK_PASSWORD)
                </p>
              </div>

              <Button
                className="w-full bg-green-600 hover:bg-green-700"
                disabled={mutation.isPending || !password.trim()}
                onClick={() => mutation.mutate(password)}
              >
                {mutation.isPending ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Ativando...</>
                ) : (
                  <><ShieldCheck className="w-4 h-4 mr-2" />Ativar Administrador</>
                )}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
