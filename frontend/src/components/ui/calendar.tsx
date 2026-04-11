import * as React from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { DayPicker } from "react-day-picker"

import { cn } from "../../lib/utils"

export type CalendarProps = React.ComponentProps<typeof DayPicker>

function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  navLayout,
  ...props
}: CalendarProps) {
  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      /** Puts prev/next beside the caption so they stay on the calendar, not a full-width top bar. */
      navLayout={navLayout ?? "around"}
      className={cn("p-2 sm:p-3 w-fit max-w-full mx-auto", className)}
      classNames={{
        months: "flex flex-col gap-4 sm:flex-row sm:justify-center",
        month:
          "grid w-max max-w-full [grid-template-columns:auto_minmax(0,1fr)_auto] items-center gap-x-1 gap-y-2",
        month_caption: "flex min-w-0 justify-center px-0.5",
        caption_label: "truncate text-center text-sm font-semibold tabular-nums",
        button_previous: cn(
          "h-8 w-8 shrink-0 bg-background p-0 opacity-90 hover:opacity-100 inline-flex items-center justify-center rounded-md border border-input shadow-sm hover:bg-accent transition-opacity sm:h-7 sm:w-7",
        ),
        button_next: cn(
          "h-8 w-8 shrink-0 bg-background p-0 opacity-90 hover:opacity-100 inline-flex items-center justify-center rounded-md border border-input shadow-sm hover:bg-accent transition-opacity sm:h-7 sm:w-7",
        ),
        month_grid: "col-span-3 w-full border-collapse",
        weekdays: "flex w-full justify-center gap-0.5 sm:gap-1",
        weekday:
          "w-8 shrink-0 text-center text-[0.7rem] font-normal text-muted-foreground sm:w-9 sm:text-[0.8rem]",
        week: "mt-2 flex w-full justify-center gap-0.5 sm:gap-1",
        day: "relative h-8 w-8 shrink-0 p-0 text-center text-sm sm:h-9 sm:w-9",
        day_button: cn(
          "flex h-8 w-8 items-center justify-center rounded-md p-0 font-normal transition-colors hover:bg-accent hover:text-accent-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1 aria-selected:opacity-100 sm:h-9 sm:w-9",
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
