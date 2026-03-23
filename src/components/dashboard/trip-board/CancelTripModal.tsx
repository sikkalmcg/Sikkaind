'use client';

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { AlertTriangle, CheckCircle2, XCircle, ShieldAlert } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

interface CancelTripModalProps {
  isOpen: boolean;
  onClose: () => void;
  trip: any;
  onConfirm: () => Promise<void>;
}

export default function CancelTripModal({ isOpen, onClose, trip, onConfirm }: CancelTripModalProps) {
  if (!trip) return null;

  const details = [
    { label: 'Trip ID Node', value: trip.tripId, mono: true },
    { label: 'Order Registry', value: trip.shipmentId || trip.shipmentIds?.[0], mono: true },
    { label: 'Vehicle Number', value: trip.vehicleNumber, bold: true },
    { label: 'Pilot Name', value: trip.driverName },
    { label: 'Mission Route', value: `${trip.loadingPoint} → ${trip.unloadingPoint}` },
    { label: 'Registry Date', value: trip.startDate ? format(new Date(trip.startDate), 'dd MMM yyyy') : '--' },
  ];

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md p-0 border-none shadow-2xl overflow-hidden bg-white">
        <DialogHeader className="p-8 bg-red-50 border-b border-red-100 flex flex-row items-center gap-5 space-y-0">
          <div className="bg-red-600 p-3 rounded-2xl shadow-xl">
            <ShieldAlert className="h-8 w-8 text-white" />
          </div>
          <div>
            <DialogTitle className="text-xl font-black text-red-900 uppercase tracking-tight">Revoke SIKKA LMC?</DialogTitle>
            <DialogDescription className="text-red-700 font-bold uppercase text-[9px] tracking-widest mt-1">
                Authorization Required for Rollback
            </DialogDescription>
          </div>
        </DialogHeader>

        <div className="p-8 space-y-8">
            <div className="space-y-4">
                <div className="grid grid-cols-1 gap-y-4 p-6 bg-slate-50 rounded-3xl border border-slate-200">
                    {details.map((item, i) => (
                        <div key={i} className="flex justify-between items-center text-sm border-b border-slate-100 last:border-0 pb-2 last:pb-0">
                            <span className="text-[10px] font-black uppercase text-slate-400">{item.label}</span>
                            <span className={cn(
                                "font-bold text-slate-800",
                                item.mono && "font-mono tracking-tighter text-blue-700",
                                item.bold && "font-black"
                            )}>{item.value}</span>
                        </div>
                    ))}
                </div>
            </div>

            <div className="p-5 bg-amber-50 rounded-2xl border border-amber-100 flex items-start gap-4 shadow-sm">
                <AlertTriangle className="h-6 w-6 text-amber-600 shrink-0 mt-0.5" />
                <p className="text-[10px] font-bold text-amber-800 leading-normal uppercase">
                    Critical Logic: Confirming this revocation will delete the Trip Node and reset Order Status to [PENDING]. This action is logged permanently.
                </p>
            </div>
        </div>

        <DialogFooter className="p-6 bg-slate-50 border-t flex-row justify-end gap-3">
          <Button variant="ghost" onClick={onClose} className="font-bold text-slate-500 uppercase text-[10px] tracking-widest h-10 px-6">Abort</Button>
          <Button onClick={onConfirm} className="bg-red-600 hover:bg-red-700 text-white font-black uppercase text-[10px] tracking-widest px-10 h-10 shadow-lg shadow-red-100 border-none transition-all active:scale-95">
            Confirm Cancel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
