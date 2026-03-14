'use client';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { format } from 'date-fns';
import { Truck, Package, Info, History, User, MapPin, ClipboardList, ShieldCheck } from 'lucide-react';
import { cn } from '@/lib/utils';

interface OrderDetailsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  shipment: any;
}

export default function OrderDetailsDrawer({ isOpen, onClose, shipment }: OrderDetailsDrawerProps) {
  const details = [
    { label: "Plant Location", value: shipment.plantName, icon: MapPin },
    { label: "Shipment ID", value: shipment.shipmentId, icon: Package },
    { label: "Order Create Date", value: format(new Date(shipment.creationDate), 'PPpp'), icon: History },
    { label: "Consignor (Dispatch From)", value: shipment.consignor, icon: User },
    { label: "Consignee (Bill to)", value: shipment.billToParty, icon: User },
    { label: "Ship To Party", value: shipment.shipToParty, icon: User },
    { label: "FROM (Loading)", value: shipment.loadingPoint, icon: MapPin },
    { label: "Destination (Drop)", value: shipment.unloadingPoint, icon: MapPin },
    { label: "Total Order Qty", value: `${shipment.quantity} MT`, icon: Truck },
    { label: "Total Dispatched", value: `${shipment.dispatchQty || 0} MT`, icon: Truck },
    { label: "Remaining Balance", value: `${shipment.balanceQty} MT`, icon: Truck, highlight: true },
    { label: "Operational Status", value: shipment.currentStatusId, icon: Info },
    { label: "Plan Created By", value: shipment.userName || 'System', icon: User },
  ];

  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent className="sm:max-w-xl overflow-y-auto bg-white border-l-4 border-l-blue-900">
        <SheetHeader className="pb-6 border-b">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-blue-900 text-white rounded-lg"><ClipboardList className="h-5 w-5" /></div>
            <SheetTitle className="text-2xl font-black text-blue-900 uppercase">Sale Order Details</SheetTitle>
          </div>
          <SheetDescription className="font-mono text-[10px] uppercase tracking-widest text-slate-400">
            Internal Registry Ref: {shipment.shipmentId}
          </SheetDescription>
        </SheetHeader>

        <div className="py-8 space-y-10">
            <div className="space-y-6">
                <h3 className="text-xs font-black uppercase tracking-[0.2em] text-slate-400 flex items-center gap-2">
                    <ShieldCheck className="h-4 w-4 text-blue-600" /> Order Particulars
                </h3>
                <div className="grid grid-cols-2 gap-x-6 gap-y-8">
                    {details.map((d, i) => (
                        <div key={i} className={cn("space-y-1", d.highlight && "col-span-2 p-4 bg-red-50 rounded-xl border border-red-100")}>
                            <div className="flex items-center gap-2 text-slate-400 mb-1">
                                <d.icon className="h-3 w-3" />
                                <span className="text-[9px] font-black uppercase tracking-wider">{d.label}</span>
                            </div>
                            <p className={cn("text-sm font-bold text-slate-800", d.highlight && "text-red-700 text-xl tracking-tighter")}>
                                {d.value || '--'}
                            </p>
                        </div>
                    ))}
                </div>
            </div>

            <Separator className="bg-slate-100" />

            <div className="space-y-6">
                <h3 className="text-xs font-black uppercase tracking-[0.2em] text-slate-400 flex items-center gap-2">
                    <Truck className="h-4 w-4 text-blue-600" /> Linked Trip Registry
                </h3>
                <div className="space-y-3">
                    {shipment.linkedTrips && shipment.linkedTrips.length > 0 ? (
                        shipment.linkedTrips.map((t: any) => (
                            <div key={t.id} className="p-4 rounded-2xl border border-slate-200 bg-slate-50/50 hover:border-blue-200 hover:bg-blue-50/20 transition-all group">
                                <div className="flex justify-between items-start mb-3">
                                    <div className="flex items-center gap-3">
                                        <div className="h-10 w-10 bg-white rounded-full border border-slate-200 flex items-center justify-center font-black text-blue-900 shadow-sm group-hover:border-blue-400">
                                            <Truck className="h-5 w-5" />
                                        </div>
                                        <div>
                                            <p className="text-sm font-black text-slate-900 tracking-tighter uppercase">{t.vehicleNumber}</p>
                                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{t.carrier}</p>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-xs font-black text-blue-900">{t.assignedQtyInTrip} MT</p>
                                        <p className="text-[9px] font-bold text-slate-400 font-mono mt-0.5">{t.tripId}</p>
                                    </div>
                                </div>
                                <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                                    <Badge variant="outline" className="text-[9px] uppercase font-black bg-white border-slate-200">{t.currentStatusId}</Badge>
                                    <div className="flex flex-col items-end">
                                        <span className="text-[9px] font-bold text-slate-400 uppercase">{format(new Date(t.startDate), 'PP')}</span>
                                        <span className="text-[8px] font-black text-blue-600 uppercase tracking-tighter">Packages: {t.lrUnits || '--'}</span>
                                    </div>
                                </div>
                            </div>
                        ))
                    ) : (
                        <div className="flex flex-col items-center justify-center py-16 px-4 rounded-3xl border-2 border-dashed border-slate-200 bg-slate-50 text-center opacity-60">
                            <Package className="h-10 w-10 text-slate-300 mb-3" />
                            <p className="text-sm font-bold text-slate-500 uppercase tracking-widest">No active trips detected</p>
                            <p className="text-[10px] text-slate-400 mt-1 uppercase">Order is fully unassigned</p>
                        </div>
                    )}
                </div>
            </div>

            {(shipment.cancelledBy || shipment.shortClosedBy) && (
                <div className="p-6 rounded-2xl bg-red-50/50 border border-red-100 mt-4">
                    <div className="flex items-center gap-2 text-red-800 mb-4">
                        <History className="h-4 w-4" />
                        <h4 className="text-[10px] font-black uppercase tracking-widest">Revocation Audit Log</h4>
                    </div>
                    <div className="grid grid-cols-2 gap-4 text-xs">
                        <div><p className="text-red-400 font-bold uppercase text-[9px] mb-1">Actioned By</p><p className="font-bold text-red-900">{shipment.cancelledBy || shipment.shortClosedBy}</p></div>
                        <div><p className="text-red-400 font-bold uppercase text-[9px] mb-1">Timestamp</p><p className="font-bold text-red-900 font-mono">{format(new Date(shipment.cancelledAt || shipment.shortClosedAt), 'PPpp')}</p></div>
                        <div className="col-span-2 pt-2 border-t border-red-100"><p className="text-red-400 font-bold uppercase text-[9px] mb-1">Revoke Reason</p><p className="font-bold text-red-900 italic">"{shipment.cancelReason || 'Standard business requirement closure'}"</p></div>
                    </div>
                </div>
            )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
