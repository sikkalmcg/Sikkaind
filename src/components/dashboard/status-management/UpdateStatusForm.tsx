'use client';

import { useState } from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Truck, MapPin, Activity, CheckCircle2, AlertTriangle, Hammer, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';

interface UpdateStatusFormProps {
  activeTrips: any[];
  availableVehicles: any[];
  onStatusUpdate: (id: string, status: string, location: string, remarks?: string, isTrip?: boolean) => Promise<void>;
}

export default function UpdateStatusForm({ activeTrips, availableVehicles, onStatusUpdate }: UpdateStatusFormProps) {
  const [selectedId, setSelectedId] = useState('');
  const [newStatus, setNewStatus] = useState('');
  const [location, setLocation] = useState('');
  const [remarks, setRemarks] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const selectedTrip = activeTrips.find(t => t.id === selectedId);
  const selectedVehicle = availableVehicles.find(v => v.id === selectedId);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedId || !newStatus) return;

    setIsSubmitting(true);
    try {
        await onStatusUpdate(selectedId, newStatus, location, remarks, !!selectedTrip);
        // Reset form on success
        setSelectedId('');
        setNewStatus('');
        setLocation('');
        setRemarks('');
    } finally {
        setIsSubmitting(false);
    }
  };

  const tripStatuses = [
    'In Transit',
    'Arrival for Delivery',
    'Arrived',
    'Delivered',
    'Breakdown',
    'Under-Maintenance'
  ];

  const maintenanceStatuses = [
    'Under Maintenance',
    'Break-down',
    'Available'
  ];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <form onSubmit={handleSubmit} className="lg:col-span-7 space-y-8">
            <div className="space-y-6 bg-white p-8 rounded-[2.5rem] border-2 border-slate-100 shadow-xl">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                        <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest px-1">Target Entity *</Label>
                        <Select value={selectedId} onValueChange={setSelectedId}>
                            <SelectTrigger className="h-12 rounded-xl font-bold border-slate-200">
                                <SelectValue placeholder="Select Trip or Vehicle" />
                            </SelectTrigger>
                            <SelectContent className="rounded-xl">
                                {activeTrips.length > 0 && (
                                    <>
                                        <div className="px-3 py-2 text-[9px] font-black text-blue-600 uppercase bg-blue-50/50 rounded-lg mb-1">Active Missions</div>
                                        {activeTrips.map(t => (
                                            <SelectItem key={t.id} value={t.id} className="font-bold py-2.5">
                                                {t.tripId} | {t.vehicleNumber}
                                            </SelectItem>
                                        ))}
                                    </>
                                )}
                                {availableVehicles.length > 0 && (
                                    <>
                                        <div className="px-3 py-2 text-[9px] font-black text-orange-600 uppercase bg-orange-50/50 rounded-lg my-1">Yard Maintenance</div>
                                        {availableVehicles.map(v => (
                                            <SelectItem key={v.id} value={v.id} className="font-bold py-2.5">
                                                {v.vehicleNumber} (IN Yard)
                                            </SelectItem>
                                        ))}
                                    </>
                                )}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="space-y-2">
                        <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest px-1">Transition To *</Label>
                        <Select value={newStatus} onValueChange={setNewStatus} disabled={!selectedId}>
                            <SelectTrigger className="h-12 rounded-xl font-black text-blue-900 border-blue-200 shadow-inner">
                                <SelectValue placeholder="Select New Status" />
                            </SelectTrigger>
                            <SelectContent className="rounded-xl">
                                {selectedTrip ? (
                                    tripStatuses.map(s => <SelectItem key={s} value={s} className="font-bold py-2.5">{s}</SelectItem>)
                                ) : (
                                    maintenanceStatuses.map(s => <SelectItem key={s} value={s} className="font-bold py-2.5">{s}</SelectItem>)
                                )}
                            </SelectContent>
                        </Select>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                        <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest px-1">Current Node (Location)</Label>
                        <div className="relative group">
                            <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-300 group-focus-within:text-blue-600 transition-colors" />
                            <Input 
                                placeholder="Enter location..." 
                                value={location}
                                onChange={e => setLocation(e.target.value)}
                                className="pl-10 h-12 rounded-xl border-slate-200" 
                            />
                        </div>
                    </div>
                    <div className="space-y-2">
                        <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest px-1">Registry Remark</Label>
                        <Input 
                            placeholder="Optional operational note..." 
                            value={remarks}
                            onChange={e => setRemarks(e.target.value)}
                            className="h-12 rounded-xl border-slate-200" 
                        />
                    </div>
                </div>

                <div className="pt-4 flex justify-end">
                    <Button 
                        disabled={isSubmitting || !selectedId || !newStatus}
                        className="bg-blue-900 hover:bg-slate-900 text-white px-12 h-14 rounded-2xl font-black uppercase text-[11px] tracking-[0.2em] shadow-xl shadow-blue-900/20 border-none transition-all active:scale-95"
                    >
                        {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Activity className="mr-2 h-4 w-4" />}
                        Commit Status Node
                    </Button>
                </div>
            </div>
        </form>

        <div className="lg:col-span-5 space-y-6">
            <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-[0.2em] px-4">Selection Context</h4>
            <div className="p-8 bg-slate-900 text-white rounded-[2.5rem] shadow-2xl relative overflow-hidden group min-h-[300px] flex flex-col justify-between">
                <div className="absolute top-0 right-0 p-8 opacity-5 rotate-12 transition-transform duration-1000 group-hover:scale-110">
                    <Truck size={180} />
                </div>
                
                {!selectedId ? (
                    <div className="flex-1 flex flex-col items-center justify-center gap-4 opacity-30 grayscale text-center">
                        <CheckCircle2 className="h-12 w-12" />
                        <p className="text-[10px] font-black uppercase tracking-widest">Awaiting Entity selection</p>
                    </div>
                ) : (
                    <div className="space-y-8 relative z-10 animate-in fade-in zoom-in-95 duration-300">
                        <div className="flex items-start justify-between">
                            <div className="space-y-1">
                                <span className="text-[8px] font-black uppercase text-blue-400 tracking-widest">Target Asset</span>
                                <h3 className="text-3xl font-black tracking-tighter uppercase leading-none">
                                    {selectedTrip?.vehicleNumber || selectedVehicle?.vehicleNumber}
                                </h3>
                            </div>
                            <Badge className="bg-blue-600 text-white font-black uppercase text-[10px] px-4 h-6 border-none shadow-lg">
                                {selectedTrip ? 'Active Mission' : 'Gate Presence'}
                            </Badge>
                        </div>

                        <div className="grid grid-cols-2 gap-8">
                            <div className="space-y-1">
                                <span className="text-[8px] font-black uppercase text-slate-500">Current Status Node</span>
                                <p className="text-xs font-bold text-blue-200 uppercase">{selectedTrip?.tripStatus || selectedVehicle?.remarks || 'Operational'}</p>
                            </div>
                            <div className="space-y-1">
                                <span className="text-[8px] font-black uppercase text-slate-500">Destination Hub</span>
                                <p className="text-xs font-bold text-white uppercase truncate">{selectedTrip?.unloadingPoint || '--'}</p>
                            </div>
                        </div>

                        <div className="p-4 bg-white/5 rounded-2xl border border-white/10 flex items-start gap-3">
                            <AlertTriangle className="h-4 w-4 text-orange-400 shrink-0 mt-0.5" />
                            <p className="text-[9px] font-bold text-slate-400 uppercase leading-normal">
                                Registry Transition Protocol: Advancing this node will update both local and global mission manifests.
                            </p>
                        </div>
                    </div>
                )}
            </div>
        </div>
    </div>
  );
}