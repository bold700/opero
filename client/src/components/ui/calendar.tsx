"use client";

import * as React from "react";
import { DayPicker } from "react-day-picker";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";

export type CalendarProps = React.ComponentProps<typeof DayPicker>;

function Calendar({ className, classNames, showOutsideDays = true, ...props }: CalendarProps) {
  return (
    <DayPicker
      className={cn("rounded-lg border border-zinc-200 bg-white p-3", className)}
      classNames={{
        button_next: cn(buttonVariants({ size: "icon", variant: "ghost" }), "size-8"),
        button_previous: cn(buttonVariants({ size: "icon", variant: "ghost" }), "size-8"),
        caption_label: "text-sm font-medium",
        day: "flex-1 aspect-square rounded-md text-sm hover:bg-zinc-100",
        day_button: "size-full flex items-center justify-center",
        disabled: "text-zinc-300 hover:bg-transparent",
        dropdowns: "flex gap-2",
        month: "space-y-3",
        month_caption: "flex h-9 items-center justify-center",
        month_grid: "w-full border-collapse",
        months: "flex flex-col gap-4",
        nav: "absolute inset-x-3 top-3 flex items-center justify-between",
        outside: "text-zinc-300",
        selected:
          "bg-emerald-600 text-white hover:bg-emerald-700 hover:text-white",
        today: "font-semibold text-emerald-700",
        weekday: "flex-1 text-xs font-normal text-zinc-500",
        weekdays: "flex w-full",
        week: "mt-1 flex w-full",
        ...classNames,
      }}
      components={{
        Chevron: ({ orientation }) =>
          orientation === "left" ? (
            <ChevronLeft className="size-4" />
          ) : (
            <ChevronRight className="size-4" />
          ),
      }}
      showOutsideDays={showOutsideDays}
      {...props}
    />
  );
}

export { Calendar };
