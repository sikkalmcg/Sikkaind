'use client';

import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { 
    Ban, 
    AlertTriangle, 
    ShieldAlert, 
    ArrowRightLeft,
    Package,
    Truck,
    Factory,
    Calculator,
    Loader2
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface CancelTripModalProps {
  isOpen: boolean;
  onClose: () => void;
  trip: any;
  onConfirm: () => void;
}

export default function CancelTripModal({ isOpen, onClose, trip, onConfirm }: CancelTripModalProps) {
  const [isDeleting, setIsDeleting] = useState(false);

  if (!trip) return null;

  const handleConfirm = async () => {
    setIsDeleting(true);
    await onConfirm();
    setIsDeleting(false);
  };

  const manifestSummary = [
    { label: 'Plant Node', value: trip.plantName || trip.originPlantId, icon: Factory },
    { label: 'Registry Trip ID', value: trip.tripId, icon: Package, mono: true },
    { label: 'Vehicle Registry', value: trip.vehicleNumber, icon: Truck, bold: true },
    { label: 'Manifest weight', value: `${trip.assignedQtyInTrip} MT`, icon: Calculator, color: 'text-red-600' },
  ];

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-xl p-0 border-none shadow-3xl overflow-hidden bg-white rounded-[2.5rem]">
        <DialogHeader className="p-8 bg-red-600 text-white shrink-0">
          <div className="flex items-center gap-5">
            <div className="p-3 bg-white/20 rounded-2xl backdrop-blur-md border border-white/20">
                <ShieldAlert className="h-8 w-8 text-white" />
            </div>
            <div>
                <DialogTitle className="text-2xl font-black uppercase tracking-tight italic leading-none text-white">MISSION REVOCATION</DialogTitle>
                <DialogDescription className="text-red-100 font-bold uppercase text-[9px] tracking-widest mt-2 opacity-80">Authorized Registry Purge node</DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="p-10 space-y-8">
            <p className="text-sm font-medium text-slate-600 leading-relaxed italic border-l-4 border-red-100 pl-4">
                "You are about to permanently erase this mission node from the active registry. Vehicle allocation will be reverted and order balance restored."
            </p>

            <div className="grid grid-cols-2 gap-6 p-8 bg-slate-50 rounded-[2rem] border border-slate-200 shadow-inner">
                {manifestSummary.map((item, i) => (
                    <div key={i} className="space-y-1.5">
                        <span className="text-[8px] font-black uppercase text-slate-400 tracking-widest flex items-center gap-2">
                            <item.icon className="h-3 w-3" /> {item.label}
                        </span>
                        <p className={cn(
                            "text-xs uppercase leading-tight",
                            item.bold ? "font-black text-slate-900" : "font-bold text-slate-700",
                            item.mono && "font-mono tracking-tighter text-blue-700",
                            item.color
                        )}>{item.value}</p>
                    </div>
                ))}
            </div>

            <div className="p-5 bg-amber-50 rounded-2xl border border-amber-100 flex items-start gap-4 shadow-sm">
                <AlertTriangle className="h-6 w-6 text-amber-600 shrink-0 mt-0.5" />
                <p className="text-[10px] font-bold text-amber-800 leading-normal uppercase">
                    Warning: This action is permanent and will be logged in the system audit registry for compliance tracking.
                </p>
            </div>
        </div>

        <DialogFooter className="p-6 bg-slate-50 border-t flex-row justify-end gap-3 shrink-0">
            <Button variant="ghost" onClick={onClose} disabled={isDeleting} className="font-black text-slate-500 uppercase text-[10px] tracking-widest px-8 h-11">Abort</Button>
            <Button 
                onClick={handleConfirm} 
                disabled={isDeleting} 
                className="bg-red-600 hover:bg-red-700 text-white px-10 h-11 rounded-xl font-black uppercase text-[10px] tracking-widest shadow-xl border-none transition-all active:scale-95 disabled:grayscale"
            >
                {isDeleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Ban className="h-4 w-4 mr-2" />}
                Confirm Purge
            </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
