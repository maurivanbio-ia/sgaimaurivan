import { useEffect, useRef } from "react";
import { Chart, registerables } from "chart.js";

Chart.register(...registerables);

interface StatusChartProps {
  stats: {
    active: number;
    expiring: number;
    expired: number;
  };
}

export default function StatusChart({ stats }: StatusChartProps) {
  const chartRef = useRef<HTMLCanvasElement>(null);
  const chartInstance = useRef<Chart | null>(null);

  useEffect(() => {
    if (!chartRef.current) return;

    // Destroy existing chart
    if (chartInstance.current) {
      chartInstance.current.destroy();
    }

    const ctx = chartRef.current.getContext("2d");
    if (!ctx) return;

    chartInstance.current = new Chart(ctx, {
      type: "doughnut",
      data: {
        labels: ["Ativas", "A Vencer", "Vencidas"],
        datasets: [
          {
            data: [stats.active, stats.expiring, stats.expired],
            backgroundColor: [
              "hsl(120, 60%, 50%)", // Ativas - verde
              "hsl(45, 100%, 50%)", // A Vencer - amarelo
              "hsl(0, 100%, 50%)", // Vencidas - vermelho
            ],
            borderWidth: 0,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: "bottom",
          },
        },
      },
    });

    return () => {
      if (chartInstance.current) {
        chartInstance.current.destroy();
      }
    };
  }, [stats]);

  return <canvas ref={chartRef} />;
}
