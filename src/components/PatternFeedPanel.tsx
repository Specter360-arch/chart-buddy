import { useState } from 'react';
import { PatternSignal, usePatternStore } from '@/stores/patternStore';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { 
  ChevronRight, 
  ChevronDown, 
  TrendingUp, 
  TrendingDown, 
  Minus,
  Trash2,
  Settings,
  Activity
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';

interface PatternFeedPanelProps {
  symbol: string;
}

export const PatternFeedPanel = ({
  symbol,
}: PatternFeedPanelProps) => {
  const [expandedPatternId, setExpandedPatternId] = useState<string | null>(null);
  const { clearPatterns, getAnalytics, getFilteredPatterns, isPanelOpen, setPanelOpen, selectPattern, selectedPatternId } = usePatternStore();

  const patterns = getFilteredPatterns(symbol);
  const analytics = getAnalytics(symbol);

  const handlePatternSelect = (pattern: PatternSignal | null) => {
    selectPattern(pattern?.id || null);
  };

  const getPatternIcon = (type: PatternSignal['patternType']) => {
    switch (type) {
      case 'bullish':
        return <TrendingUp className="h-4 w-4 text-green-500" />;
      case 'bearish':
        return <TrendingDown className="h-4 w-4 text-red-500" />;
      default:
        return <Minus className="h-4 w-4 text-yellow-500" />;
    }
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.8) return 'bg-green-500/20 text-green-400 border-green-500/30';
    if (confidence >= 0.6) return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
    return 'bg-red-500/20 text-red-400 border-red-500/30';
  };

  const formatPatternName = (name: string) => {
    return name.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());
  };

  return (
    <Collapsible open={isPanelOpen} onOpenChange={setPanelOpen}>
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <CollapsibleTrigger asChild>
          <button className="w-full flex items-center justify-between p-3 hover:bg-muted/50 transition-colors">
            <div className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-primary" />
              <span className="font-medium text-sm">Pattern Detection</span>
              {patterns.length > 0 && (
                <Badge variant="secondary" className="text-xs">
                  {patterns.length}
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-2">
              {/* Quick stats */}
              {patterns.length > 0 && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <TrendingUp className="h-3 w-3 text-green-500" />
                    {analytics.bullishCount}
                  </span>
                  <span className="flex items-center gap-1">
                    <TrendingDown className="h-3 w-3 text-red-500" />
                    {analytics.bearishCount}
                  </span>
                </div>
              )}
              {isPanelOpen ? (
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              ) : (
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              )}
            </div>
          </button>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <div className="border-t border-border">
            {/* Header actions */}
            <div className="flex items-center justify-between p-2 border-b border-border/50 bg-muted/30">
              <span className="text-xs text-muted-foreground">
                {patterns.length > 0 
                  ? `Avg confidence: ${(analytics.averageConfidence * 100).toFixed(0)}%`
                  : 'Monitoring for patterns...'
                }
              </span>
              <div className="flex items-center gap-1">
                {patterns.length > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                    onClick={(e) => {
                      e.stopPropagation();
                      clearPatterns(symbol);
                      handlePatternSelect(null);
                    }}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            </div>

            {/* Pattern list */}
            <ScrollArea className="h-[280px]">
              {patterns.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full p-6 text-center">
                  <Activity className="h-8 w-8 text-muted-foreground/40 mb-2" />
                  <p className="text-sm text-muted-foreground">No patterns detected yet</p>
                  <p className="text-xs text-muted-foreground/60 mt-1">
                    Patterns will appear as they're detected
                  </p>
                </div>
              ) : (
                <div className="p-2 space-y-1">
                  {patterns.map((pattern) => (
                    <Collapsible
                      key={pattern.id}
                      open={expandedPatternId === pattern.id}
                      onOpenChange={(open) => setExpandedPatternId(open ? pattern.id : null)}
                    >
                      <div
                        className={cn(
                          "rounded-lg border transition-colors cursor-pointer",
                          selectedPatternId === pattern.id
                            ? "border-primary bg-primary/10"
                            : "border-transparent bg-muted/30 hover:bg-muted/50"
                        )}
                        onClick={() => handlePatternSelect(
                          selectedPatternId === pattern.id ? null : pattern
                        )}
                      >
                        <CollapsibleTrigger asChild>
                          <div className="flex items-center gap-2 p-2">
                            {getPatternIcon(pattern.patternType)}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-medium truncate">
                                  {formatPatternName(pattern.patternName)}
                                </span>
                                <Badge 
                                  variant="outline" 
                                  className={cn("text-[10px] px-1.5 py-0", getConfidenceColor(pattern.confidence))}
                                >
                                  {(pattern.confidence * 100).toFixed(0)}%
                                </Badge>
                              </div>
                              <div className="text-[10px] text-muted-foreground">
                                {formatDistanceToNow(pattern.detectedAt, { addSuffix: true })}
                              </div>
                            </div>
                            {expandedPatternId === pattern.id ? (
                              <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                            ) : (
                              <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                            )}
                          </div>
                        </CollapsibleTrigger>

                        <CollapsibleContent>
                          <div className="px-2 pb-2 pt-1 space-y-2 border-t border-border/30">
                            {pattern.description && (
                              <p className="text-xs text-muted-foreground">
                                {pattern.description}
                              </p>
                            )}
                            <div className="grid grid-cols-2 gap-2 text-[10px]">
                              <div>
                                <span className="text-muted-foreground">Price: </span>
                                <span className="text-foreground font-mono">
                                  ${pattern.price.toFixed(pattern.price < 10 ? 5 : 2)}
                                </span>
                              </div>
                              <div>
                                <span className="text-muted-foreground">High: </span>
                                <span className="text-foreground font-mono">
                                  ${pattern.high.toFixed(pattern.high < 10 ? 5 : 2)}
                                </span>
                              </div>
                              <div>
                                <span className="text-muted-foreground">Low: </span>
                                <span className="text-foreground font-mono">
                                  ${pattern.low.toFixed(pattern.low < 10 ? 5 : 2)}
                                </span>
                              </div>
                              <div>
                                <span className="text-muted-foreground">Timeframe: </span>
                                <span className="text-foreground">{pattern.timeframe}</span>
                              </div>
                            </div>
                          </div>
                        </CollapsibleContent>
                      </div>
                    </Collapsible>
                  ))}
                </div>
              )}
            </ScrollArea>
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
};
