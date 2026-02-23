import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import CandlestickJS, { BuiltInLanguagePacks, PerformancePresets } from "./candlestick.js";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

// Map timeframe string to interval in ms
function timeframeToIntervalMs(tf: string): number {
  const map: Record<string, number> = {
    '1m': 60000, '5m': 300000, '15m': 900000, '30m': 1800000,
    '1h': 3600000, '4h': 14400000, '1D': 86400000, '1W': 604800000,
  };
  return map[tf] || 60000;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { candles, symbol, timeframe } = await req.json();

    if (!candles || !Array.isArray(candles) || candles.length < 3) {
      return new Response(
        JSON.stringify({ error: 'At least 3 candles required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`CandlestickJS v3.9.0 — ${symbol} (${timeframe}), ${candles.length} candles`);

    const intervalMs = timeframeToIntervalMs(timeframe);

    const detector = new CandlestickJS({
      config: {
        ...PerformancePresets.realtimeTrading,
        confidenceMin: 0.45,
        maxBufferLength: 200,
        enableTimestampValidation: true,
        enableDuplicateDetection: false,
        timeframe: {
          name: timeframe,
          intervalMs,
          validateContinuity: true,
          maxGapMs: intervalMs * 5,
        },
      },
    });

    // Register Japanese language pack
    detector.registerLanguage('japanese', BuiltInLanguagePacks.japanese);

    const detectedPatterns: any[] = [];

    detector.onSignal((tagged: any) => {
      const pattern = tagged.pattern || tagged;
      const raw = tagged.raw || tagged.candle || candles[candles.length - 1];
      
      const patternName = pattern.type || pattern.name || 'unknown';
      const confidence = pattern.aggregatedConfidence || pattern.confidence || 0.5;
      const meta = pattern.meta || {};
      
      // Determine direction from pattern data
      let patternType: 'bullish' | 'bearish' | 'neutral' = 'neutral';
      if (pattern.reversal === 'bullish' || pattern.continuation === 'bullish') {
        patternType = 'bullish';
      } else if (pattern.reversal === 'bearish' || pattern.continuation === 'bearish') {
        patternType = 'bearish';
      } else if (meta.tradeRelevance === 'indecision') {
        patternType = 'neutral';
      } else {
        // Fallback: infer from candle direction
        const dir = tagged.scanned?.direction;
        if (dir === 'bullish') patternType = 'bullish';
        else if (dir === 'bearish') patternType = 'bearish';
      }

      // Build description from meta
      const tradeRelevance = meta.tradeRelevance || 'unknown';
      const reliability = meta.reliability || 'medium';
      const displayName = patternName.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase());
      const description = `${displayName} — ${tradeRelevance} signal (${reliability} reliability)`;

      const lastCandle = candles[candles.length - 1];

      detectedPatterns.push({
        id: `${symbol}-${lastCandle.timestamp}-${patternName}-${detectedPatterns.length}`,
        patternName,
        patternType,
        confidence: Math.min(confidence, 1),
        aggregatedConfidence: pattern.aggregatedConfidence || null,
        statisticalConfidence: pattern.statisticalConfidence || null,
        significance: pattern.significance || null,
        tradeRelevance,
        reliability,
        description,
        symbol,
        timeframe,
        timestamp: lastCandle.timestamp,
        price: lastCandle.close,
        high: lastCandle.high,
        low: lastCandle.low,
        detectedAt: Date.now(),
        meta: {
          backtestedStats: meta.backtestedStats || null,
          patternType: pattern.patternType || 'single',
          contradictionPenalty: pattern.contradictionPenalty || 0,
          contradictoryPatterns: pattern.contradictoryPatterns || [],
        },
      });
    });

    detector.onError((err: any) => {
      console.warn('CandlestickJS:', err.message || err);
    });

    // Feed candles — timestamps should be in ms for the library
    for (const candle of candles) {
      const ts = candle.timestamp < 1e12 ? candle.timestamp * 1000 : candle.timestamp;
      await detector.receive({
        open: candle.open,
        high: candle.high,
        low: candle.low,
        close: candle.close,
        volume: candle.volume || 0,
        timestamp: ts,
      });
    }

    // Cleanup
    detector.destroy();

    const stats = {
      patternsDetected: detectedPatterns.length,
      patternNames: detectedPatterns.map(p => p.patternName),
    };
    console.log(`Result: ${stats.patternsDetected} patterns — ${stats.patternNames.join(', ') || 'none'}`);

    return new Response(
      JSON.stringify({
        patterns: detectedPatterns,
        symbol,
        timeframe,
        candleCount: candles.length,
        timestamp: Date.now(),
        engineVersion: '3.9.0',
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Pattern detection error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
