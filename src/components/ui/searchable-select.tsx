
'use client';

import * as React from 'react';
import { Check, ChevronDown, Search, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';

interface Option {
  value: string;
  label: string;
}

interface SearchableSelectProps {
  options: Option[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyPlaceholder?: string;
  className?: string;
  disabled?: boolean;
}

/**
 * @fileOverview Universal Searchable Registry Selector.
 * Enhanced with Arrow Key (Up/Down) navigation and Enter to select.
 */
export function SearchableSelect({
  options,
  value,
  onChange,
  placeholder = "Pick an entity...",
  searchPlaceholder = "Search registry handbook...",
  emptyPlaceholder = "No matching nodes detected.",
  className,
  disabled = false
}: SearchableSelectProps) {
  const [open, setOpen] = React.useState(false);
  const [search, setSearch] = React.useState('');
  const [highlightedIndex, setHighlightedIndex] = React.useState(0);
  const scrollRef = React.useRef<HTMLDivElement>(null);

  const filteredOptions = React.useMemo(() => {
    return options.filter((option) =>
      option.label.toLowerCase().includes(search.toLowerCase())
    );
  }, [options, search]);

  const selectedLabel = React.useMemo(() => {
    return options.find((o) => o.value === value)?.label || placeholder;
  }, [options, value, placeholder]);

  // Reset highlight on search or open
  React.useEffect(() => {
    setHighlightedIndex(0);
  }, [search, open]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!open) return;

    if (e.key === 'ArrowDown') {
        e.preventDefault();
        setHighlightedIndex(prev => (prev + 1) % filteredOptions.length);
    } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setHighlightedIndex(prev => (prev - 1 + filteredOptions.length) % filteredOptions.length);
    } else if (e.key === 'Enter') {
        e.preventDefault();
        if (filteredOptions[highlightedIndex]) {
            const selected = filteredOptions[highlightedIndex];
            onChange(selected.value);
            setOpen(false);
            setSearch('');
        }
    } else if (e.key === 'Escape') {
        setOpen(false);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn(
            "w-full justify-between h-11 rounded-xl border-slate-200 bg-white font-bold text-slate-700 hover:bg-slate-50 transition-all shadow-sm",
            !value && "text-slate-400 font-medium italic",
            className
          )}
        >
          <span className="truncate uppercase text-xs tracking-tight">{selectedLabel}</span>
          <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent 
        className="w-[var(--radix-popover-trigger-width)] p-0 border-slate-200 shadow-2xl rounded-2xl overflow-hidden" 
        align="start"
      >
        <div className="flex items-center border-b p-3 bg-slate-50/50">
          <Search className="mr-2 h-4 w-4 shrink-0 text-slate-400" />
          <Input
            placeholder={searchPlaceholder}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={handleKeyDown}
            className="h-9 border-none bg-transparent focus-visible:ring-0 text-xs font-bold uppercase tracking-tight"
            autoFocus
          />
          {search && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setSearch('')}
              className="h-7 w-7 text-slate-400 hover:text-slate-900"
            >
                <X className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>

        <ScrollArea className="h-64 p-2 bg-white" ref={scrollRef}>
          {filteredOptions.length === 0 ? (
            <div className="py-10 text-center text-xs text-slate-400 italic uppercase tracking-widest font-medium">
              {emptyPlaceholder}
            </div>
          ) : (
            <div className="space-y-1">
              {filteredOptions.map((option, idx) => (
                <div
                  key={option.value}
                  className={cn(
                    "flex items-center justify-between px-4 py-3 rounded-xl transition-all cursor-pointer group",
                    (value === option.value || highlightedIndex === idx)
                      ? "bg-blue-900 text-white" 
                      : "hover:bg-blue-50 text-slate-700"
                  )}
                  onClick={() => {
                    onChange(option.value);
                    setOpen(false);
                    setSearch('');
                  }}
                  onMouseEnter={() => setHighlightedIndex(idx)}
                >
                  <span className={cn(
                    "text-xs font-black uppercase tracking-tight",
                    (value === option.value || highlightedIndex === idx) ? "text-white" : "group-hover:text-blue-900"
                  )}>
                    {option.label}
                  </span>
                  {value === option.value && (
                    <Check className="h-4 w-4 text-blue-100 animate-in zoom-in-50 duration-200" />
                  )}
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
