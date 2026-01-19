import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Time } from 'lightweight-charts';

// Pattern signal from Candlestick.js detector
export interface PatternSignal {
  id: string;
  patternName: string;
  patternType: 'bullish' | 'bearish' | 'neutral';
  confidence: number;
  timestamp: Time;
  price: number;
  high: number;
  low: number;
  symbol: string;
  timeframe: string;
  description?: string;
  detectedAt: number; // Unix timestamp
}

// Configuration for pattern detection
export interface PatternConfig {
  minConfidence: number;
  enabledPatterns: string[];
  showBullish: boolean;
  showBearish: boolean;
  showNeutral: boolean;
  maxPatterns: number;
  alertOnHighConfidence: boolean;
  highConfidenceThreshold: number;
}

// Performance analytics
export interface PatternAnalytics {
  totalDetected: number;
  bullishCount: number;
  bearishCount: number;
  neutralCount: number;
  averageConfidence: number;
  patternsPerHour: number;
  lastHourPatterns: PatternSignal[];
}

interface PatternStore {
  // Pattern history (last 100 per symbol)
  patterns: Map<string, PatternSignal[]>;
  
  // Configuration
  config: PatternConfig;
  
  // Active symbol for pattern detection
  activeSymbol: string | null;
  activeTimeframe: string | null;
  
  // UI State
  isPanelOpen: boolean;
  selectedPatternId: string | null;
  isEnabled: boolean;
  
  // Actions
  addPattern: (pattern: PatternSignal) => void;
  clearPatterns: (symbol?: string) => void;
  setConfig: (config: Partial<PatternConfig>) => void;
  setActiveSymbol: (symbol: string, timeframe: string) => void;
  setPanelOpen: (open: boolean) => void;
  selectPattern: (id: string | null) => void;
  setEnabled: (enabled: boolean) => void;
  
  // Computed
  getPatterns: (symbol: string) => PatternSignal[];
  getFilteredPatterns: (symbol: string) => PatternSignal[];
  getAnalytics: (symbol: string) => PatternAnalytics;
}

const DEFAULT_CONFIG: PatternConfig = {
  minConfidence: 0.6,
  enabledPatterns: [
    'doji', 'hammer', 'inverted_hammer', 'hanging_man',
    'bullish_engulfing', 'bearish_engulfing',
    'bullish_harami', 'bearish_harami',
    'morning_star', 'evening_star',
    'three_white_soldiers', 'three_black_crows',
    'piercing_line', 'dark_cloud_cover',
    'spinning_top', 'marubozu'
  ],
  showBullish: true,
  showBearish: true,
  showNeutral: true,
  maxPatterns: 100,
  alertOnHighConfidence: true,
  highConfidenceThreshold: 0.85,
};

export const usePatternStore = create<PatternStore>()(
  persist(
    (set, get) => ({
      patterns: new Map(),
      config: DEFAULT_CONFIG,
      activeSymbol: null,
      activeTimeframe: null,
      isPanelOpen: false,
      selectedPatternId: null,
      isEnabled: true,

      addPattern: (pattern) => {
        set((state) => {
          const newPatterns = new Map(state.patterns);
          const symbolPatterns = newPatterns.get(pattern.symbol) || [];
          
          // Check for duplicates (same pattern within 1 minute)
          const isDuplicate = symbolPatterns.some(
            (p) =>
              p.patternName === pattern.patternName &&
              Math.abs(p.detectedAt - pattern.detectedAt) < 60000
          );
          
          if (!isDuplicate) {
            const updated = [pattern, ...symbolPatterns].slice(0, state.config.maxPatterns);
            newPatterns.set(pattern.symbol, updated);
          }
          
          return { patterns: newPatterns };
        });
      },

      clearPatterns: (symbol) => {
        set((state) => {
          const newPatterns = new Map(state.patterns);
          if (symbol) {
            newPatterns.delete(symbol);
          } else {
            newPatterns.clear();
          }
          return { patterns: newPatterns };
        });
      },

      setConfig: (config) => {
        set((state) => ({
          config: { ...state.config, ...config },
        }));
      },

      setActiveSymbol: (symbol, timeframe) => {
        set({ activeSymbol: symbol, activeTimeframe: timeframe });
      },

      setPanelOpen: (open) => {
        set({ isPanelOpen: open });
      },

      selectPattern: (id) => {
        set({ selectedPatternId: id });
      },

      setEnabled: (enabled) => {
        set({ isEnabled: enabled });
      },

      getPatterns: (symbol) => {
        return get().patterns.get(symbol) || [];
      },

      getFilteredPatterns: (symbol) => {
        const state = get();
        const patterns = state.patterns.get(symbol) || [];
        const { config } = state;
        
        return patterns.filter((p) => {
          if (p.confidence < config.minConfidence) return false;
          if (!config.enabledPatterns.includes(p.patternName)) return false;
          if (p.patternType === 'bullish' && !config.showBullish) return false;
          if (p.patternType === 'bearish' && !config.showBearish) return false;
          if (p.patternType === 'neutral' && !config.showNeutral) return false;
          return true;
        });
      },

      getAnalytics: (symbol) => {
        const patterns = get().patterns.get(symbol) || [];
        const oneHourAgo = Date.now() - 3600000;
        const lastHourPatterns = patterns.filter((p) => p.detectedAt > oneHourAgo);
        
        const bullishCount = patterns.filter((p) => p.patternType === 'bullish').length;
        const bearishCount = patterns.filter((p) => p.patternType === 'bearish').length;
        const neutralCount = patterns.filter((p) => p.patternType === 'neutral').length;
        
        const totalConfidence = patterns.reduce((sum, p) => sum + p.confidence, 0);
        const averageConfidence = patterns.length > 0 ? totalConfidence / patterns.length : 0;
        
        return {
          totalDetected: patterns.length,
          bullishCount,
          bearishCount,
          neutralCount,
          averageConfidence,
          patternsPerHour: lastHourPatterns.length,
          lastHourPatterns,
        };
      },
    }),
    {
      name: 'pattern-detection-store',
      partialize: (state) => ({
        config: state.config,
        isEnabled: state.isEnabled,
        isPanelOpen: state.isPanelOpen,
      }),
    }
  )
);
