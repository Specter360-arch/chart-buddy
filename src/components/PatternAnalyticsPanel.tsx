import { usePatternStore } from '@/stores/patternStore';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { TrendingUp, TrendingDown, Minus, Activity, Target, Clock, BarChart3 } from 'lucide-react';

interface PatternAnalyticsPanelProps {
  symbol: string;
}

export const PatternAnalyticsPanel = ({ symbol }: PatternAnalyticsPanelProps) => {
  const { getAnalytics, getFilteredPatterns } = usePatternStore();
  const analytics = getAnalytics(symbol);
  const patterns = getFilteredPatterns(symbol);

  const total = analytics.bullishCount + analytics.bearishCount + analytics.neutralCount;
  const bullishRatio = total > 0 ? (analytics.bullishCount / total) * 100 : 0;
  const bearishRatio = total > 0 ? (analytics.bearishCount / total) * 100 : 0;
  const neutralRatio = total > 0 ? (analytics.neutralCount / total) * 100 : 0;

  // Calculate sentiment
  const sentiment = bullishRatio > bearishRatio + 10 
    ? 'Bullish' 
    : bearishRatio > bullishRatio + 10 
      ? 'Bearish' 
      : 'Neutral';

  const sentimentColor = sentiment === 'Bullish' 
    ? 'text-success' 
    : sentiment === 'Bearish' 
      ? 'text-destructive' 
      : 'text-warning';

  if (patterns.length === 0) {
    return (
      <Card className="bg-card border-border">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-primary" />
            Pattern Analytics
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-6 text-center">
            <Activity className="h-8 w-8 text-muted-foreground/40 mb-2" />
            <p className="text-sm text-muted-foreground">No patterns detected yet</p>
            <p className="text-xs text-muted-foreground/60 mt-1">
              Analytics will appear as patterns are detected
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-card border-border">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-primary" />
          Pattern Analytics
          <span className={`ml-auto text-xs font-semibold ${sentimentColor}`}>
            {sentiment}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Key Stats Grid */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-muted/30 rounded-lg p-3 space-y-1">
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <Activity className="h-3.5 w-3.5" />
              <span className="text-[10px] uppercase tracking-wide">Total</span>
            </div>
            <p className="text-xl font-bold">{analytics.totalDetected}</p>
          </div>
          
          <div className="bg-muted/30 rounded-lg p-3 space-y-1">
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <Clock className="h-3.5 w-3.5" />
              <span className="text-[10px] uppercase tracking-wide">Per Hour</span>
            </div>
            <p className="text-xl font-bold">{analytics.patternsPerHour}</p>
          </div>
          
          <div className="bg-muted/30 rounded-lg p-3 space-y-1">
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <Target className="h-3.5 w-3.5" />
              <span className="text-[10px] uppercase tracking-wide">Avg Conf.</span>
            </div>
            <p className="text-xl font-bold">
              {(analytics.averageConfidence * 100).toFixed(0)}%
            </p>
          </div>
          
          <div className="bg-muted/30 rounded-lg p-3 space-y-1">
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <BarChart3 className="h-3.5 w-3.5" />
              <span className="text-[10px] uppercase tracking-wide">Last Hour</span>
            </div>
            <p className="text-xl font-bold">{analytics.lastHourPatterns.length}</p>
          </div>
        </div>

        {/* Pattern Type Distribution */}
        <div className="space-y-3">
          <p className="text-xs font-medium text-muted-foreground">Pattern Distribution</p>
          
          {/* Bullish */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-1.5">
                <TrendingUp className="h-3.5 w-3.5 text-success" />
                <span>Bullish</span>
              </div>
              <span className="font-mono text-success">
                {analytics.bullishCount} ({bullishRatio.toFixed(0)}%)
              </span>
            </div>
            <Progress value={bullishRatio} className="h-1.5 bg-muted" />
          </div>
          
          {/* Bearish */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-1.5">
                <TrendingDown className="h-3.5 w-3.5 text-destructive" />
                <span>Bearish</span>
              </div>
              <span className="font-mono text-destructive">
                {analytics.bearishCount} ({bearishRatio.toFixed(0)}%)
              </span>
            </div>
            <Progress value={bearishRatio} className="h-1.5 bg-muted" />
          </div>
          
          {/* Neutral */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-1.5">
                <Minus className="h-3.5 w-3.5 text-warning" />
                <span>Neutral</span>
              </div>
              <span className="font-mono text-warning">
                {analytics.neutralCount} ({neutralRatio.toFixed(0)}%)
              </span>
            </div>
            <Progress value={neutralRatio} className="h-1.5 bg-muted" />
          </div>
        </div>

        {/* Recent High Confidence Patterns */}
        {analytics.lastHourPatterns.filter(p => p.confidence >= 0.8).length > 0 && (
          <div className="space-y-2 pt-2 border-t border-border/50">
            <p className="text-xs font-medium text-muted-foreground">
              High Confidence (Last Hour)
            </p>
            <div className="space-y-1">
              {analytics.lastHourPatterns
                .filter(p => p.confidence >= 0.8)
                .slice(0, 3)
                .map((pattern) => (
                  <div
                    key={pattern.id}
                    className="flex items-center justify-between text-xs bg-muted/20 rounded px-2 py-1.5"
                  >
                    <div className="flex items-center gap-1.5">
                      {pattern.patternType === 'bullish' ? (
                        <TrendingUp className="h-3 w-3 text-success" />
                      ) : pattern.patternType === 'bearish' ? (
                        <TrendingDown className="h-3 w-3 text-destructive" />
                      ) : (
                        <Minus className="h-3 w-3 text-warning" />
                      )}
                      <span className="truncate max-w-[120px]">
                        {pattern.patternName.replace(/_/g, ' ')}
                      </span>
                    </div>
                    <span className="font-mono text-success">
                      {(pattern.confidence * 100).toFixed(0)}%
                    </span>
                  </div>
                ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};