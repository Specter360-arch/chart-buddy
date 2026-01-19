import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Japanese candlestick pattern definitions
interface Candle {
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
  timestamp: number;
}

interface PatternResult {
  patternName: string;
  patternType: 'bullish' | 'bearish' | 'neutral';
  confidence: number;
  description: string;
}

// Pattern detection utilities
const bodySize = (c: Candle) => Math.abs(c.close - c.open);
const upperWick = (c: Candle) => c.high - Math.max(c.open, c.close);
const lowerWick = (c: Candle) => Math.min(c.open, c.close) - c.low;
const isBullish = (c: Candle) => c.close > c.open;
const isBearish = (c: Candle) => c.close < c.open;
const candleRange = (c: Candle) => c.high - c.low;

// Calculate average body size for context
const avgBodySize = (candles: Candle[]) => {
  if (candles.length === 0) return 0;
  return candles.reduce((sum, c) => sum + bodySize(c), 0) / candles.length;
};

// Japanese Pattern Detection Functions
function detectDoji(candle: Candle, avgBody: number): PatternResult | null {
  const body = bodySize(candle);
  const range = candleRange(candle);
  
  if (range > 0 && body / range < 0.1 && body < avgBody * 0.2) {
    const upper = upperWick(candle);
    const lower = lowerWick(candle);
    
    let subType = 'standard';
    if (upper > lower * 3 && lower < range * 0.1) subType = 'dragonfly';
    else if (lower > upper * 3 && upper < range * 0.1) subType = 'gravestone';
    else if (upper > range * 0.3 && lower > range * 0.3) subType = 'long-legged';
    
    return {
      patternName: 'doji',
      patternType: 'neutral',
      confidence: 0.7 + (1 - body / range) * 0.2,
      description: `${subType.charAt(0).toUpperCase() + subType.slice(1)} Doji - Indecision in the market`,
    };
  }
  return null;
}

function detectHammer(candle: Candle, avgBody: number, prevCandles: Candle[]): PatternResult | null {
  const body = bodySize(candle);
  const lower = lowerWick(candle);
  const upper = upperWick(candle);
  const range = candleRange(candle);
  
  // Hammer: small body at top, long lower wick (2x+ body), minimal upper wick
  if (
    body > avgBody * 0.3 &&
    lower >= body * 2 &&
    upper < body * 0.5 &&
    range > avgBody * 0.5
  ) {
    // Check if in downtrend for validity
    const inDowntrend = prevCandles.length >= 3 && 
      prevCandles.slice(-3).every((c, i, arr) => i === 0 || c.close < arr[i-1].close);
    
    const confidence = 0.65 + (lower / body / 10) + (inDowntrend ? 0.15 : 0);
    
    return {
      patternName: 'hammer',
      patternType: 'bullish',
      confidence: Math.min(confidence, 0.95),
      description: 'Hammer - Potential bullish reversal signal after downtrend',
    };
  }
  return null;
}

function detectInvertedHammer(candle: Candle, avgBody: number, prevCandles: Candle[]): PatternResult | null {
  const body = bodySize(candle);
  const lower = lowerWick(candle);
  const upper = upperWick(candle);
  const range = candleRange(candle);
  
  // Inverted Hammer: small body at bottom, long upper wick, minimal lower wick
  if (
    body > avgBody * 0.3 &&
    upper >= body * 2 &&
    lower < body * 0.5 &&
    range > avgBody * 0.5
  ) {
    const inDowntrend = prevCandles.length >= 3 && 
      prevCandles.slice(-3).every((c, i, arr) => i === 0 || c.close < arr[i-1].close);
    
    const confidence = 0.6 + (upper / body / 10) + (inDowntrend ? 0.15 : 0);
    
    return {
      patternName: 'inverted_hammer',
      patternType: 'bullish',
      confidence: Math.min(confidence, 0.9),
      description: 'Inverted Hammer - Potential bullish reversal after downtrend',
    };
  }
  return null;
}

function detectHangingMan(candle: Candle, avgBody: number, prevCandles: Candle[]): PatternResult | null {
  const body = bodySize(candle);
  const lower = lowerWick(candle);
  const upper = upperWick(candle);
  const range = candleRange(candle);
  
  // Same shape as hammer but in uptrend
  if (
    body > avgBody * 0.3 &&
    lower >= body * 2 &&
    upper < body * 0.5 &&
    range > avgBody * 0.5
  ) {
    const inUptrend = prevCandles.length >= 3 && 
      prevCandles.slice(-3).every((c, i, arr) => i === 0 || c.close > arr[i-1].close);
    
    if (inUptrend) {
      const confidence = 0.6 + (lower / body / 10);
      
      return {
        patternName: 'hanging_man',
        patternType: 'bearish',
        confidence: Math.min(confidence, 0.85),
        description: 'Hanging Man - Potential bearish reversal signal after uptrend',
      };
    }
  }
  return null;
}

function detectEngulfing(curr: Candle, prev: Candle): PatternResult | null {
  const currBody = bodySize(curr);
  const prevBody = bodySize(prev);
  
  // Bullish Engulfing
  if (
    isBearish(prev) &&
    isBullish(curr) &&
    curr.open < prev.close &&
    curr.close > prev.open &&
    currBody > prevBody * 1.5
  ) {
    return {
      patternName: 'bullish_engulfing',
      patternType: 'bullish',
      confidence: 0.75 + Math.min(currBody / prevBody / 10, 0.2),
      description: 'Bullish Engulfing - Strong reversal signal, buyers taking control',
    };
  }
  
  // Bearish Engulfing
  if (
    isBullish(prev) &&
    isBearish(curr) &&
    curr.open > prev.close &&
    curr.close < prev.open &&
    currBody > prevBody * 1.5
  ) {
    return {
      patternName: 'bearish_engulfing',
      patternType: 'bearish',
      confidence: 0.75 + Math.min(currBody / prevBody / 10, 0.2),
      description: 'Bearish Engulfing - Strong reversal signal, sellers taking control',
    };
  }
  
  return null;
}

function detectHarami(curr: Candle, prev: Candle): PatternResult | null {
  const currBody = bodySize(curr);
  const prevBody = bodySize(prev);
  
  // Bullish Harami
  if (
    isBearish(prev) &&
    isBullish(curr) &&
    curr.close < prev.open &&
    curr.open > prev.close &&
    currBody < prevBody * 0.5
  ) {
    return {
      patternName: 'bullish_harami',
      patternType: 'bullish',
      confidence: 0.65,
      description: 'Bullish Harami - Potential reversal, momentum weakening',
    };
  }
  
  // Bearish Harami
  if (
    isBullish(prev) &&
    isBearish(curr) &&
    curr.open < prev.close &&
    curr.close > prev.open &&
    currBody < prevBody * 0.5
  ) {
    return {
      patternName: 'bearish_harami',
      patternType: 'bearish',
      confidence: 0.65,
      description: 'Bearish Harami - Potential reversal, momentum weakening',
    };
  }
  
  return null;
}

function detectMorningStar(candles: Candle[]): PatternResult | null {
  if (candles.length < 3) return null;
  
  const [first, second, third] = candles.slice(-3);
  const firstBody = bodySize(first);
  const secondBody = bodySize(second);
  const thirdBody = bodySize(third);
  
  if (
    isBearish(first) &&
    firstBody > secondBody * 2 &&
    isBullish(third) &&
    thirdBody > secondBody * 2 &&
    third.close > (first.open + first.close) / 2 &&
    second.close < first.close &&
    second.close < third.open
  ) {
    return {
      patternName: 'morning_star',
      patternType: 'bullish',
      confidence: 0.8,
      description: 'Morning Star - Strong bullish reversal pattern',
    };
  }
  return null;
}

function detectEveningStar(candles: Candle[]): PatternResult | null {
  if (candles.length < 3) return null;
  
  const [first, second, third] = candles.slice(-3);
  const firstBody = bodySize(first);
  const secondBody = bodySize(second);
  const thirdBody = bodySize(third);
  
  if (
    isBullish(first) &&
    firstBody > secondBody * 2 &&
    isBearish(third) &&
    thirdBody > secondBody * 2 &&
    third.close < (first.open + first.close) / 2 &&
    second.close > first.close &&
    second.close > third.open
  ) {
    return {
      patternName: 'evening_star',
      patternType: 'bearish',
      confidence: 0.8,
      description: 'Evening Star - Strong bearish reversal pattern',
    };
  }
  return null;
}

function detectThreeWhiteSoldiers(candles: Candle[]): PatternResult | null {
  if (candles.length < 3) return null;
  
  const last3 = candles.slice(-3);
  const allBullish = last3.every(isBullish);
  const progressivelyHigher = last3.every((c, i) => 
    i === 0 || (c.open > last3[i-1].open && c.close > last3[i-1].close)
  );
  const smallWicks = last3.every(c => upperWick(c) < bodySize(c) * 0.3);
  
  if (allBullish && progressivelyHigher && smallWicks) {
    return {
      patternName: 'three_white_soldiers',
      patternType: 'bullish',
      confidence: 0.85,
      description: 'Three White Soldiers - Strong bullish continuation/reversal',
    };
  }
  return null;
}

function detectThreeBlackCrows(candles: Candle[]): PatternResult | null {
  if (candles.length < 3) return null;
  
  const last3 = candles.slice(-3);
  const allBearish = last3.every(isBearish);
  const progressivelyLower = last3.every((c, i) => 
    i === 0 || (c.open < last3[i-1].open && c.close < last3[i-1].close)
  );
  const smallWicks = last3.every(c => lowerWick(c) < bodySize(c) * 0.3);
  
  if (allBearish && progressivelyLower && smallWicks) {
    return {
      patternName: 'three_black_crows',
      patternType: 'bearish',
      confidence: 0.85,
      description: 'Three Black Crows - Strong bearish continuation/reversal',
    };
  }
  return null;
}

function detectSpinningTop(candle: Candle, avgBody: number): PatternResult | null {
  const body = bodySize(candle);
  const upper = upperWick(candle);
  const lower = lowerWick(candle);
  const range = candleRange(candle);
  
  if (
    body < avgBody * 0.5 &&
    upper > body &&
    lower > body &&
    range > avgBody * 0.8
  ) {
    return {
      patternName: 'spinning_top',
      patternType: 'neutral',
      confidence: 0.6,
      description: 'Spinning Top - Indecision, potential trend change',
    };
  }
  return null;
}

function detectMarubozu(candle: Candle, avgBody: number): PatternResult | null {
  const body = bodySize(candle);
  const upper = upperWick(candle);
  const lower = lowerWick(candle);
  const range = candleRange(candle);
  
  // Marubozu has very small or no wicks
  if (
    body > avgBody * 1.5 &&
    upper < body * 0.05 &&
    lower < body * 0.05 &&
    body / range > 0.95
  ) {
    return {
      patternName: 'marubozu',
      patternType: isBullish(candle) ? 'bullish' : 'bearish',
      confidence: 0.7 + (body / range) * 0.2,
      description: isBullish(candle) 
        ? 'Bullish Marubozu - Strong buying pressure, no resistance'
        : 'Bearish Marubozu - Strong selling pressure, no support',
    };
  }
  return null;
}

// Main pattern detection function
function detectPatterns(candles: Candle[]): PatternResult[] {
  if (candles.length < 3) return [];
  
  const patterns: PatternResult[] = [];
  const avgBody = avgBodySize(candles.slice(-20));
  const current = candles[candles.length - 1];
  const prev = candles[candles.length - 2];
  const prevCandles = candles.slice(0, -1);
  
  // Single candle patterns
  const doji = detectDoji(current, avgBody);
  if (doji) patterns.push(doji);
  
  const hammer = detectHammer(current, avgBody, prevCandles);
  if (hammer) patterns.push(hammer);
  
  const invertedHammer = detectInvertedHammer(current, avgBody, prevCandles);
  if (invertedHammer) patterns.push(invertedHammer);
  
  const hangingMan = detectHangingMan(current, avgBody, prevCandles);
  if (hangingMan) patterns.push(hangingMan);
  
  const spinningTop = detectSpinningTop(current, avgBody);
  if (spinningTop) patterns.push(spinningTop);
  
  const marubozu = detectMarubozu(current, avgBody);
  if (marubozu) patterns.push(marubozu);
  
  // Two candle patterns
  const engulfing = detectEngulfing(current, prev);
  if (engulfing) patterns.push(engulfing);
  
  const harami = detectHarami(current, prev);
  if (harami) patterns.push(harami);
  
  // Three candle patterns
  const morningStar = detectMorningStar(candles);
  if (morningStar) patterns.push(morningStar);
  
  const eveningStar = detectEveningStar(candles);
  if (eveningStar) patterns.push(eveningStar);
  
  const threeWhiteSoldiers = detectThreeWhiteSoldiers(candles);
  if (threeWhiteSoldiers) patterns.push(threeWhiteSoldiers);
  
  const threeBlackCrows = detectThreeBlackCrows(candles);
  if (threeBlackCrows) patterns.push(threeBlackCrows);
  
  return patterns;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { candles, symbol, timeframe } = await req.json();
    
    if (!candles || !Array.isArray(candles) || candles.length < 3) {
      return new Response(
        JSON.stringify({ error: 'At least 3 candles required for pattern detection' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    console.log(`Pattern detection for ${symbol} (${timeframe}), ${candles.length} candles`);
    
    const patterns = detectPatterns(candles);
    
    // Attach metadata to each pattern
    const lastCandle = candles[candles.length - 1];
    const patternsWithMeta = patterns.map((p, i) => ({
      id: `${symbol}-${lastCandle.timestamp}-${p.patternName}-${i}`,
      ...p,
      symbol,
      timeframe,
      timestamp: lastCandle.timestamp,
      price: lastCandle.close,
      high: lastCandle.high,
      low: lastCandle.low,
      detectedAt: Date.now(),
    }));
    
    console.log(`Detected ${patterns.length} patterns: ${patterns.map(p => p.patternName).join(', ')}`);
    
    return new Response(
      JSON.stringify({ 
        patterns: patternsWithMeta,
        symbol,
        timeframe,
        candleCount: candles.length,
        timestamp: Date.now(),
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Pattern detection error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
