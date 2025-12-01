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
    <Card className="p-4 bg-card border-border">
      <div className="space-y-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h2 className="text-sm text-muted-foreground">{symbol}</h2>
            {isPositive ? (
              <TrendingUp className="h-4 w-4 text-success" />
            ) : (
              <TrendingDown className="h-4 w-4 text-destructive" />
            )}
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold">${price.toLocaleString()}</span>
            <span
              className={`text-sm font-medium ${
                isPositive ? "text-success" : "text-destructive"
              }`}
            >
              {isPositive ? "+" : ""}
              {change.toFixed(2)} ({changePercent.toFixed(2)}%)
            </span>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3 pt-3 border-t border-border">
          <div>
            <div className="text-xs text-muted-foreground mb-1">24h High</div>
            <div className="text-sm font-medium">${high24h.toLocaleString()}</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground mb-1">24h Low</div>
            <div className="text-sm font-medium">${low24h.toLocaleString()}</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground mb-1">24h Volume</div>
            <div className="text-sm font-medium">
              ${(volume24h / 1000000).toFixed(2)}M
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
};
