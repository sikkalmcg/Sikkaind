'use client';

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { EnrichedFreight } from '@/app/dashboard/freight-management/page';
import { format } from 'date-fns';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';

interface ViewFreightModalProps {
  isOpen: boolean;
  onClose: () => void;
  freight: EnrichedFreight;
}

export default function ViewFreightModal({ isOpen, onClose, freight }: ViewFreightModalProps) {
  
  // Defensive Registry Handshake: Ensure arrays exist before length check
  const charges = freight.charges || [];
  const payments = freight.payments || [];

  const tripDetails = [
    { label: "Trip ID", value: freight.trip.tripId },
    { label: "LR Number", value: freight.trip.lrNumber || `LR-${freight.trip.tripId.slice(-4)}`},
    { label: "Vehicle Number", value: freight.trip.vehicleNumber },
    { label: "Transporter", value: freight.trip.transporterName },
    { label: "Loading Point", value: freight.trip.originPlantId },
    { label: "Unloading Point", value: freight.trip.unloadingPoint },
    { label: "Assigned Qty", value: `${(Number(freight.trip.assignedQtyInTrip) || 0).toFixed(3)} ${freight.shipment.materialTypeId}`},
    { label: "Freight Receiver", value: freight.trip.freightReceiverName },
    { label: "Account Number", value: freight.trip.accountNumber },
    { label: "IFSC", value: freight.trip.ifsc },
    { label: "POD Status", value: <Badge variant={freight.trip.podReceived ? 'default' : 'destructive'} className="font-black uppercase text-[9px]">{freight.trip.podReceived ? 'Received' : 'Pending'}</Badge>},
  ];

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col p-0 border-none shadow-3xl bg-white">
        <DialogHeader className="p-6 bg-slate-50 border-b">
          <DialogTitle className="text-xl font-black text-blue-900 uppercase italic">Freight Registry Summary</DialogTitle>
          <DialogDescription className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
            Read-only manifest for Trip ID: {freight.trip.tripId}
          </DialogDescription>
        </DialogHeader>
        
        <div className="flex-1 overflow-y-auto p-8 space-y-10">
            {/* CORE TRIP PARTICULARS */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-8 p-8 bg-slate-50/50 rounded-3xl border border-slate-100 shadow-inner">
                {tripDetails.map(d => (
                    <div key={d.label}>
                        <p className="text-[9px] font-black uppercase text-slate-400 mb-1 tracking-wider">{d.label}</p>
                        <div className="font-bold text-slate-800 text-[13px]">{d.value || 'N/A'}</div>
                    </div>
                ))}
            </div>
          
            {/* ADDITIONAL CHARGES REGISTRY */}
            <div className="space-y-4">
                <h3 className="text-xs font-black uppercase text-slate-400 tracking-[0.2em] px-1">Adjustments & Extra Charges</h3>
                <div className="border border-slate-200 rounded-2xl bg-white overflow-hidden shadow-sm">
                    <Table>
                        <TableHeader className="bg-slate-50">
                            <TableRow className="h-10 hover:bg-transparent">
                                <TableHead className="text-[9px] font-black uppercase px-6">Charge Metric</TableHead>
                                <TableHead className="text-[9px] font-black uppercase px-4">Amount (₹)</TableHead>
                                <TableHead className="text-[9px] font-black uppercase px-6">Audit Remark</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {charges.length > 0 ? (
                                charges.map((c, i) => (
                                    <TableRow key={c.id || i} className="h-12 border-b border-slate-50 last:border-0 font-medium text-slate-600">
                                        <TableCell className="px-6 font-bold">{c.type}</TableCell>
                                        <TableCell className="px-4 font-black text-blue-900">₹ {(Number(c.amount) || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</TableCell>
                                        <TableCell className="px-6 italic text-slate-400 font-normal">"{c.remark || '--'}"</TableCell>
                                    </TableRow>
                                ))
                            ) : (
                                <TableRow><TableCell colSpan={3} className="h-24 text-center text-slate-400 italic text-[13px]">No additional charges recorded node.</TableCell></TableRow>
                            )}
                        </TableBody>
                    </Table>
                </div>
            </div>
          
            {/* LIQUIDATION HISTORY */}
            <div className="space-y-4">
                <h3 className="text-xs font-black uppercase text-slate-400 tracking-[0.2em] px-1">Liquidation Payment History</h3>
                <div className="border border-slate-200 rounded-2xl bg-white overflow-hidden shadow-sm">
                    <Table>
                        <TableHeader className="bg-slate-50">
                            <TableRow className="h-10 hover:bg-transparent">
                                <TableHead className="text-[9px] font-black uppercase px-6">Sync Date</TableHead>
                                <TableHead className="text-[9px] font-black uppercase px-4">Bank Ref / UTR</TableHead>
                                <TableHead className="text-[9px] font-black uppercase px-4">Mode</TableHead>
                                <TableHead className="text-[9px] font-black uppercase px-6 text-right">Amount Liquidated</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {payments.length > 0 ? (
                                payments.map((p, i) => (
                                    <TableRow key={p.id || i} className="h-12 border-b border-slate-50 last:border-0 font-medium text-slate-600">
                                        <TableCell className="px-6">{p.paymentDate ? format(new Date(p.paymentDate), 'dd.MM.yyyy') : '--'}</TableCell>
                                        <TableCell className="px-4 font-mono text-[11px] font-black text-blue-700">{p.referenceNo || '--'}</TableCell>
                                        <TableCell className="px-4 text-[9px] font-black uppercase text-slate-400">{p.mode || '--'}</TableCell>
                                        <TableCell className="px-6 text-right font-black text-emerald-700">₹ {(Number(p.amount) || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</TableCell>
                                    </TableRow>
                                ))
                            ) : (
                                <TableRow><TableCell colSpan={4} className="h-24 text-center text-slate-400 italic text-[13px]">No payment nodes detected in history.</TableCell></TableRow>
                            )}
                        </TableBody>
                    </Table>
                </div>
            </div>
        </div>

        <DialogFooter className="p-6 bg-slate-50 border-t flex-row items-center justify-between sm:justify-between shrink-0">
            <Badge variant="outline" className="bg-white border-slate-200 text-slate-400 font-black uppercase text-[9px] px-4 py-1.5 shadow-sm">
                Verified Mission Log
            </Badge>
            <Button onClick={onClose} className="bg-blue-900 hover:bg-slate-900 px-12 h-11 rounded-xl font-black uppercase text-[10px] tracking-widest shadow-lg shadow-blue-100 border-none transition-all active:scale-95">
                Close Registry View
            </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
