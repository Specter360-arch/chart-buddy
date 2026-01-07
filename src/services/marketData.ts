import { supabase } from '@/integrations/supabase/client';
import { CandlestickData, Time } from 'lightweight-charts';

export interface MarketQuote {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
  high: number;
  low: number;
  volume: number;
  previousClose: number;
}

export interface CandleData extends CandlestickData<Time> {
  volume?: number;
}

// Primary trading pairs - Twelvedata compatible symbols
// These are the main instruments for our trading platform
export const MARKET_SYMBOLS = {
  forex: [
    { symbol: 'XAU/USD', name: 'Gold / US Dollar' },
    { symbol: 'EUR/USD', name: 'Euro / US Dollar' },
    { symbol: 'GBP/USD', name: 'British Pound / US Dollar' },
    { symbol: 'USD/JPY', name: 'US Dollar / Japanese Yen' },
    { symbol: 'AUD/USD', name: 'Australian Dollar / US Dollar' },
  ],
};

// Primary symbols array - these are the main trading instruments
export const ALL_SYMBOLS = [...MARKET_SYMBOLS.forex];

// Default symbol for the platform
export const DEFAULT_SYMBOL = 'XAU/USD';

// Map timeframe to Twelvedata intervals
export const TIMEFRAME_MAP: Record<string, string> = {
  '1m': '1min',
  '3m': '3min',
  '5m': '5min',
  '15m': '15min',
  '30m': '30min',
  '45m': '45min',
  '1H': '1h',
  '2H': '2h',
  '4H': '4h',
  '8H': '8h',
  '1D': '1day',
  '1W': '1week',
  '1M': '1month',
};

// Available timeframes grouped for UI
export const TIMEFRAME_GROUPS = {
  minutes: ['1m', '3m', '5m', '15m', '30m', '45m'],
  hours: ['1H', '2H', '4H', '8H'],
  days: ['1D', '1W', '1M'],
};

export const marketDataService = {
  // Fetch real-time quote for a symbol
  async getQuote(symbol: string): Promise<MarketQuote | null> {
    try {
      const { data, error } = await supabase.functions.invoke('market-data', {
        body: { action: 'quote', symbol },
      });

      if (error) {
        console.error('Quote fetch error:', error);
        return null;
      }

      if (!data?.success || !data?.data) {
        console.error('Invalid quote response:', data);
        return null;
      }

      const quote = data.data;
      return {
        symbol: quote.symbol,
        name: quote.name || symbol,
        price: parseFloat(quote.close),
        change: parseFloat(quote.change),
        changePercent: parseFloat(quote.percent_change),
        high: parseFloat(quote.high),
        low: parseFloat(quote.low),
        volume: parseFloat(quote.volume) || 0,
        previousClose: parseFloat(quote.previous_close),
      };
    } catch (error) {
      console.error('Quote fetch failed:', error);
      return null;
    }
  },

  // Fetch historical candlestick data
  async getTimeSeries(
    symbol: string,
    timeframe: string = '1D',
    outputsize: number = 100
  ): Promise<{ candles: CandleData[]; meta?: any } | null> {
    try {
      const interval = TIMEFRAME_MAP[timeframe] || '1day';
      
      const { data, error } = await supabase.functions.invoke('market-data', {
        body: { 
          action: 'time_series', 
          symbol, 
          interval,
          outputsize 
        },
      });

      if (error) {
        console.error('Time series fetch error:', error);
        return null;
      }

      if (!data?.success || !data?.data) {
        console.error('Invalid time series response:', data);
        return null;
      }

      // Ensure data is sorted by time and deduplicated
      const uniqueCandles = new Map<string | number, CandleData>();
      
      data.data.forEach((d: any) => {
        const timeKey = typeof d.time === 'number' ? d.time : String(d.time);
        // Keep the latest data for each timestamp
        uniqueCandles.set(timeKey, {
          time: d.time as Time,
          open: d.open,
          high: d.high,
          low: d.low,
          close: d.close,
          volume: d.volume,
        });
      });

      // Sort by time ascending
      const candles: CandleData[] = Array.from(uniqueCandles.values()).sort((a, b) => {
        const timeA = typeof a.time === 'number' ? a.time : new Date(a.time as string).getTime();
        const timeB = typeof b.time === 'number' ? b.time : new Date(b.time as string).getTime();
        return timeA - timeB;
      });

      return { candles, meta: data.meta };
    } catch (error) {
      console.error('Time series fetch failed:', error);
      return null;
    }
  },

  // Fetch quotes for multiple symbols (for watchlist)
  async getBatchQuotes(symbols: string[]): Promise<Record<string, MarketQuote>> {
    try {
      const { data, error } = await supabase.functions.invoke('market-data', {
        body: { action: 'batch_quote', symbol: symbols },
      });

      if (error) {
        console.error('Batch quote fetch error:', error);
        return {};
      }

      if (!data?.success || !data?.data) {
        return {};
      }

      const quotes: Record<string, MarketQuote> = {};
      
      // Handle both single and multiple responses
      if (Array.isArray(data.data)) {
        data.data.forEach((quote: any) => {
          quotes[quote.symbol] = {
            symbol: quote.symbol,
            name: quote.name || quote.symbol,
            price: parseFloat(quote.close),
            change: parseFloat(quote.change),
            changePercent: parseFloat(quote.percent_change),
            high: parseFloat(quote.high),
            low: parseFloat(quote.low),
            volume: parseFloat(quote.volume) || 0,
            previousClose: parseFloat(quote.previous_close),
          };
        });
      } else if (typeof data.data === 'object') {
        // Single quote or object with symbol keys
        Object.entries(data.data).forEach(([key, quote]: [string, any]) => {
          if (quote && quote.close) {
            quotes[key] = {
              symbol: quote.symbol || key,
              name: quote.name || key,
              price: parseFloat(quote.close),
              change: parseFloat(quote.change),
              changePercent: parseFloat(quote.percent_change),
              high: parseFloat(quote.high),
              low: parseFloat(quote.low),
              volume: parseFloat(quote.volume) || 0,
              previousClose: parseFloat(quote.previous_close),
            };
          }
        });
      }

      return quotes;
    } catch (error) {
      console.error('Batch quote fetch failed:', error);
      return {};
    }
  },

  // Get symbol category
  getSymbolCategory(symbol: string): 'forex' | null {
    if (MARKET_SYMBOLS.forex.some(s => s.symbol === symbol)) return 'forex';
    return null;
  },

  // Get symbol display name
  getSymbolName(symbol: string): string {
    const found = ALL_SYMBOLS.find(s => s.symbol === symbol);
    return found?.name || symbol;
  },
};
