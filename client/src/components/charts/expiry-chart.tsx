import { useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { Chart, registerables } from "chart.js";

Chart.register(...registerables);

interface MonthlyData {
  month: string;
  count: number;
}

export default function ExpiryChart() {
  const chartRef = useRef<HTMLCanvasElement>(null);
  const chartInstance = useRef<Chart | null>(null);

  const { data: monthlyData, isLoading } = useQuery<MonthlyData[]>({
    queryKey: ["/api/stats/expiry-monthly"],
  });

  useEffect(() => {
    if (!chartRef.current || isLoading || !monthlyData) return;

    if (chartInstance.current) {
      chartInstance.current.destroy();
    }

    const ctx = chartRef.current.getContext("2d");
    if (!ctx) return;

    const months = monthlyData.map(item => item.month);
    const counts = monthlyData.map(item => item.count);

    // Índice do mês atual (3º item, pois a janela começa 3 meses atrás)
    const currentMonthIdx = 3;

    const bgColors = counts.map((_, idx) =>
      idx === currentMonthIdx
        ? "hsl(205, 85%, 31%)"         // mês atual: azul escuro
        : idx < currentMonthIdx
          ? "hsl(205, 50%, 65%)"       // meses passados: azul claro
          : "hsl(205, 85%, 45%)"       // meses futuros: azul médio
    );

    chartInstance.current = new Chart(ctx, {
      type: "bar",
      data: {
        labels: months,
        datasets: [
          {
            label: "Vencimentos",
            data: counts,
            backgroundColor: bgColors,
            hoverBackgroundColor: "hsl(205, 85%, 25%)",
            borderRadius: 4,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          y: {
            beginAtZero: true,
            ticks: {
              stepSize: 1,
            },
          },
          x: {
            ticks: {
              font: { size: 10 },
            },
          },
        },
        plugins: {
          legend: {
            display: false,
          },
          tooltip: {
            callbacks: {
              label: function(context: any) {
                const value = context.parsed.y || 0;
                return `${value} ${value === 1 ? 'vencimento' : 'vencimentos'}`;
              }
            }
          }
        },
      },
    });

    return () => {
      if (chartInstance.current) {
        chartInstance.current.destroy();
      }
    };
  }, [monthlyData, isLoading]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-sm text-muted-foreground">Carregando dados...</div>
      </div>
    );
  }

  if (!monthlyData || monthlyData.every(d => d.count === 0)) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-1">
        <div className="text-sm text-muted-foreground">Nenhum vencimento encontrado</div>
        <div className="text-xs text-muted-foreground opacity-60">nos últimos 3 e próximos 8 meses</div>
      </div>
    );
  }

  return <canvas ref={chartRef} />;
}
