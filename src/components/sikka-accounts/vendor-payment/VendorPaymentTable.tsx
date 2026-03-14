'use client';

import { useState } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { 
    Eye, 
    CreditCard, 
    Edit2, 
    Printer, 
    ExternalLink, 
    History,
    CheckCircle2,
    AlertCircle,
    Loader2,
    X as XIcon,
    ArrowRightLeft,
    Layers
} from 'lucide-react';
import type { VendorInvoice, WithId, Party } from '@/types';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import Pagination from '@/components/dashboard/vehicle-management/Pagination';
import PaymentActionModals from './PaymentActionModals';
import PrintReceiptModal from './PrintReceiptModal';

const ITEMS_PER_PAGE = 10;

export default function VendorPaymentTable({ data, vendors }: { data: WithId<VendorInvoice>[], vendors: Party[] }) {
    const [currentPage, setCurrentPage] = useState(1);
    const [actionModal, setActionModal] = useState<{ type: 'Pay' | 'Edit', invoice: WithId<VendorInvoice> } | null>(null);
    const [printInvoice, setPrintInvoice] = useState<WithId<VendorInvoice> | null>(null);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);

    const totalPages = Math.ceil(data.length / ITEMS_PER_PAGE);
    const paginated = data.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

    const getStatusStyle = (status: string) => {
        switch(status) {
            case 'Closed': return 'bg-emerald-600 text-white shadow-emerald-100';
            case 'Partially Paid': return 'bg-amber-50 text-amber-700 border-amber-200';
            case 'Open': return 'bg-red-600 text-white shadow-red-100';
            default: return 'bg-slate-400 text-white';
        }
    };

    return (
        <div className="flex flex-col">
            <div className="overflow-x-auto">
                <Table className="border-collapse w-full min-w-[2400px]">
                    <TableHeader className="bg-slate-50">
                        <TableRow className="h-14 border-b border-slate-200 hover:bg-transparent">
                            <TableHead className="text-[10px] font-black uppercase text-slate-400 px-6 text-center w-16">Sr</TableHead>
                            <TableHead className="text-[10px] font-black uppercase text-blue-900 px-4 bg-blue-50/50">Firm Name (Lifting Node)</TableHead>
                            <TableHead className="text-[10px] font-black uppercase text-slate-400 px-4">Invoice Number</TableHead>
                            <TableHead className="text-[10px] font-black uppercase text-slate-400 px-4 text-center">Date</TableHead>
                            <TableHead className="text-[10px] font-black uppercase text-slate-400 px-4">Vendor Registry</TableHead>
                            <TableHead className="text-[10px] font-black uppercase text-slate-400 px-4">GSTIN / PAN</TableHead>
                            <TableHead className="text-[10px] font-black uppercase text-slate-400 px-4">Vendor State</TableHead>
                            <TableHead className="text-[10px] font-black uppercase text-slate-400 px-4">Item Details</TableHead>
                            <TableHead className="text-[10px] font-black uppercase text-slate-400 px-4 text-center">HSN/SAC</TableHead>
                            <TableHead className="text-[10px] font-black uppercase text-slate-400 px-4 text-right">Qty</TableHead>
                            <TableHead className="text-[10px] font-black uppercase text-slate-400 px-4 text-right">Taxable (₹)</TableHead>
                            <TableHead className="text-[10px] font-black uppercase text-slate-400 px-4 text-right">CGST</TableHead>
                            <TableHead className="text-[10px] font-black uppercase text-slate-400 px-4 text-right">SGST</TableHead>
                            <TableHead className="text-[10px] font-black uppercase text-slate-400 px-4 text-right">IGST</TableHead>
                            <TableHead className="text-[10px] font-black uppercase text-slate-400 px-4 text-right font-black">Gross Invoice Amount</TableHead>
                            
                            <TableHead className="text-[10px] font-black uppercase text-blue-600 px-4 text-right bg-blue-50/30">Total Paid</TableHead>
                            <TableHead className="text-[10px] font-black uppercase text-blue-600 px-4 text-center bg-blue-50/30">Last Paid Date</TableHead>
                            <TableHead className="text-[10px] font-black uppercase text-blue-600 px-4 text-left bg-blue-50/30">Last Bank Ref</TableHead>
                            
                            <TableHead className="text-[10px] font-black uppercase text-red-600 px-4 text-right bg-red-50/30 font-black">Balance</TableHead>
                            <TableHead className="text-[10px] font-black uppercase text-slate-400 px-4 text-center">Status</TableHead>
                            <TableHead className="text-[10px] font-black uppercase text-slate-400 px-6 text-right sticky right-0 bg-white shadow-[-4px_0_10px_rgba(0,0,0,0.05)]">Action</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {paginated.map((inv, idx) => {
                            const totalPaid = (inv.payments || []).reduce((sum, p) => sum + (p.paidAmount || 0) + (p.tdsAmount || 0) + (p.deductionAmount || 0), 0);
                            
                            // RESILIENT REGISTRY NODE: Fallback hierarchy to ensure data visibility
                            const taxableValue = Number(inv.taxableAmount || inv.taxable || 0);
                            const grossValue = Number(inv.grossAmount || inv.payableAmount || taxableValue || 0);
                            const balance = Math.max(0, grossValue - totalPaid);
                            
                            const itemSummary = inv.items?.map((it: any) => it.itemDescription).join(', ') || '--';
                            const hsnSummary = inv.items?.map((it: any) => it.hsnSac).filter(Boolean).join(', ') || '--';
                            const qtySummary = inv.items?.reduce((sum: number, it: any) => sum + (it.qty || 0), 0) || 0;

                            return (
                                <TableRow key={inv.id} className="h-16 border-b border-slate-50 hover:bg-blue-50/20 transition-all group">
                                    <TableCell className="text-center font-black text-slate-300 text-[11px]">{(currentPage - 1) * ITEMS_PER_PAGE + idx + 1}</TableCell>
                                    <TableCell className="px-4 font-black text-slate-900 uppercase text-xs bg-blue-50/10">{inv.firmName}</TableCell>
                                    <TableCell className="px-4">
                                        <button 
                                            onClick={() => inv.invoiceFileUrl && setPreviewUrl(inv.invoiceFileUrl)}
                                            className="font-black text-blue-700 text-xs hover:underline flex items-center gap-1.5"
                                        >
                                            {inv.invoiceNo} <ExternalLink className="h-3 w-3 opacity-40" />
                                        </button>
                                    </TableCell>
                                    <TableCell className="px-4 text-center text-[11px] font-bold text-slate-500 whitespace-nowrap">{format(new Date(inv.invoiceDate), 'dd.MM.yy')}</TableCell>
                                    <TableCell className="px-4">
                                        <p className="text-[11px] font-black text-slate-800 uppercase leading-none">{inv.vendorName}</p>
                                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">CODE: {inv.vendorId?.slice(-6).toUpperCase() || '--'}</span>
                                    </TableCell>
                                    <TableCell className="px-4 font-mono text-[10px] font-bold">
                                        <p className="text-blue-900">{inv.vendorGstin || '--'}</p>
                                        <span className="text-slate-400">{inv.vendorPan || '--'}</span>
                                    </TableCell>
                                    <TableCell className="px-4 text-[10px] font-black uppercase text-slate-500">{inv.vendorState || '--'} ({inv.vendorStateCode || '--'})</TableCell>
                                    <TableCell className="px-4">
                                        <TooltipProvider>
                                            <Tooltip>
                                                <TooltipTrigger asChild>
                                                    <span className="text-[11px] font-bold text-slate-600 truncate max-w-[150px] block cursor-help">{itemSummary}</span>
                                                </TooltipTrigger>
                                                <TooltipContent className="max-w-xs p-3 font-medium bg-slate-900 text-white border-none shadow-2xl">
                                                    {itemSummary}
                                                </TooltipContent>
                                            </Tooltip>
                                        </TooltipProvider>
                                    </TableCell>
                                    <TableCell className="px-4 text-center font-mono text-[10px]">{hsnSummary}</TableCell>
                                    <TableCell className="px-4 text-right font-black text-slate-700">{qtySummary}</TableCell>
                                    <TableCell className="px-4 text-right font-bold text-slate-500">₹ {taxableValue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</TableCell>
                                    <TableCell className="px-4 text-right text-emerald-600 font-bold">₹ {(inv.cgstAmount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</TableCell>
                                    <TableCell className="px-4 text-right text-emerald-600 font-bold">₹ {(inv.sgstAmount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</TableCell>
                                    <TableCell className="px-4 text-right font-bold text-orange-600">₹ {(inv.igstAmount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</TableCell>
                                    <TableCell className="px-4 text-right font-black text-slate-900 text-sm">₹ {grossValue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</TableCell>
                                    
                                    <TableCell className="px-4 text-right bg-blue-50/20">
                                        <TooltipProvider>
                                            <Tooltip>
                                                <TooltipTrigger asChild>
                                                    <span className="font-black text-blue-700 cursor-help border-b border-dashed border-blue-300">
                                                        ₹ {totalPaid.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                                    </span>
                                                </TooltipTrigger>
                                                <TooltipContent className="p-0 border-none shadow-3xl rounded-2xl overflow-hidden min-w-[400px]">
                                                    <div className="bg-slate-900 p-3 text-white flex items-center gap-2">
                                                        <History className="h-3.5 w-3.5 text-blue-400" />
                                                        <span className="text-[10px] font-black uppercase tracking-widest">Payment Settlement Ledger</span>
                                                    </div>
                                                    <div className="p-0 bg-white max-h-[400px] overflow-y-auto">
                                                        {(inv.payments || []).length === 0 ? (
                                                            <div className="p-6 text-center text-[10px] text-slate-400 italic uppercase tracking-widest">No payments recorded node.</div>
                                                        ) : (
                                                            <Table>
                                                                <TableHeader className="bg-slate-50">
                                                                    <TableRow className="h-10 hover:bg-transparent border-b">
                                                                        <TableHead className="text-[9px] font-black uppercase px-4 h-10 text-slate-500">Date</TableHead>
                                                                        <TableHead className="text-[9px] font-black uppercase px-2 h-10 text-right text-blue-600">Pay Amt</TableHead>
                                                                        <TableHead className="text-[9px] font-black uppercase px-2 h-10 text-right text-orange-600">TDS</TableHead>
                                                                        <TableHead className="text-[9px] font-black uppercase px-2 h-10 text-right text-red-600">Ded</TableHead>
                                                                    </TableRow>
                                                                </TableHeader>
                                                                <TableBody>
                                                                    {inv.payments.map((p, i) => (
                                                                        <TableRow key={i} className="h-10 border-b border-slate-50 last:border-0 hover:bg-slate-50/50">
                                                                            <TableCell className="px-4 py-2 text-[10px] font-bold text-slate-500 font-mono">
                                                                                {format(new Date(p.paymentDate), 'dd.MM.yy')}
                                                                            </TableCell>
                                                                            <TableCell className="px-2 py-2 text-[10px] font-black text-blue-900 text-right">
                                                                                {(p.paidAmount || 0).toLocaleString()}
                                                                            </TableCell>
                                                                            <TableCell className="px-2 py-2 text-[10px] font-bold text-orange-600 text-right">
                                                                                {(p.tdsAmount || 0).toLocaleString()}
                                                                            </TableCell>
                                                                            <TableCell className="px-2 py-2 text-[10px] font-bold text-red-600 text-right">
                                                                                {(p.deductionAmount || 0).toLocaleString()}
                                                                            </TableCell>
                                                                        </TableRow>
                                                                    ))}
                                                                </TableBody>
                                                            </Table>
                                                        )}
                                                    </div>
                                                </TooltipContent>
                                            </Tooltip>
                                        </TooltipProvider>
                                    </TableCell>
                                    <TableCell className="px-4 text-center bg-blue-50/20 text-[10px] font-bold text-slate-500">
                                        {inv.payments && inv.payments.length > 0 ? format(new Date(inv.payments[inv.payments.length - 1].paymentDate), 'dd.MM.yy') : '--'}
                                    </TableCell>
                                    <TableCell className="px-4 bg-blue-50/20 font-mono text-[10px] font-bold text-blue-900 truncate max-w-[120px]">
                                        {inv.payments && inv.payments.length > 0 ? inv.payments[inv.payments.length - 1].paymentRefNo : '--'}
                                    </TableCell>

                                    <TableCell className="px-4 text-right bg-red-50/20 font-black text-red-600 text-sm">
                                        ₹ {balance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                    </TableCell>
                                    <TableCell className="px-4 text-center">
                                        <Badge className={cn("text-[9px] font-black uppercase px-3 shadow-sm border-none min-w-[85px] justify-center h-6", getStatusStyle(inv.paymentStatus))}>
                                            {inv.paymentStatus}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="px-6 text-right sticky right-0 bg-white/95 group-hover:bg-blue-50/95 group-odd:bg-slate-50/95 backdrop-blur-sm z-10 shadow-[-4px_0_10px_rgba(0,0,0,0.05)] border-l">
                                        <div className="flex justify-end items-center gap-2">
                                            <Button 
                                                variant="ghost" 
                                                size="icon" 
                                                className="h-8 w-8 text-blue-600 hover:bg-blue-50 rounded-lg"
                                                onClick={() => setActionModal({ type: 'Pay', invoice: inv })}
                                                disabled={inv.paymentStatus === 'Closed'}
                                            >
                                                <CreditCard className="h-4 w-4" />
                                            </Button>
                                            <Button 
                                                variant="ghost" 
                                                size="icon" 
                                                className="h-8 w-8 text-slate-600 hover:bg-slate-100 rounded-lg"
                                                onClick={() => setActionModal({ type: 'Edit', invoice: inv })}
                                            >
                                                <Edit2 className="h-4 w-4" />
                                            </Button>
                                            <Button 
                                                variant="ghost" 
                                                size="icon" 
                                                className="h-8 w-8 text-emerald-600 hover:bg-emerald-50 rounded-lg"
                                                onClick={() => setPrintInvoice(inv)}
                                            >
                                                <Printer className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            );
                        })}
                    </TableBody>
                </Table>
            </div>

            <div className="p-6 bg-slate-50 border-t flex items-center justify-between rounded-b-[3rem]">
                <Pagination 
                    currentPage={currentPage} 
                    totalPages={totalPages} 
                    onPageChange={setCurrentPage} 
                    itemCount={data.length}
                    canPreviousPage={currentPage > 1}
                    canNextPage={currentPage < totalPages}
                />
            </div>

            <Dialog open={!!previewUrl} onOpenChange={() => setPreviewUrl(null)}>
                <DialogContent className="max-w-4xl h-[85vh] p-0 border-none shadow-3xl bg-slate-900">
                    <div className="flex flex-col h-full">
                        <DialogHeader className="p-4 bg-slate-900 border-b border-white/5 flex flex-row items-center justify-between space-y-0 pr-12">
                            <DialogTitle className="text-white uppercase font-black tracking-widest text-xs">Mission Document Preview</DialogTitle>
                            <DialogDescription className="text-white/40 uppercase font-black tracking-tighter text-[9px]">Document Registry Visualization Node</DialogDescription>
                        </DialogHeader>
                        <div className="flex-1 bg-slate-100 m-4 rounded-xl overflow-hidden relative">
                            {previewUrl && (
                                previewUrl.startsWith('data:application/pdf') ? (
                                    <iframe src={previewUrl} className="w-full h-full border-none" title="Invoice PDF" />
                                ) : (
                                    <img src={previewUrl} alt="Invoice" className="w-full h-full object-contain" />
                                )
                            )}
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            {actionModal && (
                <PaymentActionModals 
                    isOpen={!!actionModal}
                    onClose={() => setActionModal(null)}
                    type={actionModal.type}
                    invoice={actionModal.invoice}
                    vendors={vendors}
                />
            )}

            {printInvoice && (
                <PrintReceiptModal 
                    isOpen={!!printInvoice}
                    onClose={() => setPrintInvoice(null)}
                    invoice={printInvoice}
                />
            )}
        </div>
    );
}
