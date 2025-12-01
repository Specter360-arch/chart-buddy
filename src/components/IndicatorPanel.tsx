import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { TrendingUp, X } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

export type IndicatorType = "volume" | "rsi" | "macd" | "bollinger";

interface IndicatorPanelProps {
  activeIndicators: IndicatorType[];
  onToggleIndicator: (indicator: IndicatorType) => void;
}

const indicators: { id: IndicatorType; name: string; description: string }[] = [
  {
    id: "volume",
    name: "Volume",
    description: "Trading volume histogram",
  },
  {
    id: "rsi",
    name: "RSI",
    description: "Relative Strength Index (14)",
  },
  {
    id: "macd",
    name: "MACD",
    description: "Moving Average Convergence Divergence",
  },
  {
    id: "bollinger",
    name: "Bollinger Bands",
    description: "Volatility bands (20, 2)",
  },
];

export const IndicatorPanel = ({ activeIndicators, onToggleIndicator }: IndicatorPanelProps) => {
  return (
    <div className="flex items-center gap-2">
      {/* Active indicators chips */}
      <div className="flex gap-1">
        {activeIndicators.map((id) => {
          const indicator = indicators.find((i) => i.id === id);
          return (
            <Button
              key={id}
              variant="secondary"
              size="sm"
              className="h-7 px-2 text-xs gap-1"
              onClick={() => onToggleIndicator(id)}
            >
              {indicator?.name}
              <X className="h-3 w-3" />
            </Button>
          );
        })}
      </div>

      {/* Add indicator popover */}
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className="h-7 px-3 gap-1">
            <TrendingUp className="h-4 w-4" />
            <span className="text-xs">Indicators</span>
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-80" align="start">
          <div className="space-y-4">
            <div>
              <h4 className="font-medium mb-2">Technical Indicators</h4>
              <p className="text-xs text-muted-foreground mb-3">
                Select indicators to display on the chart
              </p>
            </div>

            <div className="space-y-3">
              {indicators.map((indicator) => {
                const isActive = activeIndicators.includes(indicator.id);
                return (
                  <Card
                    key={indicator.id}
                    className={`p-3 cursor-pointer transition-colors ${
                      isActive ? "bg-primary/10 border-primary" : "hover:bg-accent"
                    }`}
                    onClick={() => onToggleIndicator(indicator.id)}
                  >
                    <div className="flex items-start gap-3">
                      <Checkbox
                        id={indicator.id}
                        checked={isActive}
                        onCheckedChange={() => onToggleIndicator(indicator.id)}
                        onClick={(e) => e.stopPropagation()}
                      />
                      <div className="flex-1">
                        <Label
                          htmlFor={indicator.id}
                          className="text-sm font-medium cursor-pointer"
                        >
                          {indicator.name}
                        </Label>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {indicator.description}
                        </p>
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
};
