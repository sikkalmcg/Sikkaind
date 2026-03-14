'use client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { format, isValid } from 'date-fns';
import { Truck, Package, Info, History, User } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Timestamp } from "firebase/firestore";

interface OrderDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  shipment: any;
  onAssign?: () => void;
}

const formatSafeDate = (date: any, formatStr: string) => {
    if (!date) return 'N/A';
    try {
        const d = date instanceof Timestamp ? date.toDate() : new Date(date);
        if (!isValid(d)) return 'N/A';
        return format(d, formatStr);
    } catch (e) {
        return 'N/A';
    }
}

export default function OrderDetailsModal({ isOpen, onClose, shipment, onAssign }: OrderDetailsModalProps) {
  const isCancelled = shipment.currentStatusId === 'Cancelled' || shipment.currentStatusId === 'Short Closed';

  const details = [
    { label: "Plant", value: shipment.plantName, icon: Info },
    { label: "Shipment ID", value: shipment.shipmentId, icon: Package },
    { label: "Order Date", value: formatSafeDate(shipment.creationDate, 'PPpp'), icon: History },
    { label: "Consignor", value: shipment.consignor, icon: User },
    { label: "Consignee", value: shipment.billToParty, icon: User },
    { label: "Ship To Party", value: shipment.shipToParty, icon: User },
    { label: "FROM", value: shipment.loadingPoint, icon: Package },
    { label: "Destination", value: shipment.unloadingPoint, icon: Package },
    { label: "Order Qty", value: `${shipment.quantity} MT`, icon: Truck },
    { label: "Balance Qty", value: `${shipment.balanceQty} MT`, icon: Truck, isHighlight: true },
    { label: "Status", value: shipment.currentStatusId, icon: Info, isStatus: true },
    { label: "Created By", value: shipment.userName || 'System', icon: User },
  ];

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl p-0 overflow-hidden border-none shadow-2xl">
        <DialogHeader className="p-6 bg-slate-50 border-b">
          <div className="flex justify-between items-center">
            <div>
                <DialogTitle className="text-2xl font-bold text-blue-900">Sale Order Details</DialogTitle>
                <DialogDescription className="font-mono text-xs uppercase tracking-widest mt-1">Registry Ref: {shipment.shipmentId}</DialogDescription>
            </div>
            <Badge variant="outline" className={cn("text-xs px-3 py-1 font-black uppercase", 
                shipment.currentStatusId === 'Cancelled' ? 'bg-red-50 text-red-700 border-red-200' : 
                shipment.currentStatusId === 'Short Closed' ? 'bg-orange-50 text-orange-700 border-orange-200' :
                'bg-blue-50 text-blue-700 border-blue-200'
            )}>
                {shipment.currentStatusId}
            </Badge>
          </div>
        </DialogHeader>

        <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-8 max-h-[60vh] overflow-y-auto">
            {/* LEFT: CORE INFO */}
            <div className="space-y-6">
                <h3 className="text-sm font-bold uppercase tracking-widest text-slate-400 flex items-center gap-2">
                    <Info className="h-4 w-4" /> Shipment Particulars
                </h3>
                <div className="grid grid-cols-2 gap-y-6 gap-x-4">
                    {details.map((d, i) => (
                        <div key={i} className={cn("space-y-1", d.isHighlight && "col-span-2 p-3 bg-red-50 rounded-lg border border-red-100")}>
                            <p className="text-[10px] font-bold uppercase text-muted-foreground">{d.label}</p>
                            <p className={cn("text-sm font-semibold text-slate-800", d.isHighlight && "text-red-700 text-lg")}>{d.value || '--'}</p>
                        </div>
                    ))}
                </div>
            </div>

            {/* RIGHT: ASSIGNED VEHICLES */}
            <div className="space-y-6 border-l pl-8">
                <h3 className="text-sm font-bold uppercase tracking-widest text-slate-400 flex items-center gap-2">
                    <Truck className="h-4 w-4" /> Assigned Vehicle Details
                </h3>
                
                <div className="space-y-3">
                    {shipment.linkedTrips && shipment.linkedTrips.length > 0 ? (
                        shipment.linkedTrips.map((t: any) => (
                            <div key={t.id} className="flex items-center justify-between p-4 rounded-xl border bg-white shadow-sm hover:shadow-md transition-shadow">
                                <div className="flex items-center gap-4">
                                    <div className="bg-blue-50 p-2 rounded-lg"><Truck className="h-5 w-5 text-blue-600" /></div>
                                    <div>
                                        <p className="text-sm font-black text-slate-900 tracking-tighter">{t.vehicleNumber}</p>
                                        <p className="text-[10px] font-medium text-slate-500 uppercase">{t.carrier}</p>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <p className="text-sm font-bold text-blue-700">{t.assignedQtyInTrip} MT</p>
                                    <p className="text-[10px] text-slate-400 font-mono uppercase">{t.currentStatusId}</p>
                                </div>
                            </div>
                        ))
                    ) : (
                        <div className="flex flex-col items-center justify-center py-12 px-4 rounded-xl border-2 border-dashed bg-slate-50 text-center">
                            <Truck className="h-8 w-8 text-slate-300 mb-2 opacity-50" />
                            <p className="text-sm font-medium text-slate-500 italic">Vehicle not yet assigned to this order.</p>
                            {!isCancelled && shipment.balanceQty > 0 && (
                                <Button variant="link" onClick={onAssign} className="text-blue-600 text-xs font-bold uppercase mt-2">Assign Vehicle Now</Button>
                            )}
                        </div>
                    )}
                </div>

                {isCancelled && (
                    <div className="p-4 rounded-lg bg-red-50 border border-red-100 mt-8">
                        <p className="text-xs font-bold text-red-800 uppercase mb-1">Cancellation Record</p>
                        <div className="text-sm space-y-1 text-red-700 font-medium">
                            <p>Actioned By: {shipment.cancelledBy || shipment.shortClosedBy || 'N/A'}</p>
                            <p>Time: {formatSafeDate(shipment.cancelledAt || shipment.shortClosedAt, 'PPpp')}</p>
                        </div>
                    </div>
                )}
            </div>
        </div>

        <DialogFooter className="p-4 bg-slate-50 border-t gap-3 sm:justify-end">
          <Button variant="outline" onClick={onClose}>Close Registry View</Button>
          {!isCancelled && shipment.balanceQty > 0 && (
            <Button onClick={onAssign} className="bg-blue-700 hover:bg-blue-800 shadow-md">Assign More Qty</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
