import { Card } from "@/components/ui/card";
import { TrendingUp, TrendingDown } from "lucide-react";

interface MarketStatsProps {
  symbol: string;
  price: number;
  change: number;
  changePercent: number;
  high24h: number;
  low24h: number;
  volume24h: number;
}

export const MarketStats = ({
  symbol,
  price,
  change,
  changePercent,
  high24h,
  low24h,
  volume24h,
}: MarketStatsProps) => {
  const isPositive = change >= 0;

  return (
    <Card className="p-3 sm:p-4 bg-card border-border">
      <div className="space-y-2 sm:space-y-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h2 className="text-xs sm:text-sm text-muted-foreground font-medium">{symbol}</h2>
            {isPositive ? (
              <TrendingUp className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-success" />
            ) : (
              <TrendingDown className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-destructive" />
            )}
          </div>
          <div className="flex flex-col sm:flex-row sm:items-baseline gap-1 sm:gap-2">
            <span className="text-2xl sm:text-3xl font-bold tabular-nums">
              ${price.toLocaleString()}
            </span>
            <span
              className={`text-xs sm:text-sm font-medium tabular-nums ${
                isPositive ? "text-success" : "text-destructive"
              }`}
            >
              {isPositive ? "+" : ""}
              {change.toFixed(2)} ({changePercent.toFixed(2)}%)
            </span>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2 sm:gap-3 pt-2 sm:pt-3 border-t border-border">
          <div className="min-w-0">
            <div className="text-[10px] sm:text-xs text-muted-foreground mb-0.5 sm:mb-1 font-medium">24h High</div>
            <div className="text-xs sm:text-sm font-semibold tabular-nums truncate">
              ${high24h.toLocaleString()}
            </div>
          </div>
          <div className="min-w-0">
            <div className="text-[10px] sm:text-xs text-muted-foreground mb-0.5 sm:mb-1 font-medium">24h Low</div>
            <div className="text-xs sm:text-sm font-semibold tabular-nums truncate">
              ${low24h.toLocaleString()}
            </div>
          </div>
          <div className="min-w-0">
            <div className="text-[10px] sm:text-xs text-muted-foreground mb-0.5 sm:mb-1 font-medium">24h Volume</div>
            <div className="text-xs sm:text-sm font-semibold tabular-nums truncate">
              ${(volume24h / 1000000).toFixed(2)}M
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
};
