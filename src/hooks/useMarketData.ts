import { useState, useEffect, useCallback, useRef } from 'react';
import { CandlestickData, Time } from 'lightweight-charts';
import { marketDataService, MarketQuote, CandleData, TIMEFRAME_MAP } from '@/services/marketData';
import { generateCandlestickData, generateVolumeData } from '@/utils/chartData';
import { useWebSocketPrice, LivePrice } from './useWebSocketPrice';

// Refresh intervals based on timeframe (in milliseconds)
// Lower timeframes get faster refresh rates
const REFRESH_INTERVALS: Record<string, number> = {
  '1m': 10000,    // 10 seconds - fastest for 1min candles
  '3m': 20000,    // 20 seconds
  '5m': 30000,    // 30 seconds
  '15m': 45000,   // 45 seconds
  '30m': 60000,   // 1 minute
  '45m': 90000,   // 1.5 minutes
  '1H': 120000,   // 2 minutes
  '2H': 300000,   // 5 minutes
  '4H': 600000,   // 10 minutes
  '8H': 900000,   // 15 minutes
  '1D': 1800000,  // 30 minutes
  '1W': 3600000,  // 1 hour
  '1M': 7200000,  // 2 hours
};

interface UseMarketDataResult {
  chartData: CandlestickData<Time>[];
  volumeData: { time: Time; value: number; color: string }[];
  quote: MarketQuote | null;
  livePrice: LivePrice | null;
  isLoading: boolean;
  isRefreshing: boolean;
  isConnected: boolean;
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
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const hasLoadedOnce = useRef(false);
  
  // WebSocket for real-time price updates
  const { livePrice, isConnected } = useWebSocketPrice(symbol, useLiveData);

  // Track last processed price to avoid unnecessary updates
  const lastProcessedPrice = useRef<number | null>(null);

  // Update latest candle with live price
  useEffect(() => {
    if (!livePrice || chartData.length === 0) return;
    
    // Avoid duplicate updates for same price
    if (lastProcessedPrice.current === livePrice.price) return;
    lastProcessedPrice.current = livePrice.price;

    setChartData(prevData => {
      if (prevData.length === 0) return prevData;
      
      const newData = [...prevData];
      const lastCandle = { ...newData[newData.length - 1] };
      
      // Update the last candle with live price - keep the same time
      lastCandle.close = livePrice.price;
      lastCandle.high = Math.max(lastCandle.high, livePrice.price);
      lastCandle.low = Math.min(lastCandle.low, livePrice.price);
      
      newData[newData.length - 1] = lastCandle;
      return newData;
    });

    // Also update quote price
    setQuote(prev => prev ? {
      ...prev,
      price: livePrice.price,
      change: livePrice.price - prev.previousClose,
      changePercent: ((livePrice.price - prev.previousClose) / prev.previousClose) * 100,
    } : null);
  }, [livePrice, chartData.length]);

  const fetchData = useCallback(async (isBackgroundRefresh = false) => {
    // Only show full loading on initial load, otherwise show subtle refresh
    if (!hasLoadedOnce.current) {
      setIsLoading(true);
    } else if (isBackgroundRefresh) {
      setIsRefreshing(true);
    }
    setError(null);

    if (!useLiveData) {
      // Use generated demo data - base prices for our 5 forex pairs
      const basePrice = symbol.includes('XAU')
        ? 2650
        : symbol.includes('EUR')
        ? 1.08
        : symbol.includes('GBP')
        ? 1.27
        : symbol.includes('JPY')
        ? 157
        : symbol.includes('AUD')
        ? 0.62
        : 1.0;

      const data = generateCandlestickData(100, basePrice);
      const volume = generateVolumeData(data);
      setChartData(data);
      setVolumeData(volume);
      hasLoadedOnce.current = true;
      setIsLoading(false);
      setIsRefreshing(false);
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
        const basePrice = symbol.includes('XAU')
          ? 2650
          : symbol.includes('EUR')
          ? 1.08
          : symbol.includes('GBP')
          ? 1.27
          : symbol.includes('JPY')
          ? 157
          : symbol.includes('AUD')
          ? 0.62
          : 1.0;
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
      hasLoadedOnce.current = true;
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [symbol, timeframe, useLiveData]);

  // Reset hasLoadedOnce when symbol or timeframe changes
  useEffect(() => {
    hasLoadedOnce.current = false;
  }, [symbol, timeframe]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Auto-refresh data based on timeframe
  useEffect(() => {
    if (!useLiveData) return;

    const refreshInterval = REFRESH_INTERVALS[timeframe] || 60000;
    
    const intervalId = setInterval(() => {
      fetchData(true); // Background refresh
    }, refreshInterval);

    return () => clearInterval(intervalId);
  }, [timeframe, useLiveData, fetchData]);

  // Fallback quote refresh if WebSocket disconnects
  useEffect(() => {
    if (!useLiveData || isConnected) return;

    const intervalId = setInterval(async () => {
      const newQuote = await marketDataService.getQuote(symbol);
      if (newQuote) {
        setQuote(newQuote);
      }
    }, 30000);

    return () => clearInterval(intervalId);
  }, [symbol, useLiveData, isConnected]);

  return {
    chartData,
    volumeData,
    quote,
    livePrice,
    isLoading,
    isRefreshing,
    isConnected,
    error,
    refetch: () => fetchData(false),
  };
};
