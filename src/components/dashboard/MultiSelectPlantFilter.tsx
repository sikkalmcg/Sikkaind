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

/**
 * @fileOverview Multi-Select Plant Filter Node.
 * Re-engineered for high-density ERP layouts.
 * Optimized for mobile: Removed rigid widths and scaled down typography.
 * Fixed: Registry count discrepancy by validating selection against available options.
 */
export default function MultiSelectPlantFilter({
  options,
  selected,
  onChange,
  isLoading = false,
}: MultiSelectPlantFilterProps) {
  const [open, setOpen] = React.useState(false);
  const [searchTerm, setSearchTerm] = React.useState('');
  const [stagedSelected, setStagedSelected] = React.useState<string[]>(selected);

  React.useEffect(() => {
    if (open) {
      setStagedSelected(selected);
    }
  }, [open, selected]);

  const filteredOptions = options.filter((option) =>
    option.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const isAllSelected = options.length > 0 && stagedSelected.length === options.length;

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setStagedSelected(options.map((o) => o.id));
    } else {
      setStagedSelected([]);
    }
  };

  const handleToggle = (id: string) => {
    setStagedSelected(prev => 
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleApply = () => {
    // Registry Pulse: Return unique IDs only
    onChange(Array.from(new Set(stagedSelected)));
    setOpen(false);
  };

  const handleClear = () => {
    setStagedSelected([]);
  };

  const getButtonLabel = () => {
    if (isLoading) return 'Syncing Plants...';
    
    // UI Fix Node: Ensure we only count items that actually exist in the current options registry
    const currentList = open ? stagedSelected : selected;
    const validSelected = currentList.filter(id => options.some(o => o.id === id));
    
    if (validSelected.length === 0) return 'Select Plant';
    
    const isAll = options.length > 0 && validSelected.length === options.length;
    if (isAll && options.length > 1) return 'All Authorized Plants';
    
    const count = validSelected.length;
    const unit = count === 1 ? 'Plant' : 'Plants';
    
    if (count === 1) {
        const plant = options.find(o => o.id === validSelected[0]);
        return `1 Plant Selected${plant ? ` (${plant.id})` : ''}`;
    }
    
    return `${count} ${unit} Selected`;
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full min-w-[140px] justify-between h-8 md:h-9 border-slate-200 bg-white font-bold text-slate-700 hover:bg-slate-50 transition-all shadow-sm px-2"
        >
          <div className="flex items-center gap-1.5 truncate">
            <Factory className="h-3 w-3 text-blue-900 shrink-0" />
            <span className="truncate uppercase text-[9px] font-black tracking-tight">{getButtonLabel()}</span>
          </div>
          <ChevronDown className="ml-1 h-3.5 w-3.5 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[300px] p-0 border-slate-200 shadow-3xl rounded-2xl overflow-hidden flex flex-col max-h-[80vh]" align="start">
        <div className="flex items-center border-b p-2.5 bg-slate-50/50 shrink-0">
          <Search className="mr-2 h-4 w-4 shrink-0 text-slate-400" />
          <Input
            placeholder="Filter plant registry..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="h-9 border-none bg-transparent focus-visible:ring-0 text-sm font-medium"
          />
          {searchTerm && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setSearchTerm('')}
              className="h-7 w-7"
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
        
        <div className="p-2.5 border-b bg-white sticky top-0 z-10 shrink-0">
          <div 
            className="flex items-center space-x-2.5 px-3 py-2 hover:bg-slate-50 rounded-xl transition-colors cursor-pointer group"
            onClick={(e) => {
                e.preventDefault();
                handleSelectAll(!isAllSelected);
            }}
          >
            <Checkbox
              checked={isAllSelected}
              onCheckedChange={handleSelectAll}
              className="h-5 w-5 border-slate-300 data-[state=checked]:bg-blue-900 data-[state=checked]:border-blue-900 pointer-events-none"
            />
            <span
              className="text-xs font-black uppercase tracking-wider cursor-pointer flex-1 text-slate-600 group-hover:text-blue-900 transition-colors"
            >
              Select All Nodes
            </span>
          </div>
        </div>

        <ScrollArea className="flex-1 min-h-[150px] p-2 bg-white">
          <div className="space-y-1">
            {filteredOptions.length === 0 ? (
              <div className="py-10 text-center text-xs text-muted-foreground italic font-medium uppercase tracking-widest opacity-40">
                No matching plants detected.
              </div>
            ) : (
              filteredOptions.map((option) => (
                <div
                  key={option.id}
                  className={cn(
                    "flex items-center space-x-2.5 px-3 py-2.5 rounded-xl transition-all cursor-pointer group",
                    stagedSelected.includes(option.id) 
                      ? "bg-blue-50/50" 
                      : "hover:bg-slate-50"
                  )}
                  onClick={(e) => {
                      e.preventDefault();
                      handleToggle(option.id);
                  }}
                >
                  <Checkbox
                    checked={stagedSelected.includes(option.id)}
                    onCheckedChange={() => handleToggle(option.id)}
                    className="h-5 w-5 border-slate-300 data-[state=checked]:bg-blue-900 data-[state=checked]:border-blue-900 pointer-events-none"
                  />
                  <div className="flex flex-col flex-1 truncate">
                    <span className={cn(
                      "text-[13px] font-bold transition-colors uppercase leading-tight truncate",
                      stagedSelected.includes(option.id) ? "text-blue-900 font-black" : "text-slate-700 group-hover:text-blue-900"
                    )}>
                      {option.name}
                    </span>
                    <span className="text-[9px] font-bold text-slate-400 font-mono tracking-tighter">ID: {option.id}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </ScrollArea>
        
        <div className="p-4 border-t bg-slate-50 flex justify-between gap-3 shrink-0">
          <Button
            variant="ghost"
            size="sm"
            className="text-[10px] uppercase font-black text-slate-400 hover:text-red-600 flex-1 h-10"
            onClick={handleClear}
          >
            Clear All
          </Button>
          <Button
            size="sm"
            className="text-[10px] uppercase font-black bg-blue-900 hover:bg-slate-900 px-8 h-10 flex-1 shadow-lg shadow-blue-100 border-none transition-all active:scale-95"
            onClick={handleApply}
          >
            Apply Filters
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
