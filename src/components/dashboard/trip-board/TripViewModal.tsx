'use client';

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { format, isValid } from 'date-fns';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ShieldCheck, Truck, MapPin, Calendar, Activity, User, FileText, CheckCircle2, Eye, MonitorPlay } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Timestamp } from 'firebase/firestore';

/**
 * Registry Logic: Safe Date Handshake
 * Ensures Firestore Timestamps, standard Dates, and serialized objects are formatted without crashing.
 */
const formatSafeDate = (date: any, formatStr: string) => {
    if (!date) return '--';
    try {
        let d: Date;
        if (date instanceof Timestamp) {
            d = date.toDate();
        } else if (date instanceof Date) {
            d = date;
        } else if (date && typeof date === 'object' && 'seconds' in date) {
            // Handle plain objects that look like Timestamps (e.g. from state serialization)
            d = new Date(date.seconds * 1000);
        } else {
            d = new Date(date);
        }
        
        if (!isValid(d)) return '--';
        return format(d, formatStr);
    } catch (e) {
        return '--';
    }
};

export default function TripViewModal({ isOpen, onClose, trip }: { isOpen: boolean; onClose: () => void; trip: any }) {
  if (!trip) return null;

  const sections = [
    {
        title: 'Mission Configuration',
        icon: ShieldCheck,
        items: [
            { label: 'Trip ID', value: trip.tripId, mono: true },
            { label: 'LR Number', value: trip.lrNumber, mono: true, bold: true },
            { label: 'LR Date', value: formatSafeDate(trip.lrDate, 'dd-MMM-yyyy') },
            { label: 'Vehicle Number', value: trip.vehicleNumber, bold: true },
            { label: 'Carrier', value: trip.carrier },
            { label: 'Transporter', value: trip.transporterName || 'Self' },
        ]
    },
    {
        title: 'Consignment Particulars',
        icon: FileText,
        items: [
            { label: 'Shipment ID', value: trip.shipmentId, mono: true },
            { label: 'Lifting Point (FROM)', value: trip.loadingPoint },
            { label: 'Drop Point (DEST)', value: trip.unloadingPoint },
            { label: 'Quantity (MT)', value: trip.assignedQtyInTrip, bold: true },
            { label: 'Packages', value: trip.lrUnits || '--' },
            { label: 'LR Total Weight', value: trip.lrQty ? `${trip.lrQty} MT` : '--' },
        ]
    },
    {
        title: 'Activity Timeline',
        icon: Activity,
        items: [
            { label: 'Assignment Date', value: formatSafeDate(trip.startDate, 'PPpp') },
            { label: 'Vehicle Out Date', value: formatSafeDate(trip.outDate, 'PPpp') },
            { label: 'Arrival at Site', value: formatSafeDate(trip.arrivalDate, 'PPpp') },
            { label: 'Mission Completion', value: formatSafeDate(trip.actualCompletionDate, 'PPpp') },
            { label: 'POD Type', value: trip.podType || 'Pending', bold: true },
            { label: 'Assigned By', value: trip.userName || 'System' },
        ]
    }
  ];

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col p-0 border-none shadow-3xl overflow-hidden bg-white">
        <DialogHeader className="p-6 bg-slate-900 text-white shrink-0">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-600 rounded-lg"><MonitorPlay className="h-5 w-5" /></div>
                <div>
                    <DialogTitle className="text-xl font-black uppercase tracking-tight">Trip SIKKA LMC Summary</DialogTitle>
                    <DialogDescription className="text-blue-300 font-bold uppercase text-[9px] tracking-widest mt-1">Permanent Registry Record</DialogDescription>
                </div>
            </div>
            <Badge className="bg-emerald-600 font-black uppercase tracking-widest text-[9px] px-4 py-1.5 border-none shadow-lg">
                Verified Registry
            </Badge>
          </div>
        </DialogHeader>

        <ScrollArea className="flex-1 overflow-y-auto">
            <div className="p-8 space-y-12">
                {sections.map((section, idx) => (
                    <div key={idx} className="space-y-6">
                        <h3 className="text-xs font-black uppercase tracking-[0.3em] text-slate-400 flex items-center gap-2 px-1">
                            <section.icon className="h-4 w-4 text-blue-600" />
                            {section.title}
                        </h3>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-x-12 gap-y-8 p-8 bg-slate-50/50 rounded-3xl border border-slate-100 shadow-inner">
                            {section.items.map((item, i) => (
                                <div key={i} className="flex flex-col gap-1.5">
                                    <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">{item.label}</span>
                                    <span className={cn(
                                        "text-sm font-bold text-slate-800 break-words",
                                        item.mono && "font-mono tracking-tighter text-blue-700",
                                        item.bold && "font-black"
                                    )}>
                                        {item.value || '--'}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                ))}

                {trip.podReceived && trip.podUrl && (
                    <div className="space-y-6">
                        <h3 className="text-xs font-black uppercase tracking-[0.3em] text-slate-400 flex items-center gap-2 px-1">
                            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                            Digital Proof of Delivery
                        </h3>
                        <div className="p-4 bg-white rounded-3xl border-2 border-slate-100 shadow-xl overflow-hidden group relative">
                            <div className="aspect-[4/3] relative rounded-2xl overflow-hidden bg-slate-200">
                                {trip.podUrl.startsWith('data:application/pdf') ? (
                                    <iframe src={trip.podUrl} className="w-full h-full border-none" />
                                ) : (
                                    <img src={trip.podUrl} alt="POD Document" className="w-full h-full object-contain" />
                                )}
                            </div>
                            <div className="absolute inset-0 bg-slate-900/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none">
                                <Button variant="secondary" className="font-black uppercase text-[10px] tracking-widest gap-2">
                                    <Eye className="h-4 w-4" /> View Full Resolution
                                </Button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </ScrollArea>

        <DialogFooter className="p-6 bg-slate-50 border-t shrink-0">
          <Button onClick={onClose} className="bg-blue-900 hover:bg-slate-900 px-12 h-11 rounded-xl font-black uppercase text-[11px] tracking-widest border-none shadow-xl shadow-blue-100">
            Close Registry
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
