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

    // Destroy existing chart
    if (chartInstance.current) {
      chartInstance.current.destroy();
    }

    const ctx = chartRef.current.getContext("2d");
    if (!ctx) return;

    // Extract data from API response - limit to first 6 months for better visualization
    const limitedData = monthlyData.slice(0, 6);
    const months = limitedData.map(item => item.month);
    const counts = limitedData.map(item => item.count);

    chartInstance.current = new Chart(ctx, {
      type: "bar",
      data: {
        labels: months,
        datasets: [
          {
            label: "Vencimentos",
            data: counts,
            backgroundColor: "hsl(205, 85%, 31%)",
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
        },
        plugins: {
          legend: {
            display: false,
          },
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

  return <canvas ref={chartRef} />;
}
