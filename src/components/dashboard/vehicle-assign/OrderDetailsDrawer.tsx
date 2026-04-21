
'use client';

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Package, ShieldCheck, Factory, UserCircle, MapPin, Calculator, Calendar, FileText, Clock, TrendingUp } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

interface OrderDetailsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  shipment: any;
}

export default function OrderDetailsDrawer({ isOpen, onClose, shipment }: OrderDetailsDrawerProps) {
  if (!shipment) return null;

  const creationDate = shipment.creationDate?.toDate ? shipment.creationDate.toDate() : new Date(shipment.creationDate);

  const detailNodes = [
    { label: 'Plant Node', value: shipment.plantName || shipment.originPlantId, icon: Factory },
    { label: 'Sales Order No', value: shipment.shipmentId, icon: FileText, bold: true, color: 'text-blue-700' },
    { label: 'Creation Pulse', value: format(creationDate, 'dd MMM yyyy | HH:mm'), icon: Clock },
    { label: 'Aggregate Weight', value: `${shipment.quantity} MT`, icon: Calculator, bold: true },
    { label: 'Assigned Weight', value: `${shipment.assignedQty || 0} MT`, icon: ShieldCheck, color: 'text-emerald-600' },
    { label: 'Registry Balance', value: `${shipment.balanceQty || 0} MT`, icon: TrendingUp, color: 'text-orange-600' },
  ];

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl border-none shadow-3xl p-0 overflow-hidden bg-white rounded-[2.5rem]">
        <DialogHeader className="p-8 bg-slate-900 text-white shrink-0">
          <div className="flex justify-between items-center pr-12">
            <div className="flex items-center gap-5">
                <div className="p-3 bg-blue-600 rounded-2xl shadow-xl rotate-3">
                    <Package className="h-8 w-8 text-white" />
                </div>
                <div>
                    <DialogTitle className="text-2xl font-black uppercase tracking-tight italic leading-none">Order Payload Registry</DialogTitle>
                    <DialogDescription className="text-blue-300 font-bold uppercase text-[9px] tracking-widest mt-2">Mission Manifest: {shipment.shipmentId}</DialogDescription>
                </div>
            </div>
            <Badge className="bg-emerald-600 font-black uppercase tracking-[0.2em] text-[10px] px-6 h-8 border-none">Verified Node</Badge>
          </div>
        </DialogHeader>

        <ScrollArea className="max-h-[70vh] p-8 bg-[#f8fafc]">
            <div className="space-y-10">
                <div className="grid grid-cols-2 md:grid-cols-3 gap-8 p-10 bg-white rounded-[2rem] border-2 border-slate-100 shadow-xl relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-2 h-full bg-blue-900" />
                    {detailNodes.map((node, i) => (
                        <div key={i} className="space-y-1.5">
                            <span className="text-[9px] font-black uppercase text-slate-400 tracking-widest flex items-center gap-2">
                                <node.icon className="h-3 w-3" /> {node.label}
                            </span>
                            <p className={cn(
                                "text-sm uppercase leading-tight",
                                node.bold ? "font-black text-slate-900" : "font-bold text-slate-700",
                                node.color
                            )}>{node.value}</p>
                        </div>
                    ))}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                    <div className="space-y-6">
                        <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-[0.2em] px-2">Entity Handshake</h4>
                        <div className="p-8 bg-white rounded-[2.5rem] border border-slate-200 shadow-md space-y-8">
                            <div className="space-y-2">
                                <span className="text-[8px] font-black uppercase text-blue-600">Consignor Registry</span>
                                <p className="text-sm font-black text-slate-900 uppercase">{shipment.consignor}</p>
                                <p className="text-[10px] font-bold text-slate-400 uppercase flex items-center gap-2"><MapPin className="h-3 w-3" /> {shipment.loadingPoint}</p>
                            </div>
                            <Separator />
                            <div className="space-y-2">
                                <span className="text-[8px] font-black uppercase text-emerald-600">Consignee Registry</span>
                                <p className="text-sm font-black text-slate-900 uppercase">{shipment.billToParty}</p>
                                <p className="text-[10px] font-bold text-slate-400 uppercase flex items-center gap-2"><MapPin className="h-3 w-3" /> {shipment.unloadingPoint}</p>
                            </div>
                        </div>
                    </div>

                    <div className="space-y-6">
                        <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-[0.2em] px-2">Assigned Mission Logs</h4>
                        <div className="p-8 bg-white rounded-[2.5rem] border border-slate-200 shadow-md min-h-[200px] flex flex-col">
                            {(shipment.linkedTrips || []).length === 0 ? (
                                <div className="flex-1 flex flex-col items-center justify-center gap-3 opacity-30 grayscale">
                                    <Clock className="h-10 w-10 text-slate-400" />
                                    <span className="text-[10px] font-black uppercase tracking-widest">Awaiting fleet assignment</span>
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    {shipment.linkedTrips.map((trip: any, i: number) => (
                                        <div key={i} className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100 hover:border-blue-200 transition-all group">
                                            <div className="flex items-center gap-4">
                                                <div className="p-2 bg-white rounded-lg shadow-sm border group-hover:bg-blue-900 group-hover:text-white transition-colors"><Truck className="h-4 w-4" /></div>
                                                <div className="flex flex-col">
                                                    <span className="text-xs font-black uppercase text-slate-900">{trip.vehicleNumber}</span>
                                                    <span className="text-[9px] font-mono text-slate-400 font-bold">Node: {trip.tripId}</span>
                                                </div>
                                            </div>
                                            <span className="text-sm font-black text-blue-900 tracking-tighter">{trip.assignedQtyInTrip} MT</span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </ScrollArea>

        <DialogFooter className="p-8 bg-slate-50 border-t shrink-0 flex-row justify-end gap-4">
            <Button onClick={onClose} className="bg-slate-900 hover:bg-black text-white px-12 h-12 rounded-xl font-black uppercase text-[10px] tracking-widest shadow-xl border-none transition-all active:scale-95">
                Close Registry
            </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
