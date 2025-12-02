import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { SidebarTrigger } from "@/components/ui/sidebar";
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
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 px-3 sm:px-4 lg:px-6 py-3">
        <div className="flex items-center gap-3 sm:gap-4 lg:gap-6">
          <SidebarTrigger className="shrink-0" />
          <h1 className="text-lg sm:text-xl lg:text-2xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent whitespace-nowrap">
            TradeView
          </h1>
          
          <Select value={selectedSymbol} onValueChange={onSymbolChange}>
            <SelectTrigger className="w-[120px] sm:w-[140px] bg-secondary border-border text-sm">
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

        <div className="flex items-center gap-2 sm:gap-3 overflow-x-auto pb-1 lg:pb-0">
          <div className="flex gap-0.5 sm:gap-1 bg-secondary rounded-md p-0.5 sm:p-1 shrink-0">
            {timeframes.map((tf) => (
              <Button
                key={tf}
                variant={selectedTimeframe === tf ? "default" : "ghost"}
                size="sm"
                onClick={() => onTimeframeChange(tf)}
                className="h-7 px-2 sm:px-3 text-xs min-w-[2.5rem]"
              >
                {tf}
              </Button>
            ))}
          </div>

          <div className="flex gap-0.5 sm:gap-1 bg-secondary rounded-md p-0.5 sm:p-1 shrink-0">
            <Button
              variant={chartType === "candlestick" ? "default" : "ghost"}
              size="sm"
              onClick={() => onChartTypeChange("candlestick")}
              className="h-7 px-2 sm:px-3"
              aria-label="Candlestick chart"
            >
              <CandlestickChart className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            </Button>
            <Button
              variant={chartType === "line" ? "default" : "ghost"}
              size="sm"
              onClick={() => onChartTypeChange("line")}
              className="h-7 px-2 sm:px-3"
              aria-label="Line chart"
            >
              <BarChart3 className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            </Button>
          </div>
        </div>
      </div>
    </header>
  );
};
