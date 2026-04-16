
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
 * Hardened for accurate pluralization and staged selection logic.
 * Fixed: Popover height management for mobile to ensure Apply button visibility.
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
    onChange(stagedSelected);
    setOpen(false);
  };

  const handleClear = () => {
    setStagedSelected([]);
  };

  const getButtonLabel = () => {
    if (isLoading) return 'Syncing Plants...';
    if (selected.length === 0) return 'Select Plant';
    const isAll = options.length > 0 && selected.length === options.length;
    if (isAll && options.length > 1) return 'All Authorized Plants';
    
    const count = selected.length;
    const unit = count === 1 ? 'Plant' : 'Plants';
    
    if (count === 1) {
        const plant = options.find(o => o.id === selected[0]);
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
          className="w-full min-w-[200px] justify-between h-9 border-slate-200 bg-slate-50 font-bold text-slate-700 hover:bg-slate-100 transition-all shadow-sm"
        >
          <div className="flex items-center gap-2 truncate">
            <Factory className="h-3.5 w-3.5 text-blue-900 shrink-0" />
            <span className="truncate uppercase text-[10px] font-black tracking-tight">{getButtonLabel()}</span>
          </div>
          <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[300px] p-0 border-slate-200 shadow-2xl rounded-2xl overflow-hidden flex flex-col max-h-[80vh]" align="start">
        <div className="flex items-center border-b p-2 bg-slate-50/50 shrink-0">
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
        
        <div className="p-2 border-b bg-white sticky top-0 z-10 shrink-0">
          <div 
            className="flex items-center space-x-2 px-2 py-1.5 hover:bg-slate-50 rounded-md transition-colors cursor-pointer group"
            onClick={(e) => {
                e.preventDefault();
                handleSelectAll(!isAllSelected);
            }}
          >
            <Checkbox
              checked={isAllSelected}
              className="border-slate-300 data-[state=checked]:bg-blue-900 data-[state=checked]:border-blue-900 pointer-events-none"
            />
            <span
              className="text-xs font-black uppercase tracking-wider cursor-pointer flex-1 text-slate-600 group-hover:text-blue-900 transition-colors"
            >
              Select All Plants
            </span>
          </div>
        </div>

        <ScrollArea className="flex-1 min-h-[150px] p-2 bg-white">
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
                    "flex items-center space-x-2 px-2 py-2 rounded-md transition-all cursor-pointer group",
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
                    className="border-slate-300 data-[state=checked]:bg-blue-900 data-[state=checked]:border-blue-900 pointer-events-none"
                  />
                  <span
                    className={cn(
                      "text-sm font-medium cursor-pointer flex-1 transition-colors uppercase",
                      stagedSelected.includes(option.id) ? "text-blue-900 font-black" : "text-slate-600 group-hover:text-blue-900"
                    )}
                  >
                    {option.name}
                  </span>
                </div>
              ))
            )}
          </div>
        </ScrollArea>
        
        <div className="p-3 border-t bg-slate-50 flex justify-between gap-3 shrink-0">
          <Button
            variant="ghost"
            size="sm"
            className="text-[10px] uppercase font-bold text-slate-500 hover:text-red-600 flex-1"
            onClick={handleClear}
          >
            Clear All
          </Button>
          <Button
            size="sm"
            className="text-[10px] uppercase font-black bg-blue-900 hover:bg-slate-900 px-6 h-8 flex-1 shadow-lg"
            onClick={handleApply}
          >
            Apply Filters
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
