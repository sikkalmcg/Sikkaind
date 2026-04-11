'use client';

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { EnrichedTrip } from '@/app/dashboard/shipment-summary/page';
import { format, differenceInHours, isValid } from 'date-fns';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { useMemo } from 'react';
import { Timestamp } from 'firebase/firestore';
import { ShieldCheck, FileText } from 'lucide-react';

interface ShipmentSummaryModalProps {
  isOpen: boolean;
  onClose: () => void;
  trip: EnrichedTrip;
}

/**
 * Registry Logic: Safe Date Handshake
 * Converts Firestore Timestamps or strings to valid Date objects.
 */
const getSafeDate = (date: any): Date | null => {
    if (!date) return null;
    try {
        if (date instanceof Timestamp) return date.toDate();
        if (typeof date?.toDate === 'function') return date.toDate();
        const d = new Date(date);
        return isValid(d) ? d : null;
    } catch (e) {
        return null;
    }
};

const formatSafeDate = (date: any, formatStr: string) => {
    const d = getSafeDate(date);
    if (!d) return 'N/A';
    return format(d, formatStr);
};

const DetailItem = ({ label, value }: { label: string; value: React.ReactNode }) => (
    <div>
        <p className="font-medium text-muted-foreground text-[10px] font-black uppercase tracking-widest mb-1">{label}</p>
        <div className="font-bold text-slate-800 text-sm">{value || 'N/A'}</div>
    </div>
);

export default function ShipmentSummaryModal({ isOpen, onClose, trip }: ShipmentSummaryModalProps) {
    const outDate = getSafeDate(trip.outDate);
    const arrivalDate = getSafeDate(trip.arrivalDate);
    const transitTimeHours = outDate && arrivalDate ? differenceInHours(arrivalDate, outDate) : 0;
    
    // Logic for new fields derived from LR (Lorry Receipt) with safety checks
    const lrCalculations = useMemo(() => {
        if (!trip.lrData || !trip.lrData.items) {
            return { 
                invoiceNumbers: 'N/A', 
                totalPackages: 'N/A', 
                totalActualWeight: `${trip.assignedQtyInTrip.toFixed(3)} ${trip.shipment.materialTypeId}` 
            };
        }
        
        const items = trip.lrData.items || [];
        const invoices = items.map(i => i.invoiceNumber).filter(Boolean);
        const uniqueInvoices = Array.from(new Set(invoices)).join(', ');
        
        const packages = items.reduce((sum, i) => sum + (Number(i.units) || 0), 0);
        
        const actualWeight = trip.assignedQtyInTrip;

        return {
            invoiceNumbers: uniqueInvoices || 'N/A',
            totalPackages: packages || 'N/A',
            totalActualWeight: `${actualWeight.toFixed(3)} ${trip.shipment.materialTypeId}`
        };
    }, [trip.lrData, trip.shipment.materialTypeId, trip.assignedQtyInTrip]);

    const shortageExcess = trip.assignedQtyInTrip - (trip.unloadQty ?? 0);
    
    const details = [
        { label: "Carrier", value: trip.carrier?.name },
        { label: "Shipment ID", value: <span className="text-blue-700 font-mono">{trip.shipment.shipmentId}</span> },
        { label: "Shipment Create Date/Time", value: formatSafeDate(trip.shipment.creationDate, 'PPpp') },
        { label: "Trip ID", value: <span className="text-blue-700 font-mono">{trip.tripId}</span> },
        { label: "Trip Create Date/Time", value: formatSafeDate(trip.startDate, 'PPpp') },
        { label: "LR No", value: <span className="font-black">{trip.lrNumber}</span> },
        { label: "LR Date", value: formatSafeDate(trip.lrDate, 'PP') },
        { label: "Invoice Number", value: lrCalculations.invoiceNumbers },
        { label: "Vehicle Number", value: <span className="font-black uppercase tracking-tighter">{trip.vehicleNumber}</span> },
        { label: "Driver Mobile", value: <span className="font-mono">{trip.driverMobile}</span> },
        { label: "Consignor", value: trip.shipment.consignor },
        { label: "Buyer", value: trip.shipment.billToParty },
        { label: "Ship To Party", value: trip.shipment.shipToParty },
        { label: "Total Packages", value: lrCalculations.totalPackages },
        { label: "Assigned Weight", value: <span className="text-blue-900">{trip.assignedQtyInTrip.toFixed(3)} {trip.shipment.materialTypeId}</span> },
        { label: "Total Actual Weight", value: lrCalculations.totalActualWeight },
        { label: "Vehicle Out – Date/Time", value: formatSafeDate(trip.outDate, 'PPpp') },
        { label: "Transit Time", value: `${transitTimeHours} Hours` },
        {
            label: "Shortage / Excess",
            value: (
                <TooltipProvider>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <span className={cn(
                                "font-black text-lg tracking-tighter",
                                Math.abs(shortageExcess) > 0.001 ? (shortageExcess > 0 ? "text-red-600" : "text-blue-600") : "text-emerald-600"
                            )}>
                                {shortageExcess.toFixed(3)}
                            </span>
                        </TooltipTrigger>
                        <TooltipContent className="bg-slate-900 text-white border-none shadow-xl">
                            <p className="text-[10px] font-black uppercase tracking-widest">{shortageExcess > 0.001 ? "Shortage" : shortageExcess < -0.001 ? "Excess" : "Zero Variance"} Detected</p>
                        </TooltipContent>
                    </Tooltip>
                </TooltipProvider>
            )
        },
        { label: "Last Status", value: <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 font-black uppercase text-[10px]">{trip.currentStatusId}</Badge> },
        { label: "Last Status Date/Time", value: formatSafeDate(trip.lastUpdated || trip.startDate, 'PPpp') },
        {
            label: "POD Status", value: (
                <div className="flex items-center gap-2">
                    <Badge className={cn("text-[9px] font-black uppercase border-none shadow-sm px-3", trip.podReceived ? "bg-emerald-600 text-white" : "bg-red-600 text-white")}>
                        {trip.podReceived ? 'Received' : 'Pending'}
                    </Badge>
                    {trip.podReceived && trip.podUrl && (
                        <a href={trip.podUrl} target="_blank" rel="noopener noreferrer" className="text-[10px] font-black text-blue-600 hover:underline uppercase tracking-tighter">View Node</a>
                    )}
                </div>
            )
        },
    ];

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-5xl border-none shadow-3xl p-0 overflow-hidden bg-white">
                <DialogHeader className="p-6 bg-slate-900 text-white shrink-0">
                    <div className="flex justify-between items-center pr-12">
                        <div className="flex items-center gap-4">
                            <div className="p-3 bg-white/10 rounded-2xl backdrop-blur-md">
                                <FileText className="h-7 w-7 text-blue-400" />
                            </div>
                            <div>
                                <DialogTitle className="text-2xl font-black uppercase tracking-tight italic">Shipment Master Ledger</DialogTitle>
                                <DialogDescription className="text-blue-300 font-bold uppercase text-[9px] tracking-widest mt-1">
                                    Full Lifecycle Audit: Trip {trip.tripId}
                                </DialogDescription>
                            </div>
                        </div>
                        <Badge className="bg-emerald-600 font-black uppercase tracking-[0.2em] text-[10px] px-6 py-2 border-none">Verified Registry</Badge>
                    </div>
                </DialogHeader>

                <ScrollArea className="max-h-[70vh] p-8 bg-[#f8fafc]">
                    <div className="rounded-[2.5rem] border-2 border-slate-100 bg-white shadow-xl p-10">
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-y-10 gap-x-8">
                            {details.map(d => (
                                <DetailItem key={d.label} label={d.label} value={d.value} />
                            ))}
                        </div>
                    </div>
                </ScrollArea>

                <DialogFooter className="p-6 bg-slate-50 border-t shrink-0 flex-row justify-end gap-3">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mr-auto flex items-center gap-2">
                        <ShieldCheck className="h-4 w-4" /> Registry Sync: OK
                    </p>
                    <Button onClick={onClose} className="bg-slate-900 hover:bg-black text-white px-12 h-11 rounded-xl font-black uppercase text-[10px] tracking-widest shadow-xl border-none transition-all active:scale-95">
                        Close Manifest
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
