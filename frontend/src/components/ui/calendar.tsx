import * as React from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { DayPicker } from "react-day-picker"

import { cn } from "../../lib/utils"

export type CalendarProps = React.ComponentProps<typeof DayPicker>

function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  ...props
}: CalendarProps) {
  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn("p-2 sm:p-3 min-w-0", className)}
      classNames={{
        months: "flex flex-col sm:flex-row gap-4 w-full justify-center",
        month: "flex flex-col gap-4 w-full min-w-0",
        month_caption:
          "flex justify-center pt-1 relative items-center w-full px-10 sm:px-11 min-h-9",
        caption_label: "text-sm font-semibold text-center px-1",
        nav: "flex items-center gap-1",
        button_previous: cn(
          "absolute left-0.5 top-1/2 z-10 -translate-y-1/2 h-8 w-8 shrink-0 bg-background/95 p-0 opacity-80 hover:opacity-100 inline-flex items-center justify-center rounded-md border border-input shadow-sm hover:bg-accent transition-opacity sm:left-1 sm:h-7 sm:w-7"
        ),
        button_next: cn(
          "absolute right-0.5 top-1/2 z-10 -translate-y-1/2 h-8 w-8 shrink-0 bg-background/95 p-0 opacity-80 hover:opacity-100 inline-flex items-center justify-center rounded-md border border-input shadow-sm hover:bg-accent transition-opacity sm:right-1 sm:h-7 sm:w-7"
        ),
        month_grid: "w-full border-collapse mx-auto",
        weekdays: "flex w-full justify-center",
        weekday:
          "text-muted-foreground rounded-md w-8 font-normal text-[0.7rem] text-center sm:w-9 sm:text-[0.8rem]",
        week: "flex w-full mt-2 justify-center",
        day: "h-8 w-8 text-center text-sm p-0 relative sm:h-9 sm:w-9",
        day_button: cn(
          "h-8 w-8 p-0 font-normal rounded-md transition-colors hover:bg-accent hover:text-accent-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1 aria-selected:opacity-100 inline-flex items-center justify-center w-full sm:h-9 sm:w-9"
        ),
        selected:
          "bg-brand-gold text-brand-charcoal hover:bg-brand-gold-light hover:text-brand-charcoal focus:bg-brand-gold focus:text-brand-charcoal rounded-md shadow-sm font-semibold",
        today:
          "bg-brand-gold/15 text-brand-gold font-semibold rounded-md ring-1 ring-brand-gold/30",
        outside: "text-muted-foreground opacity-40",
        disabled: "text-muted-foreground opacity-30 cursor-not-allowed",
        hidden: "invisible",
        ...classNames,
      }}
      components={{
        Chevron: ({ orientation }) =>
          orientation === "left" ? (
            <ChevronLeft className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          ),
      }}
      {...props}
    />
  )
}
Calendar.displayName = "Calendar"

export { Calendar }
