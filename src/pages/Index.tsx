import { useState, useEffect, useMemo } from "react";
import { Header } from "@/components/Header";
import { TradingChart } from "@/components/TradingChart";
import { MarketStats } from "@/components/MarketStats";
import { IndicatorPanel, IndicatorType } from "@/components/IndicatorPanel";
import { IndicatorParameters } from "@/components/IndicatorSettings";
import { WatchlistSidebar } from "@/components/WatchlistSidebar";
import { MultiChartLayout } from "@/components/MultiChartLayout";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { generateCandlestickData, generateVolumeData, getMarketStats } from "@/utils/chartData";
import { calculateRSI, calculateMACD, calculateBollingerBands } from "@/utils/technicalIndicators";
import { CandlestickData, Time } from "lightweight-charts";
import { Grid2X2, Maximize2 } from "lucide-react";

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

  useEffect(() => {
    // Generate data based on selected symbol
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

  const stats = getMarketStats(chartData);

  // Calculate indicators based on active indicators and their parameters
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

              <div className="bg-card rounded-lg border border-border p-2 sm:p-3 lg:p-4">
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
            </main>
          )}
        </div>
      </div>
    </SidebarProvider>
  );
};

export default Index;
