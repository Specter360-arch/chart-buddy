import { 
  TrendingUp, 
  Minus, 
  BarChart3, 
  Layers, 
  Trash2,
  MousePointer,
  Palette
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { DrawingType } from "@/hooks/useChartDrawings";
import { cn } from "@/lib/utils";

interface DrawingToolbarProps {
  activeTool: DrawingType | null;
  onSelectTool: (tool: DrawingType | null) => void;
  onClearAll: () => void;
  drawingColor: string;
  onColorChange: (color: string) => void;
  hasDrawings: boolean;
  compact?: boolean;
  vertical?: boolean;
}

const tools: { type: DrawingType; icon: React.ReactNode; label: string; shortcut?: string }[] = [
  { type: "trendline", icon: <TrendingUp className="h-4 w-4" />, label: "Trendline", shortcut: "T" },
  { type: "horizontal", icon: <Minus className="h-4 w-4" />, label: "Horizontal Line", shortcut: "H" },
  { type: "fibonacci", icon: <BarChart3 className="h-4 w-4" />, label: "Fibonacci Retracement", shortcut: "F" },
  { type: "channel", icon: <Layers className="h-4 w-4" />, label: "Channel", shortcut: "C" },
];

const colorPresets = [
  "#22c55e", // green
  "#ef4444", // red
  "#3b82f6", // blue
  "#f59e0b", // amber
  "#8b5cf6", // violet
  "#ec4899", // pink
  "#14b8a6", // teal
  "#ffffff", // white
];

export const DrawingToolbar = ({
  activeTool,
  onSelectTool,
  onClearAll,
  drawingColor,
  onColorChange,
  hasDrawings,
  compact = false,
  vertical = false,
}: DrawingToolbarProps) => {
  return (
    <div className={cn(
      "flex gap-1 bg-secondary/50 rounded-lg p-1",
      vertical ? "flex-col items-center" : "items-center flex-row",
      compact ? "flex-wrap" : ""
    )}>
      {/* Selection tool */}
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant={activeTool === null ? "default" : "ghost"}
            size="icon"
            className="h-8 w-8"
            onClick={() => onSelectTool(null)}
          >
            <MousePointer className="h-4 w-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom">
          <p>Select (Esc)</p>
        </TooltipContent>
      </Tooltip>

      <div className={cn(vertical ? "h-px w-6 my-1" : "w-px h-6 mx-1", "bg-border")} />

      {/* Drawing tools */}
      {tools.map((tool) => (
        <Tooltip key={tool.type}>
          <TooltipTrigger asChild>
            <Button
              variant={activeTool === tool.type ? "default" : "ghost"}
              size="icon"
              className="h-8 w-8"
              onClick={() => onSelectTool(activeTool === tool.type ? null : tool.type)}
            >
              {tool.icon}
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            <p>{tool.label} {tool.shortcut && `(${tool.shortcut})`}</p>
          </TooltipContent>
        </Tooltip>
      ))}

      <div className={cn(vertical ? "h-px w-6 my-1" : "w-px h-6 mx-1", "bg-border")} />

      {/* Color picker */}
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <div
              className="h-5 w-5 rounded-full border-2 border-border"
              style={{ backgroundColor: drawingColor }}
            />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-2" align="start">
          <div className="grid grid-cols-4 gap-1.5">
            {colorPresets.map((color) => (
              <button
                key={color}
                className={cn(
                  "h-7 w-7 rounded-full border-2 transition-transform hover:scale-110",
                  drawingColor === color ? "border-primary ring-2 ring-primary/50" : "border-border"
                )}
                style={{ backgroundColor: color }}
                onClick={() => onColorChange(color)}
              />
            ))}
          </div>
        </PopoverContent>
      </Popover>

      {/* Clear all */}
      {hasDrawings && (
        <>
          <div className={cn(vertical ? "h-px w-6 my-1" : "w-px h-6 mx-1", "bg-border")} />
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-destructive hover:text-destructive"
                onClick={onClearAll}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              <p>Clear all drawings</p>
            </TooltipContent>
          </Tooltip>
        </>
      )}
    </div>
  );
};
