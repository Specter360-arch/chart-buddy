import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { BarChart3, CandlestickChart } from "lucide-react";

interface HeaderProps {
  selectedSymbol: string;
  onSymbolChange: (symbol: string) => void;
  selectedTimeframe: string;
  onTimeframeChange: (timeframe: string) => void;
  chartType: "candlestick" | "line";
  onChartTypeChange: (type: "candlestick" | "line") => void;
}

const symbols = ["BTC/USD", "ETH/USD", "SOL/USD", "AAPL", "GOOGL", "TSLA"];
const timeframes = ["1m", "5m", "15m", "1h", "4h", "1D"];

export const Header = ({
  selectedSymbol,
  onSymbolChange,
  selectedTimeframe,
  onTimeframeChange,
  chartType,
  onChartTypeChange,
}: HeaderProps) => {
  return (
    <header className="border-b border-border bg-card">
      <div className="flex items-center justify-between px-6 py-3">
        <div className="flex items-center gap-6">
          <h1 className="text-2xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
            TradeView
          </h1>
          
          <Select value={selectedSymbol} onValueChange={onSymbolChange}>
            <SelectTrigger className="w-[140px] bg-secondary border-border">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {symbols.map((symbol) => (
                <SelectItem key={symbol} value={symbol}>
                  {symbol}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex gap-1 bg-secondary rounded-md p-1">
            {timeframes.map((tf) => (
              <Button
                key={tf}
                variant={selectedTimeframe === tf ? "default" : "ghost"}
                size="sm"
                onClick={() => onTimeframeChange(tf)}
                className="h-7 px-3 text-xs"
              >
                {tf}
              </Button>
            ))}
          </div>

          <div className="flex gap-1 bg-secondary rounded-md p-1">
            <Button
              variant={chartType === "candlestick" ? "default" : "ghost"}
              size="sm"
              onClick={() => onChartTypeChange("candlestick")}
              className="h-7 px-3"
            >
              <CandlestickChart className="h-4 w-4" />
            </Button>
            <Button
              variant={chartType === "line" ? "default" : "ghost"}
              size="sm"
              onClick={() => onChartTypeChange("line")}
              className="h-7 px-3"
            >
              <BarChart3 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </header>
  );
};
