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
  const seriesRefs = useRef<Map<string, ISeriesApi<any>>>(new Map());

  useEffect(() => {
    if (!chartContainerRef.current) return;

    const getResponsiveHeight = () => {
      if (window.innerWidth < 640) return 400; // mobile
      if (window.innerWidth < 1024) return 450; // tablet
      return 550; // desktop
    };

    const chart = createChart(chartContainerRef.current, {
      width: chartContainerRef.current.clientWidth,
      height: getResponsiveHeight(),
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
    seriesRefs.current.clear();

    // Add main series
    if (chartType === "candlestick") {
      const candlestickSeries = chart.addSeries(CandlestickSeries, {
        upColor: "hsl(142, 76%, 36%)",
        downColor: "hsl(0, 72%, 51%)",
        borderVisible: false,
        wickUpColor: "hsl(142, 76%, 36%)",
        wickDownColor: "hsl(0, 72%, 51%)",
      });
      candlestickSeries.setData(data);
      seriesRefs.current.set("main", candlestickSeries);
    } else {
      const lineSeries = chart.addSeries(LineSeries, {
        color: "hsl(180, 85%, 55%)",
        lineWidth: 2,
      });
      const lineData = data.map((d) => ({
        time: d.time,
        value: d.close,
      }));
      lineSeries.setData(lineData);
      seriesRefs.current.set("main", lineSeries);
    }

    // Add Bollinger Bands (on main chart)
    if (bollingerData) {
      const upperBand = chart.addSeries(LineSeries, {
        color: "hsl(180, 85%, 55%)",
        lineWidth: 1,
        lineStyle: 2, // Dashed
      });
      upperBand.setData(bollingerData.upper.filter((d) => !isNaN(d.value)));
      seriesRefs.current.set("bollinger-upper", upperBand);

      const middleBand = chart.addSeries(LineSeries, {
        color: "hsl(180, 85%, 55%)",
        lineWidth: 1,
      });
      middleBand.setData(bollingerData.middle.filter((d) => !isNaN(d.value)));
      seriesRefs.current.set("bollinger-middle", middleBand);

      const lowerBand = chart.addSeries(LineSeries, {
        color: "hsl(180, 85%, 55%)",
        lineWidth: 1,
        lineStyle: 2, // Dashed
      });
      lowerBand.setData(bollingerData.lower.filter((d) => !isNaN(d.value)));
      seriesRefs.current.set("bollinger-lower", lowerBand);
    }

    // Add Volume series if enabled
    if (showVolume && volumeData && volumeData.length > 0) {
      const volumeSeries = chart.addSeries(HistogramSeries, {
        color: "hsl(180, 85%, 55%)",
        priceFormat: {
          type: "volume",
        },
        priceScaleId: "",
      });
      
      volumeSeries.priceScale().applyOptions({
        scaleMargins: {
          top: 0.8,
          bottom: 0,
        },
      });
      
      volumeSeries.setData(volumeData);
      seriesRefs.current.set("volume", volumeSeries);
    }

    // Add RSI series (separate scale)
    if (rsiData) {
      const rsiSeries = chart.addSeries(LineSeries, {
        color: "hsl(270, 70%, 60%)",
        lineWidth: 2,
        priceScaleId: "rsi",
      });
      
      rsiSeries.priceScale().applyOptions({
        scaleMargins: {
          top: 0.85,
          bottom: 0,
        },
      });
      
      rsiSeries.setData(rsiData.filter((d) => !isNaN(d.value)));
      seriesRefs.current.set("rsi", rsiSeries);
    }

    // Add MACD series (separate scale)
    if (macdData) {
      const macdSeries = chart.addSeries(LineSeries, {
        color: "hsl(200, 70%, 60%)",
        lineWidth: 2,
        priceScaleId: "macd",
      });
      
      macdSeries.priceScale().applyOptions({
        scaleMargins: {
          top: 0.9,
          bottom: 0,
        },
      });
      
      macdSeries.setData(macdData.macd.filter((d) => !isNaN(d.value)));
      seriesRefs.current.set("macd", macdSeries);

      const signalSeries = chart.addSeries(LineSeries, {
        color: "hsl(30, 70%, 60%)",
        lineWidth: 2,
        priceScaleId: "macd",
      });
      signalSeries.setData(macdData.signal.filter((d) => !isNaN(d.value)));
      seriesRefs.current.set("macd-signal", signalSeries);

      const histogramSeries = chart.addSeries(HistogramSeries, {
        priceScaleId: "macd",
      });
      histogramSeries.setData(
        macdData.histogram.filter((d) => !isNaN(d.value))
      );
      seriesRefs.current.set("macd-histogram", histogramSeries);
    }

    chart.timeScale().fitContent();

    const handleResize = () => {
      if (chartContainerRef.current && chartRef.current) {
        const getResponsiveHeight = () => {
          if (window.innerWidth < 640) return 400;
          if (window.innerWidth < 1024) return 450;
          return 550;
        };

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
    };
  }, [data, volumeData, chartType, showVolume, rsiData, macdData, bollingerData]);

  return <div ref={chartContainerRef} className="w-full" />;
};
