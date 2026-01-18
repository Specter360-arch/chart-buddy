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
  // Live price pulse
  isLivePriceUpdating?: boolean;
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
  isLivePriceUpdating = false,
}: ChartWithDrawingsProps) => {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pulseCanvasRef = useRef<HTMLCanvasElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const mainSeriesRef = useRef<ISeriesApi<any> | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<any> | null>(null);
  const indicatorSeriesRef = useRef<Map<string, ISeriesApi<any>>>(new Map());
  const chartTypeRef = useRef(chartType);
  const isInitializedRef = useRef(false);
  const [isPulsing, setIsPulsing] = useState(false);
  const pulseTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
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
      ctx.beginPath();
      ctx.arc(x, y, isActive ? 8 : 6, 0, Math.PI * 2);
      ctx.fillStyle = isActive ? "rgba(34, 197, 94, 0.3)" : "rgba(255, 255, 255, 0.2)";
      ctx.fill();
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
      
      if (points.some((p) => p.x === null || p.y === null)) return;
      
      const isSelected = drawing.id === selectedDrawingId;
      const isCurrentlyDrawing = drawing.id?.startsWith("drawing-") && currentDrawing?.id === drawing.id;
      const baseLineWidth = drawing.lineWidth || 2;
      
      ctx.strokeStyle = drawing.color;
      ctx.lineWidth = isSelected ? baseLineWidth + 2 : baseLineWidth + 1;
      ctx.fillStyle = drawing.color;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.setLineDash([]);
      
      switch (drawing.type) {
        case "trendline":
          if (points.length >= 2) {
            ctx.save();
            ctx.shadowColor = drawing.color;
            ctx.shadowBlur = isSelected ? 8 : 4;
            ctx.beginPath();
            ctx.moveTo(points[0].x!, points[0].y!);
            ctx.lineTo(points[1].x!, points[1].y!);
            ctx.stroke();
            ctx.restore();
            
            ctx.beginPath();
            ctx.moveTo(points[0].x!, points[0].y!);
            ctx.lineTo(points[1].x!, points[1].y!);
            ctx.stroke();
            
            points.forEach((p) => {
              drawHandle(p.x!, p.y!, isSelected || isCurrentlyDrawing);
            });
          }
          break;
          
        case "horizontal":
          if (points.length >= 1) {
            const y = points[0].y!;
            
            ctx.save();
            ctx.shadowColor = drawing.color;
            ctx.shadowBlur = isSelected ? 6 : 3;
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(canvas.width, y);
            ctx.stroke();
            ctx.restore();
            
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(canvas.width, y);
            ctx.stroke();
            
            ctx.save();
            ctx.font = "bold 12px Inter, sans-serif";
            const priceText = `$${drawing.points[0].price.toFixed(2)}`;
            const textWidth = ctx.measureText(priceText).width;
            const labelX = canvas.width - textWidth - 16;
            const labelY = y;
            
            ctx.fillStyle = drawing.color;
            ctx.beginPath();
            ctx.roundRect(labelX - 4, labelY - 10, textWidth + 12, 20, 4);
            ctx.fill();
            
            ctx.fillStyle = "#000000";
            ctx.fillText(priceText, labelX + 2, labelY + 4);
            ctx.restore();
            
            drawHandle(40, y, isSelected || isCurrentlyDrawing);
          }
          break;
          
        case "fibonacci":
          if (points.length >= 2 && drawing.fibLevels) {
            const startY = points[0].y!;
            const endY = points[1].y!;
            const range = endY - startY;
            
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
              
              ctx.font = "bold 11px Inter, sans-serif";
              const levelText = `${(level * 100).toFixed(1)}%`;
              const textWidth = ctx.measureText(levelText).width;
              
              ctx.fillStyle = "rgba(0, 0, 0, 0.7)";
              ctx.fillRect(8, y - 8, textWidth + 8, 16);
              
              ctx.fillStyle = drawing.color;
              ctx.fillText(levelText, 12, y + 4);
              ctx.restore();
            });
            
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
            
            points.forEach((p) => {
              drawHandle(p.x!, p.y!, isSelected || isCurrentlyDrawing);
            });
          }
          break;
          
        case "channel":
          if (points.length >= 2) {
            ctx.save();
            ctx.shadowColor = drawing.color;
            ctx.shadowBlur = isSelected ? 6 : 3;
            ctx.beginPath();
            ctx.moveTo(points[0].x!, points[0].y!);
            ctx.lineTo(points[1].x!, points[1].y!);
            ctx.stroke();
            ctx.restore();
            
            ctx.beginPath();
            ctx.moveTo(points[0].x!, points[0].y!);
            ctx.lineTo(points[1].x!, points[1].y!);
            ctx.stroke();
            
            if (points.length >= 3) {
              const offsetY = points[2].y! - points[0].y!;
              
              ctx.beginPath();
              ctx.moveTo(points[0].x!, points[0].y! + offsetY);
              ctx.lineTo(points[1].x!, points[1].y! + offsetY);
              ctx.stroke();
              
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
              
              drawHandle(points[0].x!, points[0].y! + offsetY, isSelected || isCurrentlyDrawing);
            }
            
            points.slice(0, 2).forEach((p) => {
              drawHandle(p.x!, p.y!, isSelected || isCurrentlyDrawing);
            });
          }
          break;
      }
    });
  }, [drawings, currentDrawing, selectedDrawingId]);

  const getResponsiveHeight = useCallback(() => {
    if (fullscreen) return window.innerHeight;
    if (window.innerWidth < 640) return 500;
    if (window.innerWidth < 1024) return 600;
    return 700;
  }, [fullscreen]);

  // Pulse effect when live price updates
  useEffect(() => {
    if (isLivePriceUpdating && data.length > 0) {
      setIsPulsing(true);
      
      // Clear any existing timeout
      if (pulseTimeoutRef.current) {
        clearTimeout(pulseTimeoutRef.current);
      }
      
      // Reset pulse after animation
      pulseTimeoutRef.current = setTimeout(() => {
        setIsPulsing(false);
      }, 600);
    }
    
    return () => {
      if (pulseTimeoutRef.current) {
        clearTimeout(pulseTimeoutRef.current);
      }
    };
  }, [isLivePriceUpdating, data]);

  // Draw pulse effect on last candle
  const drawPulseEffect = useCallback(() => {
    const canvas = pulseCanvasRef.current;
    const chart = chartRef.current;
    const series = mainSeriesRef.current;
    
    if (!canvas || !chart || !series || data.length === 0) return;
    
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    
    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    if (!isPulsing) return;
    
    const lastCandle = data[data.length - 1];
    const timeScale = chart.timeScale();
    const x = timeScale.timeToCoordinate(lastCandle.time);
    const yHigh = series.priceToCoordinate(lastCandle.high);
    const yLow = series.priceToCoordinate(lastCandle.low);
    
    if (x === null || yHigh === null || yLow === null) return;
    
    const isGreen = lastCandle.close >= lastCandle.open;
    const color = isGreen ? "34, 197, 94" : "239, 68, 68"; // green or red RGB
    
    // Draw pulsing glow around the last candle
    const centerY = (yHigh + yLow) / 2;
    const barWidth = 16; // Approximate bar width
    
    // Multiple expanding rings for pulse effect
    for (let i = 0; i < 3; i++) {
      const delay = i * 0.15;
      const progress = Math.max(0, Math.min(1, 1 - delay));
      const radius = 20 + (i * 15);
      const alpha = 0.4 * progress;
      
      ctx.save();
      ctx.beginPath();
      ctx.ellipse(x, centerY, radius, (yLow - yHigh) / 2 + radius * 0.5, 0, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(${color}, ${alpha})`;
      ctx.lineWidth = 3 - i;
      ctx.stroke();
      ctx.restore();
    }
    
    // Inner glow
    const gradient = ctx.createRadialGradient(x, centerY, 0, x, centerY, 40);
    gradient.addColorStop(0, `rgba(${color}, 0.3)`);
    gradient.addColorStop(0.5, `rgba(${color}, 0.15)`);
    gradient.addColorStop(1, `rgba(${color}, 0)`);
    
    ctx.save();
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.ellipse(x, centerY, 40, Math.abs(yLow - yHigh) / 2 + 20, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }, [data, isPulsing]);

  // Redraw pulse effect when needed
  useEffect(() => {
    drawPulseEffect();
  }, [drawPulseEffect]);

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
        mode: CrosshairMode.Normal,
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
        autoScale: true,
        alignLabels: true,
      },
      timeScale: {
        borderColor: "hsl(220, 18%, 20%)",
        timeVisible: true,
        secondsVisible: false,
        barSpacing: 12,
        minBarSpacing: 6,
        rightOffset: 5,
      },
      handleScale: {
        axisPressedMouseMove: { time: true, price: true },
      },
      handleScroll: {
        mouseWheel: true,
        pressedMouseMove: true,
        horzTouchDrag: true,
        vertTouchDrag: true,
      },
    });

    chartRef.current = chart;
    isInitializedRef.current = true;

    // Create main series
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

    // Mouse event handlers for drawing
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
        if (pulseCanvasRef.current) {
          pulseCanvasRef.current.width = width;
          pulseCanvasRef.current.height = height;
        }
        drawOnCanvas();
        drawPulseEffect();
      }
    };

    window.addEventListener("resize", handleResize);

    // Setup canvas overlays
    if (chartContainerRef.current) {
      const width = chartContainerRef.current.clientWidth;
      const height = getResponsiveHeight();
      if (canvasRef.current) {
        canvasRef.current.width = width;
        canvasRef.current.height = height;
      }
      if (pulseCanvasRef.current) {
        pulseCanvasRef.current.width = width;
        pulseCanvasRef.current.height = height;
      }
    }

    return () => {
      window.removeEventListener("resize", handleResize);
      chart.remove();
      isInitializedRef.current = false;
    };
  }, [getChartPoint, drawOnCanvas, getResponsiveHeight]); // No data dependencies!

  // Handle chart type changes - need to recreate series
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

  // Update main series data without recreating chart - SMOOTH UPDATES
  useEffect(() => {
    if (!mainSeriesRef.current || data.length === 0) return;
    
    if (chartType === "candlestick") {
      mainSeriesRef.current.setData(data);
    } else {
      mainSeriesRef.current.setData(data.map((d) => ({ time: d.time, value: d.close })));
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

  // Update indicator data (Bollinger, RSI, MACD)
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
      {/* Drawing overlay canvas */}
      <canvas
        ref={canvasRef}
        className="absolute top-0 left-0 pointer-events-none"
        style={{ width: "100%", height: "100%" }}
      />
      {/* Pulse effect canvas - separate layer for animation */}
      <canvas
        ref={pulseCanvasRef}
        className={`absolute top-0 left-0 pointer-events-none transition-opacity duration-300 ${isPulsing ? 'opacity-100' : 'opacity-0'}`}
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
