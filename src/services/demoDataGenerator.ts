import { CandlestickData, Time } from 'lightweight-charts';

// ─── Symbol base prices ───────────────────────────────────────────────
const BASE_PRICES: Record<string, number> = {
  'XAU/USD': 2650,
  'EUR/USD': 1.08,
  'GBP/USD': 1.27,
  'USD/JPY': 157,
  'AUD/USD': 0.62,
};

const getBasePrice = (symbol: string): number =>
  BASE_PRICES[symbol] ?? 1.0;

// Volatility as a fraction of base price, per timeframe
const VOLATILITY: Record<string, number> = {
  '1m': 0.0004,
  '5m': 0.001,
  '30m': 0.003,
};

// How many seconds between simulated ticks inside the current candle
const TICK_INTERVAL: Record<string, number> = {
  '1m': 5,   // tick every 5 s inside a 60 s candle
  '5m': 10,  // tick every 10 s inside a 300 s candle
  '30m': 30, // tick every 30 s inside an 1800 s candle
};

// Candle duration in seconds
const CANDLE_DURATION: Record<string, number> = {
  '1m': 60,
  '5m': 300,
  '30m': 1800,
};

// ─── Helpers ──────────────────────────────────────────────────────────

/** Gaussian-ish noise via Box–Muller */
function gaussRandom(mean = 0, stddev = 1): number {
  const u1 = Math.random();
  const u2 = Math.random();
  return mean + stddev * Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}

/** Snap a timestamp (seconds) down to the candle boundary */
function floorToCandle(ts: number, durationSec: number): number {
  return Math.floor(ts / durationSec) * durationSec;
}

// ─── History generator ────────────────────────────────────────────────

export function generateDemoHistory(
  symbol: string,
  timeframe: string,
  count = 100,
): { candles: CandlestickData<Time>[]; volume: { time: Time; value: number; color: string }[] } {
  const base = getBasePrice(symbol);
  const vol = VOLATILITY[timeframe] ?? 0.002;
  const durationSec = CANDLE_DURATION[timeframe] ?? 60;

  const now = Math.floor(Date.now() / 1000);
  const startTs = floorToCandle(now, durationSec) - durationSec * count;

  let price = base;
  const candles: CandlestickData<Time>[] = [];
  const volume: { time: Time; value: number; color: string }[] = [];

  for (let i = 0; i < count; i++) {
    const time = (startTs + i * durationSec) as unknown as Time;
    const open = price;
    // Simulate several micro-steps within the candle
    let high = open;
    let low = open;
    let close = open;
    const steps = 10;
    for (let s = 0; s < steps; s++) {
      close += gaussRandom(0, base * vol * 0.3);
      close = Math.max(close, base * 0.8);
      high = Math.max(high, close);
      low = Math.min(low, close);
    }
    candles.push({ time, open, high, low, close });

    const isGreen = close >= open;
    volume.push({
      time,
      value: Math.random() * 100_000_000 + 50_000_000,
      color: isGreen ? 'hsla(142, 76%, 36%, 0.5)' : 'hsla(0, 72%, 51%, 0.5)',
    });

    price = close;
  }

  return { candles, volume };
}

// ─── Live tick engine ─────────────────────────────────────────────────

export interface DemoTick {
  price: number;
  timestamp: number; // unix ms
}

export type TickCallback = (tick: DemoTick) => void;
export type CandleCallback = (candle: CandlestickData<Time>, vol: { time: Time; value: number; color: string }) => void;

/**
 * Creates an interval-based ticker that emits simulated price updates
 * at the correct sub-candle frequency for the given timeframe.
 *
 * - `onTick` fires every few seconds with a new price (updates current candle).
 * - `onNewCandle` fires when a candle boundary is crossed (append new candle).
 *
 * Returns a cleanup function.
 */
export function startDemoTicker(
  symbol: string,
  timeframe: string,
  lastPrice: number,
  onTick: TickCallback,
  onNewCandle: CandleCallback,
): () => void {
  const base = getBasePrice(symbol);
  const vol = VOLATILITY[timeframe] ?? 0.0004;
  const tickSec = TICK_INTERVAL[timeframe] ?? 5;
  const durationSec = CANDLE_DURATION[timeframe] ?? 60;

  let price = lastPrice;
  let currentCandleTs = floorToCandle(Math.floor(Date.now() / 1000), durationSec);

  const intervalId = setInterval(() => {
    const nowSec = Math.floor(Date.now() / 1000);
    const candleTs = floorToCandle(nowSec, durationSec);

    // Did we cross into a new candle?
    if (candleTs > currentCandleTs) {
      currentCandleTs = candleTs;
      // Open new candle at current price
      const newCandle: CandlestickData<Time> = {
        time: candleTs as unknown as Time,
        open: price,
        high: price,
        low: price,
        close: price,
      };
      const isGreen = true;
      onNewCandle(newCandle, {
        time: candleTs as unknown as Time,
        value: Math.random() * 100_000_000 + 50_000_000,
        color: isGreen ? 'hsla(142, 76%, 36%, 0.5)' : 'hsla(0, 72%, 51%, 0.5)',
      });
    }

    // Random walk tick
    price += gaussRandom(0, base * vol * 0.15);
    price = Math.max(price, base * 0.8);

    onTick({ price, timestamp: Date.now() });
  }, tickSec * 1000);

  return () => clearInterval(intervalId);
}
