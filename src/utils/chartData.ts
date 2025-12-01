import { CandlestickData, Time } from "lightweight-charts";

// Generate realistic candlestick data
export const generateCandlestickData = (
  days: number = 100,
  basePrice: number = 45000
): CandlestickData<Time>[] => {
  const data: CandlestickData<Time>[] = [];
  let currentPrice = basePrice;
  const now = new Date();

  for (let i = days; i >= 0; i--) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);
    
    // Random price movement
    const change = (Math.random() - 0.5) * basePrice * 0.05;
    currentPrice = Math.max(currentPrice + change, basePrice * 0.5);

    const open = currentPrice;
    const close = currentPrice + (Math.random() - 0.5) * basePrice * 0.03;
    const high = Math.max(open, close) + Math.random() * basePrice * 0.02;
    const low = Math.min(open, close) - Math.random() * basePrice * 0.02;

    data.push({
      time: date.toISOString().split("T")[0] as Time,
      open,
      high,
      low,
      close,
    });

    currentPrice = close;
  }

  return data;
};

// Generate volume data
export const generateVolumeData = (
  candleData: CandlestickData<Time>[]
): { time: Time; value: number; color: string }[] => {
  return candleData.map((candle) => {
    const isGreen = candle.close >= candle.open;
    return {
      time: candle.time,
      value: Math.random() * 100000000 + 50000000,
      color: isGreen
        ? "hsla(142, 76%, 36%, 0.5)"
        : "hsla(0, 72%, 51%, 0.5)",
    };
  });
};

// Get current market stats from data
export const getMarketStats = (data: CandlestickData<Time>[]) => {
  if (data.length === 0) {
    return {
      price: 0,
      change: 0,
      changePercent: 0,
      high24h: 0,
      low24h: 0,
      volume24h: 0,
    };
  }

  const latest = data[data.length - 1];
  const previous = data[data.length - 2];
  const last24h = data.slice(-24);

  const price = latest.close;
  const change = price - previous.close;
  const changePercent = (change / previous.close) * 100;
  const high24h = Math.max(...last24h.map((d) => d.high));
  const low24h = Math.min(...last24h.map((d) => d.low));
  const volume24h = Math.random() * 5000000000 + 1000000000;

  return {
    price,
    change,
    changePercent,
    high24h,
    low24h,
    volume24h,
  };
};
