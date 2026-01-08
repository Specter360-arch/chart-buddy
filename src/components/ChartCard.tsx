import { useState, useEffect, useMemo } from "react";
import { X, Settings, Maximize2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TradingChart } from "@/components/TradingChart";
import { IndicatorPanel, IndicatorType } from "@/components/IndicatorPanel";
import { IndicatorParameters } from "@/components/IndicatorSettings";
import {
  generateCandlestickData,
  generateVolumeData,
  getMarketStats,
} from "@/utils/chartData";
import {
  calculateRSI,
  calculateMACD,
  calculateBollingerBands,
} from "@/utils/technicalIndicators";
import { CandlestickData, Time } from "lightweight-charts";

interface ChartCardProps {
  symbol: string;
  onSymbolChange: (symbol: string) => void;
  onRemove: () => void;
  onMaximize?: () => void;
  availableSymbols: string[];
  compact?: boolean;
}

const timeframes = ["1m", "5m", "15m", "1h", "4h", "1D"];

export const ChartCard = ({
  symbol,
  onSymbolChange,
  onRemove,
  onMaximize,
  availableSymbols,
  compact = false,
}: ChartCardProps) => {
  const [selectedTimeframe, setSelectedTimeframe] = useState("1D");
  const [chartType, setChartType] = useState<"candlestick" | "line">("candlestick");
  const [chartData, setChartData] = useState<CandlestickData<Time>[]>([]);
  const [volumeData, setVolumeData] = useState<{ time: Time; value: number; color: string }[]>([]);
  const [activeIndicators, setActiveIndicators] = useState<IndicatorType[]>(["volume"]);
  const [showSettings, setShowSettings] = useState(false);
  const [indicatorParameters, setIndicatorParameters] = useState<IndicatorParameters>({
    rsi: { period: 14 },
    macd: { fastPeriod: 12, slowPeriod: 26, signalPeriod: 9 },
    bollinger: { period: 20, stdDev: 2 },
  });

  useEffect(() => {
    // Base prices for our 5 forex pairs
    const basePrice = symbol.includes("XAU")
      ? 2650
      : symbol.includes("EUR")
      ? 1.08
      : symbol.includes("GBP")
      ? 1.27
      : symbol.includes("JPY")
      ? 157
      : symbol.includes("AUD")
      ? 0.62
      : 1.0;

    const data = generateCandlestickData(100, basePrice);
    const volume = generateVolumeData(data);

    setChartData(data);
    setVolumeData(volume);
  }, [symbol, selectedTimeframe]);

  const stats = getMarketStats(chartData);

  const indicators = useMemo(() => {
    if (chartData.length === 0) return {};

    return {
      rsi: activeIndicators.includes("rsi")
        ? calculateRSI(chartData, indicatorParameters.rsi.period)
        : undefined,
      macd: activeIndicators.includes("macd")
        ? calculateMACD(
            chartData,
            indicatorParameters.macd.fastPeriod,
            indicatorParameters.macd.slowPeriod,
            indicatorParameters.macd.signalPeriod
          )
        : undefined,
      bollinger: activeIndicators.includes("bollinger")
        ? calculateBollingerBands(
            chartData,
            indicatorParameters.bollinger.period,
            indicatorParameters.bollinger.stdDev
          )
        : undefined,
    };
  }, [chartData, activeIndicators, indicatorParameters]);

  const handleToggleIndicator = (indicator: IndicatorType) => {
    setActiveIndicators((prev) =>
      prev.includes(indicator)
        ? prev.filter((i) => i !== indicator)
        : [...prev, indicator]
    );
  };

  const isPositive = stats.change >= 0;

  return (
    <Card className="bg-card border-border overflow-hidden flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between gap-2 p-2 sm:p-3 border-b border-border bg-secondary/50">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <Select value={symbol} onValueChange={onSymbolChange}>
            <SelectTrigger className="w-[100px] sm:w-[120px] h-8 bg-background border-border text-xs sm:text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {availableSymbols.map((sym) => (
                <SelectItem key={sym} value={sym}>
                  {sym}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="flex flex-col min-w-0">
            <span className="text-xs sm:text-sm font-bold tabular-nums truncate">
              ${stats.price.toLocaleString()}
            </span>
            <span
              className={`text-[10px] sm:text-xs font-medium tabular-nums ${
                isPositive ? "text-success" : "text-destructive"
              }`}
            >
              {isPositive ? "+" : ""}
              {stats.changePercent.toFixed(2)}%
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => setShowSettings(!showSettings)}
            title="Settings"
          >
            <Settings className="h-3.5 w-3.5" />
          </Button>
          {onMaximize && (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={onMaximize}
              title="Maximize"
            >
              <Maximize2 className="h-3.5 w-3.5" />
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-destructive hover:text-destructive"
            onClick={onRemove}
            title="Remove chart"
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Settings Panel */}
      {showSettings && (
        <div className="p-2 border-b border-border bg-secondary/30">
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <div className="flex gap-0.5 bg-background rounded-md p-0.5">
              {timeframes.map((tf) => (
                <Button
                  key={tf}
                  variant={selectedTimeframe === tf ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setSelectedTimeframe(tf)}
                  className="h-6 px-2 text-[10px] sm:text-xs"
                >
                  {tf}
                </Button>
              ))}
            </div>
          </div>

          <IndicatorPanel
            activeIndicators={activeIndicators}
            onToggleIndicator={handleToggleIndicator}
            indicatorParameters={indicatorParameters}
            onParametersChange={setIndicatorParameters}
          />
        </div>
      )}

      {/* Chart */}
      <div className="flex-1 p-2 min-h-0">
        {chartData.length > 0 && (
          <TradingChart
            data={chartData}
            volumeData={volumeData}
            chartType={chartType}
            showVolume={activeIndicators.includes("volume")}
            rsiData={indicators.rsi}
            macdData={indicators.macd}
            bollingerData={indicators.bollinger}
          />
        )}
      </div>
    </Card>
  );
};
