import React from "react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Info, Clock } from "lucide-react";
import { formatTimeAgo, formatDate } from "@/lib/time-utils";

interface ProfileInfoTooltipProps {
  modelId?: string;
  confidence?: number;
  updatedAt?: number;
  children: React.ReactNode;
}

export function ProfileInfoTooltip({ modelId, confidence, updatedAt, children }: ProfileInfoTooltipProps) {
  const confidencePercentage = confidence ? (confidence / 10) * 100 : 0;
  
  const getProgressBarColor = (conf: number) => {
    if (conf >= 8) return "bg-green-500";
    if (conf >= 6) return "bg-yellow-500";
    if (conf >= 4) return "bg-orange-500";
    return "bg-red-500";
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
                    <span className="text-sm font-medium">{confidence}/10</span>
                  </div>
                  <div className="relative">
                    <Progress 
                      value={confidencePercentage} 
                      className="h-2"
                    />
                    <div 
                      className={`absolute top-0 left-0 h-2 rounded-full ${getProgressBarColor(confidence)}`}
                      style={{ width: `${confidencePercentage}%` }}
                    />
                  </div>
                </div>
              )}

              {updatedAt && (
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Clock className="h-3 w-3 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">Last Updated</span>
                  </div>
                  <div className="space-y-1">
                    <div className="text-sm font-medium">
                      {formatDate(updatedAt)}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {formatTimeAgo(updatedAt)}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
