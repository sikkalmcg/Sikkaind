"use client";

import * as React from "react";
import { format, isValid } from "date-fns";
import { Calendar as CalendarIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar, type CalendarProps } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

export function DatePicker({
  className,
  date,
  setDate,
  placeholder = "Pick a date",
  disabled,
  calendarProps,
}: {
  className?: string;
  date?: Date;
  setDate: (date?: Date) => void;
  placeholder?: string;
  disabled?: boolean;
  calendarProps?: CalendarProps;
}) {
  const [open, setOpen] = React.useState(false);

  // Registry Logic: Ensure date is a valid object before formatting
  const displayDate = React.useMemo(() => {
    if (!date) return null;
    const d = date instanceof Date ? date : new Date(date);
    return isValid(d) ? format(d, "dd/MM/yyyy") : null;
  }, [date]);

  return (
    <div className={cn("grid gap-2", className)}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            id="date"
            variant={"outline"}
            className={cn(
              "w-full justify-start text-left md:w-auto bg-white border-slate-200 transition-all",
              date ? "text-slate-900 font-black" : "text-muted-foreground font-medium"
            )}
            disabled={disabled}
          >
            <CalendarIcon className={cn("mr-2 h-4 w-4", date ? "text-blue-600" : "text-slate-400")} />
            {displayDate ? displayDate : <span>{placeholder}</span>}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0 border-none shadow-2xl rounded-2xl overflow-hidden" align="start">
          <Calendar
            initialFocus
            mode="single"
            selected={date}
            onSelect={(d) => {
              setDate(d);
              setOpen(false); // Registry Pulse: Close on selection
            }}
            {...calendarProps}
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}
