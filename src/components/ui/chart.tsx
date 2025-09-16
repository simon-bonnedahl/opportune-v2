"use client"

import * as React from "react"
import * as RechartsPrimitive from "recharts"
import { cn } from "@/lib/utils"

// Chart context
const ChartContext = React.createContext<{
  config: Record<string, any>
}>({
  config: {},
})

// Chart container
const ChartContainer = React.forwardRef<
  HTMLDivElement,
  React.ComponentProps<"div"> & {
    config: Record<string, any>
  }
>(({ className, children, config, ...props }, ref) => {
  return (
    <ChartContext.Provider value={{ config }}>
      <div
        ref={ref}
        className={cn("flex aspect-video justify-center", className)}
        {...props}
      >
        {children}
      </div>
    </ChartContext.Provider>
  )
})
ChartContainer.displayName = "ChartContainer"

// Chart tooltip
const ChartTooltip = RechartsPrimitive.Tooltip

// Chart legend
const ChartLegend = RechartsPrimitive.Legend

// Chart responsive container
const ChartResponsiveContainer = RechartsPrimitive.ResponsiveContainer

export {
  ChartContainer,
  ChartTooltip,
  ChartLegend,
  ChartResponsiveContainer,
}
