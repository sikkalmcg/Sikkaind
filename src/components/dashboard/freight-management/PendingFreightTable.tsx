'use client';

import { useState, useMemo } from 'react';
import * as XLSX from 'xlsx';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { FileDown, IndianRupee, Eye, User, Search, Calculator } from 'lucide-react';
import { format } from 'date-fns';
import type { EnrichedFreight, ModalState } from '@/app/dashboard/freight-management/page';
import { cn } from '@/lib/utils';

interface PendingFreightTableProps {
  data: EnrichedFreight[];
  onAction: (state: ModalState) => void;
}

const getPaymentStatusColor = (status: string) => {
    if (status === 'Pending' || status === 'Requested') return 'bg-red-600 text-white shadow-red-100';
    if (status === 'Partial' || status === 'Under Process') return 'bg-amber-50 text-amber-700 border-amber-200';
    return 'bg-slate-500 text-white';
}

export default function PendingFreightTable({ data, onAction }: PendingFreightTableProps) {
  
  return (
    <div className="overflow-x-auto">
        <Table className="border-collapse w-full min-w-[2000px]">
            <TableHeader className="bg-slate-50/50">
                <TableRow className="h-14 hover:bg-transparent border-b">
                    <TableHead className="text-[10px] font-black uppercase px-6 text-slate-400">Plant</TableHead>
                    <TableHead className="text-[10px] font-black uppercase px-4 text-slate-400">Trip ID</TableHead>
                    <TableHead className="text-[10px] font-black uppercase px-4 text-slate-400">LR Number</TableHead>
                    <TableHead className="text-[10px] font-black uppercase px-4 text-center">LR Date</TableHead>
                    <TableHead className="text-[10px] font-black uppercase px-4 text-slate-400">From</TableHead>
                    <TableHead className="text-[10px] font-black uppercase px-4 text-slate-400">Ship To</TableHead>
                    <TableHead className="text-[10px] font-black uppercase px-4 text-slate-400">Destination</TableHead>
                    <TableHead className="text-[10px] font-black uppercase px-4 text-slate-400">Vehicle Number</TableHead>
                    <TableHead className="text-[10px] font-black uppercase px-4 text-slate-400">Transporter</TableHead>
                    <TableHead className="text-[10px] font-black uppercase px-4 text-right">LR Qty</TableHead>
                    <TableHead className="text-[10px] font-black uppercase px-4 text-right">Rate</TableHead>
                    <TableHead className="text-[10px] font-black uppercase px-4 text-right text-orange-600">Other Charge</TableHead>
                    <TableHead className="text-[10px] font-black uppercase px-4 text-center">Charge Type</TableHead>
                    <TableHead className="text-[10px] font-black uppercase px-4 text-right bg-blue-50/50 text-blue-900">Total Freight</TableHead>
                    <TableHead className="text-[10px] font-black uppercase px-8 text-right sticky right-0 bg-slate-50/50 shadow-[-4px_0_10px_rgba(0,0,0,0.05)]">Action</TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                {data.length === 0 ? (
                    <TableRow><TableCell colSpan={15} className="h-64 text-center text-slate-400 italic font-medium uppercase tracking-[0.3em] opacity-40">No matching records found in registry.</TableCell></TableRow>
                ) : (
                    data.map(item => {
                        const otherCharges = (item.charges || []).reduce((s, c) => s + (Number(c.amount) || 0), 0);
                        const chargeTypesStr = (item.charges || []).map(c => c.type).join(', ') || '--';

                        return (
                            <TableRow key={item.id} className="h-16 hover:bg-blue-50/30 transition-colors border-b last:border-0 group">
                                <TableCell className="px-6 font-bold text-slate-600 uppercase text-[11px]">{item.plant.name || item.originPlantId}</TableCell>
                                <TableCell className="px-4 font-black text-blue-700 font-mono tracking-tighter text-xs uppercase">{item.trip.tripId}</TableCell>
                                <TableCell className="px-4 font-black text-slate-900 uppercase text-xs">{item.trip.lrNumber || '--'}</TableCell>
                                <TableCell className="px-4 text-center text-[11px] font-bold text-slate-500">{item.trip.lrDate ? format(new Date(item.trip.lrDate), 'dd.MM.yy') : '--'}</TableCell>
                                <TableCell className="px-4 text-[11px] font-medium text-slate-500 uppercase italic truncate max-w-[150px]">{item.trip.loadingPoint || '--'}</TableCell>
                                <TableCell className="px-4 text-[11px] font-bold text-slate-800 uppercase truncate max-w-[150px]">{item.trip.shipToParty || '--'}</TableCell>
                                <TableCell className="px-4 text-[11px] font-medium text-slate-500 uppercase truncate max-w-[150px]">{item.trip.unloadingPoint || '--'}</TableCell>
                                <TableCell className="px-4 font-black text-slate-900 uppercase tracking-tighter">{item.trip.vehicleNumber}</TableCell>
                                <TableCell className="px-4 text-[10px] font-black uppercase text-slate-400 truncate max-w-[150px]">{item.trip.transporterName || 'Self'}</TableCell>
                                <TableCell className="px-4 text-right font-black text-blue-900">{(Number(item.trip.assignedQtyInTrip) || 0).toFixed(3)}</TableCell>
                                <TableCell className="px-4 text-right font-bold text-slate-600">₹ {(item.trip.freightRate || 0).toLocaleString()}</TableCell>
                                <TableCell className="px-4 text-right font-black text-orange-600">₹ {otherCharges.toLocaleString()}</TableCell>
                                <TableCell className="px-4 text-center text-[10px] font-bold uppercase text-slate-400">{chargeTypesStr}</TableCell>
                                <TableCell className="px-4 text-right font-black text-blue-900 bg-blue-50/10">₹ {Number(item.totalFreightAmount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</TableCell>
                                
                                <TableCell className="px-8 text-right sticky right-0 bg-white group-hover:bg-blue-50/30 transition-colors shadow-[-4px_0_10px_rgba(0,0,0,0.02)]">
                                    <Button 
                                        size="sm" 
                                        className="h-8 bg-emerald-600 hover:bg-emerald-700 text-white font-black uppercase text-[10px] tracking-widest px-6 shadow-lg border-none active:scale-95 transition-all"
                                        onClick={() => onAction({ type: 'make-payment', data: item })}
                                    >
                                        Pay Request
                                    </Button>
                                </TableCell>
                            </TableRow>
                        );
                    })
                )}
            </TableBody>
        </Table>
    </div>
  )
}
