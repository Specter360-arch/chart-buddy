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
import { IndicatorSettings, IndicatorParameters } from "./IndicatorSettings";

export type IndicatorType = "volume" | "rsi" | "macd" | "bollinger";

interface IndicatorPanelProps {
  activeIndicators: IndicatorType[];
  onToggleIndicator: (indicator: IndicatorType) => void;
  indicatorParameters: IndicatorParameters;
  onParametersChange: (params: IndicatorParameters) => void;
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

export const IndicatorPanel = ({ 
  activeIndicators, 
  onToggleIndicator,
  indicatorParameters,
  onParametersChange 
}: IndicatorPanelProps) => {
  return (
    <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
      {/* Active indicators chips */}
      <div className="flex flex-wrap gap-1 sm:gap-1.5">
        {activeIndicators.map((id) => {
          const indicator = indicators.find((i) => i.id === id);
          const hasSettings = id === "rsi" || id === "macd" || id === "bollinger";
          
          return (
            <div key={id} className="flex items-center gap-0">
              <Button
                variant="secondary"
                size="sm"
                className="h-7 sm:h-8 px-2 sm:px-2.5 text-xs gap-1 rounded-r-none min-w-fit"
                onClick={() => onToggleIndicator(id)}
              >
                <span className="font-medium">{indicator?.name}</span>
                <X className="h-3 w-3" />
              </Button>
              {hasSettings && (
                <div className="bg-secondary border-l border-border h-7 sm:h-8 flex items-center px-1 rounded-r">
                  <IndicatorSettings
                    indicatorType={id as "rsi" | "macd" | "bollinger"}
                    parameters={indicatorParameters}
                    onSave={onParametersChange}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Add indicator popover */}
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className="h-7 sm:h-8 px-2.5 sm:px-3 gap-1.5 min-w-fit">
            <TrendingUp className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            <span className="text-xs font-medium">Indicators</span>
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[calc(100vw-2rem)] sm:w-80 bg-card border-border z-50" align="start">
          <div className="space-y-4">
            <div>
              <h4 className="font-semibold text-sm sm:text-base mb-2">Technical Indicators</h4>
              <p className="text-xs text-muted-foreground mb-3">
                Select indicators to display on the chart
              </p>
            </div>

            <div className="space-y-2 sm:space-y-3">
              {indicators.map((indicator) => {
                const isActive = activeIndicators.includes(indicator.id);
                return (
                  <Card
                    key={indicator.id}
                    className={`p-2.5 sm:p-3 cursor-pointer transition-colors ${
                      isActive ? "bg-primary/10 border-primary" : "hover:bg-accent"
                    }`}
                    onClick={() => onToggleIndicator(indicator.id)}
                  >
                    <div className="flex items-start gap-2.5 sm:gap-3">
                      <Checkbox
                        id={indicator.id}
                        checked={isActive}
                        onCheckedChange={() => onToggleIndicator(indicator.id)}
                        onClick={(e) => e.stopPropagation()}
                        className="mt-0.5"
                      />
                      <div className="flex-1 min-w-0">
                        <Label
                          htmlFor={indicator.id}
                          className="text-sm font-semibold cursor-pointer"
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
