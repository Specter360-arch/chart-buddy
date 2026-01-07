import { useEffect, useState, useRef } from "react";
import { LivePrice } from "@/hooks/useWebSocketPrice";
import { cn } from "@/lib/utils";

interface LivePriceIndicatorProps {
  livePrice: LivePrice | null;
  isConnected: boolean;
  previousPrice?: number;
}

export const LivePriceIndicator = ({
  livePrice,
  isConnected,
  previousPrice,
}: LivePriceIndicatorProps) => {
  const [priceFlash, setPriceFlash] = useState<"up" | "down" | null>(null);
  const prevPriceRef = useRef<number | null>(null);

  useEffect(() => {
    if (!livePrice?.price) return;

    const prev = prevPriceRef.current;
    if (prev !== null && prev !== livePrice.price) {
      setPriceFlash(livePrice.price > prev ? "up" : "down");
      const timer = setTimeout(() => setPriceFlash(null), 500);
      return () => clearTimeout(timer);
    }
    prevPriceRef.current = livePrice.price;
  }, [livePrice?.price]);

  if (!livePrice) {
    return null;
  }

  const change = livePrice.change ?? (previousPrice ? livePrice.price - previousPrice : 0);
  const changePercent = livePrice.changePercent ?? (previousPrice ? ((livePrice.price - previousPrice) / previousPrice) * 100 : 0);
  const isPositive = change >= 0;

  // Format price based on value (forex pairs need more decimals)
  const formatPrice = (price: number) => {
    if (price > 100) {
      return price.toFixed(2);
    } else if (price > 1) {
      return price.toFixed(4);
    }
    return price.toFixed(5);
  };

  return (
    <div className="absolute top-3 right-3 z-20 pointer-events-none">
      <div className="bg-card/95 backdrop-blur-sm border border-border rounded-lg shadow-lg p-3 min-w-[160px]">
        {/* Connection Status */}
        <div className="flex items-center gap-2 mb-2">
          <div className={cn(
            "h-2 w-2 rounded-full",
            isConnected 
              ? "bg-green-500 animate-pulse" 
              : "bg-yellow-500"
          )} />
          <span className="text-[10px] text-muted-foreground uppercase tracking-wider">
            {isConnected ? "Live" : "Reconnecting..."}
          </span>
        </div>

        {/* Live Price */}
        <div className="flex items-baseline gap-2">
          <span
            className={cn(
              "text-2xl font-bold tabular-nums transition-colors duration-300",
              priceFlash === "up" && "text-green-400",
              priceFlash === "down" && "text-red-400",
              !priceFlash && "text-foreground"
            )}
          >
            {formatPrice(livePrice.price)}
          </span>
          {priceFlash && (
            <span
              className={cn(
                "text-xs animate-bounce",
                priceFlash === "up" ? "text-green-400" : "text-red-400"
              )}
            >
              {priceFlash === "up" ? "▲" : "▼"}
            </span>
          )}
        </div>

        {/* Change */}
        <div className="flex items-center gap-2 mt-1">
          <span
            className={cn(
              "text-sm font-medium tabular-nums",
              isPositive ? "text-green-500" : "text-red-500"
            )}
          >
            {isPositive ? "+" : ""}{change.toFixed(4)}
          </span>
          <span
            className={cn(
              "text-xs tabular-nums",
              isPositive ? "text-green-500/70" : "text-red-500/70"
            )}
          >
            ({isPositive ? "+" : ""}{changePercent.toFixed(2)}%)
          </span>
        </div>

        {/* Bid/Ask if available */}
        {(livePrice.bid || livePrice.ask) && (
          <div className="flex gap-3 mt-2 pt-2 border-t border-border/50">
            {livePrice.bid && (
              <div>
                <span className="text-[10px] text-muted-foreground block">Bid</span>
                <span className="text-xs tabular-nums text-red-400">
                  {formatPrice(livePrice.bid)}
                </span>
              </div>
            )}
            {livePrice.ask && (
              <div>
                <span className="text-[10px] text-muted-foreground block">Ask</span>
                <span className="text-xs tabular-nums text-green-400">
                  {formatPrice(livePrice.ask)}
                </span>
              </div>
            )}
          </div>
        )}

        {/* Timestamp */}
        <div className="text-[10px] text-muted-foreground mt-2">
          {new Date(livePrice.timestamp).toLocaleTimeString()}
        </div>
      </div>
    </div>
  );
};
