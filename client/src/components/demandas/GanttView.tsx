import { useMemo } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { GitBranch } from "lucide-react";
import {
  format as formatDate,
  parseISO,
  differenceInDays,
  addDays,
  addMonths,
  startOfMonth,
  endOfMonth,
  startOfDay,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import { min as minDate, max as maxDate } from "date-fns";
import { cn } from "@/lib/utils";
import type { Demanda, Colaborador } from "./types";
import { normalizeDateYmd, getResponsavelNome } from "./utils";

const GANTT_ROW_H = 40;
const GANTT_LABEL_W = 260;
const GANTT_MIN_DAYS = 30;

const STATUS_ICON_COLOR: Record<string, string> = {
  a_fazer: "#94a3b8",
  em_andamento: "#3b82f6",
  em_revisao: "#f59e0b",
  concluido: "#22c55e",
  cancelado: "#ef4444",
};

function isMilestone(d: Demanda): boolean {
  const inicio = normalizeDateYmd(d.dataInicio ?? "");
  const fim = normalizeDateYmd(d.dataEntrega);
  if (!inicio || !fim) return false;
  return inicio === fim;
}

export function GanttView({ demandas, colaboradores, onView }: { demandas: Demanda[]; colaboradores: Colaborador[]; onView?: (d: Demanda) => void }) {
  const today = startOfDay(new Date());
  const todayStr = formatDate(today, "yyyy-MM-dd");

  const validDemandas = useMemo(() =>
    demandas.filter(d => normalizeDateYmd(d.dataEntrega)),
  [demandas]);

  const { rangeStart, rangeEnd, totalDays } = useMemo(() => {
    if (validDemandas.length === 0) {
      const rs = startOfDay(addDays(today, -7));
      const re = startOfDay(addDays(today, GANTT_MIN_DAYS));
      return { rangeStart: rs, rangeEnd: re, totalDays: differenceInDays(re, rs) + 1 };
    }
    const dates: Date[] = [];
    validDemandas.forEach(d => {
      const fim = normalizeDateYmd(d.dataEntrega);
      if (fim) dates.push(parseISO(fim));
      const ini = normalizeDateYmd(d.dataInicio ?? "");
      if (ini) dates.push(parseISO(ini));
    });
    const minD = startOfDay(addDays(minDate(dates), -3));
    const maxD = startOfDay(addDays(maxDate(dates), 5));
    const days = Math.max(differenceInDays(maxD, minD) + 1, GANTT_MIN_DAYS);
    return { rangeStart: minD, rangeEnd: addDays(minD, days - 1), totalDays: days };
  }, [validDemandas, today]);

  const sorted = useMemo(() =>
    [...validDemandas].sort((a, b) => {
      const da = normalizeDateYmd(a.dataEntrega) ?? "9999";
      const db = normalizeDateYmd(b.dataEntrega) ?? "9999";
      return da.localeCompare(db);
    }),
  [validDemandas]);

  const months = useMemo(() => {
    const result: { label: string; startDay: number; span: number }[] = [];
    let cur = new Date(rangeStart);
    while (cur <= rangeEnd) {
      const mStart = Math.max(differenceInDays(cur, rangeStart), 0);
      const mEnd = Math.min(differenceInDays(endOfMonth(cur), rangeStart), totalDays - 1);
      result.push({ label: formatDate(cur, "MMM yyyy", { locale: ptBR }), startDay: mStart, span: mEnd - mStart + 1 });
      cur = addMonths(startOfMonth(cur), 1);
    }
    return result;
  }, [rangeStart, rangeEnd, totalDays]);

  const dayPct = 100 / totalDays;

  const todayOffset = useMemo(() => {
    const diff = differenceInDays(today, rangeStart);
    if (diff < 0 || diff >= totalDays) return null;
    return diff * dayPct;
  }, [today, rangeStart, totalDays, dayPct]);

  const getBarStyle = (d: Demanda) => {
    const fimStr = normalizeDateYmd(d.dataEntrega)!;
    const iniStr = normalizeDateYmd(d.dataInicio ?? "") || fimStr;
    const startDay = Math.max(differenceInDays(parseISO(iniStr), rangeStart), 0);
    const endDay = Math.min(differenceInDays(parseISO(fimStr), rangeStart), totalDays - 1);
    const left = startDay * dayPct;
    const durationDays = Math.max(endDay - startDay + 1, 1);
    const width = Math.max(durationDays * dayPct, dayPct * 0.5);
    return { left: `${left}%`, width: `${width}%`, durationDays };
  };

  const barColor = (d: Demanda) => {
    if (d.status === "concluido") return { bg: "#22c55e", fg: "#fff" };
    if (d.status === "cancelado") return { bg: "#94a3b8", fg: "#fff" };
    if (d.prioridade === "alta") return { bg: "#ef4444", fg: "#fff" };
    if (d.prioridade === "media") return { bg: "#f59e0b", fg: "#fff" };
    return { bg: "#3b82f6", fg: "#fff" };
  };

  if (sorted.length === 0) {
    return (
      <Card>
        <CardContent className="py-16 text-center text-muted-foreground">
          <GitBranch className="h-10 w-10 mx-auto mb-3 opacity-40" />
          <p>Nenhuma demanda com datas encontrada.</p>
        </CardContent>
      </Card>
    );
  }

  const chartH = sorted.length * GANTT_ROW_H + 56;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <GitBranch className="h-5 w-5" />
          Gantt de Demandas
          <span className="ml-auto flex gap-4 text-xs font-normal text-muted-foreground">
            <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded-sm bg-red-400"/><span>Alta</span></span>
            <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded-sm bg-amber-400"/><span>Média</span></span>
            <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded-sm bg-blue-400"/><span>Baixa</span></span>
            <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded-sm bg-green-400"/><span>Concluído</span></span>
            <span className="flex items-center gap-1"><span className="text-purple-600 font-bold text-base">◆</span><span>Marco</span></span>
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="overflow-x-auto pr-0">
        <div style={{ minWidth: `${GANTT_LABEL_W + 600}px` }}>
          {/* Month headers */}
          <div className="flex" style={{ marginLeft: GANTT_LABEL_W }}>
            {months.map((m, i) => (
              <div key={i} className="border-r border-gray-200 text-xs text-center py-1 font-semibold text-gray-500 bg-gray-50" style={{ width: `${m.span * dayPct}%`, flexShrink: 0, overflow: "hidden", whiteSpace: "nowrap" }}>
                {m.label}
              </div>
            ))}
          </div>

          {/* Chart area */}
          <div className="relative" style={{ height: chartH }}>
            {/* Label column */}
            <div className="absolute left-0 top-0 bottom-0 flex flex-col" style={{ width: GANTT_LABEL_W, zIndex: 10 }}>
              <div style={{ height: 28 }} className="border-b border-gray-200 bg-white flex items-center justify-between px-3">
                <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Demanda</span>
                <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Dias</span>
              </div>
              {sorted.map((d) => {
                const resp = getResponsavelNome(d, colaboradores);
                const fimStr = normalizeDateYmd(d.dataEntrega)!;
                const iniStr = normalizeDateYmd(d.dataInicio ?? "") || fimStr;
                const durDays = iniStr && fimStr ? Math.max(differenceInDays(parseISO(fimStr), parseISO(iniStr)) + 1, 1) : 1;
                return (
                  <div key={d.id} className="border-b border-gray-100 bg-white flex items-center gap-2 px-3" style={{ height: GANTT_ROW_H }}>
                    <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: STATUS_ICON_COLOR[d.status] ?? "#94a3b8" }} />
                    <div className="min-w-0 flex-1">
                      <p className={cn("text-xs font-medium leading-tight truncate", d.status === "concluido" ? "line-through text-muted-foreground" : "")}>{d.titulo}</p>
                      {resp && <p className="text-[10px] text-muted-foreground truncate">{resp}</p>}
                    </div>
                    <div
                      className="flex-shrink-0 text-[9px] font-bold text-center rounded px-1 py-0.5"
                      style={{ backgroundColor: durDays === 1 ? "#e2e8f0" : durDays <= 7 ? "#dbeafe" : durDays <= 30 ? "#fef9c3" : "#fce7f3", color: durDays === 1 ? "#64748b" : durDays <= 7 ? "#1d4ed8" : durDays <= 30 ? "#92400e" : "#9d174d", minWidth: 28 }}
                      title={`${durDays} dia${durDays !== 1 ? "s" : ""} de duração`}
                    >
                      {durDays}d
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Grid + bars */}
            <div className="absolute top-0 bottom-0 overflow-hidden" style={{ left: GANTT_LABEL_W, right: 0 }}>
              <div className="absolute inset-0">
                {Array.from({ length: Math.ceil(totalDays / 7) }).map((_, wi) => (
                  <div key={wi} className="absolute top-0 bottom-0 border-l border-gray-100" style={{ left: `${wi * 7 * dayPct}%` }} />
                ))}
              </div>

              <div className="absolute top-0 left-0 right-0 border-b border-gray-200" style={{ height: 28 }}>
                {Array.from({ length: totalDays }).map((_, di) => {
                  const d = addDays(rangeStart, di);
                  const dow = formatDate(d, "d");
                  const isWeekend = [0, 6].includes(d.getDay());
                  const isTod = formatDate(d, "yyyy-MM-dd") === todayStr;
                  return (
                    <div key={di} className="absolute top-0 bottom-0 flex items-center justify-center text-[9px]" style={{ left: `${di * dayPct}%`, width: `${dayPct}%`, color: isTod ? "#2563eb" : isWeekend ? "#d1d5db" : "#9ca3af", fontWeight: isTod ? 700 : 400 }}>
                      {di % 3 === 0 ? dow : ""}
                    </div>
                  );
                })}
              </div>

              {todayOffset !== null && (
                <div className="absolute top-0 bottom-0 w-0.5 z-20" style={{ left: `${todayOffset}%`, backgroundColor: "#2563eb", opacity: 0.7 }}>
                  <div className="absolute -top-0.5 -translate-x-1/2 text-[9px] bg-blue-600 text-white px-1 rounded" style={{ whiteSpace: "nowrap" }}>Hoje</div>
                </div>
              )}

              {sorted.map((d, i) => {
                const ms = isMilestone(d);
                const bc = barColor(d);
                const barStyle = getBarStyle(d);
                const fimStr = normalizeDateYmd(d.dataEntrega)!;
                const isOverdue = fimStr < todayStr && d.status !== "concluido" && d.status !== "cancelado";
                return (
                  <div key={d.id} className="absolute left-0 right-0 border-b border-gray-50" style={{ top: 28 + i * GANTT_ROW_H, height: GANTT_ROW_H }}>
                    {Array.from({ length: totalDays }).map((_, di) => {
                      const day = addDays(rangeStart, di);
                      if (![0, 6].includes(day.getDay())) return null;
                      return <div key={di} className="absolute top-0 bottom-0 bg-gray-50" style={{ left: `${di * dayPct}%`, width: `${dayPct}%` }} />;
                    })}
                    {ms ? (
                      <div className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 z-10" style={{ left: barStyle.left, cursor: onView ? "pointer" : "default" }} title={`Marco: ${d.titulo}`} onClick={() => onView?.(d)}>
                        <div className="text-purple-600 drop-shadow hover:scale-125 transition-transform" style={{ fontSize: 20, lineHeight: 1 }}>◆</div>
                      </div>
                    ) : (
                      <div
                        className="absolute top-2 bottom-2 rounded flex items-center px-1.5 overflow-hidden group"
                        style={{ left: barStyle.left, width: barStyle.width, backgroundColor: bc.bg, outline: isOverdue ? "2px solid #ef4444" : "none", outlineOffset: "1px", cursor: onView ? "pointer" : "default", transition: "filter 0.15s" }}
                        title={`${d.titulo} — ${barStyle.durationDays} dia${barStyle.durationDays !== 1 ? "s" : ""}`}
                        onClick={() => onView?.(d)}
                        onMouseEnter={e => (e.currentTarget.style.filter = "brightness(1.15)")}
                        onMouseLeave={e => (e.currentTarget.style.filter = "")}
                      >
                        <span className="text-[10px] font-medium truncate flex items-center gap-1" style={{ color: bc.fg }}>
                          {d.titulo}
                          {barStyle.durationDays > 1 && (
                            <span className="flex-shrink-0 ml-1 text-[9px] font-bold opacity-90 bg-black/20 rounded px-0.5" style={{ whiteSpace: "nowrap" }}>{barStyle.durationDays}d</span>
                          )}
                        </span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="text-xs text-muted-foreground text-right py-1 pr-4 border-t border-gray-100 bg-gray-50">
            ◆ Marco = demanda de prazo único (início = fim) &nbsp;|&nbsp; Linha azul = hoje
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
