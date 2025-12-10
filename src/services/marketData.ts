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

// Major trading pairs organized by category
export const MARKET_SYMBOLS = {
  forex: [
    { symbol: 'EUR/USD', name: 'Euro / US Dollar' },
    { symbol: 'GBP/USD', name: 'British Pound / US Dollar' },
    { symbol: 'USD/JPY', name: 'US Dollar / Japanese Yen' },
    { symbol: 'USD/CHF', name: 'US Dollar / Swiss Franc' },
    { symbol: 'AUD/USD', name: 'Australian Dollar / US Dollar' },
    { symbol: 'USD/CAD', name: 'US Dollar / Canadian Dollar' },
    { symbol: 'NZD/USD', name: 'New Zealand Dollar / US Dollar' },
    { symbol: 'EUR/GBP', name: 'Euro / British Pound' },
    { symbol: 'EUR/JPY', name: 'Euro / Japanese Yen' },
    { symbol: 'GBP/JPY', name: 'British Pound / Japanese Yen' },
  ],
  crypto: [
    { symbol: 'BTC/USD', name: 'Bitcoin / US Dollar' },
    { symbol: 'ETH/USD', name: 'Ethereum / US Dollar' },
    { symbol: 'SOL/USD', name: 'Solana / US Dollar' },
    { symbol: 'XRP/USD', name: 'Ripple / US Dollar' },
    { symbol: 'ADA/USD', name: 'Cardano / US Dollar' },
    { symbol: 'DOGE/USD', name: 'Dogecoin / US Dollar' },
    { symbol: 'DOT/USD', name: 'Polkadot / US Dollar' },
    { symbol: 'AVAX/USD', name: 'Avalanche / US Dollar' },
    { symbol: 'LINK/USD', name: 'Chainlink / US Dollar' },
    { symbol: 'MATIC/USD', name: 'Polygon / US Dollar' },
  ],
  stocks: [
    { symbol: 'AAPL', name: 'Apple Inc.' },
    { symbol: 'MSFT', name: 'Microsoft Corporation' },
    { symbol: 'GOOGL', name: 'Alphabet Inc.' },
    { symbol: 'AMZN', name: 'Amazon.com Inc.' },
    { symbol: 'NVDA', name: 'NVIDIA Corporation' },
    { symbol: 'TSLA', name: 'Tesla Inc.' },
    { symbol: 'META', name: 'Meta Platforms Inc.' },
    { symbol: 'JPM', name: 'JPMorgan Chase & Co.' },
    { symbol: 'V', name: 'Visa Inc.' },
    { symbol: 'JNJ', name: 'Johnson & Johnson' },
  ],
  etfs: [
    { symbol: 'SPY', name: 'SPDR S&P 500 ETF' },
    { symbol: 'QQQ', name: 'Invesco QQQ Trust' },
    { symbol: 'DIA', name: 'SPDR Dow Jones Industrial Average ETF' },
    { symbol: 'IWM', name: 'iShares Russell 2000 ETF' },
    { symbol: 'VTI', name: 'Vanguard Total Stock Market ETF' },
    { symbol: 'GLD', name: 'SPDR Gold Shares' },
    { symbol: 'SLV', name: 'iShares Silver Trust' },
    { symbol: 'USO', name: 'United States Oil Fund' },
    { symbol: 'XLF', name: 'Financial Select Sector SPDR Fund' },
    { symbol: 'XLE', name: 'Energy Select Sector SPDR Fund' },
  ],
};

// Flatten all symbols for easy access
export const ALL_SYMBOLS = [
  ...MARKET_SYMBOLS.forex,
  ...MARKET_SYMBOLS.crypto,
  ...MARKET_SYMBOLS.stocks,
  ...MARKET_SYMBOLS.etfs,
];

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

      const candles: CandleData[] = data.data.map((d: any) => ({
        time: d.time as Time,
        open: d.open,
        high: d.high,
        low: d.low,
        close: d.close,
        volume: d.volume,
      }));

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
  getSymbolCategory(symbol: string): 'forex' | 'crypto' | 'stocks' | 'etfs' | null {
    if (MARKET_SYMBOLS.forex.some(s => s.symbol === symbol)) return 'forex';
    if (MARKET_SYMBOLS.crypto.some(s => s.symbol === symbol)) return 'crypto';
    if (MARKET_SYMBOLS.stocks.some(s => s.symbol === symbol)) return 'stocks';
    if (MARKET_SYMBOLS.etfs.some(s => s.symbol === symbol)) return 'etfs';
    return null;
  },

  // Get symbol display name
  getSymbolName(symbol: string): string {
    const found = ALL_SYMBOLS.find(s => s.symbol === symbol);
    return found?.name || symbol;
  },
};
