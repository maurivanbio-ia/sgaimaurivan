import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { History } from "lucide-react";
import type { Condicionante } from "@shared/schema";
import { STATUS_CONDICIONANTE } from "./types";

export function HistoricoTab({ licencaId }: { licencaId: number }) {
  const { data: condicionantes = [] } = useQuery<Condicionante[]>({
    queryKey: ["/api/licencas", licencaId, "condicionantes"],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/licencas/${licencaId}/condicionantes`);
      return res.json();
    },
  });

  const eventos = condicionantes
    .map(c => ({
      id: c.id,
      titulo: (c as any).titulo || c.descricao.substring(0, 60),
      codigo: (c as any).codigo,
      status: c.status,
      data: c.criadoEm,
      tipo: "criação",
    }))
    .sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime());

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Registro de criações e alterações das condicionantes desta licença.
      </p>
      {eventos.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <History className="h-12 w-12 mx-auto mb-4 opacity-30" />
          <p>Nenhum registro de histórico disponível.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {eventos.map(ev => (
            <div key={ev.id} className="flex items-start gap-3 p-3 border rounded-lg text-sm">
              <div className="w-2 h-2 rounded-full bg-primary mt-1.5 flex-shrink-0" />
              <div className="flex-1">
                <div className="font-medium">
                  {ev.codigo && <code className="mr-2 text-xs bg-muted px-1 rounded">{ev.codigo}</code>}
                  {ev.titulo}
                </div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  Condicionante registrada • Status: {STATUS_CONDICIONANTE[ev.status]?.label}
                  {ev.data && ` • ${new Date(ev.data).toLocaleDateString("pt-BR")}`}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
