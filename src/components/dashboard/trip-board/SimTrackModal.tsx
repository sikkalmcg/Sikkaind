'use client';

import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { X, Loader2, Signal } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SimTrackModalProps {
  isOpen: boolean;
  onClose: () => void;
  trip: any;
}

/**
 * @fileOverview SIM Track Handshake Terminal.
 * Implements the cellular consent registry UI as per provided handbook standards.
 */
export default function SimTrackModal({ isOpen, onClose, trip }: SimTrackModalProps) {
    if (!trip) return null;

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-2xl p-0 border-none shadow-3xl overflow-hidden bg-white rounded-xl flex flex-col">
                <DialogHeader className="p-4 bg-blue-700 text-white flex flex-row items-center justify-between space-y-0 shrink-0">
                    <DialogTitle className="text-xl font-bold uppercase tracking-tight italic">Tracking Mode</DialogTitle>
                    <button onClick={onClose} className="text-white/80 hover:text-white transition-colors">
                        <X size={24} />
                    </button>
                </DialogHeader>

                <div className="p-8 overflow-y-auto space-y-8 text-sm text-slate-600">
                    <div className="space-y-5 max-w-lg mx-auto">
                        {/* Track Mode */}
                        <div className="grid grid-cols-12 items-center gap-4">
                            <Label className="col-span-4 text-right font-black uppercase text-[10px] text-slate-400">Track Mode :</Label>
                            <div className="col-span-8">
                                <Select defaultValue="SIM">
                                    <SelectTrigger className="h-10 font-bold">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent className="rounded-xl">
                                        <SelectItem value="SIM" className="font-bold py-2">SIM</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        {/* SIM Provider */}
                        <div className="grid grid-cols-12 items-center gap-4">
                            <Label className="col-span-4 text-right font-black uppercase text-[10px] text-slate-400">SIM Provider :</Label>
                            <div className="col-span-8">
                                <Select defaultValue="SIM TRACK 4">
                                    <SelectTrigger className="h-10 font-bold">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent className="rounded-xl">
                                        <SelectItem value="SIM TRACK 4" className="font-bold py-2">SIM TRACK 4</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        {/* Driver Number */}
                        <div className="grid grid-cols-12 items-center gap-4">
                            <Label className="col-span-4 text-right font-black uppercase text-[10px] text-slate-400">Driver Number :</Label>
                            <div className="col-span-8">
                                <Input value={trip.driverMobile || ''} readOnly className="h-10 bg-slate-50 font-black text-blue-900 border-slate-200" />
                            </div>
                        </div>

                        {/* Driver Name */}
                        <div className="grid grid-cols-12 items-center gap-4">
                            <Label className="col-span-4 text-right font-black uppercase text-[10px] text-slate-400">Driver Name :</Label>
                            <div className="col-span-8">
                                <Input value={trip.driverName || ''} readOnly className="h-10 bg-slate-50 font-bold uppercase text-slate-700" />
                            </div>
                        </div>

                        {/* Network Operator */}
                        <div className="grid grid-cols-12 items-center gap-4 pt-2">
                            <Label className="col-span-4 text-right font-black uppercase text-[10px] text-slate-400">Network Operator:</Label>
                            <div className="col-span-8 font-black text-slate-900 uppercase">
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
                    </div>

                    <div className="pt-6 space-y-6 border-t">
                        <h4 className="text-center text-xl font-black uppercase tracking-tight text-slate-800">Consent Instructions</h4>
                        
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

                        <div className="grid grid-cols-12 items-center gap-4 pt-10 max-w-lg mx-auto">
                            <Label className="col-span-4 text-right font-black uppercase text-[10px] text-slate-400">Reason for Update :</Label>
                            <div className="col-span-8">
                                <Select>
                                    <SelectTrigger className="h-12 rounded-xl border-slate-200 bg-white font-bold">
                                        <SelectValue placeholder="Select..." />
                                    </SelectTrigger>
                                    <SelectContent className="rounded-xl">
                                        <SelectItem value="initial" className="font-bold py-2.5">Initial Request</SelectItem>
                                        <SelectItem value="expiry" className="font-bold py-2.5">Consent Expired</SelectItem>
                                        <SelectItem value="retry" className="font-bold py-2.5">Re-triggering Sync</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                    </div>
                </div>
                
                <DialogFooter className="p-6 bg-slate-50 border-t flex-row justify-end shrink-0">
                    <Button variant="ghost" onClick={onClose} className="font-black uppercase text-[10px] tracking-widest text-slate-400 px-8 h-11">Cancel node</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
