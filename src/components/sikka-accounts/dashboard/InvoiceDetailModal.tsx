'use client';
import { useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { format, isValid } from 'date-fns';
import { FileText, ShieldCheck, Calculator, Landmark, Factory, User, Receipt, FileX, FileDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Timestamp } from 'firebase/firestore';
import * as XLSX from 'xlsx';

type ModalState = {
    type: 'invoice' | 'paid' | 'balance' | 'outward-invoice' | 'outward-pay' | 'unpaid';
    data: any[];
    title: string;
} | null;

interface InvoiceDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  modalState: NonNullable<ModalState>;
}

const formatSafeDate = (date: any, pattern: string) => {
    if (!date) return '--';
    try {
        const d = date instanceof Timestamp ? date.toDate() : new Date(date);
        return isValid(d) ? format(d, pattern) : '--';
    } catch (e) {
        return '--';
    }
};

const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    }).format(amount || 0);
};

const getStatusColor = (status: string) => {
    if (status === 'Paid' || status === 'Closed') return 'bg-emerald-600 text-white';
    if (status === 'Partly Paid') return 'bg-amber-50 text-amber-700 border-amber-200';
    if (status === 'Unpaid' || status === 'Open') return 'bg-red-600 text-white';
    return 'bg-slate-400';
};

const ALL_COLUMNS: { [key: string]: { label: string; format?: (value: any) => any; align?: 'right' | 'left' | 'center', isBadge?: boolean } } = {
    plantId: { label: 'Plant ID' },
    firmName: { label: 'Plant Name' },
    invoiceNo: { label: 'Invoice Number' },
    invoiceDate: { label: 'Invoice Date', format: (d: any) => formatSafeDate(d, 'dd.MM.yyyy') },
    billMonth: { label: 'Bill Month' },
    buyerName: { label: 'Consignee' },
    vendorName: { label: 'Vendor' },
    chargeTypeName: { label: 'Charge Type' },
    taxableAmount: { label: 'Taxable Amount', format: formatCurrency, align: 'right' },
    gstAmount: { label: 'Total GST Amount', format: formatCurrency, align: 'right' },
    taxable: { label: 'Taxable Amount', format: formatCurrency, align: 'right' },
    gst: { label: 'GST Amount', format: formatCurrency, align: 'right' },
    gross: { label: 'Total Invoice Amount', format: formatCurrency, align: 'right' },
    netPayable: { label: 'Net Payable Amount', format: formatCurrency, align: 'right' },
    grandTotal: { label: 'Net Payable Amount', format: formatCurrency, align: 'right' },
    totalActualReceipt: { label: 'Paid Amount', format: formatCurrency, align: 'right' },
    totalTds: { label: 'TDS Amount', format: formatCurrency, align: 'right' },
    payAmt: { label: 'Pay Amount', format: formatCurrency, align: 'right' },
    tdsAmt: { label: 'TDS Amount', format: formatCurrency, align: 'right' },
    dedAmt: { label: 'Deduction Amount', format: formatCurrency, align: 'right' },
    paymentDate: { label: 'Paid Date', format: (d: any) => formatSafeDate(d, 'dd.MM.yyyy') },
    closing: { label: 'Closing Amount', format: formatCurrency, align: 'right' },
    balance: { label: 'Closing Amount', format: formatCurrency, align: 'right' },
    paymentStatus: { label: 'Status', isBadge: true },
};

const MODAL_CONFIGS = {
    invoice: {
        title: 'Inward: Document Manifest',
        columns: ['firmName', 'buyerName', 'invoiceNo', 'invoiceDate', 'chargeTypeName', 'taxableAmount', 'gstAmount', 'netPayable'],
        sums: ['taxableAmount', 'gstAmount', 'netPayable']
    },
    unpaid: {
        title: 'Inward: Unpaid Document Manifest',
        columns: ['plantId', 'invoiceNo', 'invoiceDate', 'billMonth', 'buyerName', 'chargeTypeName', 'balance'],
        sums: ['balance']
    },
    paid: {
        title: 'Inward: Receipt Manifest',
        columns: ['firmName', 'buyerName', 'invoiceNo', 'invoiceDate', 'chargeTypeName', 'netPayable', 'totalActualReceipt', 'totalTds', 'paymentDate', 'balance'],
        sums: ['netPayable', 'totalActualReceipt', 'totalTds', 'balance']
    },
    balance: {
        title: 'Inward: Outstanding Balance Registry',
        columns: ['firmName', 'invoiceNo', 'invoiceDate', 'buyerName', 'balance'],
        sums: ['balance']
    },
    'outward-invoice': {
        title: 'Outward: Invoice Manifest (MIRO)',
        columns: ['firmName', 'invoiceNo', 'invoiceDate', 'vendorName', 'taxable', 'gst', 'gross'],
        sums: ['taxable', 'gst', 'gross']
    },
    'outward-pay': {
        title: 'Outward: Settlement Manifest (F110)',
        columns: ['firmName', 'invoiceNo', 'invoiceDate', 'vendorName', 'gross', 'payAmt', 'tdsAmt', 'dedAmt', 'closing'],
        sums: ['gross', 'payAmt', 'tdsAmt', 'dedAmt', 'closing']
    }
};

export default function InvoiceDetailModal({ isOpen, onClose, modalState }: InvoiceDetailModalProps) {
    const config = MODAL_CONFIGS[modalState.type];
    const columns = useMemo(() => config.columns.map(key => {
        const col = ALL_COLUMNS[key] || { label: key.charAt(0).toUpperCase() + key.slice(1), align: typeof modalState.data[0]?.[key] === 'number' ? 'right' : 'left' };
        return { key, ...col };
    }), [config, modalState.data]);

    const aggregateSums = useMemo(() => {
        const res: Record<string, number> = {};
        config.sums.forEach(key => {
            res[key] = modalState.data.reduce((sum, rec) => sum + (Number(rec[key]) || 0), 0);
        });
        return res;
    }, [config.sums, modalState.data]);

    const handleExportExcel = () => {
        const dataToExport = modalState.data.map(rec => {
            const row: any = {};
            columns.forEach(col => {
                let val = rec[col.key];
                if (val instanceof Timestamp) val = format(val.toDate(), 'dd.MM.yyyy');
                else if (val instanceof Date) val = format(val, 'dd.MM.yyyy');
                row[col.label] = val ?? '--';
            });
            return row;
        });

        const ws = XLSX.utils.json_to_sheet(dataToExport);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Manifest");
        XLSX.writeFile(wb, `${modalState.type.toUpperCase()}_Manifest_${format(new Date(), 'yyyyMMdd')}.xlsx`);
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-[90vw] w-[1400px] h-[85vh] flex flex-col p-0 border-none shadow-3xl overflow-hidden bg-[#f8fafc]">
                <DialogHeader className="p-8 bg-slate-900 text-white shrink-0">
                    <div className="flex justify-between items-center pr-12">
                        <div className="flex items-center gap-5">
                            <div className="p-3 bg-blue-600 rounded-2xl shadow-xl">
                                {modalState.type === 'unpaid' ? <FileX className="h-8 w-8 text-white" /> : <Landmark className="h-8 w-8 text-white" />}
                            </div>
                            <div>
                                <DialogTitle className="text-2xl font-black uppercase tracking-tight italic">{config.title}</DialogTitle>
                                <DialogDescription className="text-blue-300 font-bold uppercase text-[9px] tracking-widest mt-1">
                                    Node Registry: {modalState.title} | {modalState.data.length} Records
                                </DialogDescription>
                            </div>
                        </div>
                        <div className="flex items-center gap-4">
                            <Button onClick={handleExportExcel} variant="outline" className="h-10 bg-white/10 border-white/20 text-white font-black text-[10px] uppercase tracking-widest px-6 hover:bg-white/20">
                                <FileDown className="h-4 w-4 mr-2" /> Export Excel
                            </Button>
                            <Badge className="bg-emerald-600 font-black uppercase tracking-[0.2em] text-[10px] px-6 py-2 border-none shadow-lg">Verified Extraction</Badge>
                        </div>
                    </div>
                </DialogHeader>

                <div className="flex-1 overflow-y-auto p-10">
                    <div className="rounded-[2.5rem] border-2 border-slate-200 bg-white shadow-2xl overflow-hidden">
                        <Table className="border-collapse">
                            <TableHeader className="bg-slate-100">
                                <TableRow className="h-16 border-b border-slate-200 hover:bg-transparent">
                                    {columns.map(col => (
                                        <TableHead key={col.key} className={cn(
                                            "text-[10px] font-black uppercase text-slate-500 px-6",
                                            col.align === 'right' ? "text-right" : ""
                                        )}>
                                            {col.label}
                                        </TableHead>
                                    ))}
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {modalState.data.length === 0 ? (
                                    <TableRow><TableCell colSpan={columns.length} className="h-64 text-center text-slate-400 italic font-medium uppercase tracking-widest opacity-40">Registry empty for current node.</TableCell></TableRow>
                                ) : (
                                    modalState.data.map((record, idx) => (
                                        <TableRow key={record.id || idx} className="h-16 border-b border-slate-50 last:border-0 hover:bg-blue-50/20 transition-colors group">
                                            {columns.map(col => {
                                                const value = record[col.key];
                                                return (
                                                    <TableCell key={col.key} className={cn(
                                                        "px-6 font-bold text-slate-700 text-xs transition-colors group-hover:text-blue-900",
                                                        col.align === 'right' ? 'text-right font-black' : ''
                                                    )}>
                                                        {col.isBadge ? (
                                                            <Badge className={cn("text-[9px] font-black uppercase px-3", getStatusColor(value))}>{value}</Badge>
                                                        ) : col.key === 'invoiceNo' ? (
                                                            <span className="text-blue-700 font-black tracking-tighter">{value}</span>
                                                        ) : col.format ? (
                                                            col.format(value)
                                                        ) : (
                                                            value || '--'
                                                        )}
                                                    </TableCell>
                                                )
                                            })}
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                            <TableFooter className="bg-slate-900 text-white">
                                <TableRow className="h-16 hover:bg-transparent border-none">
                                    {columns.map((col, i) => {
                                        const isFirst = i === 0;
                                        const isSummable = config.sums.includes(col.key);
                                        return (
                                            <TableCell key={i} className={cn(
                                                "px-6 font-black uppercase",
                                                isFirst ? "text-[11px] tracking-[0.2em]" : "",
                                                col.align === 'right' ? "text-right" : ""
                                            )}>
                                                {isFirst ? "Aggregate Registry Totals" : isSummable ? formatCurrency(aggregateSums[col.key]) : ""}
                                            </TableCell>
                                        );
                                    })}
                                </TableRow>
                            </TableFooter>
                        </Table>
                    </div>
                </div>

                <DialogFooter className="p-6 bg-slate-50 border-t flex-row items-center justify-between sm:justify-between shrink-0">
                    <div className="flex items-center gap-3 text-slate-400">
                        <ShieldCheck className="h-4 w-4" />
                        <span className="text-[10px] font-black uppercase tracking-widest">Registry Synchronization Node OK</span>
                    </div>
                    <Button onClick={onClose} className="bg-slate-900 hover:bg-black text-white px-12 h-11 rounded-xl font-black uppercase text-[10px] tracking-widest shadow-xl border-none">Close Dashboard Manifest</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
