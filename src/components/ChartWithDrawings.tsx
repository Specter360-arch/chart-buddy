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
  fullscreen?: boolean;
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
  fullscreen = false,
}: ChartWithDrawingsProps) => {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const mainSeriesRef = useRef<ISeriesApi<any> | null>(null);
  
  // Use refs to avoid stale closures in event handlers
  const activeDrawingToolRef = useRef(activeDrawingTool);
  const isDrawingRef = useRef(isDrawing);
  const onDrawingStartRef = useRef(onDrawingStart);
  const onDrawingUpdateRef = useRef(onDrawingUpdate);
  const onDrawingEndRef = useRef(onDrawingEnd);
  const onDrawingSelectRef = useRef(onDrawingSelect);

  // Keep refs updated
  useEffect(() => {
    activeDrawingToolRef.current = activeDrawingTool;
  }, [activeDrawingTool]);

  useEffect(() => {
    isDrawingRef.current = isDrawing;
  }, [isDrawing]);

  useEffect(() => {
    onDrawingStartRef.current = onDrawingStart;
    onDrawingUpdateRef.current = onDrawingUpdate;
    onDrawingEndRef.current = onDrawingEnd;
    onDrawingSelectRef.current = onDrawingSelect;
  }, [onDrawingStart, onDrawingUpdate, onDrawingEnd, onDrawingSelect]);

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
    
    // Helper to draw handles/control points
    const drawHandle = (x: number, y: number, isActive: boolean = false) => {
      ctx.save();
      // Outer ring
      ctx.beginPath();
      ctx.arc(x, y, isActive ? 8 : 6, 0, Math.PI * 2);
      ctx.fillStyle = isActive ? "rgba(34, 197, 94, 0.3)" : "rgba(255, 255, 255, 0.2)";
      ctx.fill();
      // Inner circle
      ctx.beginPath();
      ctx.arc(x, y, isActive ? 5 : 4, 0, Math.PI * 2);
      ctx.fillStyle = isActive ? "#22c55e" : "#ffffff";
      ctx.fill();
      ctx.strokeStyle = isActive ? "#16a34a" : "rgba(0, 0, 0, 0.5)";
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.restore();
    };
    
    allDrawings.forEach((drawing) => {
      if (!drawing.points || drawing.points.length === 0) return;
      
      const points = drawing.points.map((p) => ({
        x: timeScale.timeToCoordinate(p.time),
        y: series.priceToCoordinate(p.price),
      }));
      
      // Filter out invalid coordinates
      if (points.some((p) => p.x === null || p.y === null)) return;
      
      const isSelected = drawing.id === selectedDrawingId;
      const isCurrentlyDrawing = drawing.id?.startsWith("drawing-") && currentDrawing?.id === drawing.id;
      const baseLineWidth = drawing.lineWidth || 2;
      
      // Set up drawing styles - thicker lines for better visibility
      ctx.strokeStyle = drawing.color;
      ctx.lineWidth = isSelected ? baseLineWidth + 2 : baseLineWidth + 1;
      ctx.fillStyle = drawing.color;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.setLineDash([]);
      
      switch (drawing.type) {
        case "trendline":
          if (points.length >= 2) {
            // Draw glow effect for visibility
            ctx.save();
            ctx.shadowColor = drawing.color;
            ctx.shadowBlur = isSelected ? 8 : 4;
            ctx.beginPath();
            ctx.moveTo(points[0].x!, points[0].y!);
            ctx.lineTo(points[1].x!, points[1].y!);
            ctx.stroke();
            ctx.restore();
            
            // Draw main line
            ctx.beginPath();
            ctx.moveTo(points[0].x!, points[0].y!);
            ctx.lineTo(points[1].x!, points[1].y!);
            ctx.stroke();
            
            // Always draw handles for better visibility
            points.forEach((p) => {
              drawHandle(p.x!, p.y!, isSelected || isCurrentlyDrawing);
            });
          }
          break;
          
        case "horizontal":
          if (points.length >= 1) {
            const y = points[0].y!;
            
            // Draw glow effect
            ctx.save();
            ctx.shadowColor = drawing.color;
            ctx.shadowBlur = isSelected ? 6 : 3;
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(canvas.width, y);
            ctx.stroke();
            ctx.restore();
            
            // Draw main line
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(canvas.width, y);
            ctx.stroke();
            
            // Price label with better styling
            ctx.save();
            ctx.font = "bold 12px Inter, sans-serif";
            const priceText = `$${drawing.points[0].price.toFixed(2)}`;
            const textWidth = ctx.measureText(priceText).width;
            const labelX = canvas.width - textWidth - 16;
            const labelY = y;
            
            // Label background
            ctx.fillStyle = drawing.color;
            ctx.beginPath();
            ctx.roundRect(labelX - 4, labelY - 10, textWidth + 12, 20, 4);
            ctx.fill();
            
            // Label text
            ctx.fillStyle = "#000000";
            ctx.fillText(priceText, labelX + 2, labelY + 4);
            ctx.restore();
            
            // Draw handle on left
            drawHandle(40, y, isSelected || isCurrentlyDrawing);
          }
          break;
          
        case "fibonacci":
          if (points.length >= 2 && drawing.fibLevels) {
            const startY = points[0].y!;
            const endY = points[1].y!;
            const range = endY - startY;
            
            // Draw fib levels
            drawing.fibLevels.forEach((level, index) => {
              const y = startY + range * (1 - level);
              const alpha = index === 0 || index === drawing.fibLevels!.length - 1 ? 1 : 0.7;
              
              ctx.save();
              ctx.globalAlpha = alpha;
              ctx.lineWidth = level === 0.5 || level === 0.618 ? 2.5 : 1.5;
              ctx.beginPath();
              ctx.moveTo(points[0].x!, y);
              ctx.lineTo(canvas.width - 60, y);
              ctx.stroke();
              
              // Level label with background
              ctx.font = "bold 11px Inter, sans-serif";
              const levelText = `${(level * 100).toFixed(1)}%`;
              const textWidth = ctx.measureText(levelText).width;
              
              // Background
              ctx.fillStyle = "rgba(0, 0, 0, 0.7)";
              ctx.fillRect(8, y - 8, textWidth + 8, 16);
              
              // Text
              ctx.fillStyle = drawing.color;
              ctx.fillText(levelText, 12, y + 4);
              ctx.restore();
            });
            
            // Connecting line
            ctx.save();
            ctx.setLineDash([6, 4]);
            ctx.lineWidth = 2;
            ctx.shadowColor = drawing.color;
            ctx.shadowBlur = 4;
            ctx.beginPath();
            ctx.moveTo(points[0].x!, points[0].y!);
            ctx.lineTo(points[1].x!, points[1].y!);
            ctx.stroke();
            ctx.setLineDash([]);
            ctx.restore();
            
            // Draw handles
            points.forEach((p) => {
              drawHandle(p.x!, p.y!, isSelected || isCurrentlyDrawing);
            });
          }
          break;
          
        case "channel":
          if (points.length >= 2) {
            // Draw main trendline with glow
            ctx.save();
            ctx.shadowColor = drawing.color;
            ctx.shadowBlur = isSelected ? 6 : 3;
            ctx.beginPath();
            ctx.moveTo(points[0].x!, points[0].y!);
            ctx.lineTo(points[1].x!, points[1].y!);
            ctx.stroke();
            ctx.restore();
            
            // Draw main line
            ctx.beginPath();
            ctx.moveTo(points[0].x!, points[0].y!);
            ctx.lineTo(points[1].x!, points[1].y!);
            ctx.stroke();
            
            // Draw parallel line
            if (points.length >= 3) {
              const offsetY = points[2].y! - points[0].y!;
              
              ctx.beginPath();
              ctx.moveTo(points[0].x!, points[0].y! + offsetY);
              ctx.lineTo(points[1].x!, points[1].y! + offsetY);
              ctx.stroke();
              
              // Fill channel with gradient-like effect
              ctx.save();
              ctx.globalAlpha = 0.15;
              ctx.beginPath();
              ctx.moveTo(points[0].x!, points[0].y!);
              ctx.lineTo(points[1].x!, points[1].y!);
              ctx.lineTo(points[1].x!, points[1].y! + offsetY);
              ctx.lineTo(points[0].x!, points[0].y! + offsetY);
              ctx.closePath();
              ctx.fill();
              ctx.restore();
              
              // Draw handle for parallel line
              drawHandle(points[0].x!, points[0].y! + offsetY, isSelected || isCurrentlyDrawing);
            }
            
            // Draw handles for main points
            points.slice(0, 2).forEach((p) => {
              drawHandle(p.x!, p.y!, isSelected || isCurrentlyDrawing);
            });
          }
          break;
      }
    });
  }, [drawings, currentDrawing, selectedDrawingId]);

  // Setup chart
  useEffect(() => {
    if (!chartContainerRef.current) return;

    // Much larger heights for better candle visibility like TradingView
    const getResponsiveHeight = () => {
      if (fullscreen) return window.innerHeight; // Full screen height
      if (window.innerWidth < 640) return 500; // mobile - increased
      if (window.innerWidth < 1024) return 600; // tablet - increased
      return 700; // desktop - significantly larger
    };

    const chart = createChart(chartContainerRef.current, {
      width: chartContainerRef.current.clientWidth,
      height: getResponsiveHeight(),
      layout: {
        background: { color: "hsl(220, 20%, 10%)" }, // Darker for better contrast
        textColor: "hsl(210, 40%, 98%)",
        fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
        fontSize: 12,
      },
      grid: {
        vertLines: { color: "hsl(220, 18%, 16%)", style: 1 }, // Subtle grid
        horzLines: { color: "hsl(220, 18%, 16%)", style: 1 },
      },
      crosshair: {
        mode: CrosshairMode.Normal, // Always use normal mode, we'll handle drawing separately
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
        scaleMargins: {
          top: 0.1,
          bottom: 0.2,
        },
        autoScale: true,
        alignLabels: true,
      },
      timeScale: {
        borderColor: "hsl(220, 18%, 20%)",
        timeVisible: true,
        secondsVisible: false,
        barSpacing: 12, // Wider bars for better visibility
        minBarSpacing: 6,
        rightOffset: 5,
      },
      handleScale: {
        axisPressedMouseMove: {
          time: true,
          price: true,
        },
      },
      handleScroll: {
        mouseWheel: true,
        pressedMouseMove: true,
        horzTouchDrag: true,
        vertTouchDrag: true,
      },
    });

    chartRef.current = chart;

    // Add main series with enhanced visibility
    if (chartType === "candlestick") {
      const candlestickSeries = chart.addSeries(CandlestickSeries, {
        upColor: "#22c55e", // Bright green for bullish
        downColor: "#ef4444", // Bright red for bearish
        borderVisible: true,
        borderUpColor: "#16a34a", // Slightly darker border
        borderDownColor: "#dc2626",
        wickUpColor: "#22c55e",
        wickDownColor: "#ef4444",
      });
      candlestickSeries.setData(data);
      candlestickSeries.priceScale().applyOptions({
        scaleMargins: {
          top: 0.05,
          bottom: 0.15, // Leave room for volume
        },
      });
      mainSeriesRef.current = candlestickSeries;
    } else {
      const lineSeries = chart.addSeries(LineSeries, {
        color: "hsl(180, 85%, 55%)",
        lineWidth: 2,
        crosshairMarkerVisible: true,
        crosshairMarkerRadius: 4,
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

    // Mouse event handlers for drawing - use refs to avoid stale closures
    chart.subscribeClick((param) => {
      if (!activeDrawingToolRef.current) {
        onDrawingSelectRef.current?.(null);
        return;
      }
      
      const point = getChartPoint(param);
      if (!point) return;
      
      if (!isDrawingRef.current) {
        onDrawingStartRef.current(point);
      } else {
        onDrawingEndRef.current();
      }
    });

    chart.subscribeCrosshairMove((param) => {
      if (isDrawingRef.current && activeDrawingToolRef.current) {
        const point = getChartPoint(param);
        if (point) {
          onDrawingUpdateRef.current(point);
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
  }, [data, volumeData, chartType, showVolume, rsiData, macdData, bollingerData, getChartPoint, drawOnCanvas, fullscreen]);

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
        <div className="absolute top-3 left-3 bg-success text-success-foreground text-sm font-medium px-3 py-2 rounded-lg shadow-lg flex items-center gap-2 animate-pulse">
          <span className="w-2 h-2 bg-white rounded-full" />
          Drawing: {activeDrawingTool} • Click to place first point, click again to finish
        </div>
      )}
    </div>
  );
};
