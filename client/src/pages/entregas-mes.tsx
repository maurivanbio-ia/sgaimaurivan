import React, { useMemo } from "react";
import { useLocation, useParams } from "wouter";
import { FilteredListing } from "@/components/filtered-listing";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ChevronLeft, ChevronRight, CalendarDays } from "lucide-react";
import { useUnidade } from "@/contexts/UnidadeContext";

type RouteParams = {
  year?: string;
  month?: string; // 1-12
};

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function getMonthRange(year: number, month1to12: number) {
  const start = new Date(year, month1to12 - 1, 1);
  const end = new Date(year, month1to12, 0); // último dia do mês

  const from = `${year}-${pad2(month1to12)}-01`;
  const to = `${year}-${pad2(month1to12)}-${pad2(end.getDate())}`;

  return { from, to, start, end };
}

function addMonths(year: number, month1to12: number, delta: number) {
  const d = new Date(year, month1to12 - 1, 1);
  d.setMonth(d.getMonth() + delta);
  return { year: d.getFullYear(), month: d.getMonth() + 1 };
}

const monthLabelPT = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

export default function EntregasMes() {
  const { year: yearParam, month: monthParam } = useParams<RouteParams>();
  const [, setLocation] = useLocation();
  const { unidadeSelecionada } = useUnidade();

  const now = new Date();
  const year = useMemo(() => {
    const y = Number(yearParam);
    return Number.isFinite(y) && y >= 2000 && y <= 2100 ? y : now.getFullYear();
  }, [yearParam]);

  const month = useMemo(() => {
    const m = Number(monthParam);
    return Number.isFinite(m) && m >= 1 && m <= 12 ? m : now.getMonth() + 1;
  }, [monthParam]);

  const { from, to } = useMemo(() => getMonthRange(year, month), [year, month]);

  const { prevYear, prevMonth, nextYear, nextMonth } = useMemo(() => {
    const prev = addMonths(year, month, -1);
    const next = addMonths(year, month, 1);
    return {
      prevYear: prev.year,
      prevMonth: prev.month,
      nextYear: next.year,
      nextMonth: next.month,
    };
  }, [year, month]);

  const title = `Entregas de ${monthLabelPT[month - 1]} de ${year}`;
  const description = `Entregas com prazo entre ${from} e ${to}`;

  const apiEndpoint = useMemo(() => {
    const params = new URLSearchParams();
    params.set("from", from);
    params.set("to", to);

    if (unidadeSelecionada) {
      params.set("unidade", String(unidadeSelecionada));
    }

    return `/api/entregas?${params.toString()}`;
  }, [from, to, unidadeSelecionada]);

  return (
    <div className="space-y-4">
      <Card className="shadow-sm">
        <CardContent className="p-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-2">
            <CalendarDays className="h-5 w-5 text-muted-foreground" />
            <div>
              <div className="text-lg font-semibold">{title}</div>
              <div className="text-sm text-muted-foreground">{description}</div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={() => setLocation(`/entregas/mes/${prevYear}/${prevMonth}`)}
              data-testid="button-prev-month"
            >
              <ChevronLeft className="h-4 w-4 mr-2" />
              Mês anterior
            </Button>

            <Button
              variant="outline"
              onClick={() => setLocation(`/entregas/mes/${nextYear}/${nextMonth}`)}
              data-testid="button-next-month"
            >
              Próximo mês
              <ChevronRight className="h-4 w-4 ml-2" />
            </Button>
          </div>
        </CardContent>
      </Card>

      <FilteredListing
        title={title}
        description={description}
        apiEndpoint={apiEndpoint}
        type="entrega"
        emptyMessage="Nenhuma entrega programada para este período"
      />
    </div>
  );
}
