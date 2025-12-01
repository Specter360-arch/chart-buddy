import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Settings } from "lucide-react";

export interface IndicatorParameters {
  rsi: { period: number };
  macd: { fastPeriod: number; slowPeriod: number; signalPeriod: number };
  bollinger: { period: number; stdDev: number };
}

interface IndicatorSettingsProps {
  indicatorType: "rsi" | "macd" | "bollinger";
  parameters: IndicatorParameters;
  onSave: (params: IndicatorParameters) => void;
}

export const IndicatorSettings = ({
  indicatorType,
  parameters,
  onSave,
}: IndicatorSettingsProps) => {
  const [open, setOpen] = useState(false);
  const [localParams, setLocalParams] = useState(parameters);

  const handleSave = () => {
    onSave(localParams);
    setOpen(false);
  };

  const handleReset = () => {
    const defaults: IndicatorParameters = {
      rsi: { period: 14 },
      macd: { fastPeriod: 12, slowPeriod: 26, signalPeriod: 9 },
      bollinger: { period: 20, stdDev: 2 },
    };
    setLocalParams(defaults);
  };

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        className="h-6 w-6 p-0"
        onClick={(e) => {
          e.stopPropagation();
          setOpen(true);
        }}
      >
        <Settings className="h-3 w-3" />
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-[425px] bg-card border-border">
          <DialogHeader>
            <DialogTitle>
              {indicatorType === "rsi" && "RSI Settings"}
              {indicatorType === "macd" && "MACD Settings"}
              {indicatorType === "bollinger" && "Bollinger Bands Settings"}
            </DialogTitle>
            <DialogDescription>
              Customize the parameters for this technical indicator.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            {indicatorType === "rsi" && (
              <div className="grid gap-2">
                <Label htmlFor="rsi-period">Period</Label>
                <Input
                  id="rsi-period"
                  type="number"
                  min="1"
                  max="100"
                  value={localParams.rsi.period}
                  onChange={(e) =>
                    setLocalParams({
                      ...localParams,
                      rsi: { period: parseInt(e.target.value) || 14 },
                    })
                  }
                  className="bg-secondary border-border"
                />
                <p className="text-xs text-muted-foreground">
                  Number of periods to calculate RSI (default: 14)
                </p>
              </div>
            )}

            {indicatorType === "macd" && (
              <>
                <div className="grid gap-2">
                  <Label htmlFor="macd-fast">Fast Period</Label>
                  <Input
                    id="macd-fast"
                    type="number"
                    min="1"
                    max="100"
                    value={localParams.macd.fastPeriod}
                    onChange={(e) =>
                      setLocalParams({
                        ...localParams,
                        macd: {
                          ...localParams.macd,
                          fastPeriod: parseInt(e.target.value) || 12,
                        },
                      })
                    }
                    className="bg-secondary border-border"
                  />
                  <p className="text-xs text-muted-foreground">
                    Fast EMA period (default: 12)
                  </p>
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="macd-slow">Slow Period</Label>
                  <Input
                    id="macd-slow"
                    type="number"
                    min="1"
                    max="100"
                    value={localParams.macd.slowPeriod}
                    onChange={(e) =>
                      setLocalParams({
                        ...localParams,
                        macd: {
                          ...localParams.macd,
                          slowPeriod: parseInt(e.target.value) || 26,
                        },
                      })
                    }
                    className="bg-secondary border-border"
                  />
                  <p className="text-xs text-muted-foreground">
                    Slow EMA period (default: 26)
                  </p>
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="macd-signal">Signal Period</Label>
                  <Input
                    id="macd-signal"
                    type="number"
                    min="1"
                    max="100"
                    value={localParams.macd.signalPeriod}
                    onChange={(e) =>
                      setLocalParams({
                        ...localParams,
                        macd: {
                          ...localParams.macd,
                          signalPeriod: parseInt(e.target.value) || 9,
                        },
                      })
                    }
                    className="bg-secondary border-border"
                  />
                  <p className="text-xs text-muted-foreground">
                    Signal line EMA period (default: 9)
                  </p>
                </div>
              </>
            )}

            {indicatorType === "bollinger" && (
              <>
                <div className="grid gap-2">
                  <Label htmlFor="bb-period">Period</Label>
                  <Input
                    id="bb-period"
                    type="number"
                    min="1"
                    max="100"
                    value={localParams.bollinger.period}
                    onChange={(e) =>
                      setLocalParams({
                        ...localParams,
                        bollinger: {
                          ...localParams.bollinger,
                          period: parseInt(e.target.value) || 20,
                        },
                      })
                    }
                    className="bg-secondary border-border"
                  />
                  <p className="text-xs text-muted-foreground">
                    Moving average period (default: 20)
                  </p>
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="bb-stddev">Standard Deviation</Label>
                  <Input
                    id="bb-stddev"
                    type="number"
                    min="0.1"
                    max="10"
                    step="0.1"
                    value={localParams.bollinger.stdDev}
                    onChange={(e) =>
                      setLocalParams({
                        ...localParams,
                        bollinger: {
                          ...localParams.bollinger,
                          stdDev: parseFloat(e.target.value) || 2,
                        },
                      })
                    }
                    className="bg-secondary border-border"
                  />
                  <p className="text-xs text-muted-foreground">
                    Number of standard deviations (default: 2)
                  </p>
                </div>
              </>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={handleReset}>
              Reset to Default
            </Button>
            <Button onClick={handleSave}>Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};
