import { useState, useCallback, useEffect } from "react";
import { Time } from "lightweight-charts";

export type DrawingType = "trendline" | "horizontal" | "fibonacci" | "channel";

export interface DrawingPoint {
  time: Time;
  price: number;
}

export interface Drawing {
  id: string;
  type: DrawingType;
  points: DrawingPoint[];
  color: string;
  lineWidth: number;
  // Fibonacci specific
  fibLevels?: number[];
}

interface UseChartDrawingsProps {
  chartId: string;
}

const STORAGE_KEY_PREFIX = "chart-drawings-";

export const useChartDrawings = ({ chartId }: UseChartDrawingsProps) => {
  const [drawings, setDrawings] = useState<Drawing[]>([]);
  const [activeDrawingTool, setActiveDrawingTool] = useState<DrawingType | null>(null);
  const [selectedDrawingId, setSelectedDrawingId] = useState<string | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentDrawing, setCurrentDrawing] = useState<Partial<Drawing> | null>(null);
  const [drawingColor, setDrawingColor] = useState("#22c55e");
  const [drawingLineWidth, setDrawingLineWidth] = useState(2);

  // Load drawings from localStorage
  useEffect(() => {
    const stored = localStorage.getItem(`${STORAGE_KEY_PREFIX}${chartId}`);
    if (stored) {
      try {
        setDrawings(JSON.parse(stored));
      } catch (e) {
        console.error("Failed to parse stored drawings", e);
      }
    }
  }, [chartId]);

  // Save drawings to localStorage
  useEffect(() => {
    localStorage.setItem(`${STORAGE_KEY_PREFIX}${chartId}`, JSON.stringify(drawings));
  }, [drawings, chartId]);

  const addDrawing = useCallback((drawing: Drawing) => {
    setDrawings((prev) => [...prev, drawing]);
  }, []);

  const updateDrawing = useCallback((id: string, updates: Partial<Drawing>) => {
    setDrawings((prev) =>
      prev.map((d) => (d.id === id ? { ...d, ...updates } : d))
    );
  }, []);

  const removeDrawing = useCallback((id: string) => {
    setDrawings((prev) => prev.filter((d) => d.id !== id));
    if (selectedDrawingId === id) {
      setSelectedDrawingId(null);
    }
  }, [selectedDrawingId]);

  const clearAllDrawings = useCallback(() => {
    setDrawings([]);
    setSelectedDrawingId(null);
  }, []);

  const startDrawing = useCallback(
    (point: DrawingPoint) => {
      if (!activeDrawingTool) return;

      const newDrawing: Partial<Drawing> = {
        id: `drawing-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        type: activeDrawingTool,
        points: [point],
        color: drawingColor,
        lineWidth: drawingLineWidth,
        fibLevels: activeDrawingTool === "fibonacci" ? [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1] : undefined,
      };

      setCurrentDrawing(newDrawing);
      setIsDrawing(true);
    },
    [activeDrawingTool, drawingColor, drawingLineWidth]
  );

  const updateCurrentDrawing = useCallback(
    (point: DrawingPoint) => {
      if (!isDrawing || !currentDrawing) return;

      const points = [...(currentDrawing.points || [])];
      
      if (currentDrawing.type === "channel") {
        // Channel needs 3 points
        if (points.length < 3) {
          points[points.length] = point;
        } else {
          points[2] = point;
        }
      } else {
        // All other tools need 2 points
        points[1] = point;
      }

      setCurrentDrawing({ ...currentDrawing, points });
    },
    [isDrawing, currentDrawing]
  );

  const finishDrawing = useCallback(() => {
    if (!currentDrawing || !currentDrawing.points || currentDrawing.points.length < 2) {
      setIsDrawing(false);
      setCurrentDrawing(null);
      return;
    }

    // For channel, we need at least 2 points to finish
    if (currentDrawing.type === "channel" && currentDrawing.points.length < 2) {
      return;
    }

    addDrawing(currentDrawing as Drawing);
    setIsDrawing(false);
    setCurrentDrawing(null);
    setActiveDrawingTool(null);
  }, [currentDrawing, addDrawing]);

  const cancelDrawing = useCallback(() => {
    setIsDrawing(false);
    setCurrentDrawing(null);
  }, []);

  const selectTool = useCallback((tool: DrawingType | null) => {
    if (isDrawing) {
      cancelDrawing();
    }
    setActiveDrawingTool(tool);
    setSelectedDrawingId(null);
  }, [isDrawing, cancelDrawing]);

  return {
    drawings,
    activeDrawingTool,
    selectedDrawingId,
    isDrawing,
    currentDrawing,
    drawingColor,
    drawingLineWidth,
    setDrawingColor,
    setDrawingLineWidth,
    addDrawing,
    updateDrawing,
    removeDrawing,
    clearAllDrawings,
    startDrawing,
    updateCurrentDrawing,
    finishDrawing,
    cancelDrawing,
    selectTool,
    setSelectedDrawingId,
  };
};
