'use client';

import { useState, useMemo } from 'react';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription, 
  DialogFooter 
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { 
  ArrowRightLeft, 
  ShieldCheck, 
  Search, 
  X, 
  Factory, 
  Truck,
  CheckCircle2,
  AlertTriangle,
  Save,
  Loader2,
  Sparkles
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn, normalizePlantId } from '@/lib/utils';
import type { Carrier, WithId } from '@/types';
import { Badge } from '@/components/ui/badge';

interface ChangeToContractModalProps {
  isOpen: boolean;
  onClose: () => void;
  trip: any;
  carriers: WithId<Carrier>[];
  onSuccess: (contractorId: string, contractorName: string) => Promise<void>;
}

/**
 * @fileOverview Change to Contract Terminal.
 * Registry node allowing mission operators to transition a trip from Market/Own to Contract Fleet.
 * Updated: Injected "ARRANGE BY PARTY" virtual node. Fixed missing imports.
 */
export default function ChangeToContractModal({ 
  isOpen, 
  onClose, 
  trip, 
  carriers, 
  onSuccess 
}: ChangeToContractModalProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedId, setSelectedId] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // MISSION FIX: Filter carriers strictly by the trip's origin plant registry + Virtual Node
  const filteredCarriers = useMemo(() => {
    const tripPlant = normalizePlantId(trip?.originPlantId);
    
    // Virtual ARRANGE BY PARTY Node
    const virtualNodes = [{
        id: 'ARRANGE_BY_PARTY',
        name: 'ARRANGE BY PARTY',
        gstin: 'VIRTUAL_REGISTRY_NODE',
        plantId: tripPlant
    }];

    const registryNodes = carriers.filter(c => {
        const matchesPlant = normalizePlantId(c.plantId) === tripPlant;
        const matchesSearch = c.name.toLowerCase().includes(searchTerm.toLowerCase());
        return matchesPlant && matchesSearch;
    });

    return [...virtualNodes, ...registryNodes];
  }, [carriers, trip, searchTerm]);

  const handleConfirm = async () => {
    const contractor = filteredCarriers.find(c => c.id === selectedId);
    if (!contractor) return;

    setIsSubmitting(true);
    try {
      await onSuccess(contractor.id, contractor.name);
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!trip) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl p-0 border-none shadow-3xl overflow-hidden bg-white rounded-[2.5rem]">
        <DialogHeader className="p-8 bg-slate-900 text-white shrink-0">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-blue-600 rounded-2xl shadow-xl rotate-3">
                <ArrowRightLeft className="h-7 w-7 text-white" />
            </div>
            <div>
                <DialogTitle className="text-xl font-black uppercase tracking-tight italic leading-none">Transition to Contract Node</DialogTitle>
                <DialogDescription className="text-blue-300 font-bold uppercase text-[9px] tracking-widest mt-2">Mission ID: {trip.tripId} | Origin: {trip.plantName}</DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="p-10 space-y-8 bg-[#f8fafc]">
            <div className="p-6 bg-white rounded-3xl border-2 border-slate-100 shadow-xl space-y-4">
                <div className="flex items-center gap-3 border-b pb-3 border-slate-100">
                    <AlertTriangle className="h-4 w-4 text-amber-500" />
                    <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-widest leading-none">Registry Update Node</h4>
                </div>
                <p className="text-sm font-medium text-slate-600 leading-relaxed italic">
                    "Transitioning this mission to a Contract node will scrub existing LR manifest. Selecting 'ARRANGE BY PARTY' will restrict LR generation."
                </p>
            </div>

            <div className="space-y-6">
                <div className="flex items-center justify-between px-1">
                    <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Select Registered Contractor *</Label>
                    <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-100 font-black uppercase text-[8px] px-3">{filteredCarriers.length} Handbooks Available</Badge>
                </div>
                
                <div className="relative group">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-300 group-focus-within:text-blue-900 transition-colors" />
                    <Input 
                        placeholder="Search master contractor registry..." 
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        className="h-14 pl-12 rounded-2xl bg-white border-slate-200 font-bold shadow-inner text-lg focus-visible:ring-blue-900"
                    />
                </div>

                <div className="border-2 border-slate-200 rounded-[2.5rem] bg-white overflow-hidden shadow-2xl">
                    <ScrollArea className="h-64">
                        <div className="p-3 space-y-1.5">
                            {filteredCarriers.map((c) => {
                                const isVirtual = c.id === 'ARRANGE_BY_PARTY';
                                return (
                                    <div 
                                        key={c.id} 
                                        onClick={() => setSelectedId(c.id)}
                                        className={cn(
                                            "flex items-center justify-between p-5 rounded-[1.5rem] cursor-pointer transition-all duration-300 border-2",
                                            selectedId === c.id 
                                                ? "bg-blue-900 border-blue-900 text-white shadow-xl translate-x-1" 
                                                : isVirtual 
                                                    ? "bg-blue-50/50 border-blue-100 text-blue-900" 
                                                    : "bg-white border-transparent hover:bg-slate-50 text-slate-700"
                                        )}
                                    >
                                        <div className="flex items-center gap-4">
                                            <div className={cn("p-2 rounded-xl transition-colors", selectedId === c.id ? "bg-white/10" : "bg-blue-50 text-blue-600")}>
                                                {isVirtual ? <Sparkles className="h-5 w-5" /> : <ShieldCheck className="h-5 w-5" />}
                                            </div>
                                            <div className="flex flex-col">
                                                <span className={cn("text-xs font-black uppercase tracking-tight", selectedId === c.id ? "text-white" : "text-slate-900")}>{c.name}</span>
                                                <span className={cn("text-[9px] font-bold uppercase", selectedId === c.id ? "text-blue-300" : "text-slate-400")}>{c.gstin}</span>
                                            </div>
                                        </div>
                                        {selectedId === c.id && <CheckCircle2 className="h-5 w-5 text-emerald-400 animate-in zoom-in" />}
                                    </div>
                                );
                            })}
                        </div>
                    </ScrollArea>
                </div>
            </div>
        </div>

        <DialogFooter className="p-8 bg-slate-50 border-t shrink-0 flex-row justify-end gap-4">
            <Button variant="ghost" onClick={onClose} disabled={isSubmitting} className="font-black text-slate-400 uppercase text-[10px] tracking-widest px-8 h-12 rounded-xl">Discard</Button>
            <Button 
                onClick={handleConfirm} 
                disabled={!selectedId || isSubmitting}
                className="bg-blue-900 hover:bg-black text-white px-12 h-12 rounded-xl font-black uppercase text-[10px] tracking-widest shadow-xl shadow-blue-900/20 border-none transition-all active:scale-95 disabled:grayscale"
            >
                {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                Transition Node (F8)
            </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
