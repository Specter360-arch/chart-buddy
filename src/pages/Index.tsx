import { useState, useEffect, useMemo } from "react";
import { Header } from "@/components/Header";
import { ChartWithDrawings } from "@/components/ChartWithDrawings";
import { DrawingToolbar } from "@/components/DrawingToolbar";
import { MarketStats } from "@/components/MarketStats";
import { IndicatorPanel, IndicatorType } from "@/components/IndicatorPanel";
import { IndicatorParameters } from "@/components/IndicatorSettings";
import { WatchlistSidebar } from "@/components/WatchlistSidebar";
import { MultiChartLayout } from "@/components/MultiChartLayout";
import { SidebarProvider } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { generateCandlestickData, generateVolumeData, getMarketStats } from "@/utils/chartData";
import { calculateRSI, calculateMACD, calculateBollingerBands } from "@/utils/technicalIndicators";
import { CandlestickData, Time } from "lightweight-charts";
import { Grid2X2 } from "lucide-react";
import { useChartDrawings } from "@/hooks/useChartDrawings";
import { TooltipProvider } from "@/components/ui/tooltip";

const availableSymbols = ["BTC/USD", "ETH/USD", "SOL/USD", "AAPL", "GOOGL", "TSLA"];

const Index = () => {
  const [selectedSymbol, setSelectedSymbol] = useState("BTC/USD");
  const [selectedTimeframe, setSelectedTimeframe] = useState("1D");
  const [chartType, setChartType] = useState<"candlestick" | "line">("candlestick");
  const [chartData, setChartData] = useState<CandlestickData<Time>[]>([]);
  const [volumeData, setVolumeData] = useState<{ time: Time; value: number; color: string }[]>([]);
  const [activeIndicators, setActiveIndicators] = useState<IndicatorType[]>(["volume"]);
  const [isMultiChartView, setIsMultiChartView] = useState(false);
  const [indicatorParameters, setIndicatorParameters] = useState<IndicatorParameters>({
    rsi: { period: 14 },
    macd: { fastPeriod: 12, slowPeriod: 26, signalPeriod: 9 },
    bollinger: { period: 20, stdDev: 2 },
  });

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

  useEffect(() => {
    const basePrice = selectedSymbol.includes("BTC")
      ? 45000
      : selectedSymbol.includes("ETH")
      ? 3000
      : selectedSymbol.includes("SOL")
      ? 100
      : 150;

    const data = generateCandlestickData(100, basePrice);
    const volume = generateVolumeData(data);

    setChartData(data);
    setVolumeData(volume);
  }, [selectedSymbol, selectedTimeframe]);

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
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setIsMultiChartView(true)}
                      className="h-8 gap-2"
                    >
                      <Grid2X2 className="h-4 w-4" />
                      <span className="text-xs">Multi-Chart</span>
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

                <div className="bg-card rounded-xl border border-border overflow-hidden shadow-lg">
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
      </SidebarProvider>
    </TooltipProvider>
  );
};

export default Index;
