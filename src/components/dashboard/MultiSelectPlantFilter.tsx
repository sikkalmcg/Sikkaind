'use client';

import * as React from 'react';
import { Check, ChevronDown, Search, X, Factory } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';

interface PlantOption {
  id: string;
  name: string;
}

interface MultiSelectPlantFilterProps {
  options: PlantOption[];
  selected: string[];
  onChange: (selectedIds: string[]) => void;
  isLoading?: boolean;
}

export default function MultiSelectPlantFilter({
  options,
  selected,
  onChange,
  isLoading = false,
}: MultiSelectPlantFilterProps) {
  const [open, setOpen] = React.useState(false);
  const [searchTerm, setSearchTerm] = React.useState('');

  const filteredOptions = options.filter((option) =>
    option.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const isAllSelected = options.length > 0 && selected.length === options.length;

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      onChange(options.map((o) => o.id));
    } else {
      onChange([]);
    }
  };

  const handleToggle = (id: string) => {
    const newSelected = selected.includes(id)
      ? selected.filter((item) => item !== id)
      : [...selected, id];
    onChange(newSelected);
  };

  const getButtonLabel = () => {
    if (isLoading) return 'Loading Plants...';
    if (selected.length === 0) return 'Select Plant';
    if (isAllSelected) return 'All Plants';
    if (selected.length <= 2) {
      return selected
        .map((id) => options.find((o) => o.id === id)?.name)
        .filter(Boolean)
        .join(', ');
    }
    return `${selected.length} Plants Selected`;
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full min-w-[200px] justify-between h-9 border-slate-200 bg-slate-50 font-bold text-slate-700 hover:bg-slate-100 transition-all shadow-sm"
        >
          <div className="flex items-center gap-2 truncate">
            <Factory className="h-3.5 w-3.5 text-blue-900 shrink-0" />
            <span className="truncate">{getButtonLabel()}</span>
          </div>
          <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[300px] p-0 border-slate-200 shadow-xl" align="start">
        <div className="flex items-center border-b p-2 bg-slate-50/50">
          <Search className="mr-2 h-4 w-4 shrink-0 text-slate-400" />
          <Input
            placeholder="Search plant name..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="h-8 border-none bg-transparent focus-visible:ring-0 text-sm"
          />
          {searchTerm && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setSearchTerm('')}
              className="h-6 w-6"
            >
              <X className="h-3 w-3" />
            </Button>
          )}
        </div>
        
        <div className="p-2 border-b bg-white sticky top-0 z-10">
          <div className="flex items-center space-x-2 px-2 py-1.5 hover:bg-slate-50 rounded-md transition-colors cursor-pointer group">
            <Checkbox
              id="select-all"
              checked={isAllSelected}
              onCheckedChange={handleSelectAll}
              className="border-slate-300 data-[state=checked]:bg-blue-900 data-[state=checked]:border-blue-900"
            />
            <label
              htmlFor="select-all"
              className="text-xs font-black uppercase tracking-wider cursor-pointer flex-1 text-slate-600 group-hover:text-blue-900 transition-colors"
            >
              Select All Plants
            </label>
          </div>
        </div>

        <ScrollArea className="h-64 p-2 bg-white">
          <div className="space-y-1">
            {filteredOptions.length === 0 ? (
              <div className="py-6 text-center text-xs text-muted-foreground italic">
                No plants found matching search.
              </div>
            ) : (
              filteredOptions.map((option) => (
                <div
                  key={option.id}
                  className={cn(
                    "flex items-center space-x-2 px-2 py-2 rounded-md transition-all cursor-pointer",
                    selected.includes(option.id) 
                      ? "bg-blue-50/50" 
                      : "hover:bg-slate-50"
                  )}
                  onClick={() => handleToggle(option.id)}
                >
                  <Checkbox
                    id={`plant-${option.id}`}
                    checked={selected.includes(option.id)}
                    onCheckedChange={() => handleToggle(option.id)}
                    className="border-slate-300 data-[state=checked]:bg-blue-900 data-[state=checked]:border-blue-900"
                  />
                  <label
                    htmlFor={`plant-${option.id}`}
                    className={cn(
                      "text-sm font-medium cursor-pointer flex-1 transition-colors",
                      selected.includes(option.id) ? "text-blue-900 font-bold" : "text-slate-600"
                    )}
                  >
                    {option.name}
                  </label>
                  {selected.includes(option.id) && (
                    <Check className="h-3.5 w-3.5 text-blue-900 animate-in zoom-in-50 duration-200" />
                  )}
                </div>
              ))
            )}
          </div>
        </ScrollArea>
        
        <div className="p-2 border-t bg-slate-50 flex justify-between gap-2">
          <Button
            variant="ghost"
            size="sm"
            className="text-[10px] uppercase font-bold text-slate-500 hover:text-red-600"
            onClick={() => onChange([])}
          >
            Clear All
          </Button>
          <Button
            size="sm"
            className="text-[10px] uppercase font-black bg-blue-900 hover:bg-slate-900 px-4 h-7"
            onClick={() => setOpen(false)}
          >
            Apply Filters
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
