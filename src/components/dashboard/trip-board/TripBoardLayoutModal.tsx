'use client';
import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ArrowLeft, ArrowRight, ArrowUp, ArrowDown, RotateCcw, Save, X, Settings2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { Separator } from '@/components/ui/separator';

export const TRIP_BOARD_COLUMNS = [
  { id: 'plantName', label: 'Plant' },
  { id: 'shipmentId', label: 'Shipment ID' },
  { id: 'orderCreateDate', label: 'Order Date' },
  { id: 'tripId', label: 'Trip ID' },
  { id: 'tripCreateDate', label: 'Trip Date' },
  { id: 'consignor', label: 'Consignor' },
  { id: 'loadingPoint', label: 'FROM' },
  { id: 'billToParty', label: 'Consignee' },
  { id: 'shipToParty', label: 'Ship To' },
  { id: 'unloadingPoint', label: 'Destination' },
  { id: 'orderQty', label: 'Order Qty' },
  { id: 'dispatchedQty', label: 'Dispatched Qty' },
  { id: 'balanceQty', label: 'Balance Qty' },
  { id: 'assignedQtyInTrip', label: 'Assigned Weight' },
  { id: 'vehicleNumber', label: 'Vehicle Number' },
  { id: 'carrier', label: 'Carrier' },
  { id: 'lrNumber', label: 'LR Number' },
  { id: 'lrDate', label: 'LR Date' },
  { id: 'lrQty', label: 'LR Qty' },
  { id: 'lrUnits', label: 'LR Units' },
];

interface TripBoardLayoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeTab: string;
}

export default function TripBoardLayoutModal({ isOpen, onClose, activeTab }: TripBoardLayoutModalProps) {
  const { toast } = useToast();
  const [available, setAvailable] = useState<typeof TRIP_BOARD_COLUMNS>([]);
  const [displayed, setDisplayed] = useState<typeof TRIP_BOARD_COLUMNS>([]);
  const [selectedInAvailable, setSelectedInAvailable] = useState<string | null>(null);
  const [selectedInDisplayed, setSelectedInDisplayed] = useState<string | null>(null);

  const storageKey = `trip_board_layout_${activeTab}`;

  useEffect(() => {
    const saved = localStorage.getItem(storageKey);
    if (saved) {
      const displayedIds = JSON.parse(saved) as string[];
      const displayedCols = displayedIds
        .map(id => TRIP_BOARD_COLUMNS.find(c => c.id === id))
        .filter(Boolean) as typeof TRIP_BOARD_COLUMNS;
      
      const availableCols = TRIP_BOARD_COLUMNS.filter(c => !displayedIds.includes(c.id));
      
      setDisplayed(displayedCols);
      setAvailable(availableCols);
    } else {
      setDisplayed([...TRIP_BOARD_COLUMNS]);
      setAvailable([]);
    }
  }, [isOpen, storageKey]);

  const handleMoveRight = () => {
    if (!selectedInAvailable) return;
    const col = available.find(c => c.id === selectedInAvailable);
    if (col) {
      setDisplayed([...displayed, col]);
      setAvailable(available.filter(c => c.id !== selectedInAvailable));
      setSelectedInAvailable(null);
    }
  };

  const handleMoveLeft = () => {
    if (!selectedInDisplayed) return;
    const col = displayed.find(c => c.id === selectedInDisplayed);
    if (col) {
      setAvailable([...available, col]);
      setDisplayed(displayed.filter(c => c.id !== selectedInDisplayed));
      setSelectedInDisplayed(null);
    }
  };

  const handleMoveUp = () => {
    if (!selectedInDisplayed) return;
    const idx = displayed.findIndex(c => c.id === selectedInDisplayed);
    if (idx > 0) {
      const newDisplayed = [...displayed];
      [newDisplayed[idx - 1], newDisplayed[idx]] = [newDisplayed[idx], newDisplayed[idx - 1]];
      setDisplayed(newDisplayed);
    }
  };

  const handleMoveDown = () => {
    if (!selectedInDisplayed) return;
    const idx = displayed.findIndex(c => c.id === selectedInDisplayed);
    if (idx < displayed.length - 1) {
      const newDisplayed = [...displayed];
      [newDisplayed[idx + 1], newDisplayed[idx]] = [newDisplayed[idx], newDisplayed[idx + 1]];
      setDisplayed(newDisplayed);
    }
  };

  const handleSave = () => {
    localStorage.setItem(storageKey, JSON.stringify(displayed.map(c => c.id)));
    toast({ title: "Layout Saved", description: "Trip board column preferences updated." });
    window.location.reload();
    onClose();
  };

  const handleReset = () => {
    setDisplayed([...TRIP_BOARD_COLUMNS]);
    setAvailable([]);
    setSelectedInAvailable(null);
    setSelectedInDisplayed(null);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl border-none shadow-2xl">
        <DialogHeader className="bg-slate-100 -m-6 p-6 mb-4 rounded-t-lg border-b">
          <DialogTitle className="text-xl font-bold flex items-center gap-2">
            <Settings2 className="h-5 w-5 text-blue-600"/> Trip Board Layout
          </DialogTitle>
          <DialogDescription>
            Customize the trip registry columns for the **{activeTab.toUpperCase()}** view.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-11 gap-4 py-6">
          <div className="col-span-4 space-y-2">
            <h4 className="text-xs font-bold uppercase text-muted-foreground tracking-widest">Available Columns</h4>
            <div className="border rounded-md h-[350px] overflow-y-auto bg-white">
              {available.map(col => (
                <div 
                  key={col.id} 
                  className={cn("px-3 py-2 text-[13px] cursor-pointer hover:bg-slate-50 transition-colors border-b last:border-0", selectedInAvailable === col.id && "bg-blue-50 text-blue-700 font-bold border-blue-100")}
                  onClick={() => { setSelectedInAvailable(col.id); setSelectedInDisplayed(null); }}
                >
                  {col.label}
                </div>
              ))}
            </div>
          </div>

          <div className="col-span-1 flex flex-col items-center justify-center gap-4">
            <Button variant="outline" size="icon" onClick={handleMoveRight} disabled={!selectedInAvailable}><ArrowRight className="h-4 w-4"/></Button>
            <Button variant="outline" size="icon" onClick={handleMoveLeft} disabled={!selectedInDisplayed}><ArrowLeft className="h-4 w-4"/></Button>
          </div>

          <div className="col-span-4 space-y-2">
            <h4 className="text-xs font-bold uppercase text-muted-foreground tracking-widest">Displayed Columns</h4>
            <div className="border rounded-md h-[350px] overflow-y-auto bg-white shadow-inner">
              {displayed.map(col => (
                <div 
                  key={col.id} 
                  className={cn("px-3 py-2 text-[13px] cursor-pointer hover:bg-slate-50 transition-colors border-b last:border-0", selectedInDisplayed === col.id && "bg-blue-50 text-blue-700 font-bold border-blue-100")}
                  onClick={() => { setSelectedInDisplayed(col.id); setSelectedInAvailable(null); }}
                >
                  {col.label}
                </div>
              ))}
            </div>
          </div>

          <div className="col-span-2 flex flex-col items-center justify-center gap-4 border-l pl-4">
            <Button variant="outline" size="sm" className="w-full gap-2" onClick={handleMoveUp} disabled={!selectedInDisplayed}><ArrowUp className="h-4 w-4"/> Move Up</Button>
            <Button variant="outline" size="sm" className="w-full gap-2" onClick={handleMoveDown} disabled={!selectedInDisplayed}><ArrowDown className="h-4 w-4"/> Move Down</Button>
            <Separator className="my-2"/>
            <Button variant="ghost" size="sm" className="w-full gap-2 text-orange-600 hover:text-orange-700" onClick={handleReset}><RotateCcw className="h-4 w-4"/> Reset</Button>
          </div>
        </div>

        <DialogFooter className="bg-slate-50 -m-6 p-6 mt-4 rounded-b-lg border-t flex-row justify-between sm:justify-between items-center">
          <Button variant="ghost" onClick={onClose} className="gap-2"><X className="h-4 w-4"/> Cancel</Button>
          <Button onClick={handleSave} className="bg-blue-700 hover:bg-blue-800 gap-2 px-8 shadow-md"><Save className="h-4 w-4"/> Save Layout</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
