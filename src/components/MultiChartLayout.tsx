import { useState, useEffect } from "react";
import { Plus, Grid2X2, Grid3X3, Maximize2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ChartCard } from "@/components/ChartCard";
import { cn } from "@/lib/utils";

interface ChartConfig {
  id: string;
  symbol: string;
}

interface MultiChartLayoutProps {
  availableSymbols: string[];
  onExitMultiView?: () => void;
  initialSymbol?: string;
}

export const MultiChartLayout = ({
  availableSymbols,
  onExitMultiView,
  initialSymbol = "XAU/USD",
}: MultiChartLayoutProps) => {
  const [charts, setCharts] = useState<ChartConfig[]>([]);
  const [gridLayout, setGridLayout] = useState<"1x1" | "2x2" | "3x3">("2x2");

  // Load charts from localStorage
  useEffect(() => {
    const saved = localStorage.getItem("multiChartLayout");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setCharts(parsed.charts || []);
        setGridLayout(parsed.gridLayout || "2x2");
      } catch (e) {
        console.error("Failed to load multi-chart layout", e);
        initializeDefaultCharts();
      }
    } else {
      initializeDefaultCharts();
    }
  }, []);

  // Save charts to localStorage
  useEffect(() => {
    if (charts.length > 0) {
      localStorage.setItem(
        "multiChartLayout",
        JSON.stringify({ charts, gridLayout })
      );
    }
  }, [charts, gridLayout]);

  const initializeDefaultCharts = () => {
    setCharts([
      { id: crypto.randomUUID(), symbol: initialSymbol },
      { id: crypto.randomUUID(), symbol: "EUR/USD" },
      { id: crypto.randomUUID(), symbol: "GBP/USD" },
      { id: crypto.randomUUID(), symbol: "USD/JPY" },
    ]);
  };

  const addChart = () => {
    const availableSymbol =
      availableSymbols.find(
        (sym) => !charts.some((chart) => chart.symbol === sym)
      ) || availableSymbols[0];

    setCharts([
      ...charts,
      {
        id: crypto.randomUUID(),
        symbol: availableSymbol,
      },
    ]);
  };

  const removeChart = (id: string) => {
    setCharts(charts.filter((chart) => chart.id !== id));
  };

  const updateChartSymbol = (id: string, symbol: string) => {
    setCharts(
      charts.map((chart) => (chart.id === id ? { ...chart, symbol } : chart))
    );
  };

  const getGridClasses = () => {
    switch (gridLayout) {
      case "1x1":
        return "grid-cols-1";
      case "2x2":
        return "grid-cols-1 md:grid-cols-2";
      case "3x3":
        return "grid-cols-1 md:grid-cols-2 lg:grid-cols-3";
      default:
        return "grid-cols-1 md:grid-cols-2";
    }
  };

  const getMaxCharts = () => {
    switch (gridLayout) {
      case "1x1":
        return 1;
      case "2x2":
        return 4;
      case "3x3":
        return 9;
      default:
        return 4;
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-2 p-3 border-b border-border bg-card">
        <div className="flex items-center gap-2">
          <h2 className="text-sm sm:text-base font-semibold">Multi-Chart View</h2>
          <span className="text-xs text-muted-foreground">
            ({charts.length}/{getMaxCharts()})
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* Grid Layout Selector */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-8 gap-2">
                {gridLayout === "1x1" && <Maximize2 className="h-4 w-4" />}
                {gridLayout === "2x2" && <Grid2X2 className="h-4 w-4" />}
                {gridLayout === "3x3" && <Grid3X3 className="h-4 w-4" />}
                <span className="hidden sm:inline text-xs">Layout</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setGridLayout("1x1")}>
                <Maximize2 className="h-4 w-4 mr-2" />
                Single (1x1)
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setGridLayout("2x2")}>
                <Grid2X2 className="h-4 w-4 mr-2" />
                Grid (2x2)
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setGridLayout("3x3")}>
                <Grid3X3 className="h-4 w-4 mr-2" />
                Large Grid (3x3)
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Add Chart Button */}
          <Button
            variant="outline"
            size="sm"
            onClick={addChart}
            disabled={charts.length >= getMaxCharts()}
            className="h-8 gap-1"
          >
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline text-xs">Add Chart</span>
          </Button>

          {/* Exit Multi-View */}
          {onExitMultiView && (
            <Button
              variant="secondary"
              size="sm"
              onClick={onExitMultiView}
              className="h-8"
            >
              <span className="text-xs">Single View</span>
            </Button>
          )}
        </div>
      </div>

      {/* Charts Grid */}
      <div className="flex-1 p-3 overflow-auto">
        {charts.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center space-y-4">
              <div className="text-muted-foreground">No charts added</div>
              <Button onClick={addChart} variant="outline">
                <Plus className="h-4 w-4 mr-2" />
                Add Your First Chart
              </Button>
            </div>
          </div>
        ) : (
          <div
            className={cn(
              "grid gap-3 h-full auto-rows-fr",
              getGridClasses()
            )}
          >
            {charts.map((chart) => (
              <div key={chart.id} className="min-h-[300px]">
                <ChartCard
                  symbol={chart.symbol}
                  onSymbolChange={(symbol) =>
                    updateChartSymbol(chart.id, symbol)
                  }
                  onRemove={() => removeChart(chart.id)}
                  availableSymbols={availableSymbols}
                  compact
                />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
