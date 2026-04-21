
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
    Navigation,
    Globe,
    Smartphone, 
    User,
    ShieldCheck
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface SimTrackModalProps {
  isOpen: boolean;
  onClose: () => void;
  trip: any;
}

/**
 * @fileOverview Refined Tracking Mode Terminal.
 * Optimized for high-density ERP: Compact form, responsive stacking, and streamlined typography.
 * Dual Support: Handshakes with both SIM-based and Hardware GPS nodes.
 */
export default function SimTrackModal({ isOpen, onClose, trip }: SimTrackModalProps) {
    const [trackMode, setTrackMode] = useState<'SIM' | 'GPS'>('SIM');

    if (!trip) return null;

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-xl p-0 border-none shadow-3xl overflow-hidden bg-white rounded-2xl flex flex-col sm:rounded-[2rem]">
                <DialogHeader className="p-4 md:p-5 bg-blue-700 text-white flex flex-row items-center justify-between space-y-0 shrink-0 pr-12">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-white/10 rounded-lg backdrop-blur-md">
                            <Navigation className="h-4 w-4 md:h-5 md:w-5 text-white" />
                        </div>
                        <DialogTitle className="text-lg md:text-xl font-bold uppercase tracking-tight italic">Tracking Node</DialogTitle>
                    </div>
                </DialogHeader>

                <div className="p-4 md:p-6 overflow-y-auto space-y-6 md:space-y-8 text-sm">
                    {/* CORE FORM REGISTRY */}
                    <div className="space-y-4 md:space-y-5">
                        {/* Track Mode */}
                        <div className="flex flex-col md:grid md:grid-cols-12 md:items-center gap-2 md:gap-4">
                            <Label className="md:col-span-4 md:text-right font-black uppercase text-[9px] md:text-[10px] text-slate-400">Track Mode :</Label>
                            <div className="md:col-span-8">
                                <Select value={trackMode} onValueChange={(v) => setTrackMode(v as any)}>
                                    <SelectTrigger className="h-10 rounded-xl font-black text-blue-900 border-2 border-slate-100 shadow-sm">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent className="rounded-xl">
                                        <SelectItem value="SIM" className="font-bold py-2 text-xs">SIM CARD TRACKING</SelectItem>
                                        <SelectItem value="GPS" className="font-bold py-2 text-xs">HARDWARE GPS NODE</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        {/* Provider Node */}
                        <div className="flex flex-col md:grid md:grid-cols-12 md:items-center gap-2 md:gap-4">
                            <Label className="md:col-span-4 md:text-right font-black uppercase text-[9px] md:text-[10px] text-slate-400">
                                {trackMode === 'SIM' ? 'SIM Provider' : 'GPS Provider'} :
                            </Label>
                            <div className="md:col-span-8">
                                <Select defaultValue={trackMode === 'SIM' ? "SIM TRACK 4" : "WHEELSEYE"}>
                                    <SelectTrigger className="h-10 rounded-xl font-bold">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent className="rounded-xl">
                                        {trackMode === 'SIM' ? (
                                            <SelectItem value="SIM TRACK 4" className="font-bold py-2 text-xs">SIM TRACK 4</SelectItem>
                                        ) : (
                                            <>
                                                <SelectItem value="WHEELSEYE" className="font-bold py-2 text-xs">WHEELSEYE HANDSHAKE</SelectItem>
                                                <SelectItem value="INTUGINE" className="font-bold py-2 text-xs">INTUGINE NODE</SelectItem>
                                            </>
                                        )}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        {/* Driver Number */}
                        <div className="flex flex-col md:grid md:grid-cols-12 md:items-center gap-2 md:gap-4">
                            <Label className="md:col-span-4 md:text-right font-black uppercase text-[9px] md:text-[10px] text-slate-400">Driver Number :</Label>
                            <div className="md:col-span-8">
                                <div className="relative group">
                                    <Smartphone className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-300" />
                                    <Input value={trip.driverMobile || ''} readOnly className="h-10 pl-10 bg-slate-50 font-black text-blue-900 border-slate-200 rounded-xl text-xs" />
                                </div>
                            </div>
                        </div>

                        {/* Driver Name */}
                        <div className="flex flex-col md:grid md:grid-cols-12 md:items-center gap-2 md:gap-4">
                            <Label className="md:col-span-4 md:text-right font-black uppercase text-[9px] md:text-[10px] text-slate-400">Driver Name :</Label>
                            <div className="md:col-span-8">
                                <div className="relative group">
                                    <User className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-300" />
                                    <Input value={trip.driverName || ''} readOnly className="h-10 pl-10 bg-slate-50 font-bold uppercase text-slate-700 border-slate-200 rounded-xl text-xs" />
                                </div>
                            </div>
                        </div>

                        {trackMode === 'SIM' ? (
                            <>
                                <div className="flex flex-col md:grid md:grid-cols-12 md:items-center gap-2 md:gap-4 pt-1">
                                    <Label className="md:col-span-4 md:text-right font-black uppercase text-[9px] md:text-[10px] text-slate-400">Network Operator:</Label>
                                    <div className="md:col-span-8 font-black text-slate-900 uppercase text-[11px] tracking-tight">
                                        VODAFONE IDEA - DELHI
                                    </div>
                                </div>

                                <div className="flex flex-col md:grid md:grid-cols-12 md:items-start gap-2 md:gap-4">
                                    <Label className="md:col-span-4 md:text-right font-black uppercase text-[9px] md:text-[10px] text-slate-400">Consent Status :</Label>
                                    <div className="md:col-span-8 space-y-1">
                                        <div className="flex items-center gap-2 font-black text-blue-900 uppercase tracking-tight text-[11px]">
                                            AWAITING CONSENT <Loader2 className="h-3 w-3 animate-spin text-blue-600" />
                                        </div>
                                        <p className="text-[9px] font-bold italic text-slate-400 leading-tight">
                                            **Might take 15 mins to reflect from Operator node
                                        </p>
                                    </div>
                                </div>
                            </>
                        ) : (
                            <>
                                <div className="flex flex-col md:grid md:grid-cols-12 md:items-center gap-2 md:gap-4 pt-1">
                                    <Label className="md:col-span-4 md:text-right font-black uppercase text-[9px] md:text-[10px] text-slate-400">Hardware Link:</Label>
                                    <div className="md:col-span-8 flex items-center gap-2 font-black text-emerald-600 uppercase text-[11px]">
                                        <ShieldCheck className="h-3.5 w-3.5" /> SATELLITE LINK ACTIVE
                                    </div>
                                </div>
                                <div className="flex flex-col md:grid md:grid-cols-12 gap-2 md:gap-4">
                                    <div className="md:col-span-4"></div>
                                    <div className="md:col-span-8">
                                        <Button 
                                            variant="outline" 
                                            className="w-full h-10 rounded-xl border-blue-200 text-blue-700 font-black uppercase text-[9px] tracking-widest gap-2 bg-blue-50/30 hover:bg-blue-900 hover:text-white transition-all shadow-sm"
                                            onClick={() => window.open(`/dashboard/shipment-tracking?search=${trip.vehicleNumber}`, '_blank')}
                                        >
                                            <Globe className="h-3.5 w-3.5" /> Switch to GIS Node
                                        </Button>
                                    </div>
                                </div>
                            </>
                        )}
                    </div>

                    {/* INSTRUCTIONS NODE */}
                    {trackMode === 'SIM' && (
                        <div className="pt-5 space-y-5 border-t animate-in fade-in duration-500">
                            <h4 className="text-center text-lg font-black uppercase tracking-tight text-slate-800 italic">Consent Instructions</h4>
                            
                            <p className="text-center text-[10px] md:text-xs font-medium text-slate-500 max-w-sm mx-auto leading-relaxed">
                                Use the driver's registered mobile number to provide cellular consent.
                            </p>

                            <div className="space-y-3 px-2">
                                <div className="flex gap-3 leading-relaxed items-start">
                                    <div className="h-1.5 w-1.5 rounded-full bg-blue-600 shrink-0 mt-1.5" />
                                    <p className="text-[11px] font-bold text-slate-700 uppercase">JIO: Missed call to <span className="text-blue-700 font-black">9982256700</span>.</p>
                                </div>
                                <div className="flex gap-3 leading-relaxed items-start">
                                    <div className="h-1.5 w-1.5 rounded-full bg-blue-600 shrink-0 mt-1.5" />
                                    <p className="text-[11px] font-bold text-slate-700 uppercase">Airtel/VI: Call <span className="text-blue-700 font-black">7303777719</span> & press 1.</p>
                                </div>
                            </div>

                            <div className="max-w-sm mx-auto border-2 border-slate-100 rounded-xl overflow-hidden shadow-inner bg-white">
                                <Table>
                                    <TableHeader className="bg-slate-50">
                                        <TableRow className="h-10 hover:bg-transparent">
                                            <TableHead className="text-center border-r font-black uppercase text-[9px] text-slate-500 h-10">Operator</TableHead>
                                            <TableHead className="text-center font-black uppercase text-[9px] text-slate-500 h-10">SMS Node</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        <TableRow className="h-10 border-t hover:bg-transparent text-[10px]">
                                            <TableCell className="py-2 px-4 border-r font-bold text-slate-800 uppercase">Airtel</TableCell>
                                            <TableCell className="py-2 px-4 text-center font-black text-blue-900 uppercase">SMS "Y" to 5114040</TableCell>
                                        </TableRow>
                                        <TableRow className="h-10 border-t hover:bg-transparent text-[10px]">
                                            <TableCell className="py-2 px-4 border-r font-bold text-slate-800 uppercase">VI Node</TableCell>
                                            <TableCell className="py-2 px-4 text-center font-black text-blue-900 uppercase">SMS "Y" to 55502</TableCell>
                                        </TableRow>
                                    </TableBody>
                                </Table>
                            </div>
                        </div>
                    )}
                </div>
                
                <DialogFooter className="p-4 md:p-5 bg-slate-50 border-t flex-row justify-end shrink-0 gap-3">
                    <span className="text-[8px] md:text-[9px] font-black uppercase text-slate-400 tracking-widest mr-auto flex items-center gap-2 italic">
                        <ShieldCheck className="h-3.5 w-3.5 text-blue-600" /> Authorized Terminal Node
                    </span>
                    <Button variant="ghost" onClick={onClose} className="font-black uppercase text-[9px] md:text-[10px] tracking-widest text-slate-400 px-6 h-10 hover:text-slate-900">Discard</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

