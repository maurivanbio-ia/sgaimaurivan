import { Progress } from "@/components/ui/progress";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, AlertCircle, Clock } from "lucide-react";
import type { Condicionante } from "@shared/schema";
import { diasParaVencer } from "./types";

export function PainelConformidade({ condicionantes }: { condicionantes: Condicionante[] }) {
  const total = condicionantes.length;
  const cumpridas = condicionantes.filter(c => c.status === "cumprida").length;
  const emAndamento = condicionantes.filter(c => c.status === "em_andamento").length;
  const pendentes = condicionantes.filter(c => c.status === "pendente").length;
  const vencidas = condicionantes.filter(c => c.status === "vencida").length;
  const conformidade = total > 0 ? Math.round((cumpridas / total) * 100) : 0;

  const vencendo7 = condicionantes.filter(c => {
    if (c.status === "cumprida" || c.status === "vencida") return false;
    const dias = diasParaVencer(c.prazo);
    return dias !== null && dias >= 0 && dias <= 7;
  }).length;

  const vencendo15 = condicionantes.filter(c => {
    if (c.status === "cumprida" || c.status === "vencida") return false;
    const dias = diasParaVencer(c.prazo);
    return dias !== null && dias >= 0 && dias <= 15;
  }).length;

  const vencendo30 = condicionantes.filter(c => {
    if (c.status === "cumprida" || c.status === "vencida") return false;
    const dias = diasParaVencer(c.prazo);
    return dias !== null && dias >= 0 && dias <= 30;
  }).length;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <Card className="border-l-4 border-l-slate-400">
          <CardContent className="p-3 text-center">
            <div className="text-2xl font-bold">{total}</div>
            <div className="text-xs text-muted-foreground">Total</div>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-green-500">
          <CardContent className="p-3 text-center">
            <div className="text-2xl font-bold text-green-600">{cumpridas}</div>
            <div className="text-xs text-muted-foreground">Cumpridas</div>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-blue-500">
          <CardContent className="p-3 text-center">
            <div className="text-2xl font-bold text-blue-600">{emAndamento}</div>
            <div className="text-xs text-muted-foreground">Em Andamento</div>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-yellow-500">
          <CardContent className="p-3 text-center">
            <div className="text-2xl font-bold text-yellow-600">{pendentes}</div>
            <div className="text-xs text-muted-foreground">Pendentes</div>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-red-500">
          <CardContent className="p-3 text-center">
            <div className="text-2xl font-bold text-red-600">{vencidas}</div>
            <div className="text-xs text-muted-foreground">Vencidas</div>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-purple-500">
          <CardContent className="p-3 text-center">
            <div className="text-2xl font-bold text-purple-600">{conformidade}%</div>
            <div className="text-xs text-muted-foreground">Conformidade</div>
          </CardContent>
        </Card>
      </div>

      {total > 0 && (
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span>Progresso de Conformidade</span>
            <span className="font-semibold">{cumpridas} de {total} cumpridas</span>
          </div>
          <Progress value={conformidade} className="h-3" />
        </div>
      )}

      {(vencendo7 > 0 || vencendo15 > 0 || vencendo30 > 0) && (
        <div className="flex flex-wrap gap-2">
          {vencendo7 > 0 && (
            <Badge variant="destructive" className="gap-1">
              <AlertTriangle className="h-3 w-3" />
              {vencendo7} vencendo em 7 dias
            </Badge>
          )}
          {vencendo15 > 0 && (
            <Badge className="gap-1 bg-orange-100 text-orange-800 hover:bg-orange-100">
              <AlertCircle className="h-3 w-3" />
              {vencendo15} vencendo em 15 dias
            </Badge>
          )}
          {vencendo30 > 0 && (
            <Badge className="gap-1 bg-yellow-100 text-yellow-800 hover:bg-yellow-100">
              <Clock className="h-3 w-3" />
              {vencendo30} vencendo em 30 dias
            </Badge>
          )}
        </div>
      )}
    </div>
  );
}
