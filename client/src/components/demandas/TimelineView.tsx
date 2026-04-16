import { useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LayoutList, CalendarDays, User } from "lucide-react";
import { format as formatDate } from "date-fns";
import { formatDateBR } from "@/lib/date-utils";
import { cn } from "@/lib/utils";
import type { Demanda, Colaborador } from "./types";
import { STATUS_LABEL } from "./types";
import { normalizeDateYmd, getResponsavelNome } from "./utils";

const PRIORIDADE_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  alta:  { bg: "#fee2e2", text: "#991b1b", border: "#ef4444" },
  media: { bg: "#fef9c3", text: "#854d0e", border: "#eab308" },
  baixa: { bg: "#dcfce7", text: "#166534", border: "#22c55e" },
};

export function TimelineView({ demandas, colaboradores }: { demandas: Demanda[]; colaboradores: Colaborador[] }) {
  const sorted = useMemo(() => {
    return [...demandas].sort((a, b) => {
      const da = normalizeDateYmd(a.dataEntrega) ?? "9999";
      const db = normalizeDateYmd(b.dataEntrega) ?? "9999";
      return da.localeCompare(db);
    });
  }, [demandas]);

  const todayStr = formatDate(new Date(), "yyyy-MM-dd");

  if (sorted.length === 0) {
    return (
      <Card>
        <CardContent className="py-16 text-center text-muted-foreground">
          <LayoutList className="h-10 w-10 mx-auto mb-3 opacity-40" />
          <p>Nenhuma demanda encontrada.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="relative space-y-1 pl-8 pt-2 pb-8">
      <div className="absolute left-[19px] top-0 bottom-0 w-0.5 bg-gradient-to-b from-blue-300 via-gray-200 to-gray-100 rounded-full" />
      {sorted.map((d, idx) => {
        const prazo = normalizeDateYmd(d.dataEntrega) ?? "";
        const inicio = normalizeDateYmd(d.dataInicio ?? "") ?? prazo;
        const isOverdue = prazo && prazo < todayStr && d.status !== "concluido" && d.status !== "cancelado";
        const isToday = prazo === todayStr;
        const isConcluido = d.status === "concluido";
        const isCancelado = d.status === "cancelado";
        const respNome = getResponsavelNome(d, colaboradores);
        const pc = PRIORIDADE_COLORS[d.prioridade] ?? PRIORIDADE_COLORS.baixa;
        const dotColor = isConcluido ? "#22c55e" : isCancelado ? "#94a3b8" : isOverdue ? "#ef4444" : isToday ? "#f59e0b" : "#3b82f6";

        return (
          <div key={d.id} className={cn("relative flex gap-4 group pb-6", idx === sorted.length - 1 ? "pb-0" : "")}>
            <div
              className="absolute -left-[21px] top-1.5 h-4 w-4 rounded-full border-2 border-white shadow-sm flex-shrink-0 z-10"
              style={{ backgroundColor: dotColor }}
            />
            <div className={cn(
              "flex-1 rounded-xl border shadow-sm p-4 transition-all hover:shadow-md",
              isConcluido ? "opacity-70" : "",
              isOverdue ? "border-l-4 border-l-red-400" : isToday ? "border-l-4 border-l-amber-400" : "border-l-4",
            )} style={{ borderLeftColor: isOverdue ? "#ef4444" : isToday ? "#f59e0b" : pc.border }}>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <Badge className="text-xs font-medium" style={{ backgroundColor: pc.bg, color: pc.text, border: `1px solid ${pc.border}` }}>
                      {d.prioridade.charAt(0).toUpperCase() + d.prioridade.slice(1)}
                    </Badge>
                    <Badge variant="outline" className="text-xs">{STATUS_LABEL[d.status]}</Badge>
                    {d.categoria && <Badge variant="secondary" className="text-xs">{d.categoria}</Badge>}
                    {isOverdue && <Badge className="text-xs bg-red-100 text-red-700 border-red-300">Atrasada</Badge>}
                    {isToday && <Badge className="text-xs bg-amber-100 text-amber-700 border-amber-300">Vence hoje</Badge>}
                  </div>
                  <h3 className={cn("font-semibold text-base leading-tight", isConcluido ? "line-through text-muted-foreground" : "")}>
                    {d.titulo}
                  </h3>
                  {d.descricao && <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{d.descricao}</p>}
                </div>
                <div className="text-right text-xs text-muted-foreground space-y-1 flex-shrink-0">
                  <div className="flex items-center gap-1 justify-end">
                    <CalendarDays className="h-3 w-3" />
                    {inicio !== prazo ? (
                      <span>{formatDateBR(inicio)} → {formatDateBR(prazo)}</span>
                    ) : (
                      <span>{formatDateBR(prazo)}</span>
                    )}
                  </div>
                  {respNome && (
                    <div className="flex items-center gap-1 justify-end">
                      <User className="h-3 w-3" />
                      <span>{respNome}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
