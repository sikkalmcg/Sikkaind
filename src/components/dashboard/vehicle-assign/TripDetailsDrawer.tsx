'use client';

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Truck, ShieldCheck, Factory, UserCircle, MapPin, Calculator, Calendar, FileText, Clock, Smartphone, User, History } from 'lucide-react';
import { format, isValid } from 'date-fns';
import { cn } from '@/lib/utils';
import { Timestamp } from 'firebase/firestore';

interface TripDetailsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  trip: any;
}

/**
 * @fileOverview SIKKA LMC - Mission Node Registry View.
 * Specialized read-only drawer for inspecting specific trip particulars.
 */
export default function TripDetailsDrawer({ isOpen, onClose, trip }: TripDetailsDrawerProps) {
  if (!trip) return null;

  const startDate = trip.startDate?.toDate ? trip.startDate.toDate() : new Date(trip.startDate);

  const detailNodes = [
    { label: 'Lifting Node', value: trip.plantName || trip.originPlantId, icon: Factory },
    { label: 'Registry Trip ID', value: trip.tripId, icon: FileText, bold: true, color: 'text-blue-700' },
    { label: 'Mission Start', value: isValid(startDate) ? format(startDate, 'dd MMM yyyy | HH:mm') : '--', icon: Clock },
    { label: 'Vehicle Number', value: trip.vehicleNumber, icon: Truck, bold: true },
    { label: 'Fleet Category', value: trip.vehicleType, icon: ShieldCheck, badge: true },
    { label: 'Assigned Username', value: trip.userName || 'System', icon: UserCircle },
  ];

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl border-none shadow-3xl p-0 overflow-hidden bg-white rounded-[2.5rem]">
        <DialogHeader className="p-8 bg-slate-900 text-white shrink-0">
          <div className="flex justify-between items-center pr-12">
            <div className="flex items-center gap-5">
                <div className="p-3 bg-emerald-600 rounded-2xl shadow-xl rotate-3">
                    <Truck className="h-8 w-8 text-white" />
                </div>
                <div>
                    <DialogTitle className="text-2xl font-black uppercase tracking-tight italic leading-none">Mission Node Manifest</DialogTitle>
                    <DialogDescription className="text-emerald-300 font-bold uppercase text-[9px] tracking-widest mt-2">Active Trip: {trip.tripId}</DialogDescription>
                </div>
            </div>
            <Badge className="bg-blue-600 font-black uppercase tracking-[0.2em] text-[10px] px-6 h-8 border-none">Verified Asset</Badge>
          </div>
        </DialogHeader>

        <ScrollArea className="max-h-[70vh] p-8 bg-[#f8fafc]">
            <div className="space-y-10">
                <div className="grid grid-cols-2 md:grid-cols-3 gap-8 p-10 bg-white rounded-[2rem] border-2 border-slate-100 shadow-xl">
                    {detailNodes.map((node, i) => (
                        <div key={i} className="space-y-1.5">
                            <span className="text-[9px] font-black uppercase text-slate-400 tracking-widest flex items-center gap-2">
                                <node.icon className="h-3 w-3" /> {node.label}
                            </span>
                            {node.badge ? (
                                <Badge variant="outline" className="bg-slate-50 text-slate-600 font-black text-[10px] uppercase border-slate-200 mt-1">{node.value}</Badge>
                            ) : (
                                <p className={cn(
                                    "text-sm uppercase leading-tight",
                                    node.bold ? "font-black text-slate-900" : "font-bold text-slate-600",
                                    node.color
                                )}>{node.value}</p>
                            )}
                        </div>
                    ))}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                    <div className="space-y-6">
                        <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-[0.2em] px-2">Pilot & Crew Registry</h4>
                        <div className="p-8 bg-white rounded-[2.5rem] border border-slate-200 shadow-md space-y-8">
                            <div className="flex items-start gap-5">
                                <div className="p-3 bg-slate-50 rounded-2xl border"><User className="h-5 w-5 text-slate-400" /></div>
                                <div className="space-y-1">
                                    <span className="text-[8px] font-black uppercase text-slate-400">Driver Name</span>
                                    <p className="text-sm font-black text-slate-900 uppercase">{trip.driverName || 'N/A'}</p>
                                </div>
                            </div>
                            <Separator />
                            <div className="flex items-start gap-5">
                                <div className="p-3 bg-slate-50 rounded-2xl border"><Smartphone className="h-5 w-5 text-slate-400" /></div>
                                <div className="space-y-1">
                                    <span className="text-[8px] font-black uppercase text-slate-400">Mobile Node</span>
                                    <p className="text-sm font-black text-slate-900 font-mono tracking-tighter">{trip.driverMobile || 'N/A'}</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="space-y-6">
                        <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-[0.2em] px-2">Manifest Particulars</h4>
                        <div className="p-8 bg-slate-900 text-white rounded-[2.5rem] border border-slate-800 shadow-2xl relative overflow-hidden group">
                            <div className="absolute top-0 right-0 p-8 opacity-[0.03] rotate-12 transition-transform duration-1000 group-hover:scale-110"><History size={140} /></div>
                            <div className="space-y-8 relative z-10">
                                <div className="space-y-1.5">
                                    <span className="text-[8px] font-black uppercase text-slate-500">Transporter Node</span>
                                    <p className="text-sm font-black text-emerald-400 uppercase">{trip.transporterName || 'Self Registry'}</p>
                                </div>
                                <div className="grid grid-cols-2 gap-6 pt-4 border-t border-white/5">
                                    <div className="space-y-1">
                                        <span className="text-[8px] font-black uppercase text-slate-500">Manifest Weight</span>
                                        <p className="text-lg font-black text-white">{trip.assignedQtyInTrip} MT</p>
                                    </div>
                                    <div className="space-y-1 text-right">
                                        <span className="text-[8px] font-black uppercase text-slate-500">Node Status</span>
                                        <Badge className="bg-blue-600 text-white font-black uppercase text-[8px] px-3 h-5 border-none shadow-sm">{trip.tripStatus}</Badge>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </ScrollArea>

        <DialogFooter className="p-8 bg-slate-50 border-t shrink-0 flex-row justify-end gap-4">
            <span className="text-[9px] font-black uppercase text-slate-400 tracking-widest mr-auto flex items-center gap-2 italic">
                <ShieldCheck className="h-4 w-4 text-emerald-600" /> Registry Sync OK
            </span>
            <Button onClick={onClose} className="bg-slate-900 hover:bg-black text-white px-12 h-12 rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-xl border-none transition-all active:scale-95">
                Close Manifest
            </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
