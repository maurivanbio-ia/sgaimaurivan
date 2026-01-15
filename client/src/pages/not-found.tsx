import { useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertCircle, ArrowLeft, Home } from "lucide-react";

export default function NotFound() {
  const [location, setLocation] = useLocation();
  const headingRef = useRef<HTMLHeadingElement | null>(null);

  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-muted/40 px-4">
      <Card className="w-full max-w-md">
        <CardContent className="pt-6 pb-8">
          <div className="flex items-start gap-3 mb-4">
            <AlertCircle className="h-10 w-10 text-destructive flex-shrink-0" />
            <div>
              <h1
                ref={headingRef}
                tabIndex={-1}
                className="text-2xl font-bold text-foreground outline-none"
              >
                Página não encontrada
              </h1>
              <p className="text-sm text-muted-foreground mt-1">
                O endereço <span className="font-mono">{location}</span> não existe ou foi removido.
              </p>
            </div>
          </div>

          <p className="text-sm text-muted-foreground mb-6">
            Verifique se o link está correto ou utilize uma das opções abaixo para continuar.
          </p>

          <div className="flex gap-2 justify-end">
            <Button
              variant="outline"
              onClick={() => window.history.back()}
              aria-label="Voltar para a página anterior"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Voltar
            </Button>

            <Button
              onClick={() => setLocation("/")}
              aria-label="Ir para a página inicial"
            >
              <Home className="h-4 w-4 mr-2" />
              Início
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
