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
              "hsl(145, 63%, 20%)", // success
              "hsl(145, 67%, 12%)", // warning
              "hsl(0, 84%, 60%)", // destructive
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
