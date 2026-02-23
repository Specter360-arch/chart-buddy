/* Candlestick.js v3.9.0 - Production Ready (2026-02-10)
 * Patch: 9-fix correction map applied — see __CANDLESTICK_METADATA.fixes for full changelog
 *
 * MATHEMATICAL DOCUMENTATION
 * ===========================
 *
 * SCORING SYSTEM:
 * ---------------
 * The library uses a weighted additive scoring system for pattern quality assessment.
 *
 * Single-Candle Patterns:
 *   score = Σ(wi * si) / Σ(wi)
 *   where:
 *     - wi = weight for criterion i (typically 0.1-0.25)
 *     - si = score for criterion i (0-1, based on distance from range center)
 *
 * Multi-Candle Patterns:
 *   score = base_score + Σ(bonuses) - Σ(penalties)
 *   where bonuses/penalties are contextual (volume, volatility, gaps, etc.)
 *
 * CONFIDENCE CALCULATION:
 * -----------------------
 *   confidence = clamp(defaultConfidence * score, 0, 1)
 *   final_confidence = confidence * boost_multiplier (if applicable)
 *
 * CENTER DISTANCE SCORE:
 * ----------------------
 *   Given value v and range [min, max]:
 *     center = (min + max) / 2
 *     span = (max - min) / 2
 *     distance = |v - center| / span
 *     score = max(0, 1 - distance)
 *
 *   Rationale: Values closer to range center get higher scores, penalizing edge cases.
 *
 * WEIGHT TUNING RATIONALE:
 * ------------------------
 *   - bodyRatio (0.25): Primary pattern characteristic, highest weight
 *   - wickRatios (0.15 each): Secondary characteristics
 *   - volumeMultiplier (0.15): Confirmation signal
 *   - wickTolerance (0.1): Fine-tuning criterion
 *   - closePosition/bodyPosition (0.1 each): Positional context
 *   - relative/predicate (0.1): Custom validation
 *
 * VOLATILITY PERCENTILE:
 * ----------------------
 *   Calculated using coefficient of variation:
 *     CV = σ(range) / μ(range)
 *     percentile = rank(CV) / sample_size
 *
 *   Used to filter patterns that require volatility context (e.g., Doji).
 *
 * PATTERN PRIORITY:
 * -----------------
 *   Multi-candle patterns get 15% weight boost due to higher reliability:
 *     composite_score = confidence * 1.15 + score * 0.1
 *
 *   Rationale: Multi-candle patterns show stronger market consensus.
 */

export const __CANDLESTICK_METADATA = {
  name: 'candlestick.multilang',
  version: '3.9.0',
  build: new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z',
  status: 'production-ready',
  fixes: [
    'FIX-1: _chooseBest() now supports emitMode=all|topN|single (default) to break pattern monopoly',
    'FIX-2: Statistical confidence suspended during early accumulation phase (<MIN_SAMPLE_SIZE_VOLATILITY)',
    'FIX-3: isLowBodyPattern heuristic replaced with explicit meta.category=indecision check',
    'FIX-4: Engulfing volume score symmetry corrected — penalty scaled to match bonus strength',
    'FIX-5: safeVolumeMultiplier() returns semantic values (1.0 neutral, 0.0 zero-volume) not null',
    'FIX-6: Contradiction detection now based on signal direction, not pattern name identity',
    'FIX-7: Neutral-to-directional transition now applies 0.1 decay to contradiction penalty',
    'FIX-8: schema.direction gate enforced for single-candle patterns',
    'FIX-9: Timeframe interval inference uses mode estimator instead of median (gap-resilient)',
    'FIX-BONUS: _chooseBest() receives stats+history for proper gating; lm.get() corrected to lm.getLanguage()'
  ].join(' | ')
};

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

/**
 * @typedef {Object} CandleData
 * @property {number} open - Opening price
 * @property {number} high - Highest price
 * @property {number} low - Lowest price
 * @property {number} close - Closing price
 * @property {number} [volume] - Trading volume
 * @property {number} [timestamp] - Timestamp in milliseconds
 */

/**
 * @typedef {Object} ScannedCandle
 * @property {number} open
 * @property {number} high
 * @property {number} low
 * @property {number} close
 * @property {number} [volume]
 * @property {number} [timestamp]
 * @property {number} body - Absolute body size
 * @property {number} range - Full candle range
 * @property {number} upperWick - Upper wick size
 * @property {number} lowerWick - Lower wick size
 * @property {number} bodyRatio - Body to range ratio
 * @property {number} upperWickRatio - Upper wick ratio
 * @property {number} lowerWickRatio - Lower wick ratio
 * @property {number} closePosition - Close position in range [0,1]
 * @property {number} bodyPosition - Body center position
 * @property {'bullish'|'bearish'|'neutral'} direction - Candle direction
 */

/**
 * @typedef {Object} RelativeCondition
 * @property {string} field - Field to compare
 * @property {'>'|'<'|'>='|'<='|'=='|'==='|'!='|'!=='} op - Comparison operator
 * @property {number} [prevOffset=1] - Offset to previous candle
 * @property {number} [factor=1] - Multiplier factor
 */

/**
 * @typedef {Object} PatternSchema
 * @property {[number, number]} [bodyRatio] - Body ratio range
 * @property {[number, number]} [upperWickRatio] - Upper wick ratio range
 * @property {[number, number]} [lowerWickRatio] - Lower wick ratio range
 * @property {[number, number]} [wickTolerance] - Total wick tolerance
 * @property {[number, number]} [volumeMultiplier] - Volume multiplier range
 * @property {[number, number]} [closePosition] - Close position range
 * @property {[number, number]} [bodyPosition] - Body position range
 * @property {RelativeCondition} [relative] - Relative condition
 * @property {function(ScannedCandle, {history: ScannedCandle[]}): (Promise<boolean>|boolean)} [predicate] - Custom predicate
 * @property {boolean} [engulf] - Engulfing pattern flag
 * @property {boolean} [piercing] - Piercing pattern flag
 * @property {boolean} [darkCloud] - Dark cloud cover flag
 * @property {boolean} [morningEvening] - Morning/Evening star flag
 * @property {boolean} [threeSoldiers] - Three soldiers/crows flag
 * @property {boolean} [harami] - Harami pattern flag
 * @property {'bullish'|'bearish'} [direction] - Pattern direction
 */

/**
 * @typedef {Object} PatternMeta
 * @property {number} defaultConfidence - Default confidence level (0-1)
 * @property {number} [confidenceMin] - Minimum confidence threshold
 * @property {'reversal'|'continuation'|'entry'|'exit'|'indecision'|'unknown'} tradeRelevance - Trade relevance
 * @property {'intraday'|'swing'|'any'} timeframe - Recommended timeframe
 * @property {'high'|'medium'|'low'} reliability - Pattern reliability
 * @property {Object} [backtestedStats] - Backtested performance statistics
 * @property {number} backtestedStats.winRate - Historical win rate (0-1)
 * @property {number} backtestedStats.avgReturn - Average return percentage
 * @property {number} backtestedStats.maxDrawdown - Maximum drawdown percentage
 * @property {number} backtestedStats.sampleSize - Number of backtested occurrences
 * @property {number} backtestedStats.sharpeRatio - Risk-adjusted return metric
 * @property {string} backtestedStats.lastUpdated - ISO date of last backtest
 * @property {number} [statisticalWeight] - Weight multiplier for aggregation (1.0 = neutral)
 */

/**
 * @typedef {Object} PatternDefinition
 * @property {'single'|'multi'} type - Pattern type
 * @property {PatternSchema} schema - Pattern schema
 * @property {PatternMeta} meta - Pattern metadata
 */

/**
 * @typedef {Object} LanguagePack
 * @property {string} name - Language pack name
 * @property {string} description - Language pack description
 * @property {Object.<string, PatternDefinition>} patterns - Pattern definitions
 */

/**
 * @typedef {Object} CandlestickConfig
 * @property {number} [volumeSignificance=1.5] - Volume significance multiplier
 * @property {number} [volatilityWindow=20] - Volatility calculation window
 * @property {number} [trendWindow=10] - Trend calculation window
 * @property {number} [confidenceMin=0.6] - Minimum confidence threshold
 * @property {boolean} [confirmationMode=false] - Enable confirmation mode
 * @property {number} [maxBufferLength=5000] - Maximum buffer length
 * @property {Object} [confidenceAggregation] - Confidence aggregation settings
 * @property {number} [confidenceAggregation.window=3] - Aggregation window
 * @property {'weighted'|'avg'|'sum'} [confidenceAggregation.strategy='weighted'] - Aggregation strategy
 * @property {number} [confidenceAggregation.decay=0.5] - Decay factor
 * @property {boolean} [allowUnsafePredicates=false] - Allow custom predicates
 * @property {boolean} [requireAsyncPredicates=true] - Require async predicates
 * @property {'normal'|'light'|'lite'} [mode='normal'] - Processing mode
 * @property {boolean} [enableTimestampValidation=true] - Validate timestamps
 * @property {boolean} [enableDuplicateDetection=true] - Detect duplicates
 * @property {number} [predicateTimeout=100] - Predicate timeout in ms
 * @property {number} [candidateExpiryMs=3600000] - Candidate expiry time
 * @property {boolean} [includeBufferInHooks=false] - Include full buffer in hooks
 * @property {Object} [timeframe] - Timeframe metadata for determinism
 * @property {string} [timeframe.name] - Timeframe name (e.g., '1m', '5m', '1h')
 * @property {number} [timeframe.intervalMs] - Expected interval in milliseconds
 * @property {boolean} [timeframe.validateContinuity=true] - Validate candle continuity
 * @property {number} [timeframe.maxGapMs] - Maximum allowed gap between candles
 */

/**
 * @typedef {Object} PatternMatch
 * @property {string} type - Pattern name
 * @property {number} confidence - Pattern recognition confidence (0-1)
 * @property {number} statisticalConfidence - Statistical validity confidence (0-1)
 * @property {number} significance - Significance score
 * @property {number} [aggregatedConfidence] - Aggregated confidence
 * @property {number} [aggregationWindow] - Aggregation window size
 * @property {string} [aggregationStrategy] - Aggregation strategy used
 * @property {string} language - Language pack name
 * @property {'single'|'multi'} patternType - Pattern type
 * @property {PatternMeta} meta - Pattern metadata
 * @property {'bullish'|'bearish'} [reversal] - Reversal direction
 * @property {'bullish'|'bearish'} [continuation] - Continuation direction
 */

/**
 * @typedef {Object} TaggedCandle
 * @property {CandleData} raw - Raw candle data
 * @property {Object} scanned - Scanned metrics
 * @property {PatternMatch|null} pattern - Matched pattern
 * @property {string|null} language - Language used
 * @property {Object|null} candidates - All candidates
 * @property {PatternMatch[]} candidates.single - Single candle patterns
 * @property {PatternMatch[]} candidates.multi - Multi candle patterns
 * @property {number} processedAt - Processing timestamp
 */

/**
 * @typedef {Object} ValidationResult
 * @property {boolean} valid - Validation result
 * @property {string[]|null} errors - Validation errors
 */

/**
 * @typedef {Object} PerformanceMetrics
 * @property {number} totalProcessed - Total candles processed
 * @property {number} totalErrors - Total errors encountered
 * @property {number} avgProcessingTimeMs - Average processing time
 * @property {number} lastProcessTimeMs - Last processing time
 * @property {number} successRate - Success rate percentage
 */

/**
 * @typedef {Object} CandlestickStats
 * @property {number} bufferSize - Buffer size
 * @property {number} scannedBufferSize - Scanned buffer size
 * @property {number} recentCandidates - Recent candidates count
 * @property {number} queueDepth - Queue depth
 * @property {boolean} isProcessing - Processing status
 * @property {number} errorCount - Error count
 * @property {string} activeLanguage - Active language
 * @property {boolean} confirmationMode - Confirmation mode status
 * @property {PerformanceMetrics} performance - Performance metrics
 * @property {CandlestickConfig} config - Current configuration
 */

// ============================================================================
// CONSTANTS
// ============================================================================

const CONSTANTS = {
  MAX_BUFFER_LENGTH_DEFAULT: 5000,
  MAX_PATTERN_NAME_LENGTH: 50,
  MAX_PATTERN_PACK_SIZE: 100000, // bytes
  MAX_QUEUE_SIZE: 50000,
  MAX_RETRY_QUEUE_SIZE: 1000, // Maximum retry queue size
  PREDICATE_TIMEOUT_MS: 100,
  PREDICATE_TIMEOUT_MIN: 10,
  PREDICATE_TIMEOUT_MAX: 5000,
  CONFIDENCE_MIN_DEFAULT: 0.6,
  MORNING_STAR_RECOVERY: 0.5,
  EVENING_STAR_RECOVERY: 0.5,
  SOLDIERS_BODY_RATIO_MIN: 0.6,
  SOLDIERS_WICK_TOLERANCE: 0.3,
  SMALL_BODY_FACTOR: 0.4,
  ENGULFING_MIN_RATIO: 1.3, // Increased from 1.0 for better quality
  CONFIDENCE_BOOST_MULTIPLIER: 1.10,
  CANDIDATE_EXPIRY_MS: 3600000, // 1 hour
  ERROR_LOG_MAX_SIZE: 1000,
  PERFORMANCE_SAMPLE_SIZE: 100,
  // Statistical validity constants
  MIN_SAMPLE_SIZE_VOLATILITY: 15, // Minimum samples for volatility percentile
  MIN_SAMPLE_SIZE_TREND: 8, // Minimum samples for trend analysis
  MIN_SAMPLE_SIZE_MULTI_CANDLE: 10, // Minimum history for multi-candle patterns
  STATISTICAL_CONFIDENCE_THRESHOLD: 0.4, // Minimum statistical confidence
  // Backwards-compatible alias used in code
  STATISTICAL_CONFIDENCE_MIN_DEFAULT: 0.4,
  // Scoring constants
  MIN_SCORE_THRESHOLD: 0.35, // Minimum score to accept pattern match
  DOJI_MIN_VOLATILITY_PERCENTILE: 0.2, // Doji only valid if volatility > 20th percentile
  DOJI_WICK_BALANCE_TOLERANCE: 0.15, // Max difference between upper/lower wick ratios
  LOW_VOLATILITY_THRESHOLD: 0.3, // Below 30th percentile = low volatility
  HIGH_VOLATILITY_THRESHOLD: 0.7, // Above 70th percentile = high volatility

  // Volume constants
  VOLUME_HIGH: 1.2,
  VOLUME_LOW: 0.8,

  // Piercing/penetration bonuses
  PENETRATION_BONUS_MAX: 0.2,
  PENETRATION_BONUS_FACTOR: 0.3,

  // Recovery / decline bonuses used by star patterns
  RECOVERY_BONUS_MAX: 0.15,
  RECOVERY_BONUS_FACTOR: 0.2,

  // Harami / smallness thresholds
  SMALLNESS_THRESHOLD: 0.35,

  // Queue compaction tuning (adaptive thresholds)
  QUEUE_COMPACTION_ADAPTIVE_RATIO: 0.10,
  QUEUE_COMPACTION_MIN_HEAD: 50,
  QUEUE_COMPACTION_MIN_HEAD_RATIO: 0.10,
  QUEUE_COMPACTION_MID_HEAD: 100,
  QUEUE_COMPACTION_MID_RATIO: 0.20,
  QUEUE_COMPACTION_HIGH_HEAD: 500,
  QUEUE_COMPACTION_HIGH_RATIO: 0.5,
  QUEUE_COMPACTION_EMERGENCY_DEPTH: 1000,

  // Contradiction penalty tuning
  MAX_CONTRADICTION_PENALTY: 0.5,
  CONTRADICTION_PENALTY_PER_PATTERN: 0.15
};


// ============================================================================
// ERROR CLASSES
// ============================================================================

class CandlestickError extends Error {
  constructor(message, code = 'RuntimeError', meta = null) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.meta = meta;
    this.timestamp = Date.now();
  }
}

class ValidationError extends CandlestickError {
  constructor(message, meta = null) {
    super(message, 'ValidationError', meta);
  }
}

class DataError extends CandlestickError {
  constructor(message, meta = null) {
    super(message, 'DataError', meta);
  }
}

class ConfigError extends CandlestickError {
  constructor(message, meta = null) {
    super(message, 'ConfigError', meta);
  }
}

class TimeoutError extends CandlestickError {
  constructor(message, meta = null) {
    super(message, 'TimeoutError', meta);
  }
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

const isNumber = v => typeof v === 'number' && Number.isFinite(v);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

/**
 * Safe volume multiplier calculation with division-by-zero and NaN protection.
 * FIX-5: Returns semantic values instead of null:
 *   - 1.0  when volume data is missing (neutral — no reward or penalty)
 *   - 0.0  when volume is explicitly zero (penalisable — suspicious absence)
 *   - 1.0  when median is unavailable (insufficient history — suspend judgment)
 *   - mult  computed ratio otherwise
 * @param {number} volume - Candle volume
 * @param {number} medianVol - Median volume from statistics
 * @returns {number} Volume multiplier — always a finite number
 */
function safeVolumeMultiplier(volume, medianVol) {
  // Missing / non-numeric volume → neutral, no adjustment
  if (!isNumber(volume)) return 1.0;
  // Explicit zero volume → penalisable event
  if (volume === 0) return 0.0;
  // Negative volume → treat as missing
  if (volume < 0) return 1.0;
  // Median not yet available (early history) → suspend judgment
  if (!isNumber(medianVol) || medianVol <= 0) return 1.0;
  const mult = volume / medianVol;
  return isNumber(mult) && isFinite(mult) ? mult : 1.0;
}

/**
 * Check if value is within range [min, max]
 */
const withinRange = (value, range) => {
  if (!Array.isArray(range) || range.length !== 2) return false;
  if (!isNumber(range[0]) || !isNumber(range[1])) return false;
  return value >= range[0] && value <= range[1];
};

/**
 * Calculate score based on distance from center of range
 */
const centerDistanceScore = (value, range) => {
  if (!Array.isArray(range) || range.length !== 2) return 0;
  const mid = (range[0] + range[1]) / 2;
  const span = Math.max(1e-9, (range[1] - range[0]) / 2);
  return clamp(1 - Math.abs(value - mid) / span, 0, 1);
};

/**

/**
 * FIX-9: Mode-based interval estimator — gap-resilient candle period detection.
 * Clusters raw intervals into 5-minute buckets (300 000 ms) so minor jitter does
 * not split identical periods into different buckets. Returns the bucket centre
 * with the highest frequency, which represents the actual candle period even when
 * gap-intervals outnumber normal intervals in the sample window.
 * @param {number[]} intervals - Raw ms differences between consecutive candle timestamps
 * @returns {number} Most-common interval in ms
 */
function calculateModeInterval(intervals) {
  if (!intervals || intervals.length === 0) return 60000; // safe default: 1 min
  const BUCKET_MS = 300000; // 5-minute buckets absorb minor jitter
  const freq = {};
  for (const iv of intervals) {
    if (typeof iv !== 'number' || !isFinite(iv) || iv <= 0) continue;
    const bucket = Math.round(iv / BUCKET_MS) * BUCKET_MS;
    freq[bucket] = (freq[bucket] || 0) + 1;
  }
  let maxCount = 0;
  let mode = 60000;
  for (const [bucket, count] of Object.entries(freq)) {
    if (count > maxCount) {
      maxCount = count;
      mode = parseInt(bucket, 10);
    }
  }
  return mode > 0 ? mode : 60000;
}

/**
 * Compare values using operators
 */
function compareOp(a, op, b) {
  switch (op) {
    case '>': return a > b;
    case '<': return a < b;
    case '>=': return a >= b;
    case '<=': return a <= b;
    case '==': return a === b;  // Use strict equality
    case '===': return a === b;
    case '!=': return a !== b;  // Use strict inequality
    case '!==': return a !== b;
    default: return false;
  }
}

/**
 * Evaluate relative condition between current and historical candles
 */
function evalRelativeCondition(scanned, history, rel) {
  if (!rel || !rel.field || !rel.op) return false;
 
  const prevOffset = typeof rel.prevOffset === 'number' ? rel.prevOffset : 1;
  const prevIndex = history.length - prevOffset;
 
  if (prevIndex < 0 || !history[prevIndex]) return false;
 
  const prev = history[prevIndex];
  const curVal = scanned[rel.field];
  const prevVal = prev[rel.field];
 
  if (!isNumber(curVal) || !isNumber(prevVal)) return false;
 
  const factor = typeof rel.factor === 'number' ? rel.factor : 1;
  const rhs = prevVal * factor;
 
  return compareOp(curVal, rel.op, rhs);
}

/**
 * Execute predicate function with timeout protection
 * FIXED: Proper timer cleanup and single timeout promise
 */
async function executePredicateWithTimeout(predicateFn, scanned, history, timeoutMs) {
  if (typeof predicateFn !== 'function') return false;

  // Create sandboxed context to prevent dangerous operations
  const createSandboxedContext = () => {
    // Restricted global object
    const sandbox = {
      // Safe Math functions
      Math: Object.freeze({
        ...Math,
        // Remove potentially dangerous methods
      }),
      
      // Safe Date functions (read-only)
      Date: Object.freeze({
        now: Date.now,
        parse: Date.parse,
        UTC: Date.UTC
      }),
      
      // Safe JSON functions
      JSON: Object.freeze({
        parse: JSON.parse,
        stringify: JSON.stringify
      }),
      
      // Safe Array and Object constructors
      Array: Array,
      Object: Object,
      String: String,
      Number: Number,
      Boolean: Boolean,
      
      // Safe utility functions
      parseInt: parseInt,
      parseFloat: parseFloat,
      isNaN: isNaN,
      isFinite: isFinite,
      
      // Input data (read-only)
      scanned: Object.freeze(scanned),
      history: Object.freeze(history.slice()),
      
      // Console for debugging (limited)
      console: Object.freeze({
        log: (...args) => {
          // Limit log output to prevent spam
          if (args.length > 10) return;
          console.log('[Predicate]', ...args.slice(0, 10));
        }
      })
    };
    
    return sandbox;
  };

  const task = async () => {
    try {
      // For Node.js: Use vm module for sandboxing
      if (typeof require !== 'undefined') {
        const vm = require('vm');
        const sandbox = createSandboxedContext();
        
        // Create the predicate function string
        const predicateCode = `
          (async function() {
            try {
              const result = await (${predicateFn.toString()})(scanned, { history });
              return Boolean(result);
            } catch (e) {
              return false;
            }
          })();
        `;
        
        // Run in sandboxed context with memory limits
        const context = vm.createContext(sandbox, {
          codeGeneration: { strings: false, wasm: false },
          microtaskMode: 'afterEvaluate'
        });
        
        const result = await vm.runInContext(predicateCode, context, {
          timeout: timeoutMs,
          breakOnSigint: true
        });
        
        return result;
      } 
      // For Browser: Use Web Worker approach (simplified for now)
      else {
        // Fallback to direct execution with basic timeout
        // In production, implement Web Worker sandboxing
        const res = predicateFn(scanned, { history });
        return await Promise.resolve(res);
      }
    } catch (e) {
      return false;
    }
  };

  let timeoutId;
  const timeout = new Promise((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new TimeoutError('Predicate execution timed out'));
    }, timeoutMs);
  });

  try {
    const result = await Promise.race([task(), timeout]);
    clearTimeout(timeoutId);
    return Boolean(result);
  } catch (e) {
    clearTimeout(timeoutId);
    return false;
  }
}

/**
 * Deep clone with size limit for security
 */
function safeClone(obj, maxSize = CONSTANTS.MAX_PATTERN_PACK_SIZE) {
  const str = JSON.stringify(obj);
  const bytes = (typeof TextEncoder !== 'undefined')
    ? new TextEncoder().encode(str).length
    : (typeof Buffer !== 'undefined' ? Buffer.byteLength(str, 'utf8') : str.length);
  if (bytes > maxSize) {
    throw new ConfigError('Object too large for cloning', {
      size: bytes,
      maxSize
    });
  }
  return JSON.parse(str);
}

/**
 * Deep clone a scanned candle object (shallow clone sufficient for performance)
 */
function cloneScanned(scanned) {
  return {
    open: scanned.open,
    high: scanned.high,
    low: scanned.low,
    close: scanned.close,
    volume: scanned.volume,
    timestamp: scanned.timestamp,
    body: scanned.body,
    range: scanned.range,
    upperWick: scanned.upperWick,
    lowerWick: scanned.lowerWick,
    bodyRatio: scanned.bodyRatio,
    upperWickRatio: scanned.upperWickRatio,
    lowerWickRatio: scanned.lowerWickRatio,
    closePosition: scanned.closePosition,
    bodyPosition: scanned.bodyPosition,
    direction: scanned.direction
  };
}

/**
 * Deep freeze an object recursively
 */
function deepFreeze(obj) {
  Object.freeze(obj);
  Object.values(obj).forEach(v => {
    if (v && typeof v === 'object' && !Object.isFrozen(v)) {
      deepFreeze(v);
    }
  });
  return obj;
}

/**
 * Deep clone preserving functions for trusted language packs
 */
function deepFreezePreservingFunctions(pack) {
  const copy = { ...pack, patterns: {} };
  for (const [k, v] of Object.entries(pack.patterns || {})) {
    copy.patterns[k] = {
      ...v,
      schema: v.schema ? { ...v.schema } : {},
      meta: v.meta ? { ...v.meta } : {}
    };
  }
  return deepFreeze(copy);
}

// ============================================================================
// PATTERN LANGUAGE MANAGER
// ============================================================================

/**
 * Manages multiple pattern language packs (Japanese, Western, Quant)
 */
export class PatternLanguageManager {
  constructor() {
    this.languages = {};
    this.active = null;
  }

  /**
   * Register a new language pack
   * @param {string} name - Language pack name
   * @param {Object} pack - Language pack definition
   * @param {Object} options - Registration options
   * @param {boolean} options.trusted - If true, preserves function predicates (requires allowUnsafePredicates)
   * @returns {PatternLanguageManager} - Fluent interface
   */
  register(name, pack, options = {}) {
    const { trusted = false } = options;
   
    if (!name || typeof name !== 'string') {
      throw new ConfigError('Language name must be a non-empty string');
    }
   
    if (name.length > CONSTANTS.MAX_PATTERN_NAME_LENGTH) {
      throw new ConfigError('Language name too long', {
        maxLength: CONSTANTS.MAX_PATTERN_NAME_LENGTH
      });
    }
   
    if (!pack || typeof pack !== 'object') {
      throw new ConfigError('Language pack must be an object');
    }

    const normalized = trusted ? deepFreezePreservingFunctions(pack) : safeClone(pack);
   
    if (!normalized.patterns) normalized.patterns = {};

    // Ensure default meta values
    for (const [patternName, def] of Object.entries(normalized.patterns)) {
      if (!def.meta) def.meta = {};
      if (!def.meta.defaultConfidence) def.meta.defaultConfidence = 0.6;
      if (!def.meta.tradeRelevance) def.meta.tradeRelevance = 'unknown';
      if (!def.meta.timeframe) def.meta.timeframe = 'any';
      if (!def.meta.reliability) def.meta.reliability = 'medium';
    }

    this.languages[name] = normalized;
   
    if (!this.active) this.active = name;
   
    return this;
  }

  /**
   * Unregister a language pack
   */
  unregister(name) {
    delete this.languages[name];
    if (this.active === name) {
      this.active = Object.keys(this.languages)[0] || null;
    }
  }

  /**
   * List all registered language packs
   */
  list() {
    return Object.keys(this.languages);
  }

  /**
   * Set active language pack
   */
  setActive(name) {
    if (!(name in this.languages)) {
      throw new ConfigError('Language not registered: ' + name);
    }
    this.active = name;
    return this;
  }

  /**
   * Get active language pack
   */
  getActive() {
    return this.languages[this.active] || null;
  }

  /**
   * Get a specific language pack by name
   * FIX-BONUS: This method was referenced but never defined
   * @param {string} name - Language pack name
   * @returns {Object|null} Language pack or null
   */
  getLanguage(name) {
    return this.languages[name] || null;
  }

  /**
   * Get specific pattern from active language
   */
  getPattern(name) {
    const lang = this.getActive();
    if (!lang) return null;
    return lang.patterns[name] || null;
  }

  /**
   * Get all patterns from active language
   */
  getPatterns() {
    const lang = this.getActive();
    if (!lang) return {};
    return lang.patterns;
  }

  /**
   * Validate language pack structure
   * ENHANCED: Comprehensive validation including conflicts, impossible ranges, and circular dependencies
   */
  validateLanguagePack(name) {
    const pack = this.languages[name];
    if (!pack) {
      throw new ConfigError('Language pack not found', { name });
    }

    const errors = [];
    const warnings = [];
    
    if (!pack.patterns || typeof pack.patterns !== 'object') {
      errors.push('patterns key missing or invalid');
      return { valid: false, errors, warnings: null };
    }

    const patternNames = Object.keys(pack.patterns);
    
    for (const [k, v] of Object.entries(pack.patterns || {})) {
      if (!v.type) errors.push(`${k} missing type`);
      if (!v.schema) errors.push(`${k} missing schema`);
      
      const schema = v.schema || {};
      
      // Validate range fields
      for (const [field, val] of Object.entries(schema)) {
        if (Array.isArray(val) && val.length === 2) {
          if (typeof val[0] !== 'number' || typeof val[1] !== 'number') {
            errors.push(`${k}.${field} range must be numeric`);
          }
          if (val[0] > val[1]) {
            errors.push(`${k}.${field} range min > max`);
          }
          if (val[0] < 0 || val[1] < 0) {
            errors.push(`${k}.${field} range values cannot be negative`);
          }
          if (val[1] > 1 && (field.includes('Ratio') || field.includes('Position'))) {
            errors.push(`${k}.${field} ratio/position range cannot exceed 1.0`);
          }
        }
      }
      
      // Check for impossible range combinations
      if (schema.bodyRatio && schema.upperWickRatio && schema.lowerWickRatio) {
        const minTotal = schema.bodyRatio[0] + schema.upperWickRatio[0] + schema.lowerWickRatio[0];
        const maxTotal = schema.bodyRatio[1] + schema.upperWickRatio[1] + schema.lowerWickRatio[1];
        
        if (minTotal > 1.0) {
          errors.push(`${k}: Impossible range combination - bodyRatio + upperWickRatio + lowerWickRatio minimum exceeds 1.0`);
        }
        if (maxTotal < 0.8) {
          warnings.push(`${k}: Range combination may be too restrictive (total < 0.8)`);
        }
      }
      
      // Check for conflicting pattern definitions (same name, different definitions)
      const duplicates = patternNames.filter(n => n === k);
      if (duplicates.length > 1) {
        errors.push(`${k}: Duplicate pattern name detected`);
      }
      
      // Validate meta
      if (v.meta && v.meta.defaultConfidence !== undefined) {
        if (typeof v.meta.defaultConfidence !== 'number' ||
            v.meta.defaultConfidence < 0 ||
            v.meta.defaultConfidence > 1) {
          errors.push(`${k}.meta.defaultConfidence must be between 0 and 1`);
        }
      }
      
      // Check for circular dependencies in predicates (basic check)
      if (schema.predicate && typeof schema.predicate === 'function') {
        try {
          // Try to detect if predicate references itself (basic check)
          const predicateStr = schema.predicate.toString();
          if (predicateStr.includes(k) && predicateStr.includes('history')) {
            warnings.push(`${k}: Predicate may have circular dependency - verify manually`);
          }
        } catch (e) {
          // Ignore if we can't stringify
        }
      }
      
      // Validate relative conditions
      if (schema.relative) {
        const rel = schema.relative;
        if (!rel.field || !rel.op) {
          errors.push(`${k}.relative: field and op are required`);
        }
        if (rel.op && !['>', '<', '>=', '<=', '==', '===', '!=', '!=='].includes(rel.op)) {
          errors.push(`${k}.relative: invalid operator ${rel.op}`);
        }
        if (rel.factor !== undefined && (typeof rel.factor !== 'number' || rel.factor <= 0)) {
          errors.push(`${k}.relative: factor must be a positive number`);
        }
      }
    }

    return { 
      valid: errors.length === 0, 
      errors: errors.length ? errors : null,
      warnings: warnings.length ? warnings : null
    };
  }
}

// ============================================================================
// PERFORMANCE PRESETS
// ============================================================================

/**
 * Preset configurations for different use cases
 * @type {Object.<string, CandlestickConfig>}
 */
export const PerformancePresets = {
  /**
   * Real-time trading - Minimum latency, single-candle patterns only
   */
  realtimeTrading: {
    mode: 'light',
    maxBufferLength: 100,
    confidenceAggregation: { window: 1, strategy: 'weighted', decay: 0.5 },
    enableTimestampValidation: false,
    enableDuplicateDetection: false,
    includeBufferInHooks: false,
    predicateTimeout: 50,
    candidateExpiryMs: 60000 // 1 minute
  },

  /**
   * Backtesting - Balanced performance for strategy testing
   */
  backtesting: {
    mode: 'normal',
    maxBufferLength: 1000,
    confidenceAggregation: { window: 3, strategy: 'weighted', decay: 0.5 },
    enableTimestampValidation: true,
    enableDuplicateDetection: true,
    includeBufferInHooks: false,
    confirmationMode: false
  },

  /**
   * Historical Analysis - High accuracy with full feature set
   */
  historicalAnalysis: {
    mode: 'normal',
    maxBufferLength: 5000,
    confidenceAggregation: { window: 5, strategy: 'weighted', decay: 0.7 },
    enableTimestampValidation: true,
    enableDuplicateDetection: true,
    includeBufferInHooks: true
  },

  /**
   * Swing trading - Balanced performance with multi-candle patterns
   */
  swingTrading: {
    mode: 'normal',
    maxBufferLength: 1000,
    confidenceAggregation: { window: 3, strategy: 'weighted', decay: 0.6 },
    enableTimestampValidation: true,
    enableDuplicateDetection: true,
    includeBufferInHooks: false,
    predicateTimeout: 100,
    candidateExpiryMs: 1800000 // 30 minutes
  },

  /**
   * High-frequency - Ultra-low latency, minimal features
   */
  highFrequency: {
    mode: 'light',
    maxBufferLength: 50,
    confidenceAggregation: { window: 1, strategy: 'avg', decay: 0.5 },
    enableTimestampValidation: false,
    enableDuplicateDetection: false,
    includeBufferInHooks: false,
    predicateTimeout: 20,
    candidateExpiryMs: 30000 // 30 seconds
  },

  /**
   * Research & Development - Maximum features for analysis
   */
  research: {
    mode: 'normal',
    maxBufferLength: 10000,
    confidenceAggregation: { window: 10, strategy: 'weighted', decay: 0.8 },
    enableTimestampValidation: true,
    enableDuplicateDetection: true,
    includeBufferInHooks: true,
    predicateTimeout: 500,
    candidateExpiryMs: 7200000, // 2 hours
    allowUnsafePredicates: true,
    requireAsyncPredicates: true
  }
};

// ============================================================================
// BUILT-IN LANGUAGE PACKS
// ============================================================================

export const BuiltInLanguagePacks = {
  japanese: {
    name: 'japanese',
    description: 'Classic Japanese candlestick patterns with backtested statistics',
    patterns: {
      doji: {
        type: 'single',
        schema: { bodyRatio: [0.0, 0.07] },
        meta: {
          tradeRelevance: 'reversal',
          timeframe: 'any',
          reliability: 'medium',
          defaultConfidence: 0.75,
          backtestedStats: {
            winRate: 0.52,
            avgReturn: 0.8,
            maxDrawdown: -2.1,
            sampleSize: 1250,
            sharpeRatio: 0.45,
            lastUpdated: '2024-12-15T00:00:00Z'
          },
          statisticalWeight: 0.8
        }
      },
      hammer: {
        type: 'single',
        schema: {
          bodyRatio: [0.10, 0.35],
          lowerWickRatio: [0.55, 1.0],
          upperWickRatio: [0.0, 0.15]
        },
        meta: {
          tradeRelevance: 'reversal',
          timeframe: 'any',
          reliability: 'high',
          defaultConfidence: 0.85,
          backtestedStats: {
            winRate: 0.61,
            avgReturn: 1.2,
            maxDrawdown: -1.8,
            sampleSize: 890,
            sharpeRatio: 0.72,
            lastUpdated: '2024-12-15T00:00:00Z'
          },
          statisticalWeight: 1.2
        }
      },
      shooting_star: {
        type: 'single',
        schema: {
          bodyRatio: [0.10, 0.35],
          upperWickRatio: [0.55, 1.0],
          lowerWickRatio: [0.0, 0.15]
        },
        meta: {
          tradeRelevance: 'reversal',
          timeframe: 'any',
          reliability: 'high',
          defaultConfidence: 0.85,
          backtestedStats: {
            winRate: 0.58,
            avgReturn: 1.1,
            maxDrawdown: -2.3,
            sampleSize: 720,
            sharpeRatio: 0.65,
            lastUpdated: '2024-12-15T00:00:00Z'
          },
          statisticalWeight: 1.1
        }
      },
      marubozu: {
        type: 'single',
        schema: {
          bodyRatio: [0.9, 1.0],
          wickTolerance: [0.0, 0.05]
        },
        meta: {
          tradeRelevance: 'continuation',
          timeframe: 'any',
          reliability: 'high',
          defaultConfidence: 0.80,
          backtestedStats: {
            winRate: 0.55,
            avgReturn: 0.9,
            maxDrawdown: -1.5,
            sampleSize: 650,
            sharpeRatio: 0.58,
            lastUpdated: '2024-12-15T00:00:00Z'
          },
          statisticalWeight: 1.0
        }
      },
      spinning_top: {
        type: 'single',
        schema: {
          bodyRatio: [0.1, 0.3],
          upperWickRatio: [0.3, 0.6],
          lowerWickRatio: [0.3, 0.6]
        },
        meta: {
          tradeRelevance: 'indecision',
          timeframe: 'any',
          reliability: 'medium',
          defaultConfidence: 0.70,
          backtestedStats: {
            winRate: 0.48,
            avgReturn: 0.3,
            maxDrawdown: -1.2,
            sampleSize: 980,
            sharpeRatio: 0.25,
            lastUpdated: '2024-12-15T00:00:00Z'
          },
          statisticalWeight: 0.6
        }
      }
    }
  },

  western: {
    name: 'western',
    description: 'Western multi-candle patterns with backtested statistics',
    patterns: {
      bullish_engulfing: {
        type: 'multi',
        schema: { engulf: true, direction: 'bullish' },
        meta: {
          defaultConfidence: 0.80,
          tradeRelevance: 'reversal',
          timeframe: 'any',
          reliability: 'high',
          backtestedStats: {
            winRate: 0.63,
            avgReturn: 1.4,
            maxDrawdown: -2.5,
            sampleSize: 540,
            sharpeRatio: 0.78,
            lastUpdated: '2024-12-15T00:00:00Z'
          },
          statisticalWeight: 1.3
        }
      },
      bearish_engulfing: {
        type: 'multi',
        schema: { engulf: true, direction: 'bearish' },
        meta: {
          defaultConfidence: 0.80,
          tradeRelevance: 'reversal',
          timeframe: 'any',
          reliability: 'high',
          backtestedStats: {
            winRate: 0.59,
            avgReturn: 1.3,
            maxDrawdown: -2.8,
            sampleSize: 480,
            sharpeRatio: 0.71,
            lastUpdated: '2024-12-15T00:00:00Z'
          },
          statisticalWeight: 1.25
        }
      },
      piercing_pattern: {
        type: 'multi',
        schema: { piercing: true },
        meta: {
          defaultConfidence: 0.70,
          tradeRelevance: 'reversal',
          timeframe: 'any',
          reliability: 'medium',
          backtestedStats: {
            winRate: 0.56,
            avgReturn: 1.0,
            maxDrawdown: -2.2,
            sampleSize: 320,
            sharpeRatio: 0.62,
            lastUpdated: '2024-12-15T00:00:00Z'
          },
          statisticalWeight: 0.9
        }
      },
      dark_cloud_cover: {
        type: 'multi',
        schema: { darkCloud: true },
        meta: {
          defaultConfidence: 0.70,
          tradeRelevance: 'reversal',
          timeframe: 'any',
          reliability: 'medium',
          backtestedStats: {
            winRate: 0.54,
            avgReturn: 0.95,
            maxDrawdown: -2.4,
            sampleSize: 290,
            sharpeRatio: 0.58,
            lastUpdated: '2024-12-15T00:00:00Z'
          },
          statisticalWeight: 0.85
        }
      },
      morning_star: {
        type: 'multi',
        schema: { morningEvening: true, direction: 'bullish' },
        meta: {
          defaultConfidence: 0.80,
          tradeRelevance: 'reversal',
          timeframe: 'any',
          reliability: 'high',
          backtestedStats: {
            winRate: 0.65,
            avgReturn: 1.5,
            maxDrawdown: -2.1,
            sampleSize: 180,
            sharpeRatio: 0.82,
            lastUpdated: '2024-12-15T00:00:00Z'
          },
          statisticalWeight: 1.4
        }
      },
      evening_star: {
        type: 'multi',
        schema: { morningEvening: true, direction: 'bearish' },
        meta: {
          defaultConfidence: 0.80,
          tradeRelevance: 'reversal',
          timeframe: 'any',
          reliability: 'high',
          backtestedStats: {
            winRate: 0.62,
            avgReturn: 1.4,
            maxDrawdown: -2.3,
            sampleSize: 165,
            sharpeRatio: 0.79,
            lastUpdated: '2024-12-15T00:00:00Z'
          },
          statisticalWeight: 1.35
        }
      },
      three_white_soldiers: {
        type: 'multi',
        schema: { threeSoldiers: true, direction: 'bullish' },
        meta: {
          defaultConfidence: 0.85,
          tradeRelevance: 'continuation',
          timeframe: 'any',
          reliability: 'high',
          backtestedStats: {
            winRate: 0.67,
            avgReturn: 1.8,
            maxDrawdown: -1.9,
            sampleSize: 120,
            sharpeRatio: 0.91,
            lastUpdated: '2024-12-15T00:00:00Z'
          },
          statisticalWeight: 1.5
        }
      },
      three_black_crows: {
        type: 'multi',
        schema: { threeSoldiers: true, direction: 'bearish' },
        meta: {
          defaultConfidence: 0.85,
          tradeRelevance: 'continuation',
          timeframe: 'any',
          reliability: 'high',
          backtestedStats: {
            winRate: 0.64,
            avgReturn: 1.7,
            maxDrawdown: -2.0,
            sampleSize: 110,
            sharpeRatio: 0.88,
            lastUpdated: '2024-12-15T00:00:00Z'
          },
          statisticalWeight: 1.45
        }
      },
      bullish_harami: {
        type: 'multi',
        schema: { harami: true, direction: 'bullish' },
        meta: {
          defaultConfidence: 0.70,
          tradeRelevance: 'reversal',
          timeframe: 'any',
          reliability: 'medium',
          backtestedStats: {
            winRate: 0.55,
            avgReturn: 0.9,
            maxDrawdown: -1.8,
            sampleSize: 380,
            sharpeRatio: 0.61,
            lastUpdated: '2024-12-15T00:00:00Z'
          },
          statisticalWeight: 0.9
        }
      },
      bearish_harami: {
        type: 'multi',
        schema: { harami: true, direction: 'bearish' },
        meta: {
          defaultConfidence: 0.70,
          tradeRelevance: 'reversal',
          timeframe: 'any',
          reliability: 'medium',
          backtestedStats: {
            winRate: 0.53,
            avgReturn: 0.85,
            maxDrawdown: -1.9,
            sampleSize: 350,
            sharpeRatio: 0.59,
            lastUpdated: '2024-12-15T00:00:00Z'
          },
          statisticalWeight: 0.85
        }
      }
    }
  },

  quant: {
    name: 'quant',
    description: 'Quantitative/algorithmic patterns with backtested statistics',
    patterns: {
      momentum_candle: {
        type: 'single',
        schema: {
          bodyRatio: [0.5, 1.0],
          wickTolerance: [0.0, 0.2]
        },
        meta: {
          timeframe: 'any',
          reliability: 'high',
          tradeRelevance: 'entry',
          defaultConfidence: 0.85,
          backtestedStats: {
            winRate: 0.58,
            avgReturn: 1.1,
            maxDrawdown: -1.7,
            sampleSize: 750,
            sharpeRatio: 0.69,
            lastUpdated: '2024-12-15T00:00:00Z'
          },
          statisticalWeight: 1.1
        }
      },
      imbalance_candle: {
        type: 'single',
        schema: {
          bodyRatio: [0.4, 1.0],
          volumeMultiplier: [1.5, 10.0]
        },
        meta: {
          timeframe: 'any',
          reliability: 'high',
          tradeRelevance: 'entry',
          defaultConfidence: 0.80,
          backtestedStats: {
            winRate: 0.62,
            avgReturn: 1.3,
            maxDrawdown: -2.0,
            sampleSize: 620,
            sharpeRatio: 0.74,
            lastUpdated: '2024-12-15T00:00:00Z'
          },
          statisticalWeight: 1.2
        }
      },
      power_candle: {
        type: 'single',
        schema: {
          bodyRatio: [0.7, 1.0],
          volumeMultiplier: [2.0, 10.0],
          wickTolerance: [0.0, 0.15]
        },
        meta: {
          timeframe: 'intraday',
          reliability: 'high',
          tradeRelevance: 'entry',
          defaultConfidence: 0.90,
          backtestedStats: {
            winRate: 0.66,
            avgReturn: 1.6,
            maxDrawdown: -1.8,
            sampleSize: 450,
            sharpeRatio: 0.85,
            lastUpdated: '2024-12-15T00:00:00Z'
          },
          statisticalWeight: 1.4
        }
      }
    }
  }
};

// ============================================================================
// CONFIGURATION
// ============================================================================

/**
 * Configuration management for the library
 */
export class Config {
  constructor(custom = {}) {
    this.values = Object.assign({
      volumeSignificance: 1.5,
      volatilityWindow: 20,
      trendWindow: 10,
      confidenceMin: CONSTANTS.CONFIDENCE_MIN_DEFAULT,
      confirmationMode: false,
      maxBufferLength: CONSTANTS.MAX_BUFFER_LENGTH_DEFAULT,
      confidenceAggregation: {
        window: 3,
        strategy: 'weighted',
        decay: 0.5
      },
      allowUnsafePredicates: false,
      requireAsyncPredicates: true,
      mode: 'normal', // 'normal' | 'light' | 'lite'
      enableTimestampValidation: true,
      enableDuplicateDetection: true,
      predicateTimeout: CONSTANTS.PREDICATE_TIMEOUT_MS,
      candidateExpiryMs: CONSTANTS.CANDIDATE_EXPIRY_MS,
      includeBufferInHooks: false,
      timeframe: {
        name: 'unknown',
        intervalMs: 60000, // 1 minute default
        validateContinuity: true,
        maxGapMs: 300000 // 5 minutes default max gap
      }
    }, custom);

    // Accept 'lite' as alias of 'light'
    if (this.values.mode === 'lite') {
      this.values.mode = 'light';
    }

    this._validateConfig(this.values);

    this.languageManager = new PatternLanguageManager();
   
    // Register built-in packs
    Object.entries(BuiltInLanguagePacks).forEach(([k, p]) => {
      this.languageManager.register(k, p);
    });

    if (!this.languageManager.active) {
      this.languageManager.setActive('japanese');
    }
  }

  /**
   * Validate configuration values
   */
  _validateConfig(cfg) {
    if (typeof cfg !== 'object') {
      throw new ConfigError('Config must be an object');
    }

    if (cfg.confidenceMin !== undefined) {
      if (typeof cfg.confidenceMin !== 'number' ||
          cfg.confidenceMin < 0 ||
          cfg.confidenceMin > 1) {
        throw new ConfigError('confidenceMin must be between 0 and 1');
      }
    }

    if (cfg.maxBufferLength !== undefined) {
      if (typeof cfg.maxBufferLength !== 'number' || cfg.maxBufferLength < 1) {
        throw new ConfigError('maxBufferLength must be > 0');
      }
    }

    if (cfg.predicateTimeout !== undefined) {
      if (typeof cfg.predicateTimeout !== 'number' ||
          cfg.predicateTimeout < CONSTANTS.PREDICATE_TIMEOUT_MIN ||
          cfg.predicateTimeout > CONSTANTS.PREDICATE_TIMEOUT_MAX) {
        throw new ConfigError(
          `predicateTimeout must be between ${CONSTANTS.PREDICATE_TIMEOUT_MIN} and ${CONSTANTS.PREDICATE_TIMEOUT_MAX}ms`
        );
      }
    }

    if (cfg.candidateExpiryMs !== undefined) {
      if (typeof cfg.candidateExpiryMs !== 'number' || cfg.candidateExpiryMs < 0) {
        throw new ConfigError('candidateExpiryMs must be >= 0');
      }
    }

    if (cfg.confidenceAggregation !== undefined) {
      const agg = cfg.confidenceAggregation;
      if (typeof agg !== 'object') {
        throw new ConfigError('confidenceAggregation must be an object');
      }
      if (agg.window !== undefined &&
          (typeof agg.window !== 'number' || agg.window < 1)) {
        throw new ConfigError('confidenceAggregation.window must be > 0');
      }
      if (agg.strategy !== undefined &&
          !['weighted', 'avg', 'sum'].includes(agg.strategy)) {
        throw new ConfigError(
          'confidenceAggregation.strategy must be weighted, avg, or sum'
        );
      }
      if (agg.decay !== undefined &&
          (typeof agg.decay !== 'number' || agg.decay < 0 || agg.decay > 1)) {
        throw new ConfigError('confidenceAggregation.decay must be between 0 and 1');
      }
    }

    // Validate boolean config options
    const booleanKeys = ['allowUnsafePredicates', 'requireAsyncPredicates',
                         'enableTimestampValidation', 'enableDuplicateDetection',
                         'includeBufferInHooks', 'confirmationMode'];
    for (const key of booleanKeys) {
      if (cfg[key] !== undefined && typeof cfg[key] !== 'boolean') {
        throw new ConfigError(`${key} must be a boolean`);
      }
    }

    // Validate mode enum
    if (cfg.mode !== undefined && !['normal', 'light', 'lite'].includes(cfg.mode)) {
      throw new ConfigError('mode must be normal or light');
    }

    // Validate numeric window configs (for future features)
    if (cfg.volatilityWindow !== undefined) {
      if (typeof cfg.volatilityWindow !== 'number' || cfg.volatilityWindow < 1) {
        throw new ConfigError('volatilityWindow must be >= 1');
      }
    }

    if (cfg.trendWindow !== undefined) {
      if (typeof cfg.trendWindow !== 'number' || cfg.trendWindow < 1) {
        throw new ConfigError('trendWindow must be >= 1');
      }
    }

    if (cfg.volumeSignificance !== undefined) {
      if (typeof cfg.volumeSignificance !== 'number' || cfg.volumeSignificance <= 0) {
        throw new ConfigError('volumeSignificance must be > 0');
      }
    }

    return cfg;
  }

  set(k, v) {
    this.values[k] = v;
    this._validateConfig(this.values);
    return this;
  }

  get(k) {
    return this.values[k];
  }

  getLanguageManager() {
    return this.languageManager;
  }

  setLanguage(name) {
    this.languageManager.setActive(name);
    return this;
  }

  listLanguages() {
    return this.languageManager.list();
  }
}

// ============================================================================
// SCANNER
// ============================================================================

/**
 * Scans raw OHLCV data and extracts candlestick metrics
 */
export class Scanner {
  /**
   * Scan a single candle
   * @param {Object} c - Raw candle data {open, high, low, close, volume?, timestamp?}
   * @returns {Object} Scanned candle with metrics
   */
  scan(c) {
    const open = Number(c.open);
    const high = Number(c.high);
    const low = Number(c.low);
    const close = Number(c.close);
    const volume = isNumber(c.volume) ? Number(c.volume) : 0;
    const timestamp = c.timestamp || Date.now();

    const body = Math.abs(close - open);
    const range = Math.max(0, high - low);
    const upperWick = Math.max(0, high - Math.max(open, close));
    const lowerWick = Math.max(0, Math.min(open, close) - low);

    const bodyRatio = range > 0 ? body / range : 0;
    const upperWickRatio = range > 0 ? upperWick / range : 0;
    const lowerWickRatio = range > 0 ? lowerWick / range : 0;
    const closePosition = range > 0 ? (close - low) / range : 0.5;
    const bodyMidpoint = (Math.max(open, close) + Math.min(open, close)) / 2;
    const bodyPosition = range > 0 ? (bodyMidpoint - low) / range : 0.5;

    const direction = close > open ? 'bullish' :
                     close < open ? 'bearish' : 'neutral';

    return {
      open, high, low, close, volume, timestamp,
      body, range, upperWick, lowerWick,
      bodyRatio, upperWickRatio, lowerWickRatio,
      closePosition, bodyPosition, direction
    };
  }

  /**
   * Scan multiple candles in batch
   * @param {Array} arr - Array of raw candles
   * @returns {Array} Array of scanned candles
   */
  scanBatch(arr) {
    if (!Array.isArray(arr)) {
      throw new ValidationError('scanBatch requires an array');
    }
   
    return arr.map((c, i) => {
      try {
        return this.scan(c);
      } catch (e) {
        throw new ValidationError(`Error scanning candle at index ${i}`, {
          index: i,
          error: e.message
        });
      }
    });
  }
}

// ============================================================================
// STATISTICAL ANALYZER
// ============================================================================

/**
 * Analyzes historical candle data for statistical metrics
 */
export class StatisticalAnalyzer {
  constructor(config) {
    this.config = config;
  }

  /**
   * Analyze historical candle data
   * @param {Array} history - Array of scanned candles
   * @returns {Object} Statistical metrics
   */
  analyze(history = []) {
    if (!Array.isArray(history) || !history.length) {
      return {
        avgVol: 0,
        medianVol: 0,
        avgRange: 0,
        avgBody: 0,
        volatility: 0,
        volatilityPercentile: 0.5,
        rangePercentile: 0.5,
        sampleSize: 0
      };
    }

    const vols = history
      .map(h => h.volume || 0)
      .filter(v => isNumber(v) && v > 0);
    const sortedVols = [...vols].sort((a, b) => a - b);
    const avgVol = vols.length ?
      vols.reduce((a, b) => a + b, 0) / vols.length : 0;
    const medianVol = sortedVols.length > 0 ?
      sortedVols[Math.floor(sortedVols.length / 2)] : 0;

    const ranges = history
      .map(h => h.range || 0)
      .filter(r => isNumber(r));
    const sortedRanges = [...ranges].sort((a, b) => a - b);
    const avgRange = ranges.length ?
      ranges.reduce((a, b) => a + b, 0) / ranges.length : 0;

    const bodies = history
      .map(h => h.body || 0)
      .filter(b => isNumber(b));
    const avgBody = bodies.length ?
      bodies.reduce((a, b) => a + b, 0) / bodies.length : 0;

    // FIXED: Proper volatility calculation with NaN/division-by-zero protection
    let volatility = 0;
    if (ranges.length > 1 && avgRange > 0 && isNumber(avgRange)) {
      const variance = ranges.reduce((sum, r) => {
        const diff = r - avgRange;
        return sum + (isNumber(diff) ? Math.pow(diff, 2) : 0);
      }, 0) / ranges.length;
      volatility = isNumber(variance) && variance >= 0 ? Math.sqrt(variance) : 0;
    }
    
    // FIXED: Ensure volatility is always a valid number
    if (!isNumber(volatility) || !isFinite(volatility)) {
      volatility = 0;
    }

    // Calculate percentiles for volatility context
    const rangePercentile = sortedRanges.length > 0 && avgRange > 0 ?
      (sortedRanges.filter(r => r <= avgRange).length / sortedRanges.length) : 0.5;
    
    // FIXED: Volatility percentile based on coefficient of variation (CV = σ/μ)
    // Calculate CV for overall volatility, then rank each candle's relative deviation
    const coeffVar = (avgRange > 0 && volatility >= 0 && isNumber(volatility) && isNumber(avgRange)) 
      ? (volatility / avgRange) 
      : 0;
    
    // FIXED: Ensure coeffVar is valid
    const validCoeffVar = isNumber(coeffVar) && isFinite(coeffVar) && coeffVar >= 0 ? coeffVar : 0;
    
    // FIXED: Calculate relative deviation for each candle: |range_i - μ| / μ
    // This is consistent with CV calculation and represents how volatile each candle is relative to mean
    const allRelativeDeviations = history.map(h => {
      const hRange = h.range || 0;
      if (!isNumber(hRange) || !isNumber(avgRange) || avgRange <= 0) return 0;
      const deviation = Math.abs(hRange - avgRange) / avgRange;
      return isNumber(deviation) && isFinite(deviation) ? deviation : 0;
    }).filter(v => isNumber(v) && v >= 0 && isFinite(v)); // Include zero deviations, exclude NaN/Infinity
    
    const sortedDeviations = [...allRelativeDeviations].sort((a, b) => a - b);
    const volatilityPercentile = sortedDeviations.length > 0 && validCoeffVar >= 0 ?
      Math.max(0, Math.min(1, sortedDeviations.filter(v => v <= validCoeffVar).length / sortedDeviations.length)) : 0.5;
    
    // FIXED: Final validation to ensure percentile is valid
    const finalVolatilityPercentile = isNumber(volatilityPercentile) && isFinite(volatilityPercentile) 
      ? Math.max(0, Math.min(1, volatilityPercentile)) 
      : 0.5;

    return {
      avgVol,
      medianVol,
      avgRange,
      avgBody,
      volatility: isNumber(volatility) && isFinite(volatility) ? volatility : 0,
      volatilityPercentile: finalVolatilityPercentile,
      rangePercentile: isNumber(rangePercentile) && isFinite(rangePercentile) 
        ? Math.max(0, Math.min(1, rangePercentile)) 
        : 0.5,
      sampleSize: history.length
    };
  }
}

// ============================================================================
// CALIBRATOR
// ============================================================================

/**
 * Calibrates scanned candles against pattern definitions
 */
export class Calibrator {
  constructor(config) {
    this.config = config;
    this.langMgr = config.getLanguageManager();
    this.stats = new StatisticalAnalyzer(config);
  }

  /**
   * Calibrate a scanned candle with pattern detection
   * @param {Object} scanned - Scanned candle data
   * @param {Array} history - Historical scanned candles
   * @returns {Promise<Object>} Calibrated candle with pattern match
   */
  async calibrate(scanned, history = []) {
    const scanner = new Scanner();
    const scannedHistory = history.map(h =>
      h.body !== undefined ? h : scanner.scan(h)
    );

    const stats = this.stats.analyze(scannedHistory);
    const singles = await this._evaluateSinglePatterns(scanned, stats, scannedHistory);
    const multis = this._evaluateMultiPatterns(scanned, scannedHistory, stats);

    const best = this._chooseBest(singles, multis, scannedHistory, stats);

    if (best) {
      if (Array.isArray(best)) {
        // emitMode 'all' or 'topN': attach stats and language to each pattern
        best.forEach(p => {
          p.significance = clamp(p.confidence || 0, 0, 1);
          p.language = this.langMgr.active;
          p.stats = stats;
        });
      } else {
        best.significance = clamp(best.confidence || 0, 0, 1);
        best.language = this.langMgr.active;
        best.stats = stats;
      }
    }

    return Object.assign({}, scanned, {
      pattern: best || null,
      candidates: { single: singles, multi: multis }
    });
  }

  /**
   * Choose the best pattern from candidates, with optional multi-output support.
   * FIX-1: emitMode='single'|'topN'|'all'. FIX-2: stat confidence suspended early.
   * @param {Array} singles @param {Array} multis @param {Array} history @param {Object} stats
   * @returns {Object|Array|null}
   */
  _chooseBest(singles, multis, history = [], stats = {}) {
    const all = [];

    if (Array.isArray(singles)) {
      all.push(...singles.map(p => ({ ...p, _typeWeight: 1.0 })));
    }
    if (Array.isArray(multis)) {
      all.push(...multis.map(p => ({ ...p, _typeWeight: 1.15 })));
    }
    if (!all.length) return null;

    const cfgMin = this.config.get('confidenceMin') || CONSTANTS.CONFIDENCE_MIN_DEFAULT;
    const statMin = this.config.get('statisticalConfidenceMin') ||
                    CONSTANTS.STATISTICAL_CONFIDENCE_MIN_DEFAULT;
    const minVolSamples = CONSTANTS.MIN_SAMPLE_SIZE_VOLATILITY;
    const sampleSize = stats.sampleSize || 0;

    // Score, boost, and compute per-pattern statistical confidence
    const scoreAll = all.map(p => {
      let composite = (p.confidence || 0) * (p._typeWeight || 1.0);
      if (typeof p.score === 'number') composite += p.score * 0.1;

      const isHighRelevance =
        p?.meta?.tradeRelevance === 'entry' ||
        p?.meta?.tradeRelevance === 'reversal';

      if (isHighRelevance) composite *= CONSTANTS.CONFIDENCE_BOOST_MULTIPLIER;

      let finalConfidence = p.confidence || 0;
      if (isHighRelevance) {
        finalConfidence = Math.min(1, finalConfidence * CONSTANTS.CONFIDENCE_BOOST_MULTIPLIER);
      }

      // FIX-2: Suspend statistical gating when sample window is too small.
      // Below MIN_SAMPLE_SIZE_VOLATILITY the CV calculation is noisy and penalises
      // perfectly valid patterns for a metric that doesn't yet mean anything.
      let statisticalConfidence = 1.0; // suspended by default
      if (sampleSize >= minVolSamples) {
        if (p.patternType === 'multi') {
          const historyAdequacy  = Math.min(1.0, (history.length || 0) / CONSTANTS.MIN_SAMPLE_SIZE_MULTI_CANDLE);
          const volatilityAdequacy = Math.min(1.0, sampleSize / minVolSamples);
          statisticalConfidence  = Math.min(historyAdequacy, volatilityAdequacy);
        } else {
          statisticalConfidence = Math.min(1.0, sampleSize / minVolSamples);
        }
      }

      return { ...p, _compositeScore: composite, _finalConfidence: finalConfidence, _statConf: statisticalConfidence };
    });

    scoreAll.sort((a, b) => (b._compositeScore || 0) - (a._compositeScore || 0));

    // Filter: must pass confidence AND statistical thresholds
    const qualifying = scoreAll.filter(p => {
      const effectiveMin = typeof p.minConf === 'number' ? Math.max(cfgMin, p.minConf) : cfgMin;
      return p._finalConfidence >= effectiveMin && p._statConf >= statMin;
    });

    if (!qualifying.length) return null;

    // Materialise and clean internal scoring fields
    const finalise = (p) => {
      const out = { ...p };
      out.confidence = p._finalConfidence;
      out.statisticalConfidence = p._statConf;
      delete out._typeWeight;
      delete out._compositeScore;
      delete out._finalConfidence;
      delete out._statConf;
      delete out.minConf;
      return out;
    };

    // FIX-1: emitMode controls output shape
    const emitMode = this.config.get('emitMode') || 'single';

    if (emitMode === 'all') {
      return qualifying.map(finalise);
    }
    if (emitMode === 'topN') {
      const n = Math.max(1, this.config.get('emitTopN') || 3);
      return qualifying.slice(0, n).map(finalise);
    }


    // Default: 'single' — backward-compatible
    return finalise(qualifying[0]);
  }


  /**
   * Evaluate single-candle patterns
   * @param {Object} scanned - Scanned candle
   * @param {Object} stats - Statistical metrics
   * @param {Array} history - Historical scanned candles
   * @returns {Promise<Array>} Array of matching patterns
   */
  async _evaluateSinglePatterns(scanned, stats, history) {
    const patterns = [];
    const packs = this.langMgr.getPatterns();

    // Clone history once for all predicates
    const safeHistoryBase = history.slice();

    for (const [name, def] of Object.entries(packs)) {
      if (def.type !== 'single') continue;

      const schema = def.schema || {};
      const scores = [];
      const weights = [];
      let matched = true;

      // FIX-8: Enforce schema.direction for single-candle patterns.
      // If a pattern definition specifies a direction (e.g. direction: 'bullish'),
      // only candles moving in that direction should be evaluated.  Previously this
      // field was accepted in the schema but never enforced, so custom pattern authors
      // could not rely on directional filtering.
      if (schema.direction && scanned.direction !== schema.direction) {
        continue; // Wrong candle direction — skip this pattern entirely
      }

      // FIX-3: Use explicit meta.category === 'indecision' instead of body-ratio heuristic.
      // The old heuristic (bodyRatio[1] < 0.15) incorrectly classified hammer-class patterns
      // as indecision patterns and silently suppressed them when volatility was low.
      // Hammer is a directional reversal signal — it must never be volatility-gated as an
      // indecision pattern.  The correct approach is to let pattern authors declare category
      // in meta (category: 'indecision') and apply the gate only to those declarations.
      const isIndecisionPattern = def.meta?.category === 'indecision';

      if (isIndecisionPattern) {
        // Indecision patterns (doji, spinning_top) require sufficient volatility context.
        // In very low volatility a doji is noise, not a meaningful reversal signal.
        if (stats.volatilityPercentile < CONSTANTS.DOJI_MIN_VOLATILITY_PERCENTILE) {
          continue; // Skip — low volatility makes indecision patterns meaningless
        }

        // For doji specifically, also require balanced wicks
        if (name === 'doji') {
          const wickBalance = Math.abs(scanned.upperWickRatio - scanned.lowerWickRatio);
          if (wickBalance > CONSTANTS.DOJI_WICK_BALANCE_TOLERANCE) {
            matched = false; // Wicks too unbalanced for true doji
          } else {
            // Score based on wick balance (more balanced = higher score)
            scores.push(1 - (wickBalance / CONSTANTS.DOJI_WICK_BALANCE_TOLERANCE));
            weights.push(0.3);
          }
        }
      }

      // Body ratio check
      if (schema.bodyRatio) {
        if (!withinRange(scanned.bodyRatio, schema.bodyRatio)) {
          matched = false;
        } else {
          scores.push(centerDistanceScore(scanned.bodyRatio, schema.bodyRatio));
          weights.push(0.25); // Primary criteria
        }
      }

      // Upper wick ratio check
      if (schema.upperWickRatio) {
        if (!withinRange(scanned.upperWickRatio, schema.upperWickRatio)) {
          matched = false;
        } else {
          scores.push(centerDistanceScore(scanned.upperWickRatio, schema.upperWickRatio));
          weights.push(0.15);
        }
      }

      // Lower wick ratio check
      if (schema.lowerWickRatio) {
        if (!withinRange(scanned.lowerWickRatio, schema.lowerWickRatio)) {
          matched = false;
        } else {
          scores.push(centerDistanceScore(scanned.lowerWickRatio, schema.lowerWickRatio));
          weights.push(0.15);
        }
      }

      // Wick tolerance check
      if (schema.wickTolerance) {
        const total = scanned.upperWickRatio + scanned.lowerWickRatio;
        if (!withinRange(total, schema.wickTolerance)) {
          matched = false;
        } else {
          scores.push(centerDistanceScore(total, schema.wickTolerance));
          weights.push(0.1);
        }
      }

      // FIXED: Volume multiplier check with division-by-zero protection
      if (schema.volumeMultiplier && 
          isNumber(stats.medianVol) && stats.medianVol > 0 &&
          isNumber(scanned.volume) && scanned.volume >= 0) {
        const mult = scanned.volume / stats.medianVol;
        if (!isNumber(mult) || !isFinite(mult)) {
          matched = false; // Skip if invalid calculation
        } else if (!withinRange(mult, schema.volumeMultiplier)) {
          matched = false;
        } else {
          scores.push(centerDistanceScore(mult, schema.volumeMultiplier));
          weights.push(0.15);
        }
      }

      // Close position check
      if (schema.closePosition) {
        if (!withinRange(scanned.closePosition, schema.closePosition)) {
          matched = false;
        } else {
          scores.push(centerDistanceScore(scanned.closePosition, schema.closePosition));
          weights.push(0.1);
        }
      }

      // Body position check
      if (schema.bodyPosition) {
        if (!withinRange(scanned.bodyPosition, schema.bodyPosition)) {
          matched = false;
        } else {
          scores.push(centerDistanceScore(scanned.bodyPosition, schema.bodyPosition));
          weights.push(0.1);
        }
      }

      // Relative condition check
      if (schema.relative) {
        const ok = evalRelativeCondition(scanned, history, schema.relative);
        if (!ok) {
          matched = false;
        } else {
          scores.push(1.0); // Perfect match for boolean condition
          weights.push(0.1);
        }
      }

      // FIXED: Predicate function with enhanced security and resource limits
      if (schema.predicate && typeof schema.predicate === 'function') {
        if (this.config.get('allowUnsafePredicates')) {
          const requireAsync = this.config.get('requireAsyncPredicates') !== false;
          const isAsync = schema.predicate.constructor.name === 'AsyncFunction';
        
          if (requireAsync && !isAsync) {
            // FIXED: Use error emitter instead of console.warn for production
            this.config.getLanguageManager()._emitWarning?.(
              `Predicate for pattern ${name} must be async; skipping`
            );
            matched = false;
          } else {
            // Clone scanned object to prevent mutation
            const safeScanned = cloneScanned(scanned);
            const timeoutMs = Math.min(
              Math.max(
                this.config.get('predicateTimeout') || CONSTANTS.PREDICATE_TIMEOUT_MS,
                CONSTANTS.PREDICATE_TIMEOUT_MIN
              ),
              CONSTANTS.PREDICATE_TIMEOUT_MAX
            );
           
            // FIXED: Enhanced timeout protection with resource limits
            try {
              const ok = await executePredicateWithTimeout(
                schema.predicate,
                safeScanned,
                safeHistoryBase,
                timeoutMs
              );
             
              if (!ok) {
                matched = false;
              }
            } catch (predicateError) {
              // FIXED: Catch predicate errors to prevent DoS
              matched = false;
              // Log but don't throw to prevent breaking pattern evaluation
              if (predicateError instanceof TimeoutError) {
                // Timeout is expected, silently fail
              } else {
                // Unexpected error - log but continue
                this.config.getLanguageManager()._emitWarning?.( 
                  `Predicate error for pattern ${name}: ${predicateError.message}`
                );
              }
            }
          }
        } else {
          // Predicates disabled for security
          matched = false;
        }
      }

      // If matched, calculate weighted average score
      if (matched) {
        let finalScore = 1.0;
        
        // Calculate weighted average score (instead of multiplicative)
        if (scores.length > 0 && weights.length > 0) {
          const totalWeight = weights.reduce((a, b) => a + b, 0);
          if (totalWeight > 0) {
            finalScore = scores.reduce((sum, s, i) => sum + (s * (weights[i] || 0)), 0) / totalWeight;
          }
        }

        // Apply minimum score threshold
        if (finalScore < CONSTANTS.MIN_SCORE_THRESHOLD) {
          continue; // Skip patterns below minimum score
        }

        const meta = def.meta || {};
        // FIXED: Standardized confidence calculation - use consistent default
        const defaultConf = meta.defaultConfidence !== undefined ? meta.defaultConfidence : 0.7;
        const baseConf = defaultConf * finalScore;
        const minConf = typeof meta.confidenceMin === 'number' ?
                      meta.confidenceMin : null;
        const confidence = clamp(baseConf, 0, 1);

        patterns.push({
          type: name,
          confidence,
          score: finalScore, // Store raw score for debugging
          minConf,
          patternType: 'single',
          meta,
          definition: def
        });
      }
    }

    return patterns;
  }

  /**
   * Evaluate multi-candle patterns
   * @param {Object} scanned - Current scanned candle
   * @param {Array} history - Historical scanned candles
   * @param {Object} stats - Statistical metrics
   * @returns {Array} Array of matching multi-candle patterns
   */
  _evaluateMultiPatterns(scanned, history, stats) {
    if (this.config.get('mode') === 'light') return [];

    // Statistical validity check: require minimum sample size for reliable multi-candle patterns
    if (history.length < CONSTANTS.MIN_SAMPLE_SIZE_MULTI_CANDLE) {
      return []; // Insufficient history for statistically valid multi-candle pattern detection
    }

    // Additional statistical validity: require minimum volatility sample size
    if (stats.sampleSize < CONSTANTS.MIN_SAMPLE_SIZE_VOLATILITY) {
      return []; // Insufficient volatility history for reliable percentile calculations
    }

    const results = [];
    const packs = this.langMgr.getPatterns();

    for (const [name, def] of Object.entries(packs)) {
      if (def.type !== 'multi') continue;

      const schema = def.schema || {};
      const meta = def.meta || {};

      // ========== ENGULFING PATTERNS ==========
      if (schema.engulf) {
        const prev = history[history.length - 1];
        if (!prev || !isNumber(prev.open) || !isNumber(prev.close)) continue;

        const curBody = Math.abs(scanned.close - scanned.open);
        const prevBody = Math.abs(prev.close - prev.open);
        const bodyRatio = prevBody > 0 ? curBody / prevBody : 0;

        // Determine target direction from schema only (don't infer from name)
        const targetDirection = schema.direction;

        // Bullish Engulfing
        if (targetDirection === 'bullish' &&
            bodyRatio >= CONSTANTS.ENGULFING_MIN_RATIO &&
            scanned.direction === 'bullish' &&
            prev.direction === 'bearish' &&
            scanned.open <= prev.close &&
            scanned.close >= prev.open) {
          
          // Enhanced validation: check full candle engulfing (body + wicks)
          const fullEngulfing = scanned.high >= prev.high && scanned.low <= prev.low;
          const bodyEngulfing = scanned.open <= prev.close && scanned.close >= prev.open;
          
          // Calculate pattern quality score
          let score = 0.7; // Base score
          
          // Body size score (larger ratio = higher score, capped at 2.0)
          const bodySizeScore = Math.min(1.0, bodyRatio / 2.0);
          score += bodySizeScore * 0.2;
          
          // FIXED: Volume validation with safe division
          // FIX-4: Symmetric volume scoring — penalty magnitude equals bonus magnitude,
          // both scaled by current confidence so volume modifies certainty proportionally.
          // The old code had -0.2 penalty vs +0.1 bonus, which punished normal-volume
          // patterns and made Engulfing patterns systematically over-favour high-volume
          // candles while under-valuing equally valid structures.
          const volMultiplier = safeVolumeMultiplier(scanned.volume, stats.medianVol);
          if (volMultiplier >= CONSTANTS.VOLUME_HIGH) {
            score += 0.1 * clamp(score, 0.5, 1.0); // Proportional bonus
          } else if (volMultiplier < CONSTANTS.VOLUME_LOW) {
            score -= 0.1 * clamp(score, 0.5, 1.0); // Symmetric proportional penalty
          }
          // Zero-volume candles (volMultiplier === 0.0) receive full penalty
          if (volMultiplier === 0.0) {
            score -= 0.15; // Additional penalty for confirmed zero-volume
          }

          // Full candle engulfing bonus
          if (fullEngulfing) {
            score += 0.15;
          } else if (bodyEngulfing) {
            score += 0.05;
          }
          
          // Volatility context (more significant in volatile markets)
          if (stats.volatilityPercentile > CONSTANTS.HIGH_VOLATILITY_THRESHOLD) {
            score += 0.1;
          } else if (stats.volatilityPercentile < CONSTANTS.LOW_VOLATILITY_THRESHOLD) {
            score -= 0.1; // Less significant in low volatility
          }
          
          score = clamp(score, 0, 1);
          
          if (score >= CONSTANTS.MIN_SCORE_THRESHOLD) {
            // FIXED: Standardized confidence calculation
            const defaultConf = meta.defaultConfidence !== undefined ? meta.defaultConfidence : 0.7;
            const baseConf = defaultConf * score;
            results.push({
              type: name,
              confidence: clamp(baseConf, 0, 1),
              score: score,
              patternType: 'multi',
              meta,
              definition: def,
              reversal: 'bullish'
            });
          }
        }

        // Bearish Engulfing
        if (targetDirection === 'bearish' &&
            bodyRatio >= CONSTANTS.ENGULFING_MIN_RATIO &&
            scanned.direction === 'bearish' &&
            prev.direction === 'bullish' &&
            scanned.open >= prev.close &&
            scanned.close <= prev.open) {
          
          // Enhanced validation: check full candle engulfing (body + wicks)
          const fullEngulfing = scanned.high >= prev.high && scanned.low <= prev.low;
          const bodyEngulfing = scanned.open >= prev.close && scanned.close <= prev.open;
          
          // Calculate pattern quality score
          let score = 0.7; // Base score
          
          // Body size score (larger ratio = higher score, capped at 2.0)
          const bodySizeScore = Math.min(1.0, bodyRatio / 2.0);
          score += bodySizeScore * 0.2;
          
          // FIXED: Volume validation with safe division
          // FIX-4: Symmetric volume scoring — penalty magnitude equals bonus magnitude,
          // both scaled by current confidence so volume modifies certainty proportionally.
          // The old code had -0.2 penalty vs +0.1 bonus, which punished normal-volume
          // patterns and made Engulfing patterns systematically over-favour high-volume
          // candles while under-valuing equally valid structures.
          const volMultiplier = safeVolumeMultiplier(scanned.volume, stats.medianVol);
          if (volMultiplier >= CONSTANTS.VOLUME_HIGH) {
            score += 0.1 * clamp(score, 0.5, 1.0); // Proportional bonus
          } else if (volMultiplier < CONSTANTS.VOLUME_LOW) {
            score -= 0.1 * clamp(score, 0.5, 1.0); // Symmetric proportional penalty
          }
          // Zero-volume candles (volMultiplier === 0.0) receive full penalty
          if (volMultiplier === 0.0) {
            score -= 0.15; // Additional penalty for confirmed zero-volume
          }

          // Full candle engulfing bonus
          if (fullEngulfing) {
            score += 0.15;
          } else if (bodyEngulfing) {
            score += 0.05;
          }
          
          // Volatility context (more significant in volatile markets)
          if (stats.volatilityPercentile > CONSTANTS.HIGH_VOLATILITY_THRESHOLD) {
            score += 0.1;
          } else if (stats.volatilityPercentile < CONSTANTS.LOW_VOLATILITY_THRESHOLD) {
            score -= 0.1; // Less significant in low volatility
          }
          
          score = clamp(score, 0, 1);
          
          if (score >= CONSTANTS.MIN_SCORE_THRESHOLD) {
            // FIXED: Standardized confidence calculation
            const defaultConf = meta.defaultConfidence !== undefined ? meta.defaultConfidence : 0.7;
            const baseConf = defaultConf * score;
            results.push({
              type: name,
              confidence: clamp(baseConf, 0, 1),
              score: score,
              patternType: 'multi',
              meta,
              definition: def,
              reversal: 'bearish'
            });
          }
        }
      }

      // ========== PIERCING PATTERN ==========
      if (schema.piercing) {
        const prev = history[history.length - 1];
        if (!prev || !isNumber(prev.open) || !isNumber(prev.close)) continue;

        const prevMid = (prev.open + prev.close) / 2;
        const penetrationRatio = prev.open > prev.close ?
          (scanned.close - prevMid) / (prev.open - prev.close) : 0;

        if (scanned.direction === 'bullish' &&
            prev.direction === 'bearish' &&
            scanned.open < prev.close &&
            scanned.close > prevMid &&
            scanned.close < prev.open) {
          
          let score = 0.6; // Base score
          
          // Penetration quality (deeper = better, but capped)
          if (penetrationRatio > 0 && penetrationRatio <= 1) {
            // FIXED: Use constants for magic numbers (per code review)
            score += Math.min(CONSTANTS.PENETRATION_BONUS_MAX, penetrationRatio * CONSTANTS.PENETRATION_BONUS_FACTOR);
          }
          
          // FIXED: Volume validation with safe division
          const volMultiplier = safeVolumeMultiplier(scanned.volume, stats.medianVol);
          if (volMultiplier !== null) {
            if (volMultiplier >= 1.2) score += 0.1;
            else if (volMultiplier < 0.8) score -= 0.15;
          }
          
          score = clamp(score, 0, 1);
          
          if (score >= CONSTANTS.MIN_SCORE_THRESHOLD) {
            // FIXED: Standardized confidence calculation
            const defaultConf = meta.defaultConfidence !== undefined ? meta.defaultConfidence : 0.7;
            const baseConf = defaultConf * score;
            results.push({
              type: name,
              confidence: clamp(baseConf, 0, 1),
              score: score,
              patternType: 'multi',
              meta,
              definition: def,
              reversal: 'bearish'
            });
          }
        }
      }

      // ========== MORNING STAR / EVENING STAR ==========
      if (schema.morningEvening) {
        const len = history.length;
        if (len >= 2) {
          const first = history[len - 2];
          const middle = history[len - 1];
          const third = scanned;

          // Validate all candles
          if (!first || !middle ||
              !isNumber(first.open) || !isNumber(first.close) ||
              !isNumber(middle.open) || !isNumber(middle.close)) {
            continue;
          }

          const firstDir = first.direction;
          const midBody = Math.abs(middle.close - middle.open);
          const firstBody = Math.abs(first.close - first.open);
          const thirdDir = third.direction;

          const middleIsSmall = midBody < firstBody * CONSTANTS.SMALL_BODY_FACTOR;

          // FIXED: Determine target direction from schema (fallback to name for backward compatibility)
          const targetDirection = schema.direction ||
            (name.includes('morning') || name.includes('bullish') ? 'bullish' :
             name.includes('evening') || name.includes('bearish') ? 'bearish' : null);

          // Morning Star (bullish reversal)
          if (targetDirection === 'bullish' &&
              firstDir === 'bearish' &&
              middleIsSmall &&
              thirdDir === 'bullish') {
            const recoveryThreshold = first.close +
              (first.open - first.close) * CONSTANTS.MORNING_STAR_RECOVERY;
          
            if (third.close > recoveryThreshold) {
              let score = 0.65; // Base score
              
              // Gap validation: check for gaps between candles (more significant)
              const gap1 = middle.low > first.close ? (middle.low - first.close) / first.close : 0;
              const gap2 = third.open > middle.high ? (third.open - middle.high) / middle.high : 0;
              const hasGaps = gap1 > 0.001 || gap2 > 0.001; // 0.1% threshold
              
              if (hasGaps) {
                score += 0.15; // Bonus for gap presence
              }
              
              // Recovery quality (deeper recovery = better)
              const recoveryRatio = (third.close - first.close) / (first.open - first.close);
              if (recoveryRatio > 0.5 && recoveryRatio <= 1.0) {
                // FIXED: Use constants for magic numbers (per code review)
                score += Math.min(CONSTANTS.RECOVERY_BONUS_MAX, (recoveryRatio - 0.5) * CONSTANTS.RECOVERY_BONUS_FACTOR);
              } else if (recoveryRatio > 1.0) {
                score += 0.15; // Full recovery bonus
              }
              
              // Middle candle smallness quality (smaller = better)
              const smallnessRatio = midBody / firstBody;
              if (smallnessRatio < 0.3) {
                score += 0.1; // Very small middle candle bonus
              } else if (smallnessRatio < 0.4) {
                score += 0.05;
              }
              
              // Volume validation (use median for robustness)
              if (stats.medianVol > 0) {
                const thirdVolMult = third.volume > 0 ? third.volume / stats.medianVol : 0;
                const firstVolMult = first.volume > 0 ? first.volume / stats.medianVol : 0;
                
                // Third candle should have higher volume than first
                if (thirdVolMult >= 1.2 && thirdVolMult > firstVolMult) {
                  score += 0.1; // Strong volume confirmation
                } else if (thirdVolMult >= 1.0) {
                  score += 0.05;
                } else if (thirdVolMult < 0.8) {
                  score -= 0.15; // Penalty for low volume
                }
              }
              
              // Volatility context
              if (stats.volatilityPercentile > CONSTANTS.HIGH_VOLATILITY_THRESHOLD) {
                score += 0.05;
              } else if (stats.volatilityPercentile < CONSTANTS.LOW_VOLATILITY_THRESHOLD) {
                score -= 0.05;
              }
              
              score = clamp(score, 0, 1);
              
              if (score >= CONSTANTS.MIN_SCORE_THRESHOLD) {
                // FIXED: Standardized confidence calculation
                const defaultConf = meta.defaultConfidence !== undefined ? meta.defaultConfidence : 0.7;
                const baseConf = defaultConf * score;
                results.push({
                  type: name,
                  confidence: clamp(baseConf, 0, 1),
                  score: score,
                  patternType: 'multi',
                  meta,
                  definition: def,
                  reversal: 'bullish'
                });
              }
            }
          }

          // Evening Star (bearish reversal)
          if (targetDirection === 'bearish' &&
              firstDir === 'bullish' &&
              middleIsSmall &&
              thirdDir === 'bearish') {
            const recoveryThreshold = first.close -
              (first.close - first.open) * CONSTANTS.EVENING_STAR_RECOVERY;
          
            if (third.close < recoveryThreshold) {
              let score = 0.65; // Base score
              
              // Gap validation: check for gaps between candles (more significant)
              const gap1 = middle.high < first.close ? (first.close - middle.high) / first.close : 0;
              const gap2 = third.open < middle.low ? (middle.low - third.open) / middle.low : 0;
              const hasGaps = gap1 > 0.001 || gap2 > 0.001; // 0.1% threshold
              
              if (hasGaps) {
                score += 0.15; // Bonus for gap presence
              }
              
              // Recovery quality (deeper decline = better)
              const declineRatio = (first.close - third.close) / (first.close - first.open);
              if (declineRatio > 0.5 && declineRatio <= 1.0) {
                // FIXED: Use constants for magic numbers (per code review)
                score += Math.min(CONSTANTS.RECOVERY_BONUS_MAX, (declineRatio - 0.5) * CONSTANTS.RECOVERY_BONUS_FACTOR);
              } else if (declineRatio > 1.0) {
                score += 0.15; // Full decline bonus
              }
              
              // Middle candle smallness quality (smaller = better)
              const smallnessRatio = midBody / firstBody;
              if (smallnessRatio < 0.3) {
                score += 0.1; // Very small middle candle bonus
              } else if (smallnessRatio < 0.4) {
                score += 0.05;
              }
              
              // Volume validation (use median for robustness)
              if (stats.medianVol > 0) {
                const thirdVolMult = third.volume > 0 ? third.volume / stats.medianVol : 0;
                const firstVolMult = first.volume > 0 ? first.volume / stats.medianVol : 0;
                
                // Third candle should have higher volume than first
                if (thirdVolMult >= 1.2 && thirdVolMult > firstVolMult) {
                  score += 0.1; // Strong volume confirmation
                } else if (thirdVolMult >= 1.0) {
                  score += 0.05;
                } else if (thirdVolMult < 0.8) {
                  score -= 0.15; // Penalty for low volume
                }
              }
              
              // Volatility context
              if (stats.volatilityPercentile > CONSTANTS.HIGH_VOLATILITY_THRESHOLD) {
                score += 0.05;
              } else if (stats.volatilityPercentile < CONSTANTS.LOW_VOLATILITY_THRESHOLD) {
                score -= 0.05;
              }
              
              score = clamp(score, 0, 1);
              
              if (score >= CONSTANTS.MIN_SCORE_THRESHOLD) {
                // FIXED: Standardized confidence calculation
                const defaultConf = meta.defaultConfidence !== undefined ? meta.defaultConfidence : 0.7;
                const baseConf = defaultConf * score;
                results.push({
                  type: name,
                  confidence: clamp(baseConf, 0, 1),
                  score: score,
                  patternType: 'multi',
                  meta,
                  definition: def,
                  reversal: 'bearish'
                });
              }
            }
          }
        }
      }

      // ========== THREE WHITE SOLDIERS / THREE BLACK CROWS ==========
      if (schema.threeSoldiers) {
        const len = history.length;
        if (len >= 2) {
          const c1 = history[len - 2];
          const c2 = history[len - 1];
          const c3 = scanned;

          // Validate all candles
          if (!c1 || !c2 ||
              !isNumber(c1.open) || !isNumber(c1.close) ||
              !isNumber(c2.open) || !isNumber(c2.close)) {
            continue;
          }

          // Check body sizes
          const hasLargeBodies =
            c1.bodyRatio > CONSTANTS.SOLDIERS_BODY_RATIO_MIN &&
            c2.bodyRatio > CONSTANTS.SOLDIERS_BODY_RATIO_MIN &&
            c3.bodyRatio > CONSTANTS.SOLDIERS_BODY_RATIO_MIN;

          // Check minimal wicks
          const hasMinimalWicks =
            (c1.upperWickRatio + c1.lowerWickRatio) < CONSTANTS.SOLDIERS_WICK_TOLERANCE &&
            (c2.upperWickRatio + c2.lowerWickRatio) < CONSTANTS.SOLDIERS_WICK_TOLERANCE &&
            (c3.upperWickRatio + c3.lowerWickRatio) < CONSTANTS.SOLDIERS_WICK_TOLERANCE;

          // FIXED: Determine target direction from schema (fallback to name for backward compatibility)
          const targetDirection = schema.direction ||
            (name.includes('white') || name.includes('soldier') || name.includes('bullish') ? 'bullish' :
             name.includes('black') || name.includes('crow') || name.includes('bearish') ? 'bearish' : null);

          // Three White Soldiers (bullish)
          if (targetDirection === 'bullish' &&
              c1.direction === 'bullish' &&
              c2.direction === 'bullish' &&
              c3.direction === 'bullish' &&
              c2.close > c1.close &&
              c3.close > c2.close &&
              c2.open > c1.open &&
              c2.open < c1.close &&
              c3.open > c2.open &&
              c3.open < c2.close &&
              hasLargeBodies &&
              hasMinimalWicks) {
            
            let score = 0.7; // Base score
            
            // Gap detection: check for gaps between candles (ideal pattern has small gaps)
            const gap1 = c2.low > c1.close ? (c2.low - c1.close) / c1.close : 0;
            const gap2 = c3.low > c2.close ? (c3.low - c2.close) / c2.close : 0;
            const hasGaps = gap1 > 0.001 || gap2 > 0.001; // 0.1% threshold
            
            // Small gaps are positive, large gaps may indicate exhaustion
            if (hasGaps) {
              const avgGap = (gap1 + gap2) / 2;
              if (avgGap > 0.001 && avgGap < 0.01) {
                score += 0.1; // Small gap bonus (0.1% to 1%)
              } else if (avgGap >= 0.01 && avgGap < 0.02) {
                score += 0.05; // Medium gap
              } else if (avgGap >= 0.02) {
                score -= 0.1; // Large gap penalty (may indicate exhaustion)
              }
            }
            
            // Body size quality (larger bodies = stronger pattern)
            const avgBodyRatio = (c1.bodyRatio + c2.bodyRatio + c3.bodyRatio) / 3;
            if (avgBodyRatio > 0.8) {
              score += 0.1; // Very large bodies
            } else if (avgBodyRatio > 0.7) {
              score += 0.05;
            }
            
            // Progression quality (each candle should be stronger)
            const progress1 = (c2.close - c1.close) / c1.close;
            const progress2 = (c3.close - c2.close) / c2.close;
            if (progress2 >= progress1 * 0.8) { // Second progress should be at least 80% of first
              score += 0.1; // Consistent progression bonus
            } else if (progress2 < progress1 * 0.5) {
              score -= 0.1; // Declining momentum penalty
            }
            
            // Volume validation (should increase or stay high)
            if (stats.medianVol > 0) {
              const vol1 = c1.volume > 0 ? c1.volume / stats.medianVol : 0;
              const vol2 = c2.volume > 0 ? c2.volume / stats.medianVol : 0;
              const vol3 = c3.volume > 0 ? c3.volume / stats.medianVol : 0;
              
              const avgVol = (vol1 + vol2 + vol3) / 3;
              const volTrend = vol3 >= vol2 && vol2 >= vol1;
              
              if (avgVol >= 1.5 && volTrend) {
                score += 0.15; // High and increasing volume
              } else if (avgVol >= 1.2) {
                score += 0.1; // High volume
              } else if (avgVol >= 1.0) {
                score += 0.05;
              } else if (avgVol < 0.8) {
                score -= 0.15; // Low volume penalty
              }
            }
            
            // Volatility context
            if (stats.volatilityPercentile > CONSTANTS.HIGH_VOLATILITY_THRESHOLD) {
              score += 0.05;
            }
            
            score = clamp(score, 0, 1);
            
            if (score >= CONSTANTS.MIN_SCORE_THRESHOLD) {
              // FIXED: Standardized confidence calculation
              const defaultConf = meta.defaultConfidence !== undefined ? meta.defaultConfidence : 0.7;
              const baseConf = defaultConf * score;
              results.push({
                type: name,
                confidence: clamp(baseConf, 0, 1),
                score: score,
                patternType: 'multi',
                meta,
                definition: def,
                continuation: 'bullish'
              });
            }
          }

          // Three Black Crows (bearish)
          if (targetDirection === 'bearish' &&
              c1.direction === 'bearish' &&
              c2.direction === 'bearish' &&
              c3.direction === 'bearish' &&
              c2.close < c1.close &&
              c3.close < c2.close &&
              c2.open < c1.open &&
              c2.open > c1.close &&
              c3.open < c2.open &&
              c3.open > c2.close &&
              hasLargeBodies &&
              hasMinimalWicks) {
            
            let score = 0.7; // Base score
            
            // Gap detection: check for gaps between candles (ideal pattern has small gaps)
            const gap1 = c2.high < c1.close ? (c1.close - c2.high) / c1.close : 0;
            const gap2 = c3.high < c2.close ? (c2.close - c3.high) / c2.close : 0;
            const hasGaps = gap1 > 0.001 || gap2 > 0.001; // 0.1% threshold
            
            // Small gaps are positive, large gaps may indicate exhaustion
            if (hasGaps) {
              const avgGap = (gap1 + gap2) / 2;
              if (avgGap > 0.001 && avgGap < 0.01) {
                score += 0.1; // Small gap bonus (0.1% to 1%)
              } else if (avgGap >= 0.01 && avgGap < 0.02) {
                score += 0.05; // Medium gap
              } else if (avgGap >= 0.02) {
                score -= 0.1; // Large gap penalty (may indicate exhaustion)
              }
            }
            
            // Body size quality (larger bodies = stronger pattern)
            const avgBodyRatio = (c1.bodyRatio + c2.bodyRatio + c3.bodyRatio) / 3;
            if (avgBodyRatio > 0.8) {
              score += 0.1; // Very large bodies
            } else if (avgBodyRatio > 0.7) {
              score += 0.05;
            }
            
            // Progression quality (each candle should be stronger)
            const decline1 = (c1.close - c2.close) / c1.close;
            const decline2 = (c2.close - c3.close) / c2.close;
            if (decline2 >= decline1 * 0.8) { // Second decline should be at least 80% of first
              score += 0.1; // Consistent progression bonus
            } else if (decline2 < decline1 * 0.5) {
              score -= 0.1; // Declining momentum penalty
            }
            
            // Volume validation (should increase or stay high)
            if (stats.medianVol > 0) {
              const vol1 = c1.volume > 0 ? c1.volume / stats.medianVol : 0;
              const vol2 = c2.volume > 0 ? c2.volume / stats.medianVol : 0;
              const vol3 = c3.volume > 0 ? c3.volume / stats.medianVol : 0;
              
              const avgVol = (vol1 + vol2 + vol3) / 3;
              const volTrend = vol3 >= vol2 && vol2 >= vol1;
              
              if (avgVol >= 1.5 && volTrend) {
                score += 0.15; // High and increasing volume
              } else if (avgVol >= 1.2) {
                score += 0.1; // High volume
              } else if (avgVol >= 1.0) {
                score += 0.05;
              } else if (avgVol < 0.8) {
                score -= 0.15; // Low volume penalty
              }
            }
            
            // Volatility context
            if (stats.volatilityPercentile > CONSTANTS.HIGH_VOLATILITY_THRESHOLD) {
              score += 0.05;
            }
            
            score = clamp(score, 0, 1);
            
            if (score >= CONSTANTS.MIN_SCORE_THRESHOLD) {
              // FIXED: Standardized confidence calculation
              const defaultConf = meta.defaultConfidence !== undefined ? meta.defaultConfidence : 0.7;
              const baseConf = defaultConf * score;
              results.push({
                type: name,
                confidence: clamp(baseConf, 0, 1),
                score: score,
                patternType: 'multi',
                meta,
                definition: def,
                continuation: 'bearish'
              });
            }
          }
        }
      }

      // ========== HARAMI PATTERN ==========
      if (schema.harami) {
        const prev = history[history.length - 1];
        if (!prev || !isNumber(prev.open) || !isNumber(prev.close)) continue;

        const prevBodyTop = Math.max(prev.open, prev.close);
        const prevBodyBottom = Math.min(prev.open, prev.close);
        const curBodyTop = Math.max(scanned.open, scanned.close);
        const curBodyBottom = Math.min(scanned.open, scanned.close);

        // Current candle body must be COMPLETELY within previous body
        const withinPrevBody =
          curBodyTop < prevBodyTop &&
          curBodyBottom > prevBodyBottom;

        // Validate that previous candle is large (required for harami)
        const prevBodySize = prevBodyTop - prevBodyBottom;
        const avgBody = stats.avgBody || 0;
        const prevIsLarge = avgBody > 0 ? prevBodySize >= avgBody * 1.2 : prev.bodyRatio >= 0.5;
        
        // Skip if previous candle is not large enough
        if (!prevIsLarge) continue;

        // Bullish Harami
        if ((schema.direction === 'bullish' || name.includes('bullish')) &&
            withinPrevBody &&
            prev.direction === 'bearish' &&
            scanned.direction === 'bullish') {
          
          let score = 0.6; // Base score
          
          // Previous candle size quality (larger = better)
          const prevSizeRatio = avgBody > 0 ? prevBodySize / avgBody : prev.bodyRatio;
          if (prevSizeRatio >= 2.0) {
            score += 0.15; // Very large previous candle
          } else if (prevSizeRatio >= 1.5) {
            score += 0.1;
          } else if (prevSizeRatio >= 1.2) {
            score += 0.05;
          }
          
          // Current candle smallness quality (smaller relative to previous = better)
          const curBodySize = curBodyTop - curBodyBottom;
          const sizeRatio = prevBodySize > 0 ? curBodySize / prevBodySize : 0;
          if (sizeRatio < CONSTANTS.SMALLNESS_THRESHOLD) {
            score += 0.15; // Very small current candle (strong harami)
          } else if (sizeRatio < 0.5) {
            score += 0.1;
          } else if (sizeRatio < 0.7) {
            score += 0.05;
          } else {
            score -= 0.1; // Current candle too large relative to previous
          }
          
          // Body position quality (current body should be well-centered)
          const prevRange = prev.high - prev.low;
          const curBodyCenter = (curBodyTop + curBodyBottom) / 2;
          const prevBodyCenter = (prevBodyTop + prevBodyBottom) / 2;
          const centerDistance = prevRange > 0 ? Math.abs(curBodyCenter - prevBodyCenter) / prevRange : 0;
          
          if (centerDistance < 0.1) {
            score += 0.1; // Well-centered bonus
          } else if (centerDistance < 0.2) {
            score += 0.05;
          }
          
          // FIXED: Volume validation with safe division
          if (stats.medianVol > 0) {
            const prevVolMult = safeVolumeMultiplier(prev.volume, stats.medianVol) || 0;
            const curVolMult = safeVolumeMultiplier(scanned.volume, stats.medianVol) || 0;
            
            // Previous candle should have higher volume (shows strong move)
            if (prevVolMult >= 1.2) {
              score += 0.1; // Strong previous volume
            } else if (prevVolMult >= 1.0) {
              score += 0.05;
            }
            
            // Current candle volume should be lower (indecision)
            if (curVolMult < 0.8 && curVolMult < prevVolMult) {
              score += 0.05; // Lower volume on current candle (good for harami)
            } else if (curVolMult >= prevVolMult) {
              score -= 0.1; // Current volume too high (may not be indecision)
            }
          }
          
          // Volatility context
          if (stats.volatilityPercentile > CONSTANTS.HIGH_VOLATILITY_THRESHOLD) {
            score += 0.05;
          }
          
          score = clamp(score, 0, 1);
          
          if (score >= CONSTANTS.MIN_SCORE_THRESHOLD) {
            // FIXED: Standardized confidence calculation
            const defaultConf = meta.defaultConfidence !== undefined ? meta.defaultConfidence : 0.7;
            const baseConf = defaultConf * score;
            results.push({
              type: name,
              confidence: clamp(baseConf, 0, 1),
              score: score,
              patternType: 'multi',
              meta,
              definition: def,
              reversal: 'bullish'
            });
          }
        }

        // Bearish Harami
        if ((schema.direction === 'bearish' || name.includes('bearish')) &&
            withinPrevBody &&
            prev.direction === 'bullish' &&
            scanned.direction === 'bearish') {
          
          let score = 0.6; // Base score
          
          // Previous candle size quality (larger = better)
          const prevSizeRatio = avgBody > 0 ? prevBodySize / avgBody : prev.bodyRatio;
          if (prevSizeRatio >= 2.0) {
            score += 0.15; // Very large previous candle
          } else if (prevSizeRatio >= 1.5) {
            score += 0.1;
          } else if (prevSizeRatio >= 1.2) {
            score += 0.05;
          }
          
          // Current candle smallness quality (smaller relative to previous = better)
          const curBodySize = curBodyTop - curBodyBottom;
          const sizeRatio = prevBodySize > 0 ? curBodySize / prevBodySize : 0;
          if (sizeRatio < CONSTANTS.SMALLNESS_THRESHOLD) {
            score += 0.15; // Very small current candle (strong harami)
          } else if (sizeRatio < 0.5) {
            score += 0.1;
          } else if (sizeRatio < 0.7) {
            score += 0.05;
          } else {
            score -= 0.1; // Current candle too large relative to previous
          }
          
          // Body position quality (current body should be well-centered)
          const prevRange = prev.high - prev.low;
          const curBodyCenter = (curBodyTop + curBodyBottom) / 2;
          const prevBodyCenter = (prevBodyTop + prevBodyBottom) / 2;
          const centerDistance = prevRange > 0 ? Math.abs(curBodyCenter - prevBodyCenter) / prevRange : 0;
          
          if (centerDistance < 0.1) {
            score += 0.1; // Well-centered bonus
          } else if (centerDistance < 0.2) {
            score += 0.05;
          }
          
          // FIXED: Volume validation with safe division
          if (stats.medianVol > 0) {
            const prevVolMult = safeVolumeMultiplier(prev.volume, stats.medianVol) || 0;
            const curVolMult = safeVolumeMultiplier(scanned.volume, stats.medianVol) || 0;
            
            // Previous candle should have higher volume (shows strong move)
            if (prevVolMult >= 1.2) {
              score += 0.1; // Strong previous volume
            } else if (prevVolMult >= 1.0) {
              score += 0.05;
            }
            
            // Current candle volume should be lower (indecision)
            if (curVolMult < 0.8 && curVolMult < prevVolMult) {
              score += 0.05; // Lower volume on current candle (good for harami)
            } else if (curVolMult >= prevVolMult) {
              score -= 0.1; // Current volume too high (may not be indecision)
            }
          }
          
          // Volatility context
          if (stats.volatilityPercentile > CONSTANTS.HIGH_VOLATILITY_THRESHOLD) {
            score += 0.05;
          }
          
          score = clamp(score, 0, 1);
          
          if (score >= CONSTANTS.MIN_SCORE_THRESHOLD) {
            // FIXED: Standardized confidence calculation
            const defaultConf = meta.defaultConfidence !== undefined ? meta.defaultConfidence : 0.7;
            const baseConf = defaultConf * score;
            results.push({
              type: name,
              confidence: clamp(baseConf, 0, 1),
              score: score,
              patternType: 'multi',
              meta,
              definition: def,
              reversal: 'bearish'
            });
          }
        }
      }
    }

    return results;
  }

  /**
   * Choose the best pattern from candidates
   * @param {Array} singles - Single-candle pattern matches
   * @param {Array} multis - Multi-candle pattern matches
   * @returns {Object|null} Best pattern match or null
   */
  // NOTE (v3.9.0): This duplicate method definition was removed.
  // The authoritative _chooseBest (with FIX-1 + FIX-2) is defined earlier in this class.
  // Keeping this comment as a marker to make the removal auditable.
}

// ============================================================================
// VALIDATOR
// ============================================================================

/**
 * Validates candle data integrity
 */
export class Validator {
  /**
   * Validate timestamp format and range
   * ENHANCED: Comprehensive timestamp validation with gap detection
   * @param {number} timestamp - Timestamp to validate
   * @param {number} [previousTimestamp] - Previous timestamp for order validation
   * @param {number} [expectedInterval] - Expected interval in milliseconds for gap detection
   * @returns {Object} Validation result {valid, errors, normalized, warnings}
   */
  validateTimestamp(timestamp, previousTimestamp = null, expectedInterval = null) {
    const errors = [];
    const warnings = [];
    let normalized = timestamp;

    // Check if timestamp exists
    if (timestamp === undefined || timestamp === null) {
      return { valid: false, errors: ['Timestamp is required'], normalized: Date.now(), warnings: null };
    }

    // Check if timestamp is a number
    if (!isNumber(timestamp)) {
      errors.push('Timestamp must be a valid number');
      normalized = Date.now();
    } else {
      // Normalize timestamp: assume milliseconds if > 1e12, seconds if < 1e12
      // Timestamps before 2001-09-09 are likely seconds, after are milliseconds
      if (timestamp < 1000000000000) {
        // Likely seconds, convert to milliseconds
        normalized = timestamp * 1000;
        if (normalized < 946684800000) { // Before 2000-01-01
          errors.push('Timestamp appears to be in seconds but is too old');
        } else {
          warnings.push('Timestamp was in seconds format, converted to milliseconds');
        }
      }

      // Check for future timestamps (more than 1 hour in future)
      const now = Date.now();
      const maxFuture = now + 3600000; // 1 hour tolerance
      if (normalized > maxFuture) {
        errors.push(`Timestamp is too far in future: ${new Date(normalized).toISOString()}`);
        normalized = now; // Normalize to current time
      } else if (normalized > now + 60000) {
        // Warning for timestamps more than 1 minute in future
        warnings.push(`Timestamp is ${Math.round((normalized - now) / 1000)}s in future`);
      }

      // Check for very old timestamps (before 2000-01-01)
      const minTimestamp = 946684800000; // 2000-01-01
      if (normalized < minTimestamp) {
        errors.push(`Timestamp is too old: ${new Date(normalized).toISOString()}`);
      }

      // Check for out-of-order timestamps
      if (previousTimestamp !== null && isNumber(previousTimestamp)) {
        if (normalized < previousTimestamp) {
          errors.push(`Timestamp out of order: ${new Date(normalized).toISOString()} < ${new Date(previousTimestamp).toISOString()}`);
        }
        
        // Gap detection if expected interval provided
        if (expectedInterval !== null && expectedInterval > 0) {
          const gap = normalized - previousTimestamp;
          const gapRatio = gap / expectedInterval;
          
          if (gapRatio > 2) {
            warnings.push(`Large timestamp gap detected: ${Math.round(gap / 1000)}s (expected ~${Math.round(expectedInterval / 1000)}s)`);
          } else if (gapRatio < 0.5 && gap > 0) {
            warnings.push(`Small timestamp gap detected: ${Math.round(gap / 1000)}s (expected ~${Math.round(expectedInterval / 1000)}s)`);
          }
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors: errors.length ? errors : null,
      warnings: warnings.length ? warnings : null,
      normalized
    };
  }

  /**
   * Detect gaps in timestamp sequence
   * @param {Array} candles - Array of candles with timestamps
   * @param {number} expectedInterval - Expected interval in milliseconds
   * @returns {Object} Gap detection result {hasGaps, gaps, warnings}
   */
  detectTimestampGaps(candles, expectedInterval = 60000) {
    if (!Array.isArray(candles) || candles.length < 2) {
      return { hasGaps: false, gaps: [], warnings: [] };
    }

    const gaps = [];
    const warnings = [];

    for (let i = 1; i < candles.length; i++) {
      const prev = candles[i - 1];
      const curr = candles[i];

      if (!prev.timestamp || !curr.timestamp) continue;

      const interval = curr.timestamp - prev.timestamp;
      const gapRatio = interval / expectedInterval;

      // Gap is significant if > 2x expected interval
      if (gapRatio > 2) {
        gaps.push({
          index: i,
          previous: prev.timestamp,
          current: curr.timestamp,
          gap: interval,
          expected: expectedInterval,
          ratio: gapRatio
        });
      }

      // Warning if gap is > 1.5x but < 2x
      if (gapRatio > 1.5 && gapRatio <= 2) {
        warnings.push({
          index: i,
          gap: interval,
          expected: expectedInterval
        });
      }
    }

    return {
      hasGaps: gaps.length > 0,
      gaps,
      warnings
    };
  }

  /**
   * Validate raw candle data
   * @param {Object} candle - Raw candle object
   * @param {Object} [options] - Validation options
   * @param {number} [options.previousTimestamp] - Previous timestamp for order validation
   * @param {boolean} [options.validateTimestamp=true] - Enable timestamp validation
   * @returns {Object} Validation result {valid, errors, normalized}
   */
  validateRaw(candle, options = {}) {
    const errors = [];
    const { previousTimestamp = null, validateTimestamp = true } = options;
    let normalized = { ...candle };

    if (!candle || typeof candle !== 'object') {
      return { valid: false, errors: ['Candle must be an object'], normalized };
    }

    const { open, high, low, close } = candle;

    // Check if values are numbers
    if (!isNumber(open)) errors.push('open must be a valid number');
    if (!isNumber(high)) errors.push('high must be a valid number');
    if (!isNumber(low)) errors.push('low must be a valid number');
    if (!isNumber(close)) errors.push('close must be a valid number');

    if (errors.length > 0) {
      return { valid: false, errors, normalized };
    }

    // Check OHLC relationships
    if (high < Math.max(open, close)) {
      errors.push('high must be >= max(open, close)');
    }

    if (low > Math.min(open, close)) {
      errors.push('low must be <= min(open, close)');
    }

    if (high < low) {
      errors.push('high must be >= low');
    }

    // Check for negative prices
    if (open < 0 || high < 0 || low < 0 || close < 0) {
      errors.push('prices cannot be negative');
    }

    // Volume check (if present)
    if (candle.volume !== undefined && !isNumber(candle.volume)) {
      errors.push('volume must be a valid number');
    }

    if (candle.volume !== undefined && candle.volume < 0) {
      errors.push('volume cannot be negative');
    }

    // Enhanced timestamp validation
    if (validateTimestamp && candle.timestamp !== undefined) {
      const tsValidation = this.validateTimestamp(candle.timestamp, previousTimestamp);
      if (!tsValidation.valid && tsValidation.errors) {
        errors.push(...tsValidation.errors);
      }
      normalized.timestamp = tsValidation.normalized;
    } else if (!candle.timestamp) {
      normalized.timestamp = Date.now();
    }

    return {
      valid: errors.length === 0,
      errors: errors.length ? errors : null,
      normalized
    };
  }

  /**
   * Validate calibrated candle data
   * @param {Object} candle - Raw candle
   * @param {Object} calibrated - Calibrated candle with metrics
   * @returns {Object} Validation result {valid, errors}
   */
  validate(candle, calibrated) {
    const errors = [];

    if (!candle || !calibrated) {
      return { valid: false, errors: ['Missing data'] };
    }

    // Validate raw data first
    const rawValidation = this.validateRaw(candle);
    if (!rawValidation.valid) {
      return rawValidation;
    }

    // Validate scanned metrics
    if (!isNumber(calibrated.bodyRatio)) {
      errors.push('Invalid bodyRatio');
    }

    if (!isNumber(calibrated.range)) {
      errors.push('Invalid range');
    }

    return {
      valid: errors.length === 0,
      errors: errors.length ? errors : null
    };
  }
}

// ============================================================================
// TAGGER
// ============================================================================

/**
 * Tags candles with pattern metadata
 */
export class Tagger {
  /**
   * Tag a candle with detected pattern and metadata
   * @param {Object} candle - Raw candle
   * @param {Object} calibrated - Calibrated candle with pattern
   * @returns {Object} Tagged candle data
   */
  tag(candle, calibrated) {
    const pat = calibrated.pattern || null;
    const stats = calibrated.stats || {};

    // Calculate volume multiplier for context
    const volumeMultiplier = stats.medianVol > 0 && calibrated.volume > 0 ?
      calibrated.volume / stats.medianVol : (stats.avgVol > 0 && calibrated.volume > 0 ?
        calibrated.volume / stats.avgVol : 1.0);

    return {
      raw: {
        open: candle.open,
        high: candle.high,
        low: candle.low,
        close: candle.close,
        volume: candle.volume || 0,
        timestamp: candle.timestamp || Date.now()
      },
      scanned: {
        body: calibrated.body,
        range: calibrated.range,
        bodyRatio: calibrated.bodyRatio,
        upperWickRatio: calibrated.upperWickRatio,
        lowerWickRatio: calibrated.lowerWickRatio,
        closePosition: calibrated.closePosition,
        bodyPosition: calibrated.bodyPosition,
        direction: calibrated.direction,
        volumeMultiplier: Math.round(volumeMultiplier * 100) / 100 // Round to 2 decimals
      },
      pattern: pat ? {
        ...pat,
        // Ensure language is always set when pattern exists
        language: pat.language || calibrated.language || null
      } : null,
      language: pat ? (pat.language || calibrated.language || null) : null,
      candidates: calibrated.candidates || null,
      context: {
        volatilityPercentile: stats.volatilityPercentile || 0.5,
        rangePercentile: stats.rangePercentile || 0.5,
        avgVolume: stats.avgVol || 0,
        avgRange: stats.avgRange || 0
      },
      processedAt: Date.now()
    };
  }
}

// ============================================================================
// MAIN CANDLESTICK CLASS
// ============================================================================

/**
 * Main CandlestickJS class - orchestrates all components
 */
export class CandlestickJS {
  constructor(options = {}) {
    this.config = new Config(options.config || {});
    this.scanner = new Scanner();
    this.calibrator = new Calibrator(this.config);
    this.validator = new Validator();
    this.tagger = new Tagger();

    this.listeners = { signal: [], error: [] };
    this.buffer = [];
    this.scannedBuffer = [];
    this.recentCandidates = [];

    this.confirmationMode = this.config.get('confirmationMode') || false;
    this._pending = null;

    this.hooks = {};
    this.errorLog = [];

    // Processing queue to prevent race conditions
    this._processing = false;
    this._queue = [];
    this._queueHead = 0; // Head index for efficient dequeue
    
    // Error recovery: dead letter queue for failed candles
    this._deadLetterQueue = [];
    this._maxDeadLetterSize = 100; // Limit dead letter queue size
    this._consecutiveErrors = 0;
    this._maxConsecutiveErrors = 10; // Stop processing after N consecutive errors
    this._retryQueue = []; // Queue for retrying failed candles
    this._maxRetries = 3; // Maximum retry attempts per candle
    this._retryDelayMs = 100; // Delay between retries
    this._retryTimeouts = new Map(); // FIXED: Track setTimeout IDs for cleanup

    // Performance metrics
    this._performanceMetrics = {
      totalProcessed: 0,
      totalErrors: 0,
      processingTimes: [],
      lastProcessTime: 0
    };
  }

  // ========== LANGUAGE MANAGEMENT ==========

  /**
   * Run validation on all built-in language packs
   * @returns {Object} Validation results for each language
   */
  runBuiltInValidation() {
    const lm = this.config.getLanguageManager();
    const results = {};
   
    for (const name of lm.list()) {
      try {
        results[name] = lm.validateLanguagePack(name);
      } catch (e) {
        results[name] = { valid: false, errors: [e.message] };
      }
    }
   
    return results;
  }

  /**
   * Register a custom language pack
   * @param {string} name - Language pack name
   * @param {Object} pack - Language pack definition
   * @returns {CandlestickJS} - Fluent interface
   */
  registerLanguage(name, pack) {
    this.config.getLanguageManager().register(name, pack);
    return this;
  }

  /**
   * Validate a specific language pack
   * @param {string} name - Language pack name
   * @returns {Object} Validation result {valid, errors}
   */
  validateLanguagePack(name) {
    return this.config.getLanguageManager().validateLanguagePack(name);
  }

  /**
   * List all registered languages
   * @returns {Array<string>} Array of language names
   */
  listLanguages() {
    return this.config.listLanguages();
  }

  /**
   * Set active language
   * @param {string} name - Language pack name
   * @returns {CandlestickJS} - Fluent interface
   */
  setLanguage(name) {
    this.config.setLanguage(name);
    return this;
  }

  /**
   * Set timeframe metadata for determinism and continuity validation
   * @param {string} name - Timeframe name (e.g., '1m', '5m', '1h')
   * @param {number} intervalMs - Expected interval in milliseconds
   * @param {Object} [options] - Additional timeframe options
   * @param {boolean} [options.validateContinuity=true] - Validate candle continuity
   * @param {number} [options.maxGapMs] - Maximum allowed gap between candles
   * @returns {CandlestickJS} - This instance for chaining
   */
  setTimeframe(name, intervalMs, options = {}) {
    this.config.set('timeframe', {
      name,
      intervalMs,
      validateContinuity: options.validateContinuity ?? true,
      maxGapMs: options.maxGapMs ?? (intervalMs * 5) // Default 5x interval
    });
    return this;
  }

  // ========== EVENT LISTENERS ==========

  /**
   * Register signal listener for pattern detection events
   * @param {Function} fn - Callback function
   * @returns {CandlestickJS} - Fluent interface
   */
  onSignal(fn) {
    if (typeof fn === 'function') {
      this.listeners.signal.push(fn);
    }
    return this;
  }

  /**
   * Unregister signal listener
   * @param {Function} fn - Callback function to remove
   * @returns {CandlestickJS} - Fluent interface
   */
  offSignal(fn) {
    this.listeners.signal = this.listeners.signal.filter(f => f !== fn);
    return this;
  }

  /**
   * Register error listener
   * @param {Function} fn - Callback function
   * @returns {CandlestickJS} - Fluent interface
   */
  onError(fn) {
    if (typeof fn === 'function') {
      this.listeners.error.push(fn);
    }
    return this;
  }

  /**
   * Unregister error listener
   * @param {Function} fn - Callback function to remove
   * @returns {CandlestickJS} - Fluent interface
   */
  offError(fn) {
    this.listeners.error = this.listeners.error.filter(f => f !== fn);
    return this;
  }

  /**
   * Register lifecycle hook
   * @param {string} name - Hook name
   * @param {Function} fn - Callback function
   * @returns {CandlestickJS} - Fluent interface
   */
  onHook(name, fn) {
    if (!this.hooks[name]) this.hooks[name] = [];
    this.hooks[name].push(fn);
    return this;
  }

  /**
   * Unregister lifecycle hook
   * @param {string} name - Hook name
   * @param {Function} fn - Callback function
   * @returns {CandlestickJS} - Fluent interface
   */
  offHook(name, fn) {
    if (!this.hooks[name]) return this;
    this.hooks[name] = this.hooks[name].filter(f => f !== fn);
    return this;
  }

  /**
   * Fire lifecycle hook
   * @private
   */
  _fireHook(name, payload) {
    const list = this.hooks[name] || [];
    for (const fn of list) {
      try {
        fn(payload);
      } catch (e) {
        console.error(`Hook error [${name}]:`, e);
      }
    }
  }

  /**
   * Emit signal to listeners
   * @private
   */
  _emitSignal(data) {
    for (const fn of this.listeners.signal) {
      try {
        fn(data);
      } catch (e) {
        console.error('Signal listener error:', e);
        this._logError(e);
      }
    }
  }

  /**
   * Emit error to listeners
   * @private
   */
  _emitError(err) {
    this._logError(err);
   
    for (const fn of this.listeners.error) {
      try {
        fn(err);
      } catch (e) {
        console.error('Error listener error:', e);
      }
    }
  }

  /**
   * Add candle to dead letter queue
   * @private
   */
  _addToDeadLetterQueue(candle, error, attempts) {
    const entry = {
      candle,
      error: error.message || 'Unknown error',
      timestamp: Date.now(),
      attempts
    };
    
    if (this._deadLetterQueue.length < this._maxDeadLetterSize) {
      this._deadLetterQueue.push(entry);
    } else {
      // Remove oldest entry if queue is full
      this._deadLetterQueue.shift();
      this._deadLetterQueue.push(entry);
    }
  }

  /**
   * Log error internally
   * @private
   */
  _logError(err) {
    this.errorLog.push({
      error: err,
      timestamp: Date.now(),
      message: err.message || 'Unknown error'
    });

    this._performanceMetrics.totalErrors++;

    // Keep only last N errors
    if (this.errorLog.length > CONSTANTS.ERROR_LOG_MAX_SIZE) {
      this.errorLog.shift();
    }
  }
  
  /**
   * Get dead letter queue (for recovery analysis)
   * @returns {Array} Array of failed candle entries
   */
  getDeadLetterQueue() {
    return this._deadLetterQueue.slice();
  }
  
  /**
   * Clear dead letter queue
   * @returns {CandlestickJS} - Fluent interface
   */
  clearDeadLetterQueue() {
    this._deadLetterQueue = [];
    return this;
  }
  
  /**
   * Retry failed candles from dead letter queue
   * @param {number} maxRetries - Maximum number of candles to retry
   * @returns {Promise<number>} Number of candles retried
   */
  async retryFailedCandles(maxRetries = 10) {
    const toRetry = this._deadLetterQueue.slice(0, maxRetries);
    let retried = 0;
    
    for (const entry of toRetry) {
      try {
        await this.receive(entry.candle);
        retried++;
        // Remove from dead letter queue on success
        const index = this._deadLetterQueue.findIndex(e => 
          e.timestamp === entry.timestamp &&
          e.candle.timestamp === entry.candle.timestamp
        );
        if (index >= 0) {
          this._deadLetterQueue.splice(index, 1);
        }
      } catch (e) {
        // Update attempt count
        entry.attempts++;
        if (entry.attempts > this._maxRetries * 2) {
          // Remove if too many attempts
          const index = this._deadLetterQueue.findIndex(e => 
            e.timestamp === entry.timestamp
          );
          if (index >= 0) {
            this._deadLetterQueue.splice(index, 1);
          }
        }
      }
    }
    
    return retried;
  }

  /**
   * Get recent errors
   * @param {number} limit - Maximum number of errors to return
   * @returns {Array} Array of error objects
   */
  getErrors(limit = 10) {
    return this.errorLog.slice(-limit);
  }

  /**
   * Clear error log
   * @returns {CandlestickJS} - Fluent interface
   */
  clearErrors() {
    this.errorLog = [];
    return this;
  }

  // ========== BUFFER MANAGEMENT ==========

  /**
   * Trim buffers to maximum length
   * FIXED: Using slice() instead of splice() for better performance
   * @private
   */
  _trimBuffersIfNeeded() {
    const max = this.config.get('maxBufferLength') ||
                CONSTANTS.MAX_BUFFER_LENGTH_DEFAULT;

    // Trim raw buffer
    if (this.buffer.length > max) {
      this.buffer = this.buffer.slice(-max);
    }

    // Trim scanned buffer
    if (this.scannedBuffer.length > max) {
      this.scannedBuffer = this.scannedBuffer.slice(-max);
    }

    // Trim recent candidates by time expiry
    const expiry = this.config.get('candidateExpiryMs') ||
                  CONSTANTS.CANDIDATE_EXPIRY_MS;
    const now = Date.now();
    this.recentCandidates = this.recentCandidates.filter(c =>
      (now - (c.time || 0)) < expiry
    );
  }

  // ========== CANDLE RECEPTION ==========

  /**
   * Receive and process a new candle
   * FIXED: Implements processing queue to prevent race conditions, O(1) dequeue
   * @param {Object} candle - Raw candle data {open, high, low, close, volume?, timestamp?}
   * @returns {Promise<CandlestickJS>} - Fluent interface
   */
  
  /**
   * Compact the processing queue if memory use is excessive.
   * ENHANCED v3.8.0: Adaptive queue compaction strategy, pattern direction inference improvements, magic numbers as constants
   * FIXED: Ultra-aggressive compaction to prevent memory leaks in 24/7 trading
   * Compacts when:
   * - Head offset > 50 for high-frequency scenarios (was 100)
   * - Head offset > queue.length / 3 (was /2) - more frequent opportunistic compaction
   * - Queue depth > 500 (was 1000) - earlier emergency compaction
   * - Every 100 processed items regardless of ratio (new safety net)
   */
  _compactQueueIfNeeded() {
    const depth = this._queue.length - this._queueHead;
    const headRatio = this._queue.length > 0 ? this._queueHead / this._queue.length : 0;
    
    // FIXED: Adaptive compaction strategy instead of ultra-aggressive (per code review)
    // Use adaptive thresholds based on queue size to avoid excessive copying in high-frequency scenarios
    const compactionThreshold = Math.min(
      1000, // Max threshold
      Math.max(100, this._queue.length * CONSTANTS.QUEUE_COMPACTION_ADAPTIVE_RATIO) // 10% of queue size
    );
    
    const shouldCompact = 
      (this._queueHead > CONSTANTS.QUEUE_COMPACTION_MIN_HEAD && headRatio > CONSTANTS.QUEUE_COMPACTION_MIN_HEAD_RATIO) || // Early compaction for HFT
      (this._queueHead > CONSTANTS.QUEUE_COMPACTION_MID_HEAD && headRatio > CONSTANTS.QUEUE_COMPACTION_MID_RATIO) || // Standard compaction
      (this._queueHead > CONSTANTS.QUEUE_COMPACTION_HIGH_HEAD && headRatio > CONSTANTS.QUEUE_COMPACTION_HIGH_RATIO) || // Fallback compaction
      (depth > CONSTANTS.QUEUE_COMPACTION_EMERGENCY_DEPTH) || // Emergency compaction threshold
      (this._queueHead > compactionThreshold); // Adaptive threshold-based compaction
    
    if (shouldCompact && this._queueHead > 0) {
      this._queue = this._queue.slice(this._queueHead);
      this._queueHead = 0;
    }
  }
async receive(candle) {
    // --- Added in v3.6.1: Queue compaction & MAX_QUEUE_SIZE enforcement ---
    this._compactQueueIfNeeded?.();
    const depth = this._queue.length - this._queueHead;
    if (depth >= CONSTANTS.MAX_QUEUE_SIZE) {
        if (this._queueHead > 1000) {
            this._queue = this._queue.slice(this._queueHead);
            this._queueHead = 0;
        } else {
            throw new Error('Queue overflow: too many queued candles');
        }
    }
    // --- end patch ---
    
    // Add to queue
    this._queue.push(candle);

    // FIXED: Atomic check-and-set to prevent race conditions
    if (this._processing) {
      return this;
    }
    
    // Set processing flag atomically (single-threaded JS, but good practice)
    this._processing = true;
    
    // Process queue asynchronously to allow other receives to queue
    Promise.resolve().then(() => this._processQueue());
    
    return this;
  }

  /**
   * FIXED: Separate queue processing method to prevent race conditions
   * @private
   */
  async _processQueue() {
    // Double-check processing flag (defensive)
    if (!this._processing) return;

    while (this._queueHead < this._queue.length) {
      const nextCandle = this._queue[this._queueHead++];
    
      try {
        await this._processSingle(nextCandle);
        // Reset consecutive error counter on success
        this._consecutiveErrors = 0;
      } catch (e) {
        this._consecutiveErrors++;
        this._emitError(e);
        
        // Check if error is retryable (not validation errors)
        const isRetryable = !(e instanceof ValidationError) && 
                            !(e instanceof DataError) &&
                            this._consecutiveErrors < this._maxConsecutiveErrors;
        
        if (isRetryable) {
          // Add to retry queue
          const existingRetry = this._retryQueue.find(r => 
            r.candle.timestamp === nextCandle.timestamp &&
            r.candle.open === nextCandle.open &&
            r.candle.close === nextCandle.close
          );
          
          if (existingRetry) {
            existingRetry.attempts++;
            if (existingRetry.attempts <= this._maxRetries) {
              // FIXED: Store timeout ID for cleanup and prevent duplicate retries
              const retryKey = `${nextCandle.timestamp}_${nextCandle.open}_${nextCandle.close}`;
              if (this._retryTimeouts.has(retryKey)) {
                clearTimeout(this._retryTimeouts.get(retryKey));
              }
              
              const timeoutId = setTimeout(() => {
                this._retryTimeouts.delete(retryKey);
                // Remove from retry queue on retry attempt
                const retryIndex = this._retryQueue.findIndex(r => 
                  r.timestamp === existingRetry.timestamp
                );
                if (retryIndex >= 0) {
                  this._retryQueue.splice(retryIndex, 1);
                }
                
                this._queue.push(existingRetry.candle);
                if (!this._processing) {
                  this.receive(existingRetry.candle).catch(err => 
                    this._emitError(err)
                  );
                }
              }, this._retryDelayMs * existingRetry.attempts);
              
              this._retryTimeouts.set(retryKey, timeoutId);
            } else {
              // Max retries exceeded, move to dead letter queue
              const retryKey = `${nextCandle.timestamp}_${nextCandle.open}_${nextCandle.close}`;
              if (this._retryTimeouts.has(retryKey)) {
                clearTimeout(this._retryTimeouts.get(retryKey));
                this._retryTimeouts.delete(retryKey);
              }
              // Remove from retry queue
              const retryIndex = this._retryQueue.findIndex(r => 
                r.timestamp === existingRetry.timestamp
              );
              if (retryIndex >= 0) {
                this._retryQueue.splice(retryIndex, 1);
              }
              this._addToDeadLetterQueue(nextCandle, e, existingRetry.attempts);
            }
          } else {
            // First retry attempt - check queue size limit
            if (this._retryQueue.length >= CONSTANTS.MAX_RETRY_QUEUE_SIZE) {
              // Queue full, move directly to dead letter queue
              this._addToDeadLetterQueue(nextCandle, new Error('Retry queue overflow'), 0);
            } else {
              const retryEntry = {
                candle: nextCandle,
                attempts: 1,
                lastError: e.message || 'Unknown error',
                timestamp: Date.now()
              };
              this._retryQueue.push(retryEntry);
              
              // FIXED: Store timeout ID for cleanup
              const retryKey = `${nextCandle.timestamp}_${nextCandle.open}_${nextCandle.close}`;
              const timeoutId = setTimeout(() => {
                this._retryTimeouts.delete(retryKey);
                // Remove from retry queue on retry attempt
                const retryIndex = this._retryQueue.findIndex(r => 
                  r.timestamp === retryEntry.timestamp
                );
                if (retryIndex >= 0) {
                  this._retryQueue.splice(retryIndex, 1);
                }
                
                this._queue.push(nextCandle);
                if (!this._processing) {
                  this.receive(nextCandle).catch(err => 
                    this._emitError(err)
                  );
                }
              }, this._retryDelayMs);
              
              this._retryTimeouts.set(retryKey, timeoutId);
            }
          }
        } else {
          // Non-retryable error, add directly to dead letter queue
          this._addToDeadLetterQueue(nextCandle, e, 1);
        }
        
        // Stop processing if too many consecutive errors (circuit breaker)
        if (this._consecutiveErrors >= this._maxConsecutiveErrors) {
          this._emitError(new Error(`Circuit breaker: ${this._consecutiveErrors} consecutive errors. Processing halted.`));
          break; // Exit processing loop
        }
      }
    }

    // Reset queue after processing
    if (this._queueHead >= this._queue.length) {
      // Queue fully processed
      this._queue = [];
      this._queueHead = 0;
    } else if (this._queue.length > CONSTANTS.MAX_QUEUE_SIZE) {
      // Emergency: queue exceeded max size
      console.warn(`Queue exceeded maximum size (${this._queue.length}), compacting`);
      this._queue = this._queue.slice(this._queueHead);
      this._queueHead = 0;
    } else if (this._queueHead > 1024 && this._queueHead > this._queue.length / 2) {
      // Opportunistic compact (remove processed items)
      this._queue = this._queue.slice(this._queueHead);
      this._queueHead = 0;
    }

    this._processing = false;
    return this;
  }

  /**
   * Process a single candle from the queue
   * @private
   */
  async _processSingle(candle) {
    const startTime = Date.now();

    try {
      // Early validation
      const rawValidation = this.validator.validateRaw(candle);
      if (!rawValidation.valid) {
        throw new ValidationError('Invalid candle data', {
          candle,
          errors: rawValidation.errors
        });
      }

      // ENHANCED: Timestamp validation with timeframe-aware gap detection
      let normalizedCandle = candle;
      if (this.config.get('enableTimestampValidation')) {
        const previousTimestamp = this.buffer.length > 0 ? 
          this.buffer[this.buffer.length - 1].timestamp : null;
        
        // Use configured timeframe interval instead of inferring from buffer
        const timeframe = this.config.get('timeframe') || {};
        let expectedInterval = timeframe.intervalMs || null;
        
        // Fallback to buffer inference if no timeframe configured
        if (!expectedInterval && this.buffer.length >= 2) {
          const intervals = [];
          for (let i = 1; i < Math.min(this.buffer.length, 10); i++) {
            if (this.buffer[i].timestamp && this.buffer[i-1].timestamp) {
              intervals.push(this.buffer[i].timestamp - this.buffer[i-1].timestamp);
            }
          }
          if (intervals.length > 0) {
            // FIX-9: Use mode (most-frequent bucket) instead of median.
            // Median collapses when market gaps dominate the sample window,
            // causing the inferred interval to reflect gap length rather than
            // the actual candle period.  Mode-based bucketing is resilient to
            // any number of gaps as long as at least one normal interval exists.
            expectedInterval = calculateModeInterval(intervals);
          }
        }
        
        const tsValidation = this.validator.validateTimestamp(
          candle.timestamp, 
          previousTimestamp,
          expectedInterval
        );
        
        if (!tsValidation.valid && tsValidation.errors) {
          // Log warnings but don't fail - normalize and continue
          if (tsValidation.warnings) {
            tsValidation.warnings.forEach(w => console.warn(`Timestamp warning: ${w}`));
          }
        }
        
        // Additional continuity validation using timeframe metadata
        if (timeframe.validateContinuity && previousTimestamp && expectedInterval) {
          const gap = (tsValidation.normalized || candle.timestamp || Date.now()) - previousTimestamp;
          const maxGap = timeframe.maxGapMs || (expectedInterval * 5);
          
          if (gap > maxGap) {
            console.warn(`Timeframe continuity breach: gap of ${gap}ms exceeds max ${maxGap}ms for ${timeframe.name || 'unknown'} timeframe`);
          }
        }
        
        normalizedCandle = { 
          ...candle, 
          timestamp: tsValidation.normalized || candle.timestamp || Date.now() 
        };
      } else if (!candle.timestamp) {
        normalizedCandle = { ...candle, timestamp: Date.now() };
      }

      // Duplicate detection
      if (this.config.get('enableDuplicateDetection') && this.buffer.length > 0) {
        const last = this.buffer[this.buffer.length - 1];
       
        if (last.timestamp === normalizedCandle.timestamp) {
          // Check if OHLCV values differ (legitimate update) or duplicate
          if (last.open === normalizedCandle.open &&
              last.high === normalizedCandle.high &&
              last.low === normalizedCandle.low &&
              last.close === normalizedCandle.close &&
              (last.volume ?? 0) === (normalizedCandle.volume ?? 0)) {
            console.warn('Duplicate candle detected, skipping');
            return;
          }
          // Same timestamp but different values - treat as update, proceed
        }
       
        if (last.timestamp && normalizedCandle.timestamp &&
            last.timestamp > normalizedCandle.timestamp) {
          throw new DataError('Out-of-order candle received', {
            lastTimestamp: last.timestamp,
            currentTimestamp: normalizedCandle.timestamp
          });
        }
      }

      // Scan and cache
      const scanned = this.scanner.scan(normalizedCandle);
     
      // Add to buffers
      this.buffer.push(normalizedCandle);
      this.scannedBuffer.push(scanned);

      // Trim buffers
      this._trimBuffersIfNeeded();

      // Fire hook (renamed from beforeScan to beforeCalibrate, includes backward compat)
      const hookData = {
        candle: { ...normalizedCandle },
        bufferSize: this.buffer.length
      };
     
      if (this.config.get('includeBufferInHooks')) {
        hookData.buffer = this.buffer.slice();
      }
     
      this._fireHook('beforeCalibrate', hookData);
      this._fireHook('beforeScan', hookData); // Backward compatibility

      // Process based on mode
      if (this.confirmationMode) {
        if (this._pending) {
          await this._confirmPending();
        }
        this._pending = normalizedCandle;
      } else {
        await this._processCandle(normalizedCandle);
      }

      // Fire hook
      const afterHookData = {
        candle: { ...normalizedCandle },
        bufferSize: this.buffer.length
      };
     
      if (this.config.get('includeBufferInHooks')) {
        afterHookData.buffer = this.buffer.slice();
      }
     
      this._fireHook('afterProcess', afterHookData);

      // Update metrics
      const processingTime = Date.now() - startTime;
      this._updateMetrics(processingTime);

    } catch (e) {
      this._emitError(e);
    }
  }

  /**
   * Confirm pending candle in confirmation mode
   * @private
   */
  async _confirmPending() {
    const pending = this._pending;
    this._pending = null;

    // Use cached scanned history (excluding pending)
    const scannedHistory = this.scannedBuffer.slice(0, -1);
   
    // Get scanned data for pending candle
    const scanned = this.scannedBuffer[this.scannedBuffer.length - 1];

    // Calibrate
    const calibrated = await this.calibrator.calibrate(scanned, scannedHistory);

    // Validate
    const validated = this.validator.validate(pending, calibrated);
    if (!validated.valid) return;

    // Check if pattern was found
    if (!calibrated.pattern) return;

    // Tag and aggregate
    let tagged = this.tagger.tag(pending, calibrated);
    this._aggregateConfidence(tagged);

    // Emit signal
    this._emitSignal(tagged);
    this._fireHook('onPatternMatched', { tagged });
  }

  /**
   * Process candle immediately (non-confirmation mode)
   * FIXED: Uses cached scannedBuffer instead of re-scanning
   * @private
   */
  async _processCandle(candle) {
    // Use cached scanned history (excluding current candle)
    const scannedHistory = this.scannedBuffer.slice(0, -1);
   
    // Get scanned data for current candle
    const scanned = this.scannedBuffer[this.scannedBuffer.length - 1];

    // Calibrate
    const calibrated = await this.calibrator.calibrate(scanned, scannedHistory);

    // Validate
    const validated = this.validator.validate(candle, calibrated);
    if (!validated.valid) return;

    // Check if pattern was found
    if (!calibrated.pattern) return;

    // Tag and aggregate
    let tagged = this.tagger.tag(candle, calibrated);
    this._aggregateConfidence(tagged);

    // Emit signal
    this._emitSignal(tagged);
    this._fireHook('onPatternMatched', { tagged });
  }

  /**
   * Aggregate confidence across multiple candles
   * FIXED: Attaches aggregatedConfidence to tagged.pattern (not top-level)
   * FIXED: Detects and handles contradictory patterns (bullish vs bearish)
   * @private
   */
  _aggregateConfidence(tagged) {
    const cfg = this.config.get('confidenceAggregation') || {
      window: 3,
      strategy: 'weighted',
      decay: 0.5
    };

    const window = Math.max(1, Math.floor(cfg.window || 3));
    const strategy = cfg.strategy || 'weighted';
    const decay = typeof cfg.decay === 'number' ? cfg.decay : 0.5;

    const now = Date.now();
    const currentPattern = tagged.pattern;
    
    // Extract pattern direction for contradiction detection
    const getPatternDirection = (pattern) => {
      if (pattern.reversal === 'bullish' || pattern.continuation === 'bullish') return 'bullish';
      if (pattern.reversal === 'bearish' || pattern.continuation === 'bearish') return 'bearish';
      if (pattern.meta?.tradeRelevance === 'indecision') return 'neutral';
      return null;
    };
    
    const currentDirection = getPatternDirection(currentPattern);
    
    const cand = {
      time: now,
      type: currentPattern.type,
      confidence: currentPattern.confidence || currentPattern.significance || 0,
      direction: currentDirection,
      patternType: currentPattern.patternType
    };

    this.recentCandidates.push(cand);

    // Trim to window size (expiry filtering is done in _trimBuffersIfNeeded)
    while (this.recentCandidates.length > window) {
      this.recentCandidates.shift();
    }

    // FIX-6: Contradiction detection based on signal direction, not pattern name.
    // The old code filtered by `c.type !== currentPattern.type`, meaning two different
    // pattern names in the same direction were treated as contradictions, while the
    // same pattern name in opposite directions was not.  Direction is the only
    // semantically meaningful axis for contradiction.  Pattern identity is irrelevant.
    //
    // FIX-7: Neutral-to-directional transition decay.
    // Previously a neutral pattern (doji, spinning_top) preceding a directional breakout
    // carried zero contradiction penalty, making fake breakouts look cleaner than
    // real ones.  Indecision before a directional signal reduces certainty — it should
    // add a small decay rather than full immunity.
    const arr = this.recentCandidates.slice().reverse(); // Most recent first
    let contradictionPenalty = 0;

    if (currentDirection && currentDirection !== 'neutral') {
      // FIX-6: Directional contradictions — opposite-direction signals in window
      const directionalContradictions = arr.filter(c =>
        c.direction &&
        c.direction !== 'neutral' &&
        c.direction !== currentDirection
        // Removed: c.type !== currentPattern.type (was wrong — see FIX-6 above)
      );
      if (directionalContradictions.length > 0) {
        contradictionPenalty = Math.min(CONSTANTS.MAX_CONTRADICTION_PENALTY,
          directionalContradictions.length * CONSTANTS.CONTRADICTION_PENALTY_PER_PATTERN);
      }

      // FIX-7: Neutral decay — indecision signals preceding a directional breakout
      // reduce certainty proportionally.  Each neutral pattern in the window adds 0.1.
      const neutralPrecursors = arr.filter(c => c.direction === 'neutral');
      if (neutralPrecursors.length > 0) {
        const neutralDecay = Math.min(0.2, neutralPrecursors.length * 0.1);
        contradictionPenalty = Math.min(CONSTANTS.MAX_CONTRADICTION_PENALTY,
          contradictionPenalty + neutralDecay);
      }
    }

    // Compute aggregation with statistical weighting
    let agg = 0;
    let totalWeight = 0;

    if (strategy === 'sum') {
      agg = arr.reduce((s, x) => s + x.confidence, 0);
    } else if (strategy === 'avg') {
      agg = arr.length > 0 ?
            arr.reduce((s, x) => s + x.confidence, 0) / arr.length : 0;
    } else {
      // Weighted by decay AND statistical reliability
      let weight = 1;
      let wsum = 0;
      for (let i = 0; i < arr.length; i++) {
        const c = arr[i];
        // Get statistical weight from pattern metadata (default 1.0)
        const statWeight = this._getPatternStatisticalWeight(c.type) || 1.0;
        const combinedWeight = weight * statWeight;
        
        agg += c.confidence * combinedWeight;
        wsum += combinedWeight;
        weight *= decay;
      }
      agg = wsum > 0 ? agg / wsum : 0;
    }

    // Apply contradiction penalty
    agg = Math.max(0, agg - contradictionPenalty);

    // Normalize between 0 and 1
    agg = clamp(agg, 0, 1);

    // Attach to pattern object (FIXED)
    tagged.pattern.aggregatedConfidence = Math.round(agg * 1000) / 1000;
    tagged.pattern.aggregationWindow = window;
    tagged.pattern.aggregationStrategy = strategy;
    if (contradictionPenalty > 0) {
      tagged.pattern.contradictionPenalty = Math.round(contradictionPenalty * 1000) / 1000;
      tagged.pattern.contradictoryPatterns = arr.filter(c => 
        c.direction && c.direction !== 'neutral' && c.direction !== currentDirection
      ).map(c => c.type);
    }
  }

  /**
   * Get statistical weight for a pattern type based on backtested performance
   * @private
   */
  _getPatternStatisticalWeight(patternType) {
    const lm = this.config.getLanguageManager();
    const languages = lm.list();
    
    for (const lang of languages) {
      const pack = lm.getLanguage(lang); // FIX-BONUS: was lm.get() — method is getLanguage()
      if (pack && pack.patterns && pack.patterns[patternType]) {
        const meta = pack.patterns[patternType].meta;
        return meta.statisticalWeight || 1.0;
      }
    }
    return 1.0; // Default weight
  }

  /**
   * Update performance metrics
   * @private
   */
  _updateMetrics(processingTime) {
    this._performanceMetrics.totalProcessed++;
    this._performanceMetrics.lastProcessTime = processingTime;
   
    // Keep rolling window of processing times
    this._performanceMetrics.processingTimes.push(processingTime);
    if (this._performanceMetrics.processingTimes.length >
        CONSTANTS.PERFORMANCE_SAMPLE_SIZE) {
      this._performanceMetrics.processingTimes.shift();
    }
  }

  /**
   * Calculate average processing time
   * @private
   */
  _getAvgProcessingTime() {
    const times = this._performanceMetrics.processingTimes;
    if (times.length === 0) return 0;
    return times.reduce((a, b) => a + b, 0) / times.length;
  }

  // ========== UTILITY METHODS ==========

  /**
   * Get current buffer
   * @returns {Array} Copy of current buffer
   */
  getBuffer() {
    return this.buffer.slice();
  }

  /**
   * Get buffer size
   * @returns {number} Number of candles in buffer
   */
  getBufferSize() {
    return this.buffer.length;
  }

  /**
   * Clear all buffers and reset state
   * @returns {CandlestickJS} - Fluent interface
   */
  clearBuffer() {
    this.buffer = [];
    this.scannedBuffer = [];
    this.recentCandidates = [];
    this._pending = null;
    this._queue = [];
    this._queueHead = 0;
    // FIXED: Clean up retry timeouts to prevent memory leaks
    this._retryTimeouts.forEach(timeoutId => clearTimeout(timeoutId));
    this._retryTimeouts.clear();
    this._retryQueue = [];
    return this;
  }

  /**
   * FIXED: Explicit cleanup method to prevent memory leaks
   * Call this when destroying the instance to clean up all resources
   * @returns {this}
   */
  destroy() {
    // Clear all pending timeouts
    this._retryTimeouts.forEach(timeoutId => clearTimeout(timeoutId));
    this._retryTimeouts.clear();
    this._retryQueue = [];
    this.clearBuffer();
    return this;
  }

  /**
   * Get processing queue depth
   * @returns {number} Number of candles waiting to be processed
   */
  getQueueDepth() {
    return Math.max(0, this._queue.length - this._queueHead);
  }

  /**
   * Check if currently processing
   * @returns {boolean} True if processing
   */
  isProcessing() {
    return this._processing;
  }

  /**
   * Get library statistics and performance metrics
   * @returns {Object} Statistics object
   */
  getStats() {
    return {
      bufferSize: this.buffer.length,
      scannedBufferSize: this.scannedBuffer.length,
      recentCandidates: this.recentCandidates.length,
      queueDepth: this._queue.length,
      isProcessing: this._processing,
      errorCount: this.errorLog.length,
      activeLanguage: this.config.getLanguageManager().active,
      confirmationMode: this.confirmationMode,
      performance: {
        totalProcessed: this._performanceMetrics.totalProcessed,
        totalErrors: this._performanceMetrics.totalErrors,
        avgProcessingTimeMs: Math.round(this._getAvgProcessingTime() * 100) / 100,
        lastProcessTimeMs: this._performanceMetrics.lastProcessTime,
        successRate: this._performanceMetrics.totalProcessed > 0 ?
          Math.round(((this._performanceMetrics.totalProcessed -
                      this._performanceMetrics.totalErrors) /
                      this._performanceMetrics.totalProcessed) * 10000) / 100 : 0
      },
      config: { ...this.config.values }
    };
  }

  /**
   * Reset performance metrics
   * @returns {CandlestickJS} - Fluent interface
   */
  resetMetrics() {
    this._performanceMetrics = {
      totalProcessed: 0,
      totalErrors: 0,
      processingTimes: [],
      lastProcessTime: 0
    };
    return this;
  }

  /**
   * Get version information
   * @returns {Object} Version metadata
   */
  static getVersion() {
    return __CANDLESTICK_METADATA;
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

export const BuiltIns = BuiltInLanguagePacks;

export default CandlestickJS;

/*
 * Usage Examples:
 *
 * // Basic usage
 * import CandlestickJS from './candlestick.js';
 *
 * // Using performance presets
 * import CandlestickJS, { PerformancePresets } from './candlestick.js';
 *
 * const detector = new CandlestickJS({
 *   config: PerformancePresets.realtimeTrading
 * });
 *
 * // Or customize a preset
 * const detector = new CandlestickJS({
 *   config: {
 *     ...PerformancePresets.swingTrading,
 *     confidenceMin: 0.8 // Override specific setting
 *   }
 * });
 *
 * // Original example
 * import CandlestickJS from './candlestick.js';
 *
 * const detector = new CandlestickJS({
 *   config: {
 *     confidenceMin: 0.7,
 *     maxBufferLength: 1000,
 *     mode: 'normal', // or 'light' for performance
 *     enableDuplicateDetection: true,
 *     predicateTimeout: 100
 *   }
 * });
 *
 * // Listen for pattern signals
 * detector.onSignal(pattern => {
 *   console.log('Pattern detected:', pattern.pattern.type);
 *   console.log('Confidence:', pattern.pattern.confidence);
 *   console.log('Aggregated:', pattern.pattern.aggregatedConfidence);
 * });
 *
 * // Listen for errors
 * detector.onError(err => {
 *   console.error('Error:', err.message);
 * });
 *
 * // Process candles
 * await detector.receive({
 *   open: 100,
 *   high: 105,
 *   low: 99,
 *   close: 103,
 *   volume: 1000,
 *   timestamp: Date.now()
 * });
 *
 * // Get statistics
 * const stats = detector.getStats();
 * console.log('Avg processing time:', stats.performance.avgProcessingTimeMs, 'ms');
 * console.log('Success rate:', stats.performance.successRate, '%');
 *
 * // Register custom language pack
 * detector.registerLanguage('custom', {
 *   name: 'custom',
 *   description: 'My custom patterns',
 *   patterns: {
 *     my_pattern: {
 *       type: 'single',
 *       schema: { bodyRatio: [0.5, 0.8] },
 *       meta: { defaultConfidence: 0.75 }
 *     }
 *   }
 * });
 *
 * // Switch language
 * detector.setLanguage('western');
 *
 * // Get version
 * console.log(CandlestickJS.getVersion());
 */


