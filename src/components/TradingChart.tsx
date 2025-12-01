import { useEffect, useRef } from "react";
import { 
  createChart, 
  IChartApi, 
  ISeriesApi, 
  CandlestickData, 
  Time,
  CandlestickSeriesPartialOptions,
  LineSeriesPartialOptions,
  HistogramSeriesPartialOptions
} from "lightweight-charts";

interface TradingChartProps {
  data: CandlestickData<Time>[];
  volumeData?: { time: Time; value: number; color?: string }[];
  chartType?: "candlestick" | "line";
}

export const TradingChart = ({ data, volumeData, chartType = "candlestick" }: TradingChartProps) => {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Candlestick" | "Line"> | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<"Histogram"> | null>(null);

  useEffect(() => {
    if (!chartContainerRef.current) return;

    const chart = createChart(chartContainerRef.current, {
      width: chartContainerRef.current.clientWidth,
      height: 500,
      layout: {
        background: { color: "hsl(220, 20%, 14%)" },
        textColor: "hsl(210, 40%, 98%)",
      },
      grid: {
        vertLines: { color: "hsl(220, 18%, 20%)" },
        horzLines: { color: "hsl(220, 18%, 20%)" },
      },
      crosshair: {
        mode: 1,
      },
      rightPriceScale: {
        borderColor: "hsl(220, 18%, 24%)",
      },
      timeScale: {
        borderColor: "hsl(220, 18%, 24%)",
        timeVisible: true,
        secondsVisible: false,
      },
    });

    chartRef.current = chart;

    // Add main series
    if (chartType === "candlestick") {
      const candlestickSeries = chart.addSeries("Candlestick" as any, {
        upColor: "hsl(142, 76%, 36%)",
        downColor: "hsl(0, 72%, 51%)",
        borderVisible: false,
        wickUpColor: "hsl(142, 76%, 36%)",
        wickDownColor: "hsl(0, 72%, 51%)",
      } as CandlestickSeriesPartialOptions);
      candlestickSeries.setData(data);
      seriesRef.current = candlestickSeries as any;
    } else {
      const lineSeries = chart.addSeries("Line" as any, {
        color: "hsl(180, 85%, 55%)",
        lineWidth: 2,
      } as LineSeriesPartialOptions);
      const lineData = data.map((d) => ({
        time: d.time,
        value: d.close,
      }));
      lineSeries.setData(lineData);
      seriesRef.current = lineSeries as any;
    }

    // Add volume series if provided
    if (volumeData && volumeData.length > 0) {
      const volumeSeries = chart.addSeries("Histogram" as any, {
        color: "hsl(180, 85%, 55%)",
        priceFormat: {
          type: "volume",
        },
        priceScaleId: "",
      } as HistogramSeriesPartialOptions);
      
      volumeSeries.priceScale().applyOptions({
        scaleMargins: {
          top: 0.8,
          bottom: 0,
        },
      });
      
      volumeSeries.setData(volumeData);
      volumeSeriesRef.current = volumeSeries as any;
    }

    chart.timeScale().fitContent();

    const handleResize = () => {
      if (chartContainerRef.current && chartRef.current) {
        chartRef.current.applyOptions({
          width: chartContainerRef.current.clientWidth,
        });
      }
    };

    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      chart.remove();
    };
  }, [data, volumeData, chartType]);

  return <div ref={chartContainerRef} className="w-full" />;
};
