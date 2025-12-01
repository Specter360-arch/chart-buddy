import { useState, useEffect, useMemo } from "react";
import { Header } from "@/components/Header";
import { TradingChart } from "@/components/TradingChart";
import { MarketStats } from "@/components/MarketStats";
import { IndicatorPanel, IndicatorType } from "@/components/IndicatorPanel";
import { generateCandlestickData, generateVolumeData, getMarketStats } from "@/utils/chartData";
import { calculateRSI, calculateMACD, calculateBollingerBands } from "@/utils/technicalIndicators";
import { CandlestickData, Time } from "lightweight-charts";

const Index = () => {
  const [selectedSymbol, setSelectedSymbol] = useState("BTC/USD");
  const [selectedTimeframe, setSelectedTimeframe] = useState("1D");
  const [chartType, setChartType] = useState<"candlestick" | "line">("candlestick");
  const [chartData, setChartData] = useState<CandlestickData<Time>[]>([]);
  const [volumeData, setVolumeData] = useState<{ time: Time; value: number; color: string }[]>([]);
  const [activeIndicators, setActiveIndicators] = useState<IndicatorType[]>(["volume"]);

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

  // Calculate indicators based on active indicators
  const indicators = useMemo(() => {
    if (chartData.length === 0) return {};

    return {
      rsi: activeIndicators.includes("rsi") ? calculateRSI(chartData) : undefined,
      macd: activeIndicators.includes("macd") ? calculateMACD(chartData) : undefined,
      bollinger: activeIndicators.includes("bollinger")
        ? calculateBollingerBands(chartData)
        : undefined,
    };
  }, [chartData, activeIndicators]);

  const handleToggleIndicator = (indicator: IndicatorType) => {
    setActiveIndicators((prev) =>
      prev.includes(indicator)
        ? prev.filter((i) => i !== indicator)
        : [...prev, indicator]
    );
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header
        selectedSymbol={selectedSymbol}
        onSymbolChange={setSelectedSymbol}
        selectedTimeframe={selectedTimeframe}
        onTimeframeChange={setSelectedTimeframe}
        chartType={chartType}
        onChartTypeChange={setChartType}
      />

      <main className="flex-1 p-6 space-y-6">
        <div className="flex items-center justify-between">
          <MarketStats
            symbol={selectedSymbol}
            price={stats.price}
            change={stats.change}
            changePercent={stats.changePercent}
            high24h={stats.high24h}
            low24h={stats.low24h}
            volume24h={stats.volume24h}
          />

          <IndicatorPanel
            activeIndicators={activeIndicators}
            onToggleIndicator={handleToggleIndicator}
          />
        </div>

        <div className="bg-card rounded-lg border border-border p-4">
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
    </div>
  );
};

export default Index;
