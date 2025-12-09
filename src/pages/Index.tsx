import { useState, useEffect, useMemo } from "react";
import { Header } from "@/components/Header";
import { ChartWithDrawings } from "@/components/ChartWithDrawings";
import { DrawingToolbar } from "@/components/DrawingToolbar";
import { MarketStats } from "@/components/MarketStats";
import { IndicatorPanel, IndicatorType } from "@/components/IndicatorPanel";
import { IndicatorParameters } from "@/components/IndicatorSettings";
import { WatchlistSidebar } from "@/components/WatchlistSidebar";
import { MultiChartLayout } from "@/components/MultiChartLayout";
import { FullscreenChart } from "@/components/FullscreenChart";
import { SidebarProvider } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { calculateRSI, calculateMACD, calculateBollingerBands } from "@/utils/technicalIndicators";
import { CandlestickData, Time } from "lightweight-charts";
import { Grid2X2, Maximize2, RefreshCw, Wifi, WifiOff } from "lucide-react";
import { useChartDrawings } from "@/hooks/useChartDrawings";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useMarketData } from "@/hooks/useMarketData";
import { ALL_SYMBOLS, MARKET_SYMBOLS } from "@/services/marketData";
import { toast } from "sonner";

// Get all symbol names for the UI
const availableSymbols = ALL_SYMBOLS.map(s => s.symbol);

const Index = () => {
  const [selectedSymbol, setSelectedSymbol] = useState("BTC/USD");
  const [selectedTimeframe, setSelectedTimeframe] = useState("1D");
  const [chartType, setChartType] = useState<"candlestick" | "line">("candlestick");
  const [activeIndicators, setActiveIndicators] = useState<IndicatorType[]>(["volume"]);
  const [isMultiChartView, setIsMultiChartView] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [useLiveData, setUseLiveData] = useState(true);
  const [indicatorParameters, setIndicatorParameters] = useState<IndicatorParameters>({
    rsi: { period: 14 },
    macd: { fastPeriod: 12, slowPeriod: 26, signalPeriod: 9 },
    bollinger: { period: 20, stdDev: 2 },
  });

  // Fetch market data
  const { chartData, volumeData, quote, isLoading, error, refetch } = useMarketData(
    selectedSymbol,
    selectedTimeframe,
    useLiveData
  );

  // Drawing tools
  const {
    drawings,
    activeDrawingTool,
    isDrawing,
    currentDrawing,
    drawingColor,
    setDrawingColor,
    startDrawing,
    updateCurrentDrawing,
    finishDrawing,
    selectTool,
    clearAllDrawings,
    setSelectedDrawingId,
    selectedDrawingId,
  } = useChartDrawings({ chartId: `main-${selectedSymbol}` });

  // Keyboard shortcuts for drawing tools
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return;
      
      switch (e.key.toLowerCase()) {
        case "t":
          selectTool("trendline");
          break;
        case "h":
          selectTool("horizontal");
          break;
        case "f":
          selectTool("fibonacci");
          break;
        case "c":
          selectTool("channel");
          break;
        case "escape":
          selectTool(null);
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectTool]);

  // Show toast on data errors
  useEffect(() => {
    if (error) {
      toast.warning(error);
    }
  }, [error]);

  // Calculate stats from quote or chart data
  const stats = useMemo(() => {
    if (quote) {
      return {
        price: quote.price,
        change: quote.change,
        changePercent: quote.changePercent,
        high24h: quote.high,
        low24h: quote.low,
        volume24h: quote.volume,
      };
    }

    // Fallback to chart data stats
    if (chartData.length === 0) {
      return {
        price: 0,
        change: 0,
        changePercent: 0,
        high24h: 0,
        low24h: 0,
        volume24h: 0,
      };
    }

    const latest = chartData[chartData.length - 1];
    const previous = chartData.length > 1 ? chartData[chartData.length - 2] : latest;
    const last24h = chartData.slice(-24);

    return {
      price: latest.close,
      change: latest.close - previous.close,
      changePercent: ((latest.close - previous.close) / previous.close) * 100,
      high24h: Math.max(...last24h.map((d) => d.high)),
      low24h: Math.min(...last24h.map((d) => d.low)),
      volume24h: Math.random() * 5000000000 + 1000000000,
    };
  }, [quote, chartData]);

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

  const toggleLiveData = () => {
    setUseLiveData(!useLiveData);
    toast.info(useLiveData ? "Switched to demo data" : "Switched to live data");
  };

  return (
    <TooltipProvider>
      <SidebarProvider>
        <div className="min-h-screen bg-background flex w-full">
          <WatchlistSidebar
            selectedSymbol={selectedSymbol}
            onSymbolChange={setSelectedSymbol}
            availableSymbols={availableSymbols}
            currentStats={{
              price: stats.price,
              change: stats.change,
              changePercent: stats.changePercent,
            }}
          />

          <div className="flex-1 flex flex-col min-w-0">
            <Header
              selectedSymbol={selectedSymbol}
              onSymbolChange={setSelectedSymbol}
              selectedTimeframe={selectedTimeframe}
              onTimeframeChange={setSelectedTimeframe}
              chartType={chartType}
              onChartTypeChange={setChartType}
            />

            {isMultiChartView ? (
              <MultiChartLayout
                availableSymbols={availableSymbols}
                onExitMultiView={() => setIsMultiChartView(false)}
                initialSymbol={selectedSymbol}
              />
            ) : (
              <main className="flex-1 p-3 sm:p-4 lg:p-6 space-y-3 sm:space-y-4 lg:space-y-6">
                <div className="flex flex-col lg:flex-row lg:items-start gap-3 sm:gap-4 lg:gap-6">
                  <div className="flex-1 min-w-0">
                    <MarketStats
                      symbol={selectedSymbol}
                      price={stats.price}
                      change={stats.change}
                      changePercent={stats.changePercent}
                      high24h={stats.high24h}
                      low24h={stats.low24h}
                      volume24h={stats.volume24h}
                    />
                  </div>

                  <div className="flex items-center gap-2 lg:flex-shrink-0">
                    {/* Live/Demo toggle */}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={toggleLiveData}
                      className="h-8 gap-2"
                    >
                      {useLiveData ? (
                        <Wifi className="h-4 w-4 text-green-500" />
                      ) : (
                        <WifiOff className="h-4 w-4 text-muted-foreground" />
                      )}
                      <span className="text-xs hidden sm:inline">
                        {useLiveData ? "Live" : "Demo"}
                      </span>
                    </Button>

                    {/* Refresh */}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => refetch()}
                      disabled={isLoading}
                      className="h-8 gap-2"
                    >
                      <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
                    </Button>

                    {/* Fullscreen */}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setIsFullscreen(true)}
                      className="h-8 gap-2"
                    >
                      <Maximize2 className="h-4 w-4" />
                      <span className="text-xs hidden sm:inline">Fullscreen</span>
                    </Button>

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setIsMultiChartView(true)}
                      className="h-8 gap-2"
                    >
                      <Grid2X2 className="h-4 w-4" />
                      <span className="text-xs hidden sm:inline">Multi-Chart</span>
                    </Button>

                    <IndicatorPanel
                      activeIndicators={activeIndicators}
                      onToggleIndicator={handleToggleIndicator}
                      indicatorParameters={indicatorParameters}
                      onParametersChange={setIndicatorParameters}
                    />
                  </div>
                </div>

                {/* Drawing Toolbar */}
                <div className="flex flex-wrap items-center gap-2">
                  <DrawingToolbar
                    activeTool={activeDrawingTool}
                    onSelectTool={selectTool}
                    onClearAll={clearAllDrawings}
                    drawingColor={drawingColor}
                    onColorChange={setDrawingColor}
                    hasDrawings={drawings.length > 0}
                  />
                  {drawings.length > 0 && (
                    <span className="text-xs text-muted-foreground">
                      {drawings.length} drawing{drawings.length !== 1 ? "s" : ""} saved
                    </span>
                  )}
                </div>

                <div className="bg-card rounded-xl border border-border overflow-hidden shadow-lg relative">
                  {isLoading && (
                    <div className="absolute inset-0 flex items-center justify-center bg-background/50 z-10">
                      <RefreshCw className="h-8 w-8 animate-spin text-primary" />
                    </div>
                  )}
                  {chartData.length > 0 && (
                    <ChartWithDrawings
                      data={chartData}
                      volumeData={volumeData}
                      chartType={chartType}
                      showVolume={activeIndicators.includes("volume")}
                      rsiData={indicators.rsi}
                      macdData={indicators.macd}
                      bollingerData={indicators.bollinger}
                      drawings={drawings}
                      currentDrawing={currentDrawing}
                      activeDrawingTool={activeDrawingTool}
                      isDrawing={isDrawing}
                      onDrawingStart={startDrawing}
                      onDrawingUpdate={updateCurrentDrawing}
                      onDrawingEnd={finishDrawing}
                      onDrawingSelect={setSelectedDrawingId}
                      selectedDrawingId={selectedDrawingId}
                    />
                  )}
                </div>
              </main>
            )}
          </div>
        </div>

        {/* Fullscreen Chart Overlay */}
        {isFullscreen && chartData.length > 0 && (
          <FullscreenChart
            data={chartData}
            volumeData={volumeData}
            chartType={chartType}
            showVolume={activeIndicators.includes("volume")}
            rsiData={indicators.rsi}
            macdData={indicators.macd}
            bollingerData={indicators.bollinger}
            symbol={selectedSymbol}
            timeframe={selectedTimeframe}
            drawings={drawings}
            currentDrawing={currentDrawing}
            activeDrawingTool={activeDrawingTool}
            isDrawing={isDrawing}
            onDrawingStart={startDrawing}
            onDrawingUpdate={updateCurrentDrawing}
            onDrawingEnd={finishDrawing}
            onDrawingSelect={setSelectedDrawingId}
            selectedDrawingId={selectedDrawingId}
            drawingColor={drawingColor}
            onColorChange={setDrawingColor}
            onSelectTool={selectTool}
            onClearAll={clearAllDrawings}
            onClose={() => setIsFullscreen(false)}
          />
        )}
      </SidebarProvider>
    </TooltipProvider>
  );
};

export default Index;
