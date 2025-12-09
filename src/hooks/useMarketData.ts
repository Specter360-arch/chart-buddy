import { useState, useEffect, useCallback } from 'react';
import { CandlestickData, Time } from 'lightweight-charts';
import { marketDataService, MarketQuote, CandleData, TIMEFRAME_MAP } from '@/services/marketData';
import { generateCandlestickData, generateVolumeData } from '@/utils/chartData';

interface UseMarketDataResult {
  chartData: CandlestickData<Time>[];
  volumeData: { time: Time; value: number; color: string }[];
  quote: MarketQuote | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export const useMarketData = (
  symbol: string,
  timeframe: string = '1D',
  useLiveData: boolean = true
): UseMarketDataResult => {
  const [chartData, setChartData] = useState<CandlestickData<Time>[]>([]);
  const [volumeData, setVolumeData] = useState<{ time: Time; value: number; color: string }[]>([]);
  const [quote, setQuote] = useState<MarketQuote | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    if (!useLiveData) {
      // Use generated demo data
      const basePrice = symbol.includes('BTC')
        ? 45000
        : symbol.includes('ETH')
        ? 3000
        : symbol.includes('SOL')
        ? 100
        : symbol.includes('EUR') || symbol.includes('GBP')
        ? 1.1
        : 150;

      const data = generateCandlestickData(100, basePrice);
      const volume = generateVolumeData(data);
      setChartData(data);
      setVolumeData(volume);
      setIsLoading(false);
      return;
    }

    try {
      // Fetch both time series and quote in parallel
      const [timeSeriesResult, quoteResult] = await Promise.all([
        marketDataService.getTimeSeries(symbol, timeframe, 100),
        marketDataService.getQuote(symbol),
      ]);

      if (timeSeriesResult?.candles && timeSeriesResult.candles.length > 0) {
        setChartData(timeSeriesResult.candles);
        
        // Generate volume data from candles
        const volData = timeSeriesResult.candles.map((candle: CandleData) => {
          const isGreen = candle.close >= candle.open;
          return {
            time: candle.time,
            value: candle.volume || Math.random() * 100000000 + 50000000,
            color: isGreen
              ? 'hsla(142, 76%, 36%, 0.5)'
              : 'hsla(0, 72%, 51%, 0.5)',
          };
        });
        setVolumeData(volData);
      } else {
        // Fallback to demo data if API fails
        console.log('Using demo data as fallback');
        const basePrice = symbol.includes('BTC')
          ? 45000
          : symbol.includes('ETH')
          ? 3000
          : symbol.includes('SOL')
          ? 100
          : 150;
        const data = generateCandlestickData(100, basePrice);
        const volume = generateVolumeData(data);
        setChartData(data);
        setVolumeData(volume);
        setError('Using demo data - API unavailable');
      }

      if (quoteResult) {
        setQuote(quoteResult);
      }
    } catch (err) {
      console.error('Market data fetch error:', err);
      setError('Failed to fetch market data');
      
      // Fallback to demo data
      const basePrice = 45000;
      const data = generateCandlestickData(100, basePrice);
      const volume = generateVolumeData(data);
      setChartData(data);
      setVolumeData(volume);
    } finally {
      setIsLoading(false);
    }
  }, [symbol, timeframe, useLiveData]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Auto-refresh quote every 30 seconds for live data
  useEffect(() => {
    if (!useLiveData) return;

    const intervalId = setInterval(async () => {
      const newQuote = await marketDataService.getQuote(symbol);
      if (newQuote) {
        setQuote(newQuote);
      }
    }, 30000);

    return () => clearInterval(intervalId);
  }, [symbol, useLiveData]);

  return {
    chartData,
    volumeData,
    quote,
    isLoading,
    error,
    refetch: fetchData,
  };
};
