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
import { FileDown, Printer, Search, History, User } from 'lucide-react';
import { format } from 'date-fns';
import type { EnrichedFreight } from '@/app/dashboard/freight-management/page';
import PrintPaymentSlipModal from './PrintPaymentSlipModal';
import { cn } from '@/lib/utils';

interface PaidTripsTableProps {
  data: EnrichedFreight[];
  isLoading: boolean;
}

const cleanName = (name?: string) => {
    if (!name) return '--';
    return name.split('@')[0].toUpperCase();
};

export default function PaidTripsTable({ data, isLoading }: PaidTripsTableProps) {
    const [searchTerm, setSearchTerm] = useState('');
    const [printData, setPrintData] = useState<{ freight: EnrichedFreight, payment: any } | null>(null);

    const handleDownload = () => {
        const dataToExport = filteredData.map(item => {
            const lastPayment = item.payments && item.payments.length > 0 ? item.payments[item.payments.length - 1] : null;
            return {
                'Slip No': lastPayment?.slipNumber || '--',
                'Slip Date': lastPayment?.paymentDate ? format(new Date(lastPayment.paymentDate), 'dd-MM-yyyy') : '--',
                'Trip ID': item.trip.tripId,
                'Username': cleanName(item.trip.userName),
                'Vehicle No.': item.trip.vehicleNumber,
                'Transporter': item.trip.transporterName || 'N/A',
                'Destination': item.trip.unloadingPoint ?? 'N/A',
                'Freight Rate': item.trip.freightRate,
                'Freight Amount': item.totalFreightAmount,
                'Paid Amount': item.paidAmount,
                'Balance': item.balanceAmount,
                'Status': item.paymentStatus,
            };
        });

        const worksheet = XLSX.utils.json_to_sheet(dataToExport);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Settled Ledger");
        XLSX.writeFile(workbook, `Freight_Paid_Registry_${format(new Date(), 'yyyyMMdd')}.xlsx`);
    };

    const filteredData = useMemo(() => {
        return data.filter(item => {
            const lastPayment = item.payments && item.payments.length > 0 ? item.payments[item.payments.length - 1] : null;
            const searchTermLower = searchTerm.toLowerCase();
            return (
                item.trip.tripId.toLowerCase().includes(searchTermLower) ||
                item.trip.vehicleNumber?.toLowerCase().includes(searchTermLower) ||
                item.trip.userName?.toLowerCase().includes(searchTermLower) ||
                item.trip.transporterName?.toLowerCase().includes(searchTermLower) ||
                lastPayment?.slipNumber?.toLowerCase().includes(searchTermLower)
            );
        });
    }, [data, searchTerm]);

    return (
        <div className="space-y-6">
            <Card className="border-none shadow-none bg-transparent">
                <CardHeader className="px-0 pb-6 flex flex-row items-center justify-between space-y-0">
                    <div>
                        <CardTitle className="text-xl font-black text-slate-800 uppercase flex items-center gap-2">
                            <History className="h-5 w-5 text-emerald-600" /> Settled History Registry
                        </CardTitle>
                        <CardDescription className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mt-1">Audit log of fully liquidated mission nodes</CardDescription>
                    </div>
                    <div className="flex items-center gap-4">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 group-focus-within:text-blue-900 transition-colors" />
                            <Input
                                placeholder="Search Slip, Vehicle, Trip, User..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="pl-10 w-[320px] h-10 rounded-xl border-slate-200 bg-white font-bold shadow-sm"
                            />
                        </div>
                        <Button variant="outline" size="sm" onClick={handleDownload} className="h-10 px-6 gap-2 font-black text-[11px] uppercase border-slate-200 text-blue-900 bg-white shadow-sm hover:bg-slate-50 transition-all">
                            <FileDown className="mr-2 h-4 w-4" /> Export Ledger
                        </Button>
                    </div>
                </CardHeader>
                <CardContent className="p-0">
                    <div className="rounded-[2rem] border border-slate-200 shadow-xl bg-white overflow-hidden">
                        <div className="overflow-x-auto">
                            <Table>
                                <TableHeader className="bg-slate-50/50">
                                    <TableRow className="hover:bg-transparent border-b">
                                        <TableHead className="text-[10px] font-black uppercase px-6 text-slate-400">Slip Number</TableHead>
                                        <TableHead className="text-[10px] font-black uppercase px-4 text-center">Slip Date</TableHead>
                                        <TableHead className="text-[10px] font-black uppercase px-4 text-center text-slate-400">Trip ID</TableHead>
                                        <TableHead className="text-[10px] font-black uppercase px-4 text-slate-400">Username</TableHead>
                                        <TableHead className="text-[10px] font-black uppercase px-4 text-slate-400">Vehicle No.</TableHead>
                                        <TableHead className="text-[10px] font-black uppercase px-4 text-slate-400">Transporter</TableHead>
                                        <TableHead className="text-[10px] font-black uppercase px-4 text-right">Freight Amount</TableHead>
                                        <TableHead className="text-[10px] font-black uppercase px-4 text-right">Liquidated</TableHead>
                                        <TableHead className="text-[10px] font-black uppercase px-4 text-center">Status</TableHead>
                                        <TableHead className="text-[10px] font-black uppercase px-8 text-right sticky right-0 bg-slate-50/50 shadow-[-4px_0_10px_rgba(0,0,0,0.05)]">Action</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                {isLoading ? (
                                    Array.from({ length: 5 }).map((_, i) => (
                                        <TableRow key={i} className="h-16"><TableCell colSpan={10} className="px-6"><Skeleton className="h-8 w-full" /></TableCell></TableRow>
                                    ))
                                ) : filteredData.length === 0 ? (
                                    <TableRow><TableCell colSpan={10} className="h-64 text-center text-slate-400 italic font-medium uppercase tracking-[0.3em] opacity-40">No settled records found in registry.</TableCell></TableRow>
                                ) : (
                                    filteredData.map(item => {
                                        const lastPayment = item.payments && item.payments.length > 0 ? item.payments[item.payments.length - 1] : null;
                                        return (
                                            <TableRow key={item.id} className="h-16 hover:bg-blue-50/30 border-b last:border-0 group transition-colors">
                                                <TableCell className="px-6 font-black text-emerald-700 font-mono tracking-widest text-xs uppercase">{lastPayment?.slipNumber || '--'}</TableCell>
                                                <TableCell className="px-4 text-center text-xs font-bold text-slate-500 whitespace-nowrap">{lastPayment?.paymentDate ? format(new Date(lastPayment.paymentDate), 'dd.MM.yy') : '--'}</TableCell>
                                                <TableCell className="px-4 text-center font-bold text-blue-700 font-mono text-[11px] tracking-tighter uppercase">{item.trip.tripId}</TableCell>
                                                <TableCell className="px-4">
                                                    <div className="flex items-center gap-2">
                                                        <div className="h-6 w-6 rounded-full bg-slate-100 flex items-center justify-center">
                                                            <User className="h-3 w-3 text-slate-400" />
                                                        </div>
                                                        <span className="font-black text-slate-900 uppercase text-[10px] tracking-tight">{cleanName(item.trip.userName)}</span>
                                                    </div>
                                                </TableCell>
                                                <TableCell className="px-4 font-black text-slate-900 uppercase tracking-tighter">{item.trip.vehicleNumber}</TableCell>
                                                <TableCell className="px-4 text-[10px] font-black uppercase text-slate-400 truncate max-w-[150px]">{item.trip.transporterName || 'Self Registry'}</TableCell>
                                                <TableCell className="px-4 text-right font-black text-slate-900">₹ {Number(item.totalFreightAmount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</TableCell>
                                                <TableCell className="px-4 text-right font-black text-blue-900 bg-blue-50/10">₹ {Number(item.paidAmount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</TableCell>
                                                <TableCell className="px-4 text-center">
                                                    <Badge className="bg-emerald-600 text-white font-black uppercase text-[9px] px-3 h-6 border-none shadow-sm">Settled</Badge>
                                                </TableCell>
                                                <TableCell className="px-8 text-right sticky right-0 bg-white group-hover:bg-blue-50/30 transition-colors shadow-[-4px_0_10px_rgba(0,0,0,0.02)]">
                                                    <TooltipProvider>
                                                        <Tooltip>
                                                            <TooltipTrigger asChild>
                                                                <Button 
                                                                    variant="ghost" 
                                                                    size="icon" 
                                                                    className="h-9 w-9 rounded-xl text-blue-600 hover:bg-blue-600 hover:text-white shadow-sm border border-transparent hover:border-blue-400 transition-all"
                                                                    onClick={() => lastPayment && setPrintData({ freight: item, payment: lastPayment })}
                                                                >
                                                                    <Printer className="h-4 w-4" />
                                                                </Button>
                                                            </TooltipTrigger>
                                                            <TooltipContent className="bg-slate-900 text-white font-black uppercase text-[10px]">Print Settlement Slip</TooltipContent>
                                                        </Tooltip>
                                                    </TooltipProvider>
                                                </TableCell>
                                            </TableRow>
                                        );
                                    })
                                )}
                                </TableBody>
                            </Table>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {printData && (
                <PrintPaymentSlipModal 
                    isOpen={!!printData}
                    onClose={() => setPrintData(null)}
                    freight={printData.freight}
                    payment={printData.payment}
                />
            )}
        </div>
    )
}
