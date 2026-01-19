import { useEffect, useRef, useCallback } from 'react';
import { CandlestickData, Time } from 'lightweight-charts';
import { supabase } from '@/integrations/supabase/client';
import { usePatternStore, PatternSignal } from '@/stores/patternStore';
import { toast } from 'sonner';

interface UsePatternDetectionProps {
  symbol: string;
  timeframe: string;
  chartData: CandlestickData<Time>[];
  enabled?: boolean;
}

interface UsePatternDetectionResult {
  patterns: PatternSignal[];
  filteredPatterns: PatternSignal[];
  isDetecting: boolean;
  lastDetection: number | null;
  detectPatterns: () => Promise<void>;
}

export const usePatternDetection = ({
  symbol,
  timeframe,
  chartData,
  enabled = true,
}: UsePatternDetectionProps): UsePatternDetectionResult => {
  const isDetectingRef = useRef(false);
  const lastProcessedLengthRef = useRef(0);
  const lastDetectionRef = useRef<number | null>(null);
  
  const {
    addPattern,
    getPatterns,
    getFilteredPatterns,
    setActiveSymbol,
    config,
    isEnabled,
  } = usePatternStore();

  // Set active symbol when it changes
  useEffect(() => {
    setActiveSymbol(symbol, timeframe);
  }, [symbol, timeframe, setActiveSymbol]);

  // Convert chart data to candle format for API
  const convertToCandles = useCallback((data: CandlestickData<Time>[]) => {
    return data.map((candle) => ({
      open: candle.open,
      high: candle.high,
      low: candle.low,
      close: candle.close,
      timestamp: typeof candle.time === 'number' 
        ? candle.time 
        : new Date(candle.time as string).getTime() / 1000,
    }));
  }, []);

  // Detect patterns using edge function
  const detectPatterns = useCallback(async () => {
    if (!enabled || !isEnabled || chartData.length < 10 || isDetectingRef.current) {
      return;
    }

    isDetectingRef.current = true;

    try {
      // Send last 50 candles for pattern detection
      const candles = convertToCandles(chartData.slice(-50));
      
      const { data, error } = await supabase.functions.invoke('pattern-detection', {
        body: {
          candles,
          symbol,
          timeframe,
        },
      });

      if (error) {
        console.error('Pattern detection error:', error);
        return;
      }

      if (data?.patterns && Array.isArray(data.patterns)) {
        lastDetectionRef.current = Date.now();
        
        // Filter by minimum confidence and add to store
        const validPatterns = data.patterns.filter(
          (p: PatternSignal) => p.confidence >= config.minConfidence
        );

        validPatterns.forEach((pattern: PatternSignal) => {
          addPattern(pattern);
          
          // Alert on high confidence patterns
          if (config.alertOnHighConfidence && pattern.confidence >= config.highConfidenceThreshold) {
            toast.info(
              `${pattern.patternType === 'bullish' ? '🟢' : pattern.patternType === 'bearish' ? '🔴' : '🟡'} ${pattern.patternName.replace(/_/g, ' ').toUpperCase()} detected on ${symbol}`,
              { duration: 5000 }
            );
          }
        });
      }
    } catch (err) {
      console.error('Pattern detection failed:', err);
    } finally {
      isDetectingRef.current = false;
    }
  }, [enabled, isEnabled, chartData, symbol, timeframe, config, addPattern, convertToCandles]);

  // Auto-detect when new candles arrive
  useEffect(() => {
    if (!enabled || !isEnabled || chartData.length < 10) return;
    
    // Only detect if we have new data
    if (chartData.length > lastProcessedLengthRef.current) {
      lastProcessedLengthRef.current = chartData.length;
      detectPatterns();
    }
  }, [chartData.length, enabled, isEnabled, detectPatterns]);

  // Periodic detection (every 30 seconds when active)
  useEffect(() => {
    if (!enabled || !isEnabled) return;

    const intervalId = setInterval(() => {
      detectPatterns();
    }, 30000);

    return () => clearInterval(intervalId);
  }, [enabled, isEnabled, detectPatterns]);

  return {
    patterns: getPatterns(symbol),
    filteredPatterns: getFilteredPatterns(symbol),
    isDetecting: isDetectingRef.current,
    lastDetection: lastDetectionRef.current,
    detectPatterns,
  };
};
