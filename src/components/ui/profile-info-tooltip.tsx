import React from "react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Info } from "lucide-react";

interface ProfileInfoTooltipProps {
  modelId?: string;
  confidence?: number;
  children: React.ReactNode;
}

export function ProfileInfoTooltip({ modelId, confidence, children }: ProfileInfoTooltipProps) {
  const confidencePercentage = confidence ? (confidence / 10) * 100 : 0;
  
  const getConfidenceColor = (conf: number) => {
    if (conf >= 8) return "bg-green-500 text-white";
    if (conf >= 6) return "bg-yellow-500 text-white";
    if (conf >= 4) return "bg-orange-500 text-white";
    return "bg-red-500 text-white";
  };

  const getConfidenceLabel = (conf: number) => {
    if (conf >= 8) return "Excellent";
    if (conf >= 6) return "Good";
    if (conf >= 4) return "Fair";
    return "Poor";
  };

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          {children}
        </TooltipTrigger>
        <TooltipContent side="bottom" className="w-80 p-4 bg-popover text-popover-foreground border shadow-lg">
          <div className="space-y-3">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Info className="h-4 w-4" />
                <span className="font-medium">Profile build details</span>
              </div>
              
              {modelId && (
                <div className="space-y-1">
                  <div className="text-sm text-muted-foreground">Model Used</div>
                  <Badge variant="outline" className="text-xs">
                    {modelId}
                  </Badge>
                </div>
              )}
              
              {confidence !== undefined && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Data Quality</span>
                    <div className="flex items-center gap-2">
                      <Badge 
                        variant="outline" 
                        className={`text-xs ${getConfidenceColor(confidence)} border-0`}
                      >
                        {getConfidenceLabel(confidence)}
                      </Badge>
                      <span className="text-sm font-medium">{confidence}/10</span>
                    </div>
                  </div>
                  <Progress 
                    value={confidencePercentage} 
                    className="h-2"
                  />
                </div>
              )}
            </div>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
