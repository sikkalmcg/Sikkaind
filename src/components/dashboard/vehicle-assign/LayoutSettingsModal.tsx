'use client';
import { useState, useEffect, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ArrowLeft, ArrowRight, ArrowUp, ArrowDown, RotateCcw, Save, X, Settings2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { Separator } from '@/components/ui/separator';

export const DEFAULT_COLUMNS = [
  { id: 'plantName', label: 'Plant' },
  { id: 'shipmentId', label: 'Order ID' },
  { id: 'creationDate', label: 'Order Create Date / Time' },
  { id: 'tripId', label: 'Trip ID' },
  { id: 'tripDate', label: 'Trip Date / Time' },
  { id: 'consignor', label: 'Consignor' },
  { id: 'loadingPoint', label: 'FROM' },
  { id: 'billToParty', label: 'Consignee' },
  { id: 'shipToParty', label: 'Ship to' },
  { id: 'unloadingPoint', label: 'Destination' },
  { id: 'quantity', label: 'Order Qty' },
  { id: 'dispatchQty', label: 'Dispatched Qty' },
  { id: 'assignedQty', label: 'Assigned Qty' },
  { id: 'balanceQty', label: 'Balance Qty' },
  { id: 'vehicleNumber', label: 'Vehicle Number' },
  { id: 'driverMobile', label: 'Driver Mobile' },
  { id: 'carrier', label: 'Carrier' },
  { id: 'transporterName', label: 'Transporter' },
  { id: 'lrNumber', label: 'LR Number' },
  { id: 'lrDate', label: 'LR Date' },
  { id: 'userName', label: 'Order Create Username' },
  { id: 'currentStatusId', label: 'Status' },
];

export const CANCELLED_COLUMNS = [
    ...DEFAULT_COLUMNS,
    { id: 'cancelledBy', label: 'Cancelled By' },
];

export const PENDING_FIXED_COLUMNS = [
  { id: 'plantName', label: 'Plant' },
  { id: 'shipmentId', label: 'Order ID' },
  { id: 'creationDate', label: 'Order Create Date / Time' },
  { id: 'lrNumber', label: 'LR Number' },
  { id: 'lrDate', label: 'LR Date' },
  { id: 'consignor', label: 'Consignor' },
  { id: 'loadingPoint', label: 'FROM' },
  { id: 'billToParty', label: 'Consignee' },
  { id: 'shipToParty', label: 'Ship to' },
  { id: 'unloadingPoint', label: 'Destination' },
  { id: 'quantity', label: 'Order Qty' },
  { id: 'dispatchQty', label: 'Dispatched Qty' },
  { id: 'balanceQty', label: 'Balance Qty' },
];

interface LayoutSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeTab: string;
}

export default function LayoutSettingsModal({ isOpen, onClose, activeTab }: LayoutSettingsModalProps) {
  const { toast } = useToast();
  const [available, setAvailable] = useState<any[]>([]);
  const [displayed, setDisplayed] = useState<any[]>([]);
  const [selectedInAvailable, setSelectedInAvailable] = useState<string | null>(null);
  const [selectedInDisplayed, setSelectedInDisplayed] = useState<string | null>(null);

  const storageKey = activeTab === 'pending' ? 'pending_orders_layout' : `open_orders_layout_${activeTab}`;
  
  const masterList = useMemo(() => {
    if (activeTab === 'pending') return PENDING_FIXED_COLUMNS;
    if (activeTab === 'cancelled') return CANCELLED_COLUMNS;
    return DEFAULT_COLUMNS;
  }, [activeTab]);

  useEffect(() => {
    const saved = localStorage.getItem(storageKey);
    if (saved) {
      const displayedIds = JSON.parse(saved) as string[];
      const displayedCols = displayedIds
        .map(id => masterList.find(c => c.id === id))
        .filter(Boolean) as any[];
      
      const availableCols = masterList.filter(c => !displayedIds.includes(c.id));
      
      setDisplayed(displayedCols);
      setAvailable(availableCols);
    } else {
      setDisplayed([...masterList]);
      setAvailable([]);
    }
  }, [isOpen, activeTab, storageKey, masterList]);

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
    toast({ title: "Layout Saved", description: "Column preferences updated." });
    window.location.reload();
    onClose();
  };

  const handleReset = () => {
    setDisplayed([...masterList]);
    setAvailable([]);
    setSelectedInAvailable(null);
    setSelectedInDisplayed(null);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl border-none shadow-2xl">
        <DialogHeader className="bg-slate-100 -m-6 p-6 mb-4 rounded-t-lg border-b">
          <DialogTitle className="text-xl font-bold flex items-center gap-2">
            <Settings2 className="h-5 w-5 text-blue-600"/> Change Layout Registry
          </DialogTitle>
          <DialogDescription>
            Customize your dashboard view for the **{activeTab.toUpperCase()}** tab. Move columns to reorder or hide information.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-11 gap-4 py-6">
          <div className="col-span-4 space-y-2">
            <h4 className="text-xs font-black uppercase text-slate-400 tracking-widest">Available Columns</h4>
            <div className="border border-slate-200 rounded-md h-[350px] overflow-y-auto bg-white">
              {available.map(col => (
                <div 
                  key={col.id} 
                  className={cn("px-3 py-2 text-[12px] cursor-pointer hover:bg-slate-50 transition-colors border-b border-slate-100 last:border-0 font-bold text-slate-600", selectedInAvailable === col.id && "bg-blue-50 text-blue-700 font-black border-blue-100")}
                  onClick={() => { setSelectedInAvailable(col.id); setSelectedInDisplayed(null); }}
                >
                  {col.label}
                </div>
              ))}
            </div>
          </div>

          <div className="col-span-1 flex flex-col items-center justify-center gap-4">
            <Button variant="outline" size="icon" onClick={handleMoveRight} disabled={!selectedInAvailable} className="border-slate-300"><ArrowRight className="h-4 w-4 text-slate-600"/></Button>
            <Button variant="outline" size="icon" onClick={handleMoveLeft} disabled={!selectedInDisplayed} className="border-slate-300"><ArrowLeft className="h-4 w-4 text-slate-600"/></Button>
          </div>

          <div className="col-span-4 space-y-2">
            <h4 className="text-xs font-black uppercase text-slate-400 tracking-widest">Displayed Columns</h4>
            <div className="border border-slate-200 rounded-md h-[350px] overflow-y-auto bg-white shadow-inner">
              {displayed.map(col => (
                <div 
                  key={col.id} 
                  className={cn("px-3 py-2 text-[12px] cursor-pointer hover:bg-slate-50 transition-colors border-b border-slate-100 last:border-0 font-bold text-slate-600", selectedInDisplayed === col.id && "bg-blue-50 text-blue-700 font-black border-blue-100")}
                  onClick={() => { setSelectedInDisplayed(col.id); setSelectedInAvailable(null); }}
                >
                  {col.label}
                </div>
              ))}
            </div>
          </div>

          <div className="col-span-2 flex flex-col items-center justify-center gap-4 border-l border-slate-100 pl-4">
            <Button variant="outline" size="sm" className="w-full gap-2 font-bold text-[11px] uppercase border-slate-300" onClick={handleMoveUp} disabled={!selectedInDisplayed}><ArrowUp className="h-4 w-4 text-slate-600"/> Move Up</Button>
            <Button variant="outline" size="sm" className="w-full gap-2 font-bold text-[11px] uppercase border-slate-300" onClick={handleMoveDown} disabled={!selectedInDisplayed}><ArrowDown className="h-4 w-4 text-slate-600"/> Move Down</Button>
            <Separator className="my-2 bg-slate-100"/>
            <Button variant="ghost" size="sm" className="w-full gap-2 text-orange-600 hover:text-orange-700 font-black text-[11px] uppercase" onClick={handleReset}><RotateCcw className="h-4 w-4"/> Reset</Button>
          </div>
        </div>

        <DialogFooter className="bg-slate-50 -m-6 p-6 mt-4 rounded-b-lg border-t flex-row justify-between sm:justify-between items-center border-slate-200">
          <Button variant="ghost" onClick={onClose} className="gap-2 font-bold text-slate-500"><X className="h-4 w-4"/> Cancel</Button>
          <Button onClick={handleSave} className="bg-blue-900 hover:bg-slate-900 gap-2 px-8 shadow-md border-none font-black uppercase text-[11px] tracking-widest h-10">
            <Save className="h-4 w-4"/> Save Layout
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}