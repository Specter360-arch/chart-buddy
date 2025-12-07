import { useEffect, useRef, useCallback, useState } from "react";
import {
  createChart,
  IChartApi,
  ISeriesApi,
  CandlestickData,
  Time,
  CandlestickSeries,
  LineSeries,
  HistogramSeries,
  MouseEventParams,
  CrosshairMode,
} from "lightweight-charts";
import { Drawing, DrawingPoint, DrawingType } from "@/hooks/useChartDrawings";

interface ChartWithDrawingsProps {
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
  // Drawing props
  drawings: Drawing[];
  currentDrawing: Partial<Drawing> | null;
  activeDrawingTool: DrawingType | null;
  isDrawing: boolean;
  onDrawingStart: (point: DrawingPoint) => void;
  onDrawingUpdate: (point: DrawingPoint) => void;
  onDrawingEnd: () => void;
  onDrawingSelect?: (id: string | null) => void;
  selectedDrawingId?: string | null;
}

export const ChartWithDrawings = ({
  data,
  volumeData,
  chartType = "candlestick",
  showVolume = false,
  rsiData,
  macdData,
  bollingerData,
  drawings,
  currentDrawing,
  activeDrawingTool,
  isDrawing,
  onDrawingStart,
  onDrawingUpdate,
  onDrawingEnd,
  onDrawingSelect,
  selectedDrawingId,
}: ChartWithDrawingsProps) => {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const mainSeriesRef = useRef<ISeriesApi<any> | null>(null);
  const [mousePosition, setMousePosition] = useState<{ x: number; y: number } | null>(null);

  // Get chart coordinates from mouse event
  const getChartPoint = useCallback(
    (param: MouseEventParams): DrawingPoint | null => {
      if (!param.time || !param.point || !mainSeriesRef.current) return null;
      
      const price = mainSeriesRef.current.coordinateToPrice(param.point.y);
      if (price === null) return null;
      
      return {
        time: param.time as Time,
        price,
      };
    },
    []
  );

  // Draw all drawings on canvas overlay
  const drawOnCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const chart = chartRef.current;
    const series = mainSeriesRef.current;
    
    if (!canvas || !chart || !series) return;
    
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    
    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    const timeScale = chart.timeScale();
    const allDrawings = [...drawings, currentDrawing].filter(Boolean) as Drawing[];
    
    allDrawings.forEach((drawing) => {
      if (!drawing.points || drawing.points.length === 0) return;
      
      ctx.strokeStyle = drawing.color;
      ctx.lineWidth = drawing.lineWidth;
      ctx.fillStyle = drawing.color;
      
      const points = drawing.points.map((p) => ({
        x: timeScale.timeToCoordinate(p.time),
        y: series.priceToCoordinate(p.price),
      }));
      
      // Filter out invalid coordinates
      if (points.some((p) => p.x === null || p.y === null)) return;
      
      const isSelected = drawing.id === selectedDrawingId;
      if (isSelected) {
        ctx.lineWidth = drawing.lineWidth + 1;
        ctx.setLineDash([]);
      }
      
      switch (drawing.type) {
        case "trendline":
          if (points.length >= 2) {
            ctx.beginPath();
            ctx.moveTo(points[0].x!, points[0].y!);
            ctx.lineTo(points[1].x!, points[1].y!);
            ctx.stroke();
            
            // Draw handles if selected
            if (isSelected) {
              points.forEach((p) => {
                ctx.beginPath();
                ctx.arc(p.x!, p.y!, 5, 0, Math.PI * 2);
                ctx.fill();
              });
            }
          }
          break;
          
        case "horizontal":
          if (points.length >= 1) {
            const y = points[0].y!;
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(canvas.width, y);
            ctx.stroke();
            
            // Price label
            ctx.font = "11px sans-serif";
            ctx.fillStyle = drawing.color;
            const priceText = `$${drawing.points[0].price.toFixed(2)}`;
            const textWidth = ctx.measureText(priceText).width;
            ctx.fillRect(canvas.width - textWidth - 8, y - 8, textWidth + 8, 16);
            ctx.fillStyle = "#000";
            ctx.fillText(priceText, canvas.width - textWidth - 4, y + 4);
          }
          break;
          
        case "fibonacci":
          if (points.length >= 2 && drawing.fibLevels) {
            const startY = points[0].y!;
            const endY = points[1].y!;
            const range = endY - startY;
            
            drawing.fibLevels.forEach((level) => {
              const y = startY + range * (1 - level);
              ctx.globalAlpha = 0.7;
              ctx.beginPath();
              ctx.moveTo(0, y);
              ctx.lineTo(canvas.width, y);
              ctx.stroke();
              
              // Level label
              ctx.font = "10px sans-serif";
              ctx.fillStyle = drawing.color;
              const levelText = `${(level * 100).toFixed(1)}%`;
              ctx.fillText(levelText, 5, y - 3);
            });
            ctx.globalAlpha = 1;
            
            // Connecting line
            ctx.setLineDash([5, 5]);
            ctx.beginPath();
            ctx.moveTo(points[0].x!, points[0].y!);
            ctx.lineTo(points[1].x!, points[1].y!);
            ctx.stroke();
            ctx.setLineDash([]);
          }
          break;
          
        case "channel":
          if (points.length >= 2) {
            // Draw main trendline
            ctx.beginPath();
            ctx.moveTo(points[0].x!, points[0].y!);
            ctx.lineTo(points[1].x!, points[1].y!);
            ctx.stroke();
            
            // Draw parallel line
            if (points.length >= 3) {
              const dx = points[1].x! - points[0].x!;
              const dy = points[1].y! - points[0].y!;
              const offsetY = points[2].y! - points[0].y!;
              
              ctx.beginPath();
              ctx.moveTo(points[0].x!, points[0].y! + offsetY);
              ctx.lineTo(points[1].x!, points[1].y! + offsetY);
              ctx.stroke();
              
              // Fill channel
              ctx.globalAlpha = 0.1;
              ctx.beginPath();
              ctx.moveTo(points[0].x!, points[0].y!);
              ctx.lineTo(points[1].x!, points[1].y!);
              ctx.lineTo(points[1].x!, points[1].y! + offsetY);
              ctx.lineTo(points[0].x!, points[0].y! + offsetY);
              ctx.closePath();
              ctx.fill();
              ctx.globalAlpha = 1;
            }
          }
          break;
      }
    });
  }, [drawings, currentDrawing, selectedDrawingId]);

  // Setup chart
  useEffect(() => {
    if (!chartContainerRef.current) return;

    const getResponsiveHeight = () => {
      if (window.innerWidth < 640) return 400;
      if (window.innerWidth < 1024) return 450;
      return 550;
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
        mode: activeDrawingTool ? CrosshairMode.Normal : CrosshairMode.Magnet,
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
      const candlestickSeries = chart.addSeries(CandlestickSeries, {
        upColor: "hsl(142, 76%, 36%)",
        downColor: "hsl(0, 72%, 51%)",
        borderVisible: false,
        wickUpColor: "hsl(142, 76%, 36%)",
        wickDownColor: "hsl(0, 72%, 51%)",
      });
      candlestickSeries.setData(data);
      mainSeriesRef.current = candlestickSeries;
    } else {
      const lineSeries = chart.addSeries(LineSeries, {
        color: "hsl(180, 85%, 55%)",
        lineWidth: 2,
      });
      lineSeries.setData(data.map((d) => ({ time: d.time, value: d.close })));
      mainSeriesRef.current = lineSeries;
    }

    // Add Bollinger Bands
    if (bollingerData) {
      const upperBand = chart.addSeries(LineSeries, {
        color: "hsl(180, 85%, 55%)",
        lineWidth: 1,
        lineStyle: 2,
      });
      upperBand.setData(bollingerData.upper.filter((d) => !isNaN(d.value)));

      const middleBand = chart.addSeries(LineSeries, {
        color: "hsl(180, 85%, 55%)",
        lineWidth: 1,
      });
      middleBand.setData(bollingerData.middle.filter((d) => !isNaN(d.value)));

      const lowerBand = chart.addSeries(LineSeries, {
        color: "hsl(180, 85%, 55%)",
        lineWidth: 1,
        lineStyle: 2,
      });
      lowerBand.setData(bollingerData.lower.filter((d) => !isNaN(d.value)));
    }

    // Add Volume
    if (showVolume && volumeData && volumeData.length > 0) {
      const volumeSeries = chart.addSeries(HistogramSeries, {
        color: "hsl(180, 85%, 55%)",
        priceFormat: { type: "volume" },
        priceScaleId: "",
      });
      volumeSeries.priceScale().applyOptions({
        scaleMargins: { top: 0.8, bottom: 0 },
      });
      volumeSeries.setData(volumeData);
    }

    // Add RSI
    if (rsiData) {
      const rsiSeries = chart.addSeries(LineSeries, {
        color: "hsl(270, 70%, 60%)",
        lineWidth: 2,
        priceScaleId: "rsi",
      });
      rsiSeries.priceScale().applyOptions({
        scaleMargins: { top: 0.85, bottom: 0 },
      });
      rsiSeries.setData(rsiData.filter((d) => !isNaN(d.value)));
    }

    // Add MACD
    if (macdData) {
      const macdSeries = chart.addSeries(LineSeries, {
        color: "hsl(200, 70%, 60%)",
        lineWidth: 2,
        priceScaleId: "macd",
      });
      macdSeries.priceScale().applyOptions({
        scaleMargins: { top: 0.9, bottom: 0 },
      });
      macdSeries.setData(macdData.macd.filter((d) => !isNaN(d.value)));

      const signalSeries = chart.addSeries(LineSeries, {
        color: "hsl(30, 70%, 60%)",
        lineWidth: 2,
        priceScaleId: "macd",
      });
      signalSeries.setData(macdData.signal.filter((d) => !isNaN(d.value)));

      const histogramSeries = chart.addSeries(HistogramSeries, {
        priceScaleId: "macd",
      });
      histogramSeries.setData(macdData.histogram.filter((d) => !isNaN(d.value)));
    }

    chart.timeScale().fitContent();

    // Mouse event handlers for drawing
    chart.subscribeClick((param) => {
      if (!activeDrawingTool) {
        onDrawingSelect?.(null);
        return;
      }
      
      const point = getChartPoint(param);
      if (!point) return;
      
      if (!isDrawing) {
        onDrawingStart(point);
      } else {
        onDrawingEnd();
      }
    });

    chart.subscribeCrosshairMove((param) => {
      if (isDrawing && activeDrawingTool) {
        const point = getChartPoint(param);
        if (point) {
          onDrawingUpdate(point);
        }
      }
    });

    const handleResize = () => {
      if (chartContainerRef.current && chartRef.current && canvasRef.current) {
        const width = chartContainerRef.current.clientWidth;
        const height = getResponsiveHeight();
        chartRef.current.applyOptions({ width, height });
        canvasRef.current.width = width;
        canvasRef.current.height = height;
        drawOnCanvas();
      }
    };

    window.addEventListener("resize", handleResize);

    // Setup canvas overlay
    if (canvasRef.current && chartContainerRef.current) {
      canvasRef.current.width = chartContainerRef.current.clientWidth;
      canvasRef.current.height = getResponsiveHeight();
    }

    return () => {
      window.removeEventListener("resize", handleResize);
      chart.remove();
    };
  }, [data, volumeData, chartType, showVolume, rsiData, macdData, bollingerData, activeDrawingTool]);

  // Redraw canvas when drawings change
  useEffect(() => {
    drawOnCanvas();
  }, [drawOnCanvas]);

  // Subscribe to chart updates for canvas sync
  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;
    
    const handleTimeRangeChange = () => {
      drawOnCanvas();
    };
    
    chart.timeScale().subscribeVisibleTimeRangeChange(handleTimeRangeChange);
    
    return () => {
      chart.timeScale().unsubscribeVisibleTimeRangeChange(handleTimeRangeChange);
    };
  }, [drawOnCanvas]);

  return (
    <div className="relative w-full">
      <div ref={chartContainerRef} className="w-full" />
      <canvas
        ref={canvasRef}
        className="absolute top-0 left-0 pointer-events-none"
        style={{ width: "100%", height: "100%" }}
      />
      {activeDrawingTool && (
        <div className="absolute top-2 left-2 bg-primary/90 text-primary-foreground text-xs px-2 py-1 rounded">
          Drawing: {activeDrawingTool} • Click to start, click again to finish
        </div>
      )}
    </div>
  );
};
