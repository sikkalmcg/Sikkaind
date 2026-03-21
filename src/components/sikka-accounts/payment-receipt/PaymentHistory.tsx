'use client';
import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { FileDown, History, Trash2, RotateCcw, AlertTriangle, Search, X } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import Pagination from '@/components/dashboard/vehicle-management/Pagination';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

const ITEMS_PER_PAGE = 10;

const paymentHistoryHeaders = [
    { key: 'plantName', label: 'Plant Node' },
    { key: 'invoiceNo', label: 'Invoice No' },
    { key: 'migoNumber', label: 'MIGO Number' },
    { key: 'consignorName', label: 'Consignor' },
    { key: 'buyerName', label: 'Consignee' },
    { key: 'taxableAmount', label: 'Taxable Amt' },
    { key: 'totalInvoiceAmount', label: 'Gross Amt' },
    { key: 'receiptAmount', label: 'Receipt Amt' },
    { key: 'tdsAmount', label: 'TDS Amount' },
    { key: 'balanceAfterPayment', label: 'Post Bal' },
    { key: 'bankingRef', label: 'Bank Ref (UTR)' },
    { key: 'paymentDate', label: 'Receipt Date' },
    { key: 'invoiceStatus', label: 'Status' },
];

function HistoryTable({ data, onDelete }: { data: any[], onDelete: (paymentId: string, invoiceId: string) => void }) {
    if (data.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-20 text-slate-400 opacity-40">
                <History className="h-12 w-12 mb-4" />
                <p className="text-sm font-black uppercase tracking-widest">No Active Payment Records</p>
            </div>
        );
    }
    return (
        <div className="overflow-x-auto">
            <Table>
                <TableHeader className="bg-slate-50">
                    <TableRow className="hover:bg-transparent">
                        {paymentHistoryHeaders.map(h => <TableHead key={h.key} className="text-[10px] font-black uppercase tracking-widest px-4">{h.label}</TableHead>)}
                        <TableHead className="text-right px-6 sticky right-0 bg-slate-50">Action</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {data.map(payment => (
                        <TableRow key={payment.id} className="h-14 hover:bg-blue-50/20 border-b last:border-0 group transition-colors">
                            {paymentHistoryHeaders.map(header => {
                                const val = payment[header.key];
                                const isAmount = header.key.toLowerCase().includes('amount') || header.key === 'balanceAfterPayment';
                                const isMigo = header.key === 'migoNumber';
                                const isInvoice = header.key === 'invoiceNo';

                                return (
                                    <TableCell key={header.key} className={cn(
                                        "px-4 text-[11px]",
                                        isAmount ? "text-right font-black text-blue-900" : "font-medium text-slate-600",
                                        isMigo && "text-emerald-700 font-bold",
                                        isInvoice && "text-blue-700 font-black"
                                    )}>
                                        {header.key.includes('Date') ? format(new Date(val), 'dd.MM.yy') :
                                        isAmount ? `₹ ${Number(val).toLocaleString('en-IN', { minimumFractionDigits: 2 })}` :
                                        val || '--'}
                                    </TableCell>
                                );
                            })}
                            <TableCell className="text-right px-6 sticky right-0 bg-white group-hover:bg-blue-50/20 shadow-[-4px_0_10px_rgba(0,0,0,0.02)]">
                                 <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                        <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-300 hover:text-red-600">
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent className="border-none shadow-2xl p-0 overflow-hidden">
                                        <div className="p-8 bg-red-50 border-b border-red-100 flex items-center gap-5">
                                            <div className="p-3 bg-red-600 text-white rounded-2xl shadow-xl"><AlertTriangle className="h-6 w-6" /></div>
                                            <div>
                                                <AlertDialogTitle className="text-xl font-black uppercase text-red-900 tracking-tight">Security Purge</AlertDialogTitle>
                                                <AlertDialogDescription className="text-red-700 font-bold text-[9px] uppercase tracking-widest mt-1">Authorized Deletion Handshake</AlertDialogDescription>
                                            </div>
                                        </div>
                                        <div className="p-8">
                                            <p className="text-sm font-medium text-slate-600 leading-relaxed">
                                                You are about to revoke MIGO payment node <span className="font-black text-slate-900 underline decoration-red-200">{payment.migoNumber}</span>. This will revert the balance on Invoice {payment.invoiceNo} and move this record to the archive registry.
                                            </p>
                                        </div>
                                        <AlertDialogFooter className="bg-slate-50 p-6 flex-row justify-end gap-3 border-t">
                                            <AlertDialogCancel className="font-bold border-slate-200 rounded-xl px-8 h-10 m-0">Abort</AlertDialogCancel>
                                            <AlertDialogAction 
                                                onClick={() => onDelete?.(payment.id, payment.invoiceId)}
                                                className="bg-red-600 hover:bg-red-700 text-white font-black uppercase text-[11px] tracking-widest px-10 h-10 rounded-xl shadow-lg shadow-red-100 border-none"
                                            >
                                                Confirm Delete
                                            </AlertDialogAction>
                                        </AlertDialogFooter>
                                    </AlertDialogContent>
                                </AlertDialog>
                            </TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </div>
    );
}

function RecycleBinTable({ data, onRestore, onPermanentDelete }: { data: any[], onRestore: (itemId: string) => void, onPermanentDelete: (itemId: string) => void }) {
     if (data.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-20 text-slate-400 opacity-40">
                <History className="h-12 w-12 mb-4" />
                <p className="text-sm font-black uppercase tracking-widest">Archive Registry Empty</p>
            </div>
        );
    }
    return (
        <div className="overflow-x-auto">
            <Table>
                <TableHeader className="bg-slate-50">
                    <TableRow className="hover:bg-transparent">
                        <TableHead className="text-[10px] font-black uppercase tracking-widest px-4">Operator</TableHead>
                        <TableHead className="text-[10px] font-black uppercase tracking-widest px-4">Deleted Date</TableHead>
                        {paymentHistoryHeaders.map(h => <TableHead key={h.key} className="text-[10px] font-black uppercase tracking-widest px-4">{h.label}</TableHead>)}
                        <TableHead className="text-right px-6 sticky right-0 bg-slate-50">Action</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                     {data.map(item => (
                        <TableRow key={item.id} className="h-14 hover:bg-orange-50/20 border-b last:border-0 text-[11px] text-slate-500 font-medium">
                            <TableCell className="px-4 font-black uppercase text-slate-400">{item.userName}</TableCell>
                            <TableCell className="px-4 whitespace-nowrap">{format(new Date(item.deletedAt.toDate ? item.deletedAt.toDate() : item.deletedAt), 'dd.MM.yy HH:mm')}</TableCell>
                            {paymentHistoryHeaders.map(header => {
                                const val = item.data[header.key];
                                return (
                                    <TableCell key={header.key} className="px-4">
                                        {header.key.includes('Date') && val ? format(new Date(val.toDate ? val.toDate() : val), 'dd.MM.yy') :
                                         typeof val === 'number' ? val.toLocaleString() :
                                         val || '--'}
                                    </TableCell>
                                );
                            })}
                            <TableCell className="text-right px-6 sticky right-0 bg-white group-hover:bg-orange-50/20 shadow-[-4px_0_10px_rgba(0,0,0,0.02)]">
                                <div className="flex justify-end gap-2">
                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-emerald-600 hover:bg-emerald-50" onClick={() => onRestore(item.id)}>
                                        <RotateCcw className="h-4 w-4" />
                                    </Button>
                                    <AlertDialog>
                                        <AlertDialogTrigger asChild>
                                            <Button variant="ghost" size="icon" className="h-8 w-8 text-red-600 hover:bg-red-50">
                                                <X className="h-4 w-4" />
                                            </Button>
                                        </AlertDialogTrigger>
                                        <AlertDialogContent className="border-none shadow-2xl">
                                            <AlertDialogHeader><AlertDialogTitle className="font-black uppercase text-red-900">Final Purge?</AlertDialogTitle><AlertDialogDescription className="text-sm font-medium">This action is irreversible and will permanently scrub the record from the cloud.</AlertDialogDescription></AlertDialogHeader>
                                            <AlertDialogFooter className="bg-slate-50 -mx-6 -mb-6 p-6 flex-row justify-end gap-3 border-t">
                                                <AlertDialogCancel className="font-bold">Abort</AlertDialogCancel>
                                                <AlertDialogAction onClick={() => onPermanentDelete(item.id)} className="bg-red-600 font-black uppercase text-[10px] tracking-widest px-8 border-none">Scrub Registry</AlertDialogAction>
                                            </AlertDialogFooter>
                                        </AlertDialogContent>
                                    </AlertDialog>
                                </div>
                            </TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </div>
    );
}

export default function PaymentHistory(props: any) {
    const { history, recycled, isAdmin, onDelete, onRestore, onPermanentDelete } = props;
    const [searchTerm, setSearchTerm] = useState('');
    const [currentPage, setCurrentPage] = useState(1);

    const filteredHistory = useMemo(() => history.filter((item: any) =>
        Object.values(item).some(val => val?.toString().toLowerCase().includes(searchTerm.toLowerCase()))
    ), [history, searchTerm]);
    
    const totalPages = Math.ceil(filteredHistory.length / ITEMS_PER_PAGE);
    const paginatedHistory = filteredHistory.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

    return (
        <Card className="border-none shadow-2xl rounded-[2.5rem] bg-white overflow-hidden">
            <CardHeader className="bg-slate-50 border-b p-8">
                 <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-white rounded-lg border shadow-sm"><History className="h-5 w-5 text-blue-900" /></div>
                        <div>
                            <CardTitle className="text-lg font-black uppercase text-blue-900">MIGO Transaction Registry</CardTitle>
                            <CardDescription className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Complete audit trail of inward payments</CardDescription>
                        </div>
                    </div>
                    <div className="flex items-center gap-4">
                        <div className="relative group">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 group-focus-within:text-blue-900 transition-colors" />
                            <Input placeholder="Search ledger..." value={searchTerm} onChange={e => {setSearchTerm(e.target.value); setCurrentPage(1);}} className="pl-10 w-[320px] h-11 rounded-2xl bg-white border-slate-200 shadow-sm font-bold" />
                        </div>
                        <Button variant="outline" size="sm" className="h-11 px-6 gap-2 font-black text-[11px] uppercase border-slate-200 text-blue-900 bg-white shadow-sm hover:bg-slate-50"><FileDown className="h-4 w-4" /> Export Excel</Button>
                    </div>
                </div>
            </CardHeader>
            <CardContent className="p-0">
                <Tabs defaultValue="history" className="w-full">
                    <TabsList className="bg-slate-50 px-8 h-12 border-b rounded-none w-full justify-start gap-10">
                        <TabsTrigger value="history" className="data-[state=active]:border-b-2 data-[state=active]:border-blue-900 data-[state=active]:bg-transparent rounded-none px-0 text-xs font-black uppercase tracking-widest text-slate-400 data-[state=active]:text-blue-900">Active Ledger</TabsTrigger>
                        {isAdmin && <TabsTrigger value="recycle" className="data-[state=active]:border-b-2 data-[state=active]:border-blue-900 data-[state=active]:bg-transparent rounded-none px-0 text-xs font-black uppercase tracking-widest text-slate-400 data-[state=active]:text-blue-900">Archive Hub ({recycled?.length || 0})</TabsTrigger>}
                    </TabsList>
                    <TabsContent value="history" className="m-0 focus-visible:ring-0">
                        <HistoryTable data={paginatedHistory} onDelete={onDelete} />
                        <div className="p-6 bg-slate-50 border-t flex items-center justify-between">
                            <Pagination 
                                currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage}
                                canNextPage={currentPage < totalPages} canPreviousPage={currentPage > 1}
                                itemCount={filteredHistory.length}
                            />
                        </div>
                    </TabsContent>
                    {isAdmin && (
                        <TabsContent value="recycle" className="m-0 focus-visible:ring-0">
                            <RecycleBinTable data={recycled} onRestore={onRestore} onPermanentDelete={onPermanentDelete} />
                        </TabsContent>
                    )}
                </Tabs>
            </CardContent>
        </Card>
    );
}