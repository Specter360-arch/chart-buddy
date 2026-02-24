import { useState, useEffect } from 'react';
import { usePatternStore, PatternConfig, TradingStyle } from '@/stores/patternStore';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Settings, Zap, TrendingUp, Target } from 'lucide-react';

const PATTERN_GROUPS = {
  'Single Candle': [
    { id: 'doji', name: 'Doji', type: 'neutral' },
    { id: 'hammer', name: 'Hammer', type: 'bullish' },
    { id: 'inverted_hammer', name: 'Inverted Hammer', type: 'bullish' },
    { id: 'hanging_man', name: 'Hanging Man', type: 'bearish' },
    { id: 'spinning_top', name: 'Spinning Top', type: 'neutral' },
    { id: 'marubozu', name: 'Marubozu', type: 'both' },
  ],
  'Two Candle': [
    { id: 'bullish_engulfing', name: 'Bullish Engulfing', type: 'bullish' },
    { id: 'bearish_engulfing', name: 'Bearish Engulfing', type: 'bearish' },
    { id: 'bullish_harami', name: 'Bullish Harami', type: 'bullish' },
    { id: 'bearish_harami', name: 'Bearish Harami', type: 'bearish' },
    { id: 'piercing_line', name: 'Piercing Line', type: 'bullish' },
    { id: 'dark_cloud_cover', name: 'Dark Cloud Cover', type: 'bearish' },
  ],
  'Three Candle': [
    { id: 'morning_star', name: 'Morning Star', type: 'bullish' },
    { id: 'evening_star', name: 'Evening Star', type: 'bearish' },
    { id: 'three_white_soldiers', name: 'Three White Soldiers', type: 'bullish' },
    { id: 'three_black_crows', name: 'Three Black Crows', type: 'bearish' },
  ],
};

export const PatternSettingsDialog = () => {
  const [open, setOpen] = useState(false);
  const { config, setConfig, isEnabled, setEnabled } = usePatternStore();
  const [localConfig, setLocalConfig] = useState<PatternConfig>(config);

  // Sync local config when dialog opens
  useEffect(() => {
    if (open) {
      setLocalConfig(config);
    }
  }, [open, config]);

  const handleSave = () => {
    setConfig(localConfig);
    setOpen(false);
  };

  const handleReset = () => {
    const defaultConfig: PatternConfig = {
      minConfidence: 0.6,
      enabledPatterns: Object.values(PATTERN_GROUPS).flat().map(p => p.id),
      showBullish: true,
      showBearish: true,
      showNeutral: true,
      maxPatterns: 100,
      alertOnHighConfidence: true,
      highConfidenceThreshold: 0.85,
      tradingStyle: 'swing',
    };
    setLocalConfig(defaultConfig);
  };

  const togglePattern = (patternId: string) => {
    setLocalConfig((prev) => ({
      ...prev,
      enabledPatterns: prev.enabledPatterns.includes(patternId)
        ? prev.enabledPatterns.filter((id) => id !== patternId)
        : [...prev.enabledPatterns, patternId],
    }));
  };

  const toggleAllInGroup = (patterns: typeof PATTERN_GROUPS['Single Candle']) => {
    const allEnabled = patterns.every((p) => localConfig.enabledPatterns.includes(p.id));
    setLocalConfig((prev) => ({
      ...prev,
      enabledPatterns: allEnabled
        ? prev.enabledPatterns.filter((id) => !patterns.map(p => p.id).includes(id))
        : [...new Set([...prev.enabledPatterns, ...patterns.map(p => p.id)])],
    }));
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="h-8 gap-2">
          <Settings className="h-4 w-4" />
          <span className="text-xs hidden sm:inline">Settings</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Pattern Detection Settings</DialogTitle>
          <DialogDescription>
            Configure how patterns are detected and displayed
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[60vh] pr-4">
          <div className="space-y-6">
            {/* Master toggle */}
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-sm font-medium">Enable Pattern Detection</Label>
                <p className="text-xs text-muted-foreground">
                  Turn on/off pattern recognition
                </p>
              </div>
              <Switch checked={isEnabled} onCheckedChange={setEnabled} />
            </div>

            <Separator />

            {/* Trading Style */}
            <div className="space-y-3">
              <Label className="text-sm font-medium">Trading Style</Label>
              <p className="text-xs text-muted-foreground">
                Adjusts detection sensitivity via CandlestickJS presets
              </p>
              <ToggleGroup
                type="single"
                value={localConfig.tradingStyle}
                onValueChange={(value) => {
                  if (value) setLocalConfig((prev) => ({ ...prev, tradingStyle: value as TradingStyle }));
                }}
                className="grid grid-cols-3 gap-1"
              >
                <ToggleGroupItem value="scalping" className="flex flex-col items-center gap-1 h-auto py-2 px-1 data-[state=on]:bg-primary/15 data-[state=on]:border-primary/40">
                  <Zap className="h-4 w-4" />
                  <span className="text-xs font-medium">Scalping</span>
                  <span className="text-[9px] text-muted-foreground leading-tight text-center">Fast, single-candle</span>
                </ToggleGroupItem>
                <ToggleGroupItem value="swing" className="flex flex-col items-center gap-1 h-auto py-2 px-1 data-[state=on]:bg-primary/15 data-[state=on]:border-primary/40">
                  <TrendingUp className="h-4 w-4" />
                  <span className="text-xs font-medium">Swing</span>
                  <span className="text-[9px] text-muted-foreground leading-tight text-center">Balanced, multi-candle</span>
                </ToggleGroupItem>
                <ToggleGroupItem value="position" className="flex flex-col items-center gap-1 h-auto py-2 px-1 data-[state=on]:bg-primary/15 data-[state=on]:border-primary/40">
                  <Target className="h-4 w-4" />
                  <span className="text-xs font-medium">Position</span>
                  <span className="text-[9px] text-muted-foreground leading-tight text-center">High accuracy, full analysis</span>
                </ToggleGroupItem>
              </ToggleGroup>
            </div>

            <Separator />

            {/* Confidence threshold */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium">Minimum Confidence</Label>
                <Badge variant="outline">
                  {(localConfig.minConfidence * 100).toFixed(0)}%
                </Badge>
              </div>
              <Slider
                value={[localConfig.minConfidence * 100]}
                onValueChange={([value]) =>
                  setLocalConfig((prev) => ({ ...prev, minConfidence: value / 100 }))
                }
                min={40}
                max={95}
                step={5}
                className="w-full"
              />
              <p className="text-xs text-muted-foreground">
                Only show patterns with confidence above this threshold
              </p>
            </div>

            <Separator />

            {/* Display filters */}
            <div className="space-y-3">
              <Label className="text-sm font-medium">Display Filters</Label>
              <div className="grid grid-cols-3 gap-2">
                <label className="flex items-center gap-2 p-2 rounded-lg border cursor-pointer hover:bg-muted/50">
                  <Checkbox
                    checked={localConfig.showBullish}
                    onCheckedChange={(checked) =>
                      setLocalConfig((prev) => ({ ...prev, showBullish: !!checked }))
                    }
                  />
                  <span className="text-xs text-success">Bullish</span>
                </label>
                <label className="flex items-center gap-2 p-2 rounded-lg border cursor-pointer hover:bg-muted/50">
                  <Checkbox
                    checked={localConfig.showBearish}
                    onCheckedChange={(checked) =>
                      setLocalConfig((prev) => ({ ...prev, showBearish: !!checked }))
                    }
                  />
                  <span className="text-xs text-destructive">Bearish</span>
                </label>
                <label className="flex items-center gap-2 p-2 rounded-lg border cursor-pointer hover:bg-muted/50">
                  <Checkbox
                    checked={localConfig.showNeutral}
                    onCheckedChange={(checked) =>
                      setLocalConfig((prev) => ({ ...prev, showNeutral: !!checked }))
                    }
                  />
                  <span className="text-xs text-warning">Neutral</span>
                </label>
              </div>
            </div>

            <Separator />

            {/* Alerts */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-sm font-medium">High Confidence Alerts</Label>
                  <p className="text-xs text-muted-foreground">
                    Show toast notifications for strong patterns
                  </p>
                </div>
                <Switch
                  checked={localConfig.alertOnHighConfidence}
                  onCheckedChange={(checked) =>
                    setLocalConfig((prev) => ({ ...prev, alertOnHighConfidence: checked }))
                  }
                />
              </div>
              {localConfig.alertOnHighConfidence && (
                <div className="pl-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs">Alert Threshold</Label>
                    <Badge variant="outline" className="text-xs">
                      {(localConfig.highConfidenceThreshold * 100).toFixed(0)}%
                    </Badge>
                  </div>
                  <Slider
                    value={[localConfig.highConfidenceThreshold * 100]}
                    onValueChange={([value]) =>
                      setLocalConfig((prev) => ({ ...prev, highConfidenceThreshold: value / 100 }))
                    }
                    min={70}
                    max={95}
                    step={5}
                    className="w-full"
                  />
                </div>
              )}
            </div>

            <Separator />

            {/* Pattern selection */}
            <div className="space-y-4">
              <Label className="text-sm font-medium">Enabled Patterns</Label>
              
              {Object.entries(PATTERN_GROUPS).map(([groupName, patterns]) => (
                <div key={groupName} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-muted-foreground">
                      {groupName}
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 text-xs"
                      onClick={() => toggleAllInGroup(patterns)}
                    >
                      {patterns.every((p) => localConfig.enabledPatterns.includes(p.id))
                        ? 'Deselect All'
                        : 'Select All'}
                    </Button>
                  </div>
                  <div className="grid grid-cols-2 gap-1">
                    {patterns.map((pattern) => (
                      <label
                        key={pattern.id}
                        className="flex items-center gap-2 p-2 rounded border cursor-pointer hover:bg-muted/50"
                      >
                        <Checkbox
                          checked={localConfig.enabledPatterns.includes(pattern.id)}
                          onCheckedChange={() => togglePattern(pattern.id)}
                        />
                        <span className="text-xs">{pattern.name}</span>
                        <span
                          className={`ml-auto w-2 h-2 rounded-full ${
                            pattern.type === 'bullish'
                              ? 'bg-success'
                              : pattern.type === 'bearish'
                              ? 'bg-destructive'
                              : pattern.type === 'both'
                              ? 'bg-gradient-to-r from-success to-destructive'
                              : 'bg-warning'
                          }`}
                        />
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </ScrollArea>

        <div className="flex justify-between pt-4 border-t">
          <Button variant="outline" size="sm" onClick={handleReset}>
            Reset to Defaults
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button size="sm" onClick={handleSave}>
              Save Changes
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};