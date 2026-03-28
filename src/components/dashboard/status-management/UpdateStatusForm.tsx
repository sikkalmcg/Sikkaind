
'use client';

import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { 
    Activity, 
    CheckCircle2, 
    AlertTriangle, 
    Loader2, 
    ShieldCheck, 
    History,
    Lock
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

interface UpdateStatusFormProps {
  activeTrips: any[];
  availableVehicles: any[];
  onStatusUpdate: (id: string, status: string, location: string, remarks?: string, isTrip?: boolean) => Promise<void>;
}

export default function UpdateStatusForm({ activeTrips, availableVehicles, onStatusUpdate }: UpdateStatusFormProps) {
  const [selectedId, setSelectedId] = useState('');
  const [newStatus, setNewStatus] = useState('');
  const [remarks, setRemarks] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [registryTime, setRegistryTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setRegistryTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const selectedTrip = useMemo(() => activeTrips.find(t => t.id === selectedId), [activeTrips, selectedId]);
  const selectedVehicle = useMemo(() => availableVehicles.find(v => v.id === selectedId), [availableVehicles, selectedId]);

  const currentStatusRaw = useMemo(() => {
    if (selectedTrip) return (selectedTrip.tripStatus || selectedTrip.currentStatusId || 'ASSIGNED');
    if (selectedVehicle) return (selectedVehicle.remarks || 'IN YARD');
    return '--';
  }, [selectedTrip, selectedVehicle]);

  const currentStatus = currentStatusRaw.toUpperCase();

  const isLockedAtGate = useMemo(() => {
    if (!selectedTrip) return false;
    // Mission Logic: Status change blocked until vehicle exits gate (status is Assigned)
    return currentStatus === 'ASSIGNED' || currentStatus === 'VEHICLE-ASSIGNED' || currentStatus === 'VEHICLE ASSIGNED';
  }, [selectedTrip, currentStatus]);

  const missionRegistryStatuses = [
    'Arrive For Deliver',
    'Break-Down',
    'Delivered',
    'Not Accept Return',
    'Out For Delivery',
    'Pilot Not Available'
  ];

  const maintenanceStatuses = [
    'Under Maintenance',
    'Break-Down',
    'Available'
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedId || !newStatus) return;

    setIsSubmitting(true);
    try {
        await onStatusUpdate(selectedId, newStatus, '', remarks, !!selectedTrip);
        setSelectedId('');
        setNewStatus('');
        setRemarks('');
    } finally {
        setIsSubmitting(false);
    }
  };

  return (
    <Card className="border-none shadow-2xl rounded-[3rem] bg-white overflow-hidden animate-in fade-in duration-700">
        <div className="bg-slate-50/50 p-8 border-b flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="flex items-center gap-5">
                <div className="p-3 bg-blue-900 text-white rounded-2xl shadow-xl rotate-3">
                    <Activity className="h-7 w-7" />
                </div>
                <div>
                    <h2 className="text-2xl font-black text-blue-900 uppercase italic tracking-tight">MANUAL TRANSITION NODE</h2>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">CONFIGURE MISSION STATUS PARTICULARS</p>
                </div>
            </div>

            <div className="p-4 bg-white rounded-2xl border border-slate-100 shadow-inner flex flex-col items-center min-w-[180px]">
                <span className="text-[8px] font-black uppercase text-slate-400 tracking-[0.2em] mb-1">REGISTRY TIMESTAMP</span>
                <p className="text-sm font-black text-blue-900 font-mono tracking-tighter">
                    {format(registryTime, 'dd-MM-yy')} <span className="text-slate-300 mx-1">|</span> {format(registryTime, 'HH:mm')}
                </p>
            </div>
        </div>

        <CardContent className="p-10">
            <form onSubmit={handleSubmit} className="space-y-12">
                <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
                    <div className="md:col-span-4 space-y-3">
                        <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest px-1">VEHICLE NUMBER *</Label>
                        <Select value={selectedId} onValueChange={(v) => { setSelectedId(v); setNewStatus(''); }}>
                            <SelectTrigger className="h-14 rounded-2xl font-black text-blue-900 border-slate-200 bg-white shadow-sm focus:ring-blue-900">
                                <SelectValue placeholder="Select active vehicle..." />
                            </SelectTrigger>
                            <SelectContent className="rounded-2xl">
                                {activeTrips.length > 0 && (
                                    <>
                                        <div className="px-4 py-2 text-[9px] font-black text-blue-600 uppercase bg-blue-50/50 rounded-lg mb-1">Active Missions</div>
                                        {activeTrips.map(t => (
                                            <SelectItem key={t.id} value={t.id} className="font-bold py-3 uppercase italic">
                                                {t.vehicleNumber} ({t.tripId})
                                            </SelectItem>
                                        ))}
                                    </>
                                )}
                                {availableVehicles.length > 0 && (
                                    <>
                                        <div className="px-4 py-2 text-[9px] font-black text-orange-600 uppercase bg-orange-50/50 rounded-lg my-1">Gate Presence</div>
                                        {availableVehicles.map(v => (
                                            <SelectItem key={v.id} value={v.id} className="font-bold py-3 uppercase italic">
                                                {v.vehicleNumber} (In Yard)
                                            </SelectItem>
                                        ))}
                                    </>
                                )}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="md:col-span-4 space-y-3">
                        <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest px-1">LATEST REGISTRY STATUS</Label>
                        <div className="h-14 px-6 flex items-center bg-blue-50/30 rounded-2xl border-2 border-blue-100/50 font-black text-blue-900 uppercase tracking-tight text-sm">
                            {currentStatus}
                        </div>
                    </div>

                    <div className="md:col-span-4 space-y-3">
                        <Label className="text-[10px] font-black uppercase text-blue-600 tracking-widest px-1">TARGET STATUS NODE *</Label>
                        <Select value={newStatus} onValueChange={setNewStatus} disabled={!selectedId || isLockedAtGate}>
                            <SelectTrigger className={cn(
                                "h-14 rounded-2xl font-black text-slate-900 border-slate-200 bg-white shadow-sm focus:ring-blue-900",
                                isLockedAtGate && "bg-slate-50 opacity-60 cursor-not-allowed"
                            )}>
                                <SelectValue placeholder={isLockedAtGate ? "Locked: Awaiting Exit" : "Transition Node"} />
                            </SelectTrigger>
                            <SelectContent className="rounded-2xl">
                                {selectedTrip ? (
                                    <>
                                        <div className="px-4 py-2 text-[9px] font-black text-blue-600 uppercase tracking-[0.2em] border-b mb-1 flex items-center gap-2">
                                            <ShieldCheck className="h-3 w-3" /> TRANSIT NODES
                                        </div>
                                        {missionRegistryStatuses.map(s => (
                                            <SelectItem key={s} value={s} className="font-black py-3 uppercase text-xs tracking-tight">{s.toUpperCase()}</SelectItem>
                                        ))}
                                    </>
                                ) : (
                                    <>
                                        <div className="px-4 py-2 text-[9px] font-black text-orange-600 uppercase border-b mb-1">MAINTENANCE NODES</div>
                                        {maintenanceStatuses.map(s => (
                                            <SelectItem key={s} value={s} className="font-black py-3 uppercase text-xs tracking-tight">{s.toUpperCase()}</SelectItem>
                                        ))}
                                    </>
                                )}
                            </SelectContent>
                        </Select>
                    </div>
                </div>

                <div className="space-y-3">
                    <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest px-1">ADMINISTRATIVE REMARKS</Label>
                    <div className="relative group">
                        <Textarea 
                            placeholder="Provide justification or context for this transition..." 
                            value={remarks}
                            onChange={(e) => setRemarks(e.target.value)}
                            className="min-h-[120px] rounded-3xl border-2 border-slate-100 p-6 font-bold text-slate-700 bg-white shadow-inner focus-visible:ring-blue-900 transition-all"
                        />
                        <div className="absolute top-6 right-6 opacity-10 group-focus-within:opacity-30 transition-opacity">
                            <History className="h-8 w-8" />
                        </div>
                    </div>
                </div>

                <Separator className="opacity-50" />

                <div className="flex flex-col md:flex-row items-center justify-between gap-8">
                    <div className="flex-1 w-full md:w-auto">
                        {!selectedId ? (
                            <div className="flex items-center gap-3 p-4 px-6 bg-slate-50 rounded-2xl border border-slate-100 text-slate-400 font-bold uppercase text-[10px] italic">
                                <AlertTriangle className="h-4 w-4" /> Awaiting target node selection...
                            </div>
                        ) : isLockedAtGate ? (
                            <div className="flex items-center gap-4 p-4 px-8 bg-red-50 rounded-[2rem] border-2 border-red-100 animate-in shake duration-500">
                                <div className="h-6 w-6 rounded-full bg-red-600 flex items-center justify-center text-white shadow-lg">
                                    <Lock className="h-4 w-4" />
                                </div>
                                <span className="text-[10px] font-black uppercase text-red-700 tracking-tight">
                                    TRANSITION BLOCKED: VEHICLE MUST DEPART GATE TO ACTIVATE TRANSIT NODES.
                                </span>
                            </div>
                        ) : (
                            <div className="flex items-center gap-4 p-4 px-8 bg-emerald-50 rounded-[2rem] border-2 border-emerald-100 animate-in zoom-in duration-300">
                                <div className="h-6 w-6 rounded-full bg-emerald-600 flex items-center justify-center text-white shadow-lg">
                                    <CheckCircle2 className="h-4 w-4" />
                                </div>
                                <span className="text-[10px] font-black uppercase text-emerald-700 tracking-tight">
                                    VALIDATED: READY TO TRANSITION FROM {currentStatus}.
                                </span>
                            </div>
                        )}
                    </div>

                    <div className="flex items-center gap-10">
                        <button 
                            type="button" 
                            onClick={() => { setSelectedId(''); setNewStatus(''); setRemarks(''); }}
                            className="text-[11px] font-black uppercase tracking-[0.3em] text-slate-400 hover:text-slate-900 transition-all"
                        >
                            CLEAR BOARD
                        </button>
                        
                        <Button 
                            type="submit"
                            disabled={isSubmitting || !selectedId || !newStatus || isLockedAtGate}
                            className="h-16 w-24 rounded-3xl bg-blue-900 hover:bg-slate-900 text-white shadow-2xl shadow-blue-900/30 transition-all active:scale-90 border-none group"
                        >
                            {isSubmitting ? (
                                <Loader2 className="h-6 w-6 animate-spin" />
                            ) : (
                                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="h-7 w-7 transition-transform group-hover:-translate-y-1">
                                    <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/>
                                </svg>
                            )}
                        </Button>
                    </div>
                </div>
            </form>
        </CardContent>
    </Card>
  );
}
