import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import CandlestickJS from "./candlestick.js";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
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

    console.log(`Pattern detection v3.9.0 for ${symbol} (${timeframe}), ${candles.length} candles`);

    const detector = new CandlestickJS({
      config: {
        confidenceMin: 0.5,
        maxBufferLength: 200,
        mode: 'normal',
        enableDuplicateDetection: true,
      }
    });

    const detectedPatterns: any[] = [];

    detector.onSignal((signal: any) => {
      const pattern = signal.pattern || signal;
      const patternName = pattern.type || pattern.name || 'unknown';
      const confidence = pattern.aggregatedConfidence || pattern.confidence || 0.5;

      // Determine pattern direction
      let patternType: 'bullish' | 'bearish' | 'neutral' = 'neutral';
      const dir = pattern.direction || pattern.signal || '';
      if (typeof dir === 'string') {
        if (dir.toLowerCase().includes('bull') || dir.toLowerCase() === 'up') patternType = 'bullish';
        else if (dir.toLowerCase().includes('bear') || dir.toLowerCase() === 'down') patternType = 'bearish';
      }

      const lastCandle = candles[candles.length - 1];
      detectedPatterns.push({
        id: `${symbol}-${lastCandle.timestamp}-${patternName}-${detectedPatterns.length}`,
        patternName,
        patternType,
        confidence: Math.min(confidence, 1),
        description: pattern.description || `${patternName.replace(/_/g, ' ')} pattern detected`,
        symbol,
        timeframe,
        timestamp: lastCandle.timestamp,
        price: lastCandle.close,
        high: lastCandle.high,
        low: lastCandle.low,
        detectedAt: Date.now(),
      });
    });

    detector.onError((err: any) => {
      console.error('CandlestickJS error:', err.message || err);
    });

    // Feed candles to the detector
    for (const candle of candles) {
      await detector.receive({
        open: candle.open,
        high: candle.high,
        low: candle.low,
        close: candle.close,
        volume: candle.volume || 0,
        timestamp: candle.timestamp * 1000, // convert to ms if in seconds
      });
    }

    console.log(`Detected ${detectedPatterns.length} patterns: ${detectedPatterns.map(p => p.patternName).join(', ')}`);

    return new Response(
      JSON.stringify({
        patterns: detectedPatterns,
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
