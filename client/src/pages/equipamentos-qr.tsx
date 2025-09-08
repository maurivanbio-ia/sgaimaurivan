import { useRoute, Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

export default function QREquipamento() {
  const [match, params] = useRoute("/equipamentos/:id/qr");
  const id = params?.id;

  if (!match || !id) {
    return (
      <div className="container mx-auto py-8">
        <Card>
          <CardHeader>
            <CardTitle>QR Code não encontrado</CardTitle>
          </CardHeader>
          <CardContent>
            <Button asChild>
              <Link href="/equipamentos">Voltar à lista</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const qrUrl = `${window.location.origin}/equipamentos/${id}`;

  return (
    <div className="container mx-auto py-8 space-y-6" data-testid="page-qr-equipamento">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button asChild variant="ghost">
          <Link href={`/equipamentos/${id}`}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Voltar
          </Link>
        </Button>
        <div>
          <h1 className="text-3xl font-bold">QR Code do Equipamento</h1>
          <p className="text-muted-foreground mt-2">
            Escaneie o código para acessar este equipamento
          </p>
        </div>
      </div>

      {/* QR Code Card */}
      <Card>
        <CardHeader>
          <CardTitle>QR Code</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Placeholder for QR code - you can replace this with a real QR code library */}
          <div className="flex justify-center">
            <div className="p-6 border-2 border-dashed border-muted-foreground/50 rounded-lg text-center">
              <div className="w-48 h-48 bg-white border flex items-center justify-center text-xs text-gray-500">
                QR CODE
                <br />
                {id}
              </div>
            </div>
          </div>
          
          <div className="text-center space-y-2">
            <div className="text-sm text-muted-foreground">URL do equipamento:</div>
            <div className="text-sm font-mono break-all bg-muted p-2 rounded">
              {qrUrl}
            </div>
          </div>

          <div className="text-center text-xs text-muted-foreground">
            Para gerar um QR code real, instale uma biblioteca como 'qrcode.react' ou 'react-qr-code'
          </div>
        </CardContent>
      </Card>
    </div>
  );
}