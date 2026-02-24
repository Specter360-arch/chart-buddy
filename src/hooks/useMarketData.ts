import { useState, useEffect, useCallback, useRef } from 'react';
import { CandlestickData, Time } from 'lightweight-charts';
import { marketDataService, MarketQuote, CandleData, TIMEFRAME_MAP } from '@/services/marketData';
import { generateDemoHistory, startDemoTicker } from '@/services/demoDataGenerator';
import { useWebSocketPrice, LivePrice } from './useWebSocketPrice';

// Refresh intervals based on timeframe (in milliseconds)
const REFRESH_INTERVALS: Record<string, number> = {
  '1m': 10000,
  '3m': 20000,
  '5m': 30000,
  '15m': 45000,
  '30m': 60000,
  '45m': 90000,
  '1H': 120000,
  '2H': 300000,
  '4H': 600000,
  '8H': 900000,
  '1D': 1800000,
  '1W': 3600000,
  '1M': 7200000,
};

// Demo-supported timeframes
const DEMO_TIMEFRAMES = ['1m', '5m', '30m'];
const nearestDemoTimeframe = (tf: string) => {
  if (DEMO_TIMEFRAMES.includes(tf)) return tf;
  const minutes: Record<string, number> = {
    '3m': 5, '15m': 30, '45m': 30,
    '1H': 30, '2H': 30, '4H': 30, '8H': 30,
    '1D': 30, '1W': 30, '1M': 30,
  };
  const target = minutes[tf] ?? 1;
  if (target <= 1) return '1m';
  if (target <= 5) return '5m';
  return '30m';
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

  // Demo ticker cleanup ref
  const demoTickerCleanup = useRef<(() => void) | null>(null);

  // WebSocket for real-time price updates
  const { livePrice, isConnected } = useWebSocketPrice(symbol, useLiveData);

  // Track last processed price to avoid unnecessary updates
  const lastProcessedPrice = useRef<number | null>(null);

  // Update latest candle with live price (live mode only)
  useEffect(() => {
    if (!useLiveData || !livePrice || chartData.length === 0) return;

    if (lastProcessedPrice.current === livePrice.price) return;
    lastProcessedPrice.current = livePrice.price;

    setChartData(prevData => {
      if (prevData.length === 0) return prevData;
      const newData = [...prevData];
      const lastCandle = { ...newData[newData.length - 1] };
      lastCandle.close = livePrice.price;
      lastCandle.high = Math.max(lastCandle.high, livePrice.price);
      lastCandle.low = Math.min(lastCandle.low, livePrice.price);
      newData[newData.length - 1] = lastCandle;
      return newData;
    });

    setQuote(prev => prev ? {
      ...prev,
      price: livePrice.price,
      change: livePrice.price - prev.previousClose,
      changePercent: ((livePrice.price - prev.previousClose) / prev.previousClose) * 100,
    } : null);
  }, [livePrice, chartData.length, useLiveData]);

  // ─── Demo mode: generate history + start ticker ────────────────────
  const startDemo = useCallback(() => {
    // Clean up previous ticker
    demoTickerCleanup.current?.();
    demoTickerCleanup.current = null;

    const demoTf = nearestDemoTimeframe(timeframe);
    const { candles, volume } = generateDemoHistory(symbol, demoTf, 100);

    setChartData(candles);
    setVolumeData(volume);

    // Build a synthetic quote from the last candle
    const last = candles[candles.length - 1];
    const prev = candles[candles.length - 2] ?? last;
    setQuote({
      symbol,
      name: symbol,
      price: last.close,
      change: last.close - prev.close,
      changePercent: ((last.close - prev.close) / prev.close) * 100,
      high: last.high,
      low: last.low,
      volume: 0,
      previousClose: prev.close,
    });

    // Start live ticker
    const cleanup = startDemoTicker(
      symbol,
      demoTf,
      last.close,
      // onTick – update last candle in-place
      (tick) => {
        setChartData(prev => {
          if (prev.length === 0) return prev;
          const updated = [...prev];
          const c = { ...updated[updated.length - 1] };
          c.close = tick.price;
          c.high = Math.max(c.high, tick.price);
          c.low = Math.min(c.low, tick.price);
          updated[updated.length - 1] = c;
          return updated;
        });
        setQuote(prev => {
          if (!prev) return prev;
          return {
            ...prev,
            price: tick.price,
            change: tick.price - prev.previousClose,
            changePercent: ((tick.price - prev.previousClose) / prev.previousClose) * 100,
            high: Math.max(prev.high, tick.price),
            low: Math.min(prev.low, tick.price),
          };
        });
      },
      // onNewCandle – append new candle, trim old ones
      (candle, vol) => {
        setChartData(prev => [...prev.slice(-199), candle]);
        setVolumeData(prev => [...prev.slice(-199), vol]);
        setQuote(prev => prev ? { ...prev, high: candle.open, low: candle.open } : prev);
      },
    );

    demoTickerCleanup.current = cleanup;
    hasLoadedOnce.current = true;
    setIsLoading(false);
    setIsRefreshing(false);
    setError(null);
  }, [symbol, timeframe]);

  // ─── Live mode: fetch from API ─────────────────────────────────────
  const fetchLiveData = useCallback(async (isBackgroundRefresh = false) => {
    if (!hasLoadedOnce.current) {
      setIsLoading(true);
    } else if (isBackgroundRefresh) {
      setIsRefreshing(true);
    }
    setError(null);

    try {
      const [timeSeriesResult, quoteResult] = await Promise.all([
        marketDataService.getTimeSeries(symbol, timeframe, 100),
        marketDataService.getQuote(symbol),
      ]);

      if (timeSeriesResult?.candles && timeSeriesResult.candles.length > 0) {
        setChartData(timeSeriesResult.candles);
        const volData = timeSeriesResult.candles.map((candle: CandleData) => {
          const isGreen = candle.close >= candle.open;
          return {
            time: candle.time,
            value: candle.volume || Math.random() * 100000000 + 50000000,
            color: isGreen ? 'hsla(142, 76%, 36%, 0.5)' : 'hsla(0, 72%, 51%, 0.5)',
          };
        });
        setVolumeData(volData);
      } else {
        // API returned nothing – fall back to demo
        console.log('API returned no data, falling back to demo');
        startDemo();
        setError('Using demo data – API unavailable');
        return;
      }

      if (quoteResult) {
        setQuote(quoteResult);
      }
    } catch (err) {
      console.error('Market data fetch error:', err);
      startDemo();
      setError('Offline – running on demo data');
      return;
    } finally {
      hasLoadedOnce.current = true;
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [symbol, timeframe, startDemo]);

  // ─── Main data-fetch effect ────────────────────────────────────────
  useEffect(() => {
    hasLoadedOnce.current = false;
  }, [symbol, timeframe]);

  useEffect(() => {
    demoTickerCleanup.current?.();
    demoTickerCleanup.current = null;

    if (useLiveData) {
      fetchLiveData();
    } else {
      startDemo();
    }

    return () => {
      demoTickerCleanup.current?.();
      demoTickerCleanup.current = null;
    };
  }, [useLiveData, fetchLiveData, startDemo]);

  // Auto-refresh for live data
  useEffect(() => {
    if (!useLiveData) return;
    const refreshInterval = REFRESH_INTERVALS[timeframe] || 60000;
    const intervalId = setInterval(() => fetchLiveData(true), refreshInterval);
    return () => clearInterval(intervalId);
  }, [timeframe, useLiveData, fetchLiveData]);

  // Fallback quote refresh if WebSocket disconnects
  useEffect(() => {
    if (!useLiveData || isConnected) return;
    const intervalId = setInterval(async () => {
      const newQuote = await marketDataService.getQuote(symbol);
      if (newQuote) setQuote(newQuote);
    }, 30000);
    return () => clearInterval(intervalId);
  }, [symbol, useLiveData, isConnected]);

  return {
    chartData,
    volumeData,
    quote,
    livePrice: useLiveData ? livePrice : null,
    isLoading,
    isRefreshing,
    isConnected: useLiveData ? isConnected : false,
    error,
    refetch: useLiveData ? () => fetchLiveData(false) : () => Promise.resolve(startDemo()),
  };
};
