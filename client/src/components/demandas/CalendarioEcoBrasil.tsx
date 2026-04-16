import React, { useMemo } from "react";
import { Card, CardHeader, CardContent, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "lucide-react";
import {
  format as formatDate,
  parseISO,
  startOfMonth, endOfMonth,
  startOfWeek, endOfWeek,
  addDays, addMonths, subMonths,
  isSameMonth, isSameDay,
  eachDayOfInterval,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import type { Demanda, Colaborador } from "./types";
import { ECOBRASIL } from "./types";
import { normalizeDateYmd } from "./utils";

export function CalendarioEcoBrasil({
  demandas,
  colaboradores,
  monthDate,
  onPrevMonth,
  onNextMonth,
  exportRef,
  onView,
}: {
  demandas: Demanda[];
  colaboradores: Colaborador[];
  monthDate: Date;
  onPrevMonth: () => void;
  onNextMonth: () => void;
  exportRef: React.RefObject<HTMLDivElement>;
  onView?: (d: Demanda) => void;
}) {
  const monthStart = startOfMonth(monthDate);
  const monthEnd = endOfMonth(monthDate);
  const startDate = startOfWeek(monthStart, { locale: ptBR });
  const endDate = endOfWeek(monthEnd, { locale: ptBR });

  const rows: Date[][] = [];
  let day = startDate;
  while (day <= endDate) {
    const week: Date[] = [];
    for (let i = 0; i < 7; i++) { week.push(day); day = addDays(day, 1); }
    rows.push(week);
  }

  const byDate = useMemo(() => {
    const map = new Map<string, Demanda[]>();
    for (const d of demandas) {
      const dataEntregaYmd = normalizeDateYmd(d.dataEntrega);
      if (!dataEntregaYmd) continue;
      const dataFim = parseISO(dataEntregaYmd);
      const dataInicioYmd = d.dataInicio ? normalizeDateYmd(d.dataInicio) : null;
      const dataInicio = dataInicioYmd ? parseISO(dataInicioYmd) : dataFim;
      if (dataInicio <= dataFim) {
        const diasPeriodo = eachDayOfInterval({ start: dataInicio, end: dataFim });
        for (const dia of diasPeriodo) {
          const ymd = formatDate(dia, "yyyy-MM-dd");
          if (!map.has(ymd)) map.set(ymd, []);
          map.get(ymd)!.push(d);
        }
      } else {
        if (!map.has(dataEntregaYmd)) map.set(dataEntregaYmd, []);
        map.get(dataEntregaYmd)!.push(d);
      }
    }
    for (const [k, arr] of map.entries()) {
      arr.sort((a, b) => {
        const prio = { alta: 0, media: 1, baixa: 2 };
        return (prio[a.prioridade] ?? 9) - (prio[b.prioridade] ?? 9);
      });
      map.set(k, arr);
    }
    return map;
  }, [demandas]);

  const weekdays = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

  return (
    <Card className="mt-6">
      <CardHeader className="flex flex-row items-center justify-between gap-3">
        <div>
          <CardTitle className="text-xl flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Calendário de Demandas
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Destaque por prioridade. Exportável em PDF com layout EcoBrasil.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={onPrevMonth}>
            {formatDate(subMonths(monthDate, 1), "MMM yyyy", { locale: ptBR })}
          </Button>
          <Badge className="text-white" style={{ backgroundColor: ECOBRASIL.azulEscuro }}>
            {formatDate(monthDate, "MMMM 'de' yyyy", { locale: ptBR })}
          </Badge>
          <Button variant="outline" onClick={onNextMonth}>
            {formatDate(addMonths(monthDate, 1), "MMM yyyy", { locale: ptBR })}
          </Button>
        </div>
      </CardHeader>

      <CardContent>
        <div
          ref={exportRef}
          id="ecobrasil-calendar-export"
          style={{ borderRadius: "12px", border: `1px solid ${ECOBRASIL.cinzaClaro}`, overflow: "hidden", backgroundColor: "#ffffff", width: "100%" }}
        >
          <div style={{ backgroundColor: ECOBRASIL.azulEscuro, padding: "16px 20px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ color: "#ffffff" }}>
              <div style={{ fontSize: "18px", fontWeight: "600" }}>EcoBrasil Consultoria Ambiental</div>
              <div style={{ fontSize: "14px", opacity: 0.9 }}>Calendário de Demandas - {formatDate(monthDate, "MMMM yyyy", { locale: ptBR })}</div>
            </div>
            <div style={{ color: "#ffffff", fontSize: "13px", opacity: 0.9 }}>
              Gerado em {formatDate(new Date(), "dd/MM/yyyy HH:mm", { locale: ptBR })}
            </div>
          </div>

          <table style={{ width: "100%", borderCollapse: "collapse", tableLayout: "fixed" }}>
            <thead>
              <tr style={{ backgroundColor: ECOBRASIL.cinzaClaro }}>
                {weekdays.map((w) => (
                  <th key={w} style={{ padding: "8px 4px", fontSize: "12px", fontWeight: "600", textAlign: "center", color: ECOBRASIL.azulEscuro, border: "1px solid rgba(0,0,0,0.06)" }}>
                    {w}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((week, wi) => (
                <tr key={wi}>
                  {week.map((d, di) => {
                    const ymd = formatDate(d, "yyyy-MM-dd");
                    const list = byDate.get(ymd) ?? [];
                    const isToday = isSameDay(d, new Date());
                    const isOutside = !isSameMonth(d, monthStart);
                    return (
                      <td key={`${wi}-${di}`} style={{ minHeight: "100px", verticalAlign: "top", padding: "8px", backgroundColor: isToday ? "#e0f2fe" : "#ffffff", border: "1px solid rgba(0,0,0,0.08)", opacity: isOutside ? 0.4 : 1 }}>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "6px" }}>
                          <span style={{ fontSize: "14px", fontWeight: "700", color: ECOBRASIL.azulEscuro }}>
                            {formatDate(d, "d", { locale: ptBR })}
                          </span>
                          {list.length > 0 && (
                            <span style={{ fontSize: "10px", padding: "2px 6px", backgroundColor: ECOBRASIL.azulEscuro, borderRadius: "10px", color: "#ffffff", fontWeight: "600" }}>
                              {list.length}
                            </span>
                          )}
                        </div>
                        <div style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
                          {list.map((dem) => {
                            const todayYmd = formatDate(new Date(), "yyyy-MM-dd");
                            const entregaYmd = dem.dataEntrega ? normalizeDateYmd(dem.dataEntrega) : null;
                            const isDone = ["concluido", "cancelado"].includes(dem.status ?? "");
                            const isOverdue = !isDone && entregaYmd && entregaYmd < todayYmd;
                            const isVenceHoje = !isDone && entregaYmd === todayYmd;
                            const borderColor = isOverdue ? "#dc2626" : isVenceHoje ? "#f59e0b" : dem.prioridade === "alta" ? "#dc2626" : dem.prioridade === "media" ? "#ca8a04" : "#16a34a";
                            const bgColor = isOverdue ? "#fef2f2" : isVenceHoje ? "#fffbeb" : dem.prioridade === "alta" ? "#fef2f2" : dem.prioridade === "media" ? "#fefce8" : "#f0fdf4";
                            return (
                              <div
                                key={dem.id}
                                onClick={() => onView?.(dem)}
                                title={dem.titulo}
                                style={{ backgroundColor: bgColor, borderLeft: `3px solid ${borderColor}`, borderRadius: "3px", padding: "2px 5px", fontSize: "10px", lineHeight: "1.4", border: isOverdue ? `1px solid #fca5a5` : isVenceHoje ? `1px solid #fde68a` : `1px solid ${borderColor}22`, borderLeftWidth: "3px", borderLeftColor: borderColor, cursor: onView ? "pointer" : "default", display: "flex", alignItems: "center", gap: "3px", overflow: "hidden", transition: "filter 0.12s" }}
                                onMouseEnter={e => { if (onView) e.currentTarget.style.filter = "brightness(0.93)"; }}
                                onMouseLeave={e => { e.currentTarget.style.filter = ""; }}
                              >
                                {isOverdue && <span style={{ fontSize: "9px", flexShrink: 0 }}>⚠</span>}
                                {isVenceHoje && !isOverdue && <span style={{ fontSize: "9px", flexShrink: 0 }}>⚡</span>}
                                <span style={{ fontWeight: "600", color: isOverdue ? "#991b1b" : ECOBRASIL.azulEscuro, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1, textDecoration: isDone ? "line-through" : "none" }}>
                                  {dem.titulo}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>

          <div style={{ padding: "12px 20px", backgroundColor: "#ffffff", borderTop: "1px solid rgba(0,0,0,0.06)", display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: "11px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "16px", flexWrap: "wrap" }}>
              <span style={{ fontWeight: "600", color: ECOBRASIL.azulEscuro }}>Legenda:</span>
              <span style={{ display: "flex", alignItems: "center", gap: "4px" }}><span style={{ width: "12px", height: "12px", backgroundColor: "#fef2f2", border: "1px solid #fca5a5", borderLeft: "3px solid #dc2626", borderRadius: "2px", display: "inline-block" }} />⚠ Atrasada</span>
              <span style={{ display: "flex", alignItems: "center", gap: "4px" }}><span style={{ width: "12px", height: "12px", backgroundColor: "#fffbeb", border: "1px solid #fde68a", borderLeft: "3px solid #f59e0b", borderRadius: "2px", display: "inline-block" }} />⚡ Vence hoje</span>
              <span style={{ display: "flex", alignItems: "center", gap: "4px" }}><span style={{ width: "12px", height: "12px", backgroundColor: "#dc2626", borderRadius: "2px", display: "inline-block" }} />Alta</span>
              <span style={{ display: "flex", alignItems: "center", gap: "4px" }}><span style={{ width: "12px", height: "12px", backgroundColor: "#ca8a04", borderRadius: "2px", display: "inline-block" }} />Média</span>
              <span style={{ display: "flex", alignItems: "center", gap: "4px" }}><span style={{ width: "12px", height: "12px", backgroundColor: "#16a34a", borderRadius: "2px", display: "inline-block" }} />Baixa</span>
            </div>
            <div style={{ color: "#6b7280" }}>EcoBrasil - Demandas com data de entrega</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
