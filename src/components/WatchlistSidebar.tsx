import { useState, useEffect } from "react";
import { Star, Plus, X, TrendingUp, TrendingDown } from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  useSidebar,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";

interface WatchlistItem {
  symbol: string;
  price?: number;
  change?: number;
  changePercent?: number;
}

interface WatchlistSidebarProps {
  selectedSymbol: string;
  onSymbolChange: (symbol: string) => void;
  availableSymbols: string[];
  currentStats?: {
    price: number;
    change: number;
    changePercent: number;
  };
}

export const WatchlistSidebar = ({
  selectedSymbol,
  onSymbolChange,
  availableSymbols,
  currentStats,
}: WatchlistSidebarProps) => {
  const { state: sidebarState } = useSidebar();
  const [watchlist, setWatchlist] = useState<WatchlistItem[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);

  // Load watchlist from localStorage
  useEffect(() => {
    const saved = localStorage.getItem("tradingWatchlist");
    if (saved) {
      try {
        setWatchlist(JSON.parse(saved));
      } catch (e) {
        console.error("Failed to load watchlist", e);
      }
    } else {
      // Default watchlist - use our 5 forex pairs
      setWatchlist([
        { symbol: "XAU/USD" },
        { symbol: "EUR/USD" },
        { symbol: "GBP/USD" },
        { symbol: "USD/JPY" },
        { symbol: "AUD/USD" },
      ]);
    }
  }, []);

  // Save watchlist to localStorage
  useEffect(() => {
    if (watchlist.length > 0) {
      localStorage.setItem("tradingWatchlist", JSON.stringify(watchlist));
    }
  }, [watchlist]);

  // Update current symbol stats in watchlist
  useEffect(() => {
    if (currentStats) {
      setWatchlist((prev) =>
        prev.map((item) =>
          item.symbol === selectedSymbol
            ? { ...item, ...currentStats }
            : item
        )
      );
    }
  }, [selectedSymbol, currentStats]);

  const addToWatchlist = (symbol: string) => {
    if (!watchlist.find((item) => item.symbol === symbol)) {
      setWatchlist([...watchlist, { symbol }]);
    }
    setDialogOpen(false);
  };

  const removeFromWatchlist = (symbol: string) => {
    setWatchlist(watchlist.filter((item) => item.symbol !== symbol));
  };

  const isCollapsed = sidebarState === "collapsed";

  return (
    <Sidebar collapsible="icon" className="border-r border-border">
      <SidebarContent>
        <SidebarGroup>
          <div className="flex items-center justify-between px-2 py-2">
            {!isCollapsed && (
              <SidebarGroupLabel className="text-sm font-semibold">
                Watchlist
              </SidebarGroupLabel>
            )}
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 shrink-0"
                  title="Add to watchlist"
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>Add to Watchlist</DialogTitle>
                  <DialogDescription>
                    Select a trading pair to add to your watchlist
                  </DialogDescription>
                </DialogHeader>
                <ScrollArea className="max-h-[300px]">
                  <div className="space-y-2">
                    {availableSymbols.map((symbol) => {
                      const isInWatchlist = watchlist.some(
                        (item) => item.symbol === symbol
                      );
                      return (
                        <Button
                          key={symbol}
                          variant={isInWatchlist ? "secondary" : "outline"}
                          className="w-full justify-start"
                          onClick={() => addToWatchlist(symbol)}
                          disabled={isInWatchlist}
                        >
                          {symbol}
                          {isInWatchlist && (
                            <Star className="ml-auto h-4 w-4 fill-primary text-primary" />
                          )}
                        </Button>
                      );
                    })}
                  </div>
                </ScrollArea>
              </DialogContent>
            </Dialog>
          </div>

          <SidebarGroupContent>
            <SidebarMenu>
              {watchlist.map((item) => {
                const isActive = item.symbol === selectedSymbol;
                const isPositive = (item.changePercent || 0) >= 0;

                return (
                  <SidebarMenuItem key={item.symbol}>
                    <SidebarMenuButton
                      isActive={isActive}
                      onClick={() => onSymbolChange(item.symbol)}
                      className={`group relative ${
                        isActive ? "bg-accent" : ""
                      }`}
                      tooltip={isCollapsed ? item.symbol : undefined}
                    >
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        {isCollapsed ? (
                          <Star className="h-4 w-4 shrink-0 fill-primary text-primary" />
                        ) : (
                          <>
                            <Star className="h-4 w-4 shrink-0 fill-primary text-primary" />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between gap-2">
                                <span className="text-sm font-medium truncate">
                                  {item.symbol}
                                </span>
                                {item.changePercent !== undefined && (
                                  <div className="flex items-center gap-1 shrink-0">
                                    {isPositive ? (
                                      <TrendingUp className="h-3 w-3 text-success" />
                                    ) : (
                                      <TrendingDown className="h-3 w-3 text-destructive" />
                                    )}
                                  </div>
                                )}
                              </div>
                              {item.price !== undefined && (
                                <div className="flex items-center justify-between gap-2 mt-0.5">
                                  <span className="text-xs text-muted-foreground tabular-nums">
                                    ${item.price.toLocaleString()}
                                  </span>
                                  {item.changePercent !== undefined && (
                                    <span
                                      className={`text-xs tabular-nums ${
                                        isPositive
                                          ? "text-success"
                                          : "text-destructive"
                                      }`}
                                    >
                                      {isPositive ? "+" : ""}
                                      {item.changePercent.toFixed(2)}%
                                    </span>
                                  )}
                                </div>
                              )}
                            </div>
                          </>
                        )}
                      </div>
                      {!isCollapsed && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-5 w-5 opacity-0 group-hover:opacity-100 shrink-0"
                          onClick={(e) => {
                            e.stopPropagation();
                            removeFromWatchlist(item.symbol);
                          }}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      )}
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
};
