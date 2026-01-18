import { useEffect, useRef, useState, useCallback } from "react";
import { ChartWithDrawings } from "./ChartWithDrawings";
import { DrawingToolbar } from "./DrawingToolbar";
import { Button } from "./ui/button";
import {
  X,
  Maximize2,
  Minimize2,
  RotateCcw,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { CandlestickData, Time } from "lightweight-charts";
import { Drawing, DrawingType, DrawingPoint } from "@/hooks/useChartDrawings";
import { cn } from "@/lib/utils";

interface FullscreenChartProps {
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
  symbol: string;
  timeframe: string;
  drawings: Drawing[];
  currentDrawing: Partial<Drawing> | null;
  activeDrawingTool: DrawingType | null;
  isDrawing: boolean;
  onDrawingStart: (point: DrawingPoint) => void;
  onDrawingUpdate: (point: DrawingPoint) => void;
  onDrawingEnd: () => void;
  onDrawingSelect?: (id: string | null) => void;
  selectedDrawingId?: string | null;
  drawingColor: string;
  onColorChange: (color: string) => void;
  onSelectTool: (tool: DrawingType | null) => void;
  onClearAll: () => void;
  onClose: () => void;
  isLivePriceUpdating?: boolean;
}

export const FullscreenChart = ({
  data,
  volumeData,
  chartType = "candlestick",
  showVolume = false,
  rsiData,
  macdData,
  bollingerData,
  symbol,
  timeframe,
  drawings,
  currentDrawing,
  activeDrawingTool,
  isDrawing,
  onDrawingStart,
  onDrawingUpdate,
  onDrawingEnd,
  onDrawingSelect,
  selectedDrawingId,
  drawingColor,
  onColorChange,
  onSelectTool,
  onClearAll,
  onClose,
  isLivePriceUpdating = false,
}: FullscreenChartProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);

  // Request fullscreen and lock orientation on mount
  useEffect(() => {
    const enterFullscreen = async () => {
      try {
        if (containerRef.current && document.fullscreenEnabled) {
          await containerRef.current.requestFullscreen();
          setIsFullscreen(true);
        }

        // Lock to landscape on mobile
        if (screen.orientation && "lock" in screen.orientation) {
          try {
            await (screen.orientation as any).lock("landscape");
          } catch (e) {
            console.log("Orientation lock not supported");
          }
        }
      } catch (error) {
        console.log("Fullscreen not supported");
      }
    };

    enterFullscreen();

    // Listen for fullscreen changes
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
      if (!document.fullscreenElement) {
        // Unlock orientation when exiting fullscreen
        if (screen.orientation && "unlock" in screen.orientation) {
          try {
            (screen.orientation as any).unlock();
          } catch (e) {
            console.log("Orientation unlock not supported");
          }
        }
      }
    };

    document.addEventListener("fullscreenchange", handleFullscreenChange);

    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
      // Cleanup: unlock orientation
      if (screen.orientation && "unlock" in screen.orientation) {
        try {
          (screen.orientation as any).unlock();
        } catch (e) {}
      }
    };
  }, []);

  const exitFullscreen = useCallback(async () => {
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      }
    } catch (error) {
      console.log("Exit fullscreen error");
    }
    onClose();
  }, [onClose]);

  const toggleFullscreen = useCallback(async () => {
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      } else if (containerRef.current) {
        await containerRef.current.requestFullscreen();
      }
    } catch (error) {
      console.log("Fullscreen toggle error");
    }
  }, []);

  // Auto-hide controls after 3 seconds
  useEffect(() => {
    if (!showControls) return;

    const timer = setTimeout(() => {
      if (!activeDrawingTool) {
        setShowControls(false);
      }
    }, 5000);

    return () => clearTimeout(timer);
  }, [showControls, activeDrawingTool]);

  // Show controls on touch/click
  const handleInteraction = () => {
    setShowControls(true);
  };

  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        exitFullscreen();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [exitFullscreen]);

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 z-50 bg-background flex flex-col"
      onClick={handleInteraction}
      onTouchStart={handleInteraction}
    >
      {/* Top Bar */}
      <div
        className={cn(
          "absolute top-0 left-0 right-0 z-10 flex items-center justify-between px-4 py-2 bg-gradient-to-b from-background/95 to-transparent transition-opacity duration-300",
          showControls ? "opacity-100" : "opacity-0 pointer-events-none"
        )}
      >
        {/* Symbol & Timeframe */}
        <div className="flex items-center gap-3">
          <span className="text-lg font-bold text-foreground">{symbol}</span>
          <span className="text-sm text-muted-foreground bg-secondary/50 px-2 py-0.5 rounded">
            {timeframe}
          </span>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleFullscreen}
            className="h-8 w-8"
          >
            {isFullscreen ? (
              <Minimize2 className="h-4 w-4" />
            ) : (
              <Maximize2 className="h-4 w-4" />
            )}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={exitFullscreen}
            className="h-8 w-8 text-destructive hover:text-destructive"
          >
            <X className="h-5 w-5" />
          </Button>
        </div>
      </div>

      {/* Drawing Toolbar - Left Side */}
      <div
        className={cn(
          "absolute left-2 top-1/2 -translate-y-1/2 z-10 flex flex-col gap-2 bg-card/90 backdrop-blur p-2 rounded-lg border border-border shadow-lg transition-opacity duration-300",
          showControls ? "opacity-100" : "opacity-0 pointer-events-none"
        )}
      >
        <DrawingToolbar
          activeTool={activeDrawingTool}
          onSelectTool={onSelectTool}
          onClearAll={onClearAll}
          drawingColor={drawingColor}
          onColorChange={onColorChange}
          hasDrawings={drawings.length > 0}
          vertical
        />
      </div>

      {/* Chart Container */}
      <div className="flex-1 w-full h-full">
        <ChartWithDrawings
          data={data}
          volumeData={volumeData}
          chartType={chartType}
          showVolume={showVolume}
          rsiData={rsiData}
          macdData={macdData}
          bollingerData={bollingerData}
          drawings={drawings}
          currentDrawing={currentDrawing}
          activeDrawingTool={activeDrawingTool}
          isDrawing={isDrawing}
          onDrawingStart={onDrawingStart}
          onDrawingUpdate={onDrawingUpdate}
          onDrawingEnd={onDrawingEnd}
          onDrawingSelect={onDrawingSelect}
          selectedDrawingId={selectedDrawingId}
          fullscreen
          isLivePriceUpdating={isLivePriceUpdating}
        />
      </div>

      {/* Bottom Info Bar */}
      <div
        className={cn(
          "absolute bottom-0 left-0 right-0 z-10 flex items-center justify-center px-4 py-2 bg-gradient-to-t from-background/95 to-transparent transition-opacity duration-300",
          showControls ? "opacity-100" : "opacity-0 pointer-events-none"
        )}
      >
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <span>Tap to show controls</span>
          <span>•</span>
          <span>ESC to exit</span>
          {drawings.length > 0 && (
            <>
              <span>•</span>
              <span>{drawings.length} drawings</span>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
