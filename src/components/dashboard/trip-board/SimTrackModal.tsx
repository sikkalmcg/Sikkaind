
'use client';

import { useState } from 'react';
import { 
    Dialog, 
    DialogContent, 
    DialogHeader, 
    DialogTitle, 
    DialogFooter,
    DialogDescription 
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
    Select, 
    SelectContent, 
    SelectItem, 
    SelectTrigger, 
    SelectValue 
} from '@/components/ui/select';
import { 
    Table, 
    TableBody, 
    TableCell, 
    TableHead, 
    TableHeader, 
    TableRow 
} from '@/components/ui/table';
import { 
    X, 
    Loader2, 
    Signal, 
    Radar, 
    ShieldCheck, 
    Smartphone, 
    Navigation,
    Globe
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface SimTrackModalProps {
  isOpen: boolean;
  onClose: () => void;
  trip: any;
}

/**
 * @fileOverview SIM/GPS Track Handshake Terminal.
 * Implements cellular consent and hardware GPS registry UI.
 * Fixed: Added missing DialogFooter import.
 * Added: Dynamic Track Mode toggle (SIM/GPS).
 */
export default function SimTrackModal({ isOpen, onClose, trip }: SimTrackModalProps) {
    const [trackMode, setTrackMode] = useState<'SIM' | 'GPS'>('SIM');

    if (!trip) return null;

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-2xl p-0 border-none shadow-3xl overflow-hidden bg-white rounded-2xl flex flex-col">
                <DialogHeader className="p-5 bg-blue-700 text-white flex flex-row items-center justify-between space-y-0 shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-white/10 rounded-lg backdrop-blur-md">
                            <Navigation className="h-5 w-5 text-white" />
                        </div>
                        <DialogTitle className="text-xl font-bold uppercase tracking-tight italic">Tracking Mode</DialogTitle>
                    </div>
                    <button onClick={onClose} className="text-white/60 hover:text-white transition-colors">
                        <X size={24} />
                    </button>
                </DialogHeader>

                <div className="p-8 overflow-y-auto space-y-8 text-sm text-slate-600">
                    <div className="space-y-5 max-w-lg mx-auto">
                        {/* Track Mode */}
                        <div className="grid grid-cols-12 items-center gap-4">
                            <Label className="col-span-4 text-right font-black uppercase text-[10px] text-slate-400">Track Mode :</Label>
                            <div className="col-span-8">
                                <Select value={trackMode} onValueChange={(v) => setTrackMode(v as any)}>
                                    <SelectTrigger className="h-11 rounded-xl font-black text-blue-900 border-2 border-slate-100 shadow-sm">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent className="rounded-xl">
                                        <SelectItem value="SIM" className="font-bold py-2">SIM CARD TRACKING</SelectItem>
                                        <SelectItem value="GPS" className="font-bold py-2">HARDWARE GPS NODE</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        {/* Provider Node */}
                        <div className="grid grid-cols-12 items-center gap-4">
                            <Label className="col-span-4 text-right font-black uppercase text-[10px] text-slate-400">
                                {trackMode === 'SIM' ? 'SIM Provider' : 'GPS Provider'} :
                            </Label>
                            <div className="col-span-8">
                                <Select defaultValue={trackMode === 'SIM' ? "SIM TRACK 4" : "WHEELSEYE"}>
                                    <SelectTrigger className="h-11 rounded-xl font-bold">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent className="rounded-xl">
                                        {trackMode === 'SIM' ? (
                                            <SelectItem value="SIM TRACK 4" className="font-bold py-2">SIM TRACK 4</SelectItem>
                                        ) : (
                                            <>
                                                <SelectItem value="WHEELSEYE" className="font-bold py-2">WHEELSEYE HANDSHAKE</SelectItem>
                                                <SelectItem value="INTUGINE" className="font-bold py-2">INTUGINE NODE</SelectItem>
                                            </>
                                        )}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        {/* Driver Number */}
                        <div className="grid grid-cols-12 items-center gap-4">
                            <Label className="col-span-4 text-right font-black uppercase text-[10px] text-slate-400">Driver Number :</Label>
                            <div className="col-span-8">
                                <div className="relative group">
                                    <Smartphone className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-300 group-focus-within:text-blue-600 transition-colors" />
                                    <Input value={trip.driverMobile || ''} readOnly className="h-11 pl-10 bg-slate-50 font-black text-blue-900 border-slate-200 rounded-xl" />
                                </div>
                            </div>
                        </div>

                        {/* Driver Name */}
                        <div className="grid grid-cols-12 items-center gap-4">
                            <Label className="col-span-4 text-right font-black uppercase text-[10px] text-slate-400">Driver Name :</Label>
                            <div className="col-span-8">
                                <div className="relative group">
                                    <User className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-300" />
                                    <Input value={trip.driverName || ''} readOnly className="h-11 pl-10 bg-slate-50 font-bold uppercase text-slate-700 rounded-xl" />
                                </div>
                            </div>
                        </div>

                        {trackMode === 'SIM' ? (
                            <>
                                {/* Network Operator */}
                                <div className="grid grid-cols-12 items-center gap-4 pt-2">
                                    <Label className="col-span-4 text-right font-black uppercase text-[10px] text-slate-400">Network Operator:</Label>
                                    <div className="col-span-8 font-black text-slate-900 uppercase text-xs tracking-tight">
                                        Vodafone IDEA - Delhi
                                    </div>
                                </div>

                                {/* Consent Status */}
                                <div className="grid grid-cols-12 items-start gap-4">
                                    <Label className="col-span-4 text-right font-black uppercase text-[10px] text-slate-400">Consent status :</Label>
                                    <div className="col-span-8 space-y-1">
                                        <div className="flex items-center gap-2 font-black text-blue-900 uppercase tracking-tight">
                                            AWAITING CONSENT <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
                                        </div>
                                        <p className="text-[10px] font-bold italic text-slate-400 leading-tight">
                                            **It might take upto 15 mins for updated status to reflect from Operator
                                        </p>
                                    </div>
                                </div>
                            </>
                        ) : (
                            <>
                                {/* GPS Hardware Status */}
                                <div className="grid grid-cols-12 items-center gap-4 pt-2">
                                    <Label className="col-span-4 text-right font-black uppercase text-[10px] text-slate-400">Hardware Link:</Label>
                                    <div className="col-span-8 flex items-center gap-2 font-black text-emerald-600 uppercase text-xs">
                                        <ShieldCheck className="h-4 w-4" /> SATELLITE LINK ACTIVE
                                    </div>
                                </div>

                                <div className="grid grid-cols-12 items-center gap-4">
                                    <div className="col-span-4"></div>
                                    <div className="col-span-8">
                                        <Button 
                                            variant="outline" 
                                            className="w-full h-12 rounded-xl border-blue-200 text-blue-700 font-black uppercase text-[10px] tracking-widest gap-2 bg-blue-50/50 hover:bg-blue-900 hover:text-white transition-all shadow-sm"
                                            onClick={() => window.open(`/dashboard/shipment-tracking?search=${trip.vehicleNumber}`, '_blank')}
                                        >
                                            <Globe className="h-4 w-4" /> Switch to GIS Map Node
                                        </Button>
                                    </div>
                                </div>
                            </>
                        )}
                    </div>

                    {trackMode === 'SIM' && (
                        <div className="pt-6 space-y-6 border-t animate-in fade-in duration-500">
                            <h4 className="text-center text-xl font-black uppercase tracking-tight text-slate-800 italic">Consent Instructions</h4>
                            
                            <p className="text-center text-xs font-medium text-slate-500 max-w-md mx-auto leading-relaxed">
                                Please follow the steps below to provide consent for driver's location tracking. Use the driver's registered mobile number (displayed above) to complete the process.
                            </p>

                            <ul className="space-y-4 list-none px-4">
                                <li className="flex gap-3 leading-relaxed">
                                    <div className="h-1.5 w-1.5 rounded-full bg-blue-600 shrink-0 mt-2" />
                                    <p className="text-xs font-bold text-slate-700">For Jio, Missed call to <span className="text-blue-700 font-black">9982256700</span>. Confirmation SMS will be received upon successful registration.</p>
                                </li>
                                <li className="flex gap-3 leading-relaxed">
                                    <div className="h-1.5 w-1.5 rounded-full bg-blue-600 shrink-0 mt-2" />
                                    <p className="text-xs font-bold text-slate-700">Airtel, Vodafone Idea Call <span className="text-blue-700 font-black">7303777719</span> & press 1. If you face any issues with the IVR call, please SMS "Y" to the number mentioned below.</p>
                                </li>
                            </ul>

                            <div className="max-w-md mx-auto border-2 border-slate-100 rounded-2xl overflow-hidden shadow-inner bg-white">
                                <Table>
                                    <TableHeader className="bg-slate-50">
                                        <TableRow className="h-12 hover:bg-transparent">
                                            <TableHead className="text-center border-r font-black uppercase text-[10px] text-slate-500 h-12">Network Operator</TableHead>
                                            <TableHead className="text-center font-black uppercase text-[10px] text-slate-500 h-12">SMS Number</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        <TableRow className="h-12 border-t hover:bg-transparent">
                                            <TableCell className="py-2 px-6 border-r font-bold text-slate-800">Airtel</TableCell>
                                            <TableCell className="py-2 px-6 text-center font-black text-blue-900">SMS "Y" to 5114040</TableCell>
                                        </TableRow>
                                        <TableRow className="h-12 border-t hover:bg-transparent">
                                            <TableCell className="py-2 px-6 border-r font-bold text-slate-800">Vodafone Idea</TableCell>
                                            <TableCell className="py-2 px-6 text-center font-black text-blue-900">SMS "Y" to 55502</TableCell>
                                        </TableRow>
                                    </TableBody>
                                </Table>
                            </div>
                        </div>
                    )}
                </div>
                
                <DialogFooter className="p-5 bg-slate-50 border-t flex-row justify-end shrink-0 gap-3">
                    <span className="text-[9px] font-black uppercase text-slate-400 tracking-widest mr-auto flex items-center gap-2 italic">
                        <ShieldCheck className="h-4 w-4 text-blue-600" /> {trackMode} Tracking Authorization Terminal
                    </span>
                    <Button variant="ghost" onClick={onClose} className="font-black uppercase text-[10px] tracking-widest text-slate-400 px-8 h-11 hover:text-slate-900 transition-all">Close node</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
