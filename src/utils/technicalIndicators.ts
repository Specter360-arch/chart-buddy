import { CandlestickData, Time } from "lightweight-charts";

// Calculate Simple Moving Average
export const calculateSMA = (data: number[], period: number): number[] => {
  const sma: number[] = [];
  for (let i = 0; i < data.length; i++) {
    if (i < period - 1) {
      sma.push(NaN);
    } else {
      const sum = data.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0);
      sma.push(sum / period);
    }
  }
  return sma;
};

// Calculate Exponential Moving Average
export const calculateEMA = (data: number[], period: number): number[] => {
  const ema: number[] = [];
  const multiplier = 2 / (period + 1);

  // First EMA is SMA
  const firstSMA = data.slice(0, period).reduce((a, b) => a + b, 0) / period;
  
  for (let i = 0; i < data.length; i++) {
    if (i < period - 1) {
      ema.push(NaN);
    } else if (i === period - 1) {
      ema.push(firstSMA);
    } else {
      ema.push((data[i] - ema[i - 1]) * multiplier + ema[i - 1]);
    }
  }
  return ema;
};

// Calculate RSI (Relative Strength Index)
export const calculateRSI = (
  candleData: CandlestickData<Time>[],
  period: number = 14
): { time: Time; value: number }[] => {
  const closes = candleData.map((d) => d.close);
  const changes: number[] = [];
  
  for (let i = 1; i < closes.length; i++) {
    changes.push(closes[i] - closes[i - 1]);
  }

  const gains = changes.map((change) => (change > 0 ? change : 0));
  const losses = changes.map((change) => (change < 0 ? -change : 0));

  const avgGains = calculateSMA(gains, period);
  const avgLosses = calculateSMA(losses, period);

  const rsi: { time: Time; value: number }[] = [];
  
  for (let i = 0; i < candleData.length; i++) {
    if (i < period) {
      rsi.push({ time: candleData[i].time, value: NaN });
    } else {
      const rs = avgGains[i - 1] / avgLosses[i - 1];
      const rsiValue = 100 - 100 / (1 + rs);
      rsi.push({ time: candleData[i].time, value: isFinite(rsiValue) ? rsiValue : 50 });
    }
  }

  return rsi;
};

// Calculate MACD (Moving Average Convergence Divergence)
export const calculateMACD = (
  candleData: CandlestickData<Time>[],
  fastPeriod: number = 12,
  slowPeriod: number = 26,
  signalPeriod: number = 9
): {
  macd: { time: Time; value: number }[];
  signal: { time: Time; value: number }[];
  histogram: { time: Time; value: number; color: string }[];
} => {
  const closes = candleData.map((d) => d.close);
  const fastEMA = calculateEMA(closes, fastPeriod);
  const slowEMA = calculateEMA(closes, slowPeriod);

  const macdLine = fastEMA.map((fast, i) => fast - slowEMA[i]);
  const signalLine = calculateEMA(macdLine.filter((v) => !isNaN(v)), signalPeriod);

  // Pad signal line with NaN values to match length
  const paddedSignal = [...Array(macdLine.length - signalLine.length).fill(NaN), ...signalLine];

  const macd = candleData.map((candle, i) => ({
    time: candle.time,
    value: macdLine[i],
  }));

  const signal = candleData.map((candle, i) => ({
    time: candle.time,
    value: paddedSignal[i],
  }));

  const histogram = candleData.map((candle, i) => {
    const histValue = macdLine[i] - paddedSignal[i];
    return {
      time: candle.time,
      value: histValue,
      color: histValue >= 0 ? "hsla(142, 76%, 36%, 0.5)" : "hsla(0, 72%, 51%, 0.5)",
    };
  });

  return { macd, signal, histogram };
};

// Calculate Bollinger Bands
export const calculateBollingerBands = (
  candleData: CandlestickData<Time>[],
  period: number = 20,
  stdDev: number = 2
): {
  upper: { time: Time; value: number }[];
  middle: { time: Time; value: number }[];
  lower: { time: Time; value: number }[];
} => {
  const closes = candleData.map((d) => d.close);
  const sma = calculateSMA(closes, period);

  const upper: { time: Time; value: number }[] = [];
  const middle: { time: Time; value: number }[] = [];
  const lower: { time: Time; value: number }[] = [];

  for (let i = 0; i < candleData.length; i++) {
    if (i < period - 1) {
      upper.push({ time: candleData[i].time, value: NaN });
      middle.push({ time: candleData[i].time, value: NaN });
      lower.push({ time: candleData[i].time, value: NaN });
    } else {
      const slice = closes.slice(i - period + 1, i + 1);
      const mean = sma[i];
      const squaredDiffs = slice.map((val) => Math.pow(val - mean, 2));
      const variance = squaredDiffs.reduce((a, b) => a + b, 0) / period;
      const standardDeviation = Math.sqrt(variance);

      middle.push({ time: candleData[i].time, value: mean });
      upper.push({ time: candleData[i].time, value: mean + stdDev * standardDeviation });
      lower.push({ time: candleData[i].time, value: mean - stdDev * standardDeviation });
    }
  }

  return { upper, middle, lower };
};
