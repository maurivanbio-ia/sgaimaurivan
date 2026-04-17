import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { CalendarDays } from "lucide-react";
import type { Condicionante } from "@shared/schema";
import { diasParaVencer, STATUS_CONDICIONANTE } from "./types";

export function CronogramaTab({ licencaId }: { licencaId: number }) {
  const { data: condicionantes = [] } = useQuery<Condicionante[]>({
    queryKey: ["/api/licencas", licencaId, "condicionantes"],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/licencas/${licencaId}/condicionantes`);
      return res.json();
    },
  });

  const sorted = [...condicionantes].sort((a, b) =>
    new Date(a.prazo).getTime() - new Date(b.prazo).getTime()
  );

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Linha do tempo de vencimentos das condicionantes desta licença.
      </p>
      {sorted.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <CalendarDays className="h-12 w-12 mx-auto mb-4 opacity-30" />
          <p>Nenhuma condicionante para exibir no cronograma.</p>
        </div>
      ) : (
        <div className="relative">
          <div className="absolute left-16 top-0 bottom-0 w-px bg-border" />
          <div className="space-y-4">
            {sorted.map(cond => {
              const dataVenc = new Date(cond.prazo + "T00:00:00");
              const dias = diasParaVencer(cond.prazo);
              const atrasado = dias !== null && dias < 0 && cond.status !== "cumprida";
              const st = STATUS_CONDICIONANTE[cond.status] || STATUS_CONDICIONANTE.pendente;
              const StatusIcon = st.icon;

              return (
                <div key={cond.id} className="flex items-start gap-4 pl-4">
                  <div className="w-12 text-right text-xs text-muted-foreground flex-shrink-0 pt-1">
                    {dataVenc.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}
                  </div>
                  <div className={`relative z-10 flex-shrink-0 mt-1 w-4 h-4 rounded-full border-2 ${
                    cond.status === "cumprida" ? "bg-green-500 border-green-500" :
                    atrasado ? "bg-red-500 border-red-500" :
                    "bg-background border-primary"
                  }`} />
                  <Card className={`flex-1 ${atrasado ? "border-red-200" : cond.status === "cumprida" ? "border-green-200" : ""}`}>
                    <CardContent className="p-3">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="font-medium text-sm">
                            {(cond as any).codigo && <code className="mr-2 text-xs bg-muted px-1 rounded">{(cond as any).codigo}</code>}
                            {(cond as any).titulo || cond.descricao.substring(0, 60)}
                          </div>
                          {(cond as any).responsavelNome && (
                            <div className="text-xs text-muted-foreground mt-0.5">Resp.: {(cond as any).responsavelNome}</div>
                          )}
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <Badge className={`text-xs ${st.color} gap-1`}>
                            {StatusIcon && <StatusIcon className="h-3 w-3" />}
                            {st.label}
                          </Badge>
                          {atrasado && <Badge variant="destructive" className="text-xs">{Math.abs(dias!)}d atraso</Badge>}
                          {!atrasado && dias !== null && dias <= 7 && cond.status !== "cumprida" && (
                            <Badge className="bg-orange-100 text-orange-800 text-xs">Urgente</Badge>
                          )}
                        </div>
                      </div>
                      <Progress value={(cond as any).progresso || 0} className="h-1.5 mt-2" />
                    </CardContent>
                  </Card>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
