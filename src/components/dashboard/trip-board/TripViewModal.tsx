'use client';

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { 
    Truck, 
    ShieldCheck, 
    Factory, 
    UserCircle, 
    MapPin, 
    Calculator, 
    Calendar, 
    FileText, 
    Clock, 
    Smartphone, 
    User, 
    History,
    IndianRupee,
    Navigation,
    TrendingUp,
    Package
} from 'lucide-react';
import { format, isValid } from 'date-fns';
import { cn } from '@/lib/utils';
import { Timestamp } from 'firebase/firestore';

interface TripViewModalProps {
  isOpen: boolean;
  onClose: () => void;
  trip: any;
}

const formatSafeDate = (date: any, formatStr: string = 'dd MMM yyyy | HH:mm') => {
    if (!date) return '--';
    const d = date instanceof Timestamp ? date.toDate() : new Date(date);
    return isValid(d) ? format(d, formatStr) : '--';
}

const DetailRow = ({ label, value, icon: Icon, color, bold }: any) => (
    <div className="space-y-1.5">
        <span className="text-[9px] font-black uppercase text-slate-400 tracking-widest flex items-center gap-2">
            {Icon && <Icon className="h-3 w-3" />} {label}
        </span>
        <p className={cn(
            "text-sm uppercase leading-tight truncate",
            bold ? "font-black text-slate-900" : "font-bold text-slate-600",
            color
        )}>{value || '--'}</p>
    </div>
);

export default function TripViewModal({ isOpen, onClose, trip }: TripViewModalProps) {
  if (!trip) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-5xl border-none shadow-3xl p-0 overflow-hidden bg-white rounded-[3rem]">
        <DialogHeader className="p-8 bg-slate-900 text-white shrink-0">
          <div className="flex justify-between items-center pr-12">
            <div className="flex items-center gap-5">
                <div className="p-3 bg-blue-600 rounded-2xl shadow-xl rotate-3">
                    <Navigation className="h-8 w-8 text-white" />
                </div>
                <div>
                    <DialogTitle className="text-2xl font-black uppercase tracking-tight italic leading-none">Mission Hub Registry</DialogTitle>
                    <DialogDescription className="text-blue-300 font-bold uppercase text-[9px] tracking-widest mt-2">Asset Node Manifest: {trip.tripId}</DialogDescription>
                </div>
            </div>
            <div className="flex items-center gap-4">
                <Badge className="bg-white/10 border-white/10 text-emerald-400 font-black uppercase text-[10px] px-6 h-8 border-none">Authenticated Log</Badge>
            </div>
          </div>
        </DialogHeader>

        <ScrollArea className="max-h-[75vh] p-10 bg-[#f8fafc]">
            <div className="space-y-12">
                {/* 1. CORE MISSION PARTICULARS */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-8 p-10 bg-white rounded-[2.5rem] border-2 border-slate-100 shadow-xl relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-2 h-full bg-blue-900" />
                    <DetailRow label="Trip ID Node" value={trip.tripId} icon={FileText} bold color="text-blue-700" />
                    <DetailRow label="Mission Start" value={formatSafeDate(trip.startDate)} icon={Calendar} />
                    <DetailRow label="Vehicle Registry" value={trip.vehicleNumber} icon={Truck} bold />
                    <DetailRow label="Fleet Category" value={trip.vehicleType} icon={ShieldCheck} />
                    <DetailRow label="Lifting Node" value={trip.plantName} icon={Factory} />
                    <DetailRow label="Unloading Point" value={trip.unloadingPoint} icon={MapPin} />
                    <DetailRow label="Assigned Quantity" value={`${trip.assignedQtyInTrip} MT`} icon={Calculator} bold color="text-emerald-600" />
                    <DetailRow label="Operator Node" value={trip.userName} icon={UserCircle} />
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
                    {/* 2. PILOT & CARRIER INFO */}
                    <div className="lg:col-span-5 space-y-6">
                        <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-[0.2em] px-4 flex items-center gap-2">
                            <User className="h-3 w-3" /> Pilot & Agent Registry
                        </h4>
                        <div className="p-8 bg-white rounded-[2.5rem] border border-slate-200 shadow-lg space-y-8">
                            <div className="flex items-center gap-5">
                                <div className="p-3 bg-slate-50 rounded-2xl border"><User className="h-5 w-5 text-slate-400" /></div>
                                <div className="space-y-1">
                                    <span className="text-[8px] font-black uppercase text-slate-400">Pilot Name</span>
                                    <p className="text-sm font-black text-slate-900 uppercase">{trip.driverName || 'N/A'}</p>
                                </div>
                            </div>
                            <Separator />
                            <div className="flex items-center gap-5">
                                <div className="p-3 bg-slate-50 rounded-2xl border"><Smartphone className="h-5 w-5 text-slate-400" /></div>
                                <div className="space-y-1">
                                    <span className="text-[8px] font-black uppercase text-slate-400">Pilot Mobile</span>
                                    <p className="text-sm font-black text-slate-900 font-mono tracking-tighter">{trip.driverMobile || 'N/A'}</p>
                                </div>
                            </div>
                            <Separator />
                            <div className="flex items-center gap-5">
                                <div className="p-3 bg-blue-50 rounded-2xl border border-blue-100"><ShieldCheck className="h-5 w-5 text-blue-600" /></div>
                                <div className="space-y-1">
                                    <span className="text-[8px] font-black uppercase text-slate-400">Carrier Agent</span>
                                    <p className="text-sm font-black text-blue-900 uppercase">{trip.carrier || 'Self Registry'}</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* 3. LOGISTICS MANIFEST (SALE ORDER LINK) */}
                    <div className="lg:col-span-7 space-y-6">
                        <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-[0.2em] px-4 flex items-center gap-2">
                            <Package className="h-3 w-3" /> Sale Order manifest
                        </h4>
                        <div className="p-8 bg-slate-900 text-white rounded-[2.5rem] shadow-2xl relative overflow-hidden group">
                            <div className="absolute top-0 right-0 p-8 opacity-[0.03] rotate-12 transition-transform duration-1000 group-hover:scale-110"><FileText size={180} /></div>
                            <div className="space-y-10 relative z-10">
                                <div className="flex items-start justify-between">
                                    <div className="space-y-1.5">
                                        <span className="text-[8px] font-black uppercase text-slate-500 tracking-widest">Order ID Registry</span>
                                        <p className="text-xl font-black text-blue-400 font-mono tracking-tighter">{trip.shipmentId}</p>
                                    </div>
                                    <div className="text-right space-y-1.5">
                                        <span className="text-[8px] font-black uppercase text-slate-500 tracking-widest">Mission Status</span>
                                        <Badge className="bg-blue-600 text-white font-black uppercase text-[10px] px-4 h-6 border-none shadow-lg">{trip.tripStatus}</Badge>
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-10 pt-10 border-t border-white/5">
                                    <div className="space-y-4">
                                        <div className="space-y-1">
                                            <span className="text-[8px] font-black uppercase text-slate-500">Consignor Registry</span>
                                            <p className="text-[11px] font-black text-white uppercase truncate">{trip.consignor}</p>
                                        </div>
                                        <div className="space-y-1">
                                            <span className="text-[8px] font-black uppercase text-slate-500">Consignee Registry</span>
                                            <p className="text-[11px] font-black text-white uppercase truncate">{trip.billToParty}</p>
                                        </div>
                                    </div>
                                    <div className="space-y-4 text-right">
                                        <div className="space-y-1">
                                            <span className="text-[8px] font-black uppercase text-slate-500">Total Order Qty</span>
                                            <p className="text-sm font-black text-white">{trip.orderQty} MT</p>
                                        </div>
                                        <div className="space-y-1">
                                            <span className="text-[8px] font-black uppercase text-slate-500">LMC Node Dispatch</span>
                                            <p className="text-sm font-black text-emerald-400">{trip.assignedQtyInTrip} MT</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* 4. FINANCIAL SUMMARY (MARKET ONLY) */}
                {trip.vehicleType === 'Market Vehicle' && (
                    <section className="space-y-6">
                        <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-[0.2em] px-4 flex items-center gap-2">
                            <IndianRupee className="h-3 w-3" /> Financial Settlement Node
                        </h4>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 p-10 bg-white rounded-[2.5rem] border-2 border-slate-100 shadow-xl">
                            <DetailRow label="Freight Rate" value={`₹ ${trip.freightRate?.toLocaleString() || '--'}`} icon={TrendingUp} color="text-slate-900" bold />
                            <DetailRow label="Total Trip Freight" value={`₹ ${trip.freightAmount?.toLocaleString() || '--'}`} icon={Calculator} color="text-blue-900" bold />
                            <div className="space-y-1.5">
                                <span className="text-[9px] font-black uppercase text-slate-400 tracking-widest flex items-center gap-2"><History className="h-3 w-3" /> Payment Status</span>
                                <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-100 font-black uppercase text-[10px] px-4 h-7">{trip.freightStatus || 'Pending'}</Badge>
                            </div>
                        </div>
                    </section>
                )}
            </div>
        </ScrollArea>

        <DialogFooter className="p-8 bg-slate-50 border-t shrink-0 flex-row justify-end gap-4">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mr-auto flex items-center gap-2 italic">
                <ShieldCheck className="h-4 w-4 text-emerald-600" /> Authorized Registry Handshake Synchronized
            </p>
            <Button onClick={onClose} className="bg-slate-900 hover:bg-black text-white px-12 h-12 rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-xl border-none transition-all active:scale-95">
                Close manifest
            </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
