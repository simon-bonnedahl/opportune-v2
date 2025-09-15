"use client"

import * as React from "react"
import { format } from "date-fns"
import { Calendar as CalendarIcon } from "lucide-react"
import { DateRange } from "react-day-picker"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

export const subtractDays = (date: Date, days: number) => {
  const newDate = new Date(date)
  newDate.setDate(newDate.getDate() - days)
  return newDate
}

export function DateRangePicker({
  className,
  date,
  onDateChange,
}: React.HTMLAttributes<HTMLDivElement> & {
  date?: DateRange;
  onDateChange?: (date: DateRange | undefined) => void;
}) {
  const today = new Date()
  const presets = [
    { label: "1 Week", dates: { from: subtractDays(today, 7), to: today } },
    { label: "1 Month", dates: { from: subtractDays(today, 30), to: today } },
    { label: "3 Months", dates: { from: subtractDays(today, 90), to: today } },
    { label: "4 Months", dates: { from: subtractDays(today, 120), to: today } },
    { label: "6 Months", dates: { from: subtractDays(today, 180), to: today } },
    { label: "1 Year", dates: { from: subtractDays(today, 365), to: today } },
  ]

  const [localDate, setLocalDate] = React.useState<DateRange | undefined>(date)

  React.useEffect(() => {
    setLocalDate(date)
  }, [date])

  const handleDateChange = (newDate: DateRange | undefined) => {
    setLocalDate(newDate)
    onDateChange?.(newDate)
  }

  return (
    <div className={cn("grid gap-2", className)}>
      <Popover>
        <PopoverTrigger asChild>
          <Button
            id="date"
            variant={"outline"}
            size={"sm"}
            className={cn(
              "w-[250px] justify-start text-left font-normal",
              !localDate && "text-muted-foreground"
            )}
          >
            <CalendarIcon />
            {localDate?.from ? (
              localDate.to ? (
                <>
                  {format(localDate.from, "LLL dd, y")} -{" "}
                  {format(localDate.to, "LLL dd, y")}
                </>
              ) : (
                format(localDate.from, "LLL dd, y")
              )
            ) : (
              <span className="font-medium text-md">Date</span>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <div className="flex flex-wrap gap-2 p-3 border-b border-border">
            {presets.map((preset) => (
              <Button
                key={preset.label}
                onClick={() => handleDateChange(preset.dates)}
                variant="outline"
                size="sm"
              >
                {preset.label}
              </Button>
            ))}
          </div>
          <Calendar
            initialFocus
            mode="range"
            defaultMonth={localDate?.from}
            selected={localDate}
            onSelect={handleDateChange}
            numberOfMonths={2}
          />
        </PopoverContent>
      </Popover>
    </div>
  )
}