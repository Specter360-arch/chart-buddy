import { useEffect, useRef } from "react";
import { 
  createChart, 
  IChartApi, 
  ISeriesApi, 
  CandlestickData, 
  Time,
  CandlestickSeries,
  LineSeries,
  HistogramSeries
} from "lightweight-charts";

interface TradingChartProps {
  data: CandlestickData<Time>[];
  volumeData?: { time: Time; value: number; color?: string }[];
  chartType?: "candlestick" | "line";
  showVolume?: boolean;
  rsiData?: { time: Time; value: number }[];
  macdData?: {
    macd: { time: Time; value: number }[];
    signal: { time: Time; value: number }[];
    histogram: { time: Time; value: number; color: string }[];
  };
  bollingerData?: {
    upper: { time: Time; value: number }[];
    middle: { time: Time; value: number }[];
    lower: { time: Time; value: number }[];
  };
}

export const TradingChart = ({ 
  data, 
  volumeData, 
  chartType = "candlestick",
  showVolume = false,
  rsiData,
  macdData,
  bollingerData
}: TradingChartProps) => {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const mainSeriesRef = useRef<ISeriesApi<any> | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<any> | null>(null);
  const indicatorSeriesRef = useRef<Map<string, ISeriesApi<any>>>(new Map());
  const chartTypeRef = useRef(chartType);
  const isInitializedRef = useRef(false);

  const getResponsiveHeight = () => {
    if (window.innerWidth < 640) return 500;
    if (window.innerWidth < 1024) return 600;
    return 700;
  };

  // Initialize chart only once
  useEffect(() => {
    if (!chartContainerRef.current || isInitializedRef.current) return;

    const chart = createChart(chartContainerRef.current, {
      width: chartContainerRef.current.clientWidth,
      height: getResponsiveHeight(),
      layout: {
        background: { color: "hsl(220, 20%, 10%)" },
        textColor: "hsl(210, 40%, 98%)",
        fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
        fontSize: 12,
      },
      grid: {
        vertLines: { color: "hsl(220, 18%, 16%)", style: 1 },
        horzLines: { color: "hsl(220, 18%, 16%)", style: 1 },
      },
      crosshair: {
        mode: 1,
        vertLine: {
          color: "hsl(180, 85%, 55%)",
          width: 1,
          style: 2,
          labelBackgroundColor: "hsl(180, 85%, 35%)",
        },
        horzLine: {
          color: "hsl(180, 85%, 55%)",
          width: 1,
          style: 2,
          labelBackgroundColor: "hsl(180, 85%, 35%)",
        },
      },
      rightPriceScale: {
        borderColor: "hsl(220, 18%, 20%)",
        scaleMargins: { top: 0.1, bottom: 0.2 },
      },
      timeScale: {
        borderColor: "hsl(220, 18%, 20%)",
        timeVisible: true,
        secondsVisible: false,
        barSpacing: 12,
        minBarSpacing: 6,
      },
    });

    chartRef.current = chart;
    isInitializedRef.current = true;

    // Create main series based on chart type
    if (chartType === "candlestick") {
      const candlestickSeries = chart.addSeries(CandlestickSeries, {
        upColor: "#22c55e",
        downColor: "#ef4444",
        borderVisible: true,
        borderUpColor: "#16a34a",
        borderDownColor: "#dc2626",
        wickUpColor: "#22c55e",
        wickDownColor: "#ef4444",
      });
      candlestickSeries.priceScale().applyOptions({
        scaleMargins: { top: 0.05, bottom: 0.15 },
      });
      mainSeriesRef.current = candlestickSeries;
    } else {
      const lineSeries = chart.addSeries(LineSeries, {
        color: "hsl(180, 85%, 55%)",
        lineWidth: 2,
        crosshairMarkerVisible: true,
        crosshairMarkerRadius: 4,
      });
      mainSeriesRef.current = lineSeries;
    }
    chartTypeRef.current = chartType;

    const handleResize = () => {
      if (chartContainerRef.current && chartRef.current) {
        chartRef.current.applyOptions({
          width: chartContainerRef.current.clientWidth,
          height: getResponsiveHeight(),
        });
      }
    };

    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      chart.remove();
      isInitializedRef.current = false;
    };
  }, []); // No data dependencies - chart created only once

  // Handle chart type changes
  useEffect(() => {
    const chart = chartRef.current;
    if (!chart || !isInitializedRef.current) return;

    if (chartTypeRef.current !== chartType) {
      // Remove old series
      if (mainSeriesRef.current) {
        chart.removeSeries(mainSeriesRef.current);
      }

      // Create new series
      if (chartType === "candlestick") {
        const candlestickSeries = chart.addSeries(CandlestickSeries, {
          upColor: "#22c55e",
          downColor: "#ef4444",
          borderVisible: true,
          borderUpColor: "#16a34a",
          borderDownColor: "#dc2626",
          wickUpColor: "#22c55e",
          wickDownColor: "#ef4444",
        });
        candlestickSeries.priceScale().applyOptions({
          scaleMargins: { top: 0.05, bottom: 0.15 },
        });
        mainSeriesRef.current = candlestickSeries;
        if (data.length > 0) {
          candlestickSeries.setData(data);
        }
      } else {
        const lineSeries = chart.addSeries(LineSeries, {
          color: "hsl(180, 85%, 55%)",
          lineWidth: 2,
          crosshairMarkerVisible: true,
          crosshairMarkerRadius: 4,
        });
        mainSeriesRef.current = lineSeries;
        if (data.length > 0) {
          lineSeries.setData(data.map((d) => ({ time: d.time, value: d.close })));
        }
      }
      chartTypeRef.current = chartType;
    }
  }, [chartType, data]);

  // Update main series data smoothly without recreating chart
  useEffect(() => {
    if (!mainSeriesRef.current || data.length === 0) return;

    if (chartType === "candlestick") {
      mainSeriesRef.current.setData(data);
    } else {
      mainSeriesRef.current.setData(data.map((d) => ({ time: d.time, value: d.close })));
    }

    // Only fit content on first load
    if (chartRef.current) {
      chartRef.current.timeScale().fitContent();
    }
  }, [data, chartType]);

  // Update volume data
  useEffect(() => {
    const chart = chartRef.current;
    if (!chart || !isInitializedRef.current) return;

    if (showVolume && volumeData && volumeData.length > 0) {
      if (!volumeSeriesRef.current) {
        const volumeSeries = chart.addSeries(HistogramSeries, {
          color: "hsl(180, 85%, 55%)",
          priceFormat: { type: "volume" },
          priceScaleId: "",
        });
        volumeSeries.priceScale().applyOptions({
          scaleMargins: { top: 0.8, bottom: 0 },
        });
        volumeSeriesRef.current = volumeSeries;
      }
      volumeSeriesRef.current.setData(volumeData);
    } else if (volumeSeriesRef.current) {
      chart.removeSeries(volumeSeriesRef.current);
      volumeSeriesRef.current = null;
    }
  }, [showVolume, volumeData]);

  // Update indicators
  useEffect(() => {
    const chart = chartRef.current;
    if (!chart || !isInitializedRef.current) return;

    // Bollinger Bands
    if (bollingerData) {
      if (!indicatorSeriesRef.current.has("bollinger-upper")) {
        const upperBand = chart.addSeries(LineSeries, {
          color: "hsl(180, 85%, 55%)",
          lineWidth: 1,
          lineStyle: 2,
        });
        indicatorSeriesRef.current.set("bollinger-upper", upperBand);

        const middleBand = chart.addSeries(LineSeries, {
          color: "hsl(180, 85%, 55%)",
          lineWidth: 1,
        });
        indicatorSeriesRef.current.set("bollinger-middle", middleBand);

        const lowerBand = chart.addSeries(LineSeries, {
          color: "hsl(180, 85%, 55%)",
          lineWidth: 1,
          lineStyle: 2,
        });
        indicatorSeriesRef.current.set("bollinger-lower", lowerBand);
      }

      indicatorSeriesRef.current.get("bollinger-upper")?.setData(bollingerData.upper.filter((d) => !isNaN(d.value)));
      indicatorSeriesRef.current.get("bollinger-middle")?.setData(bollingerData.middle.filter((d) => !isNaN(d.value)));
      indicatorSeriesRef.current.get("bollinger-lower")?.setData(bollingerData.lower.filter((d) => !isNaN(d.value)));
    } else {
      ["bollinger-upper", "bollinger-middle", "bollinger-lower"].forEach((key) => {
        const series = indicatorSeriesRef.current.get(key);
        if (series) {
          chart.removeSeries(series);
          indicatorSeriesRef.current.delete(key);
        }
      });
    }

    // RSI
    if (rsiData) {
      if (!indicatorSeriesRef.current.has("rsi")) {
        const rsiSeries = chart.addSeries(LineSeries, {
          color: "hsl(270, 70%, 60%)",
          lineWidth: 2,
          priceScaleId: "rsi",
        });
        rsiSeries.priceScale().applyOptions({
          scaleMargins: { top: 0.85, bottom: 0 },
        });
        indicatorSeriesRef.current.set("rsi", rsiSeries);
      }
      indicatorSeriesRef.current.get("rsi")?.setData(rsiData.filter((d) => !isNaN(d.value)));
    } else {
      const series = indicatorSeriesRef.current.get("rsi");
      if (series) {
        chart.removeSeries(series);
        indicatorSeriesRef.current.delete("rsi");
      }
    }

    // MACD
    if (macdData) {
      if (!indicatorSeriesRef.current.has("macd")) {
        const macdSeries = chart.addSeries(LineSeries, {
          color: "hsl(200, 70%, 60%)",
          lineWidth: 2,
          priceScaleId: "macd",
        });
        macdSeries.priceScale().applyOptions({
          scaleMargins: { top: 0.9, bottom: 0 },
        });
        indicatorSeriesRef.current.set("macd", macdSeries);

        const signalSeries = chart.addSeries(LineSeries, {
          color: "hsl(30, 70%, 60%)",
          lineWidth: 2,
          priceScaleId: "macd",
        });
        indicatorSeriesRef.current.set("macd-signal", signalSeries);

        const histogramSeries = chart.addSeries(HistogramSeries, {
          priceScaleId: "macd",
        });
        indicatorSeriesRef.current.set("macd-histogram", histogramSeries);
      }

      indicatorSeriesRef.current.get("macd")?.setData(macdData.macd.filter((d) => !isNaN(d.value)));
      indicatorSeriesRef.current.get("macd-signal")?.setData(macdData.signal.filter((d) => !isNaN(d.value)));
      indicatorSeriesRef.current.get("macd-histogram")?.setData(macdData.histogram.filter((d) => !isNaN(d.value)));
    } else {
      ["macd", "macd-signal", "macd-histogram"].forEach((key) => {
        const series = indicatorSeriesRef.current.get(key);
        if (series) {
          chart.removeSeries(series);
          indicatorSeriesRef.current.delete(key);
        }
      });
    }
  }, [bollingerData, rsiData, macdData]);

  return <div ref={chartContainerRef} className="w-full" />;
};
