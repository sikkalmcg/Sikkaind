
'use client';

import { useState, useMemo, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { format, isValid } from 'date-fns';
import * as XLSX from 'xlsx';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { 
    ArrowUpDown, 
    Layout, 
    ArrowLeft, 
    WifiOff, 
    FileDown, 
    Search,
    ShieldCheck
} from 'lucide-react';

import type { WithId, Invoice, Party, Plant } from '@/types';
import { type SelectionCriteria } from './SelectionScreen';
import ColumnSelectionModal from './ColumnSelectionModal';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where, Timestamp } from 'firebase/firestore';
import { cn, normalizePlantId } from '@/lib/utils';
import Pagination from '@/components/dashboard/vehicle-management/Pagination';

interface ResultGridProps {
  criteria: SelectionCriteria;
  onBack: () => void;
}

export type ColumnDef = { key: string; label: string; visible: boolean };

const INITIAL_COLUMNS: ColumnDef[] = [
  { key: 'plantId', label: 'Plant', visible: true },
  { key: 'migoNumber', label: 'MIGO Number', visible: true },
  { key: 'invoiceType', label: 'Invoice Type', visible: true },
  { key: 'chargeType', label: 'Charge Type', visible: true },
  { key: 'invoiceNo', label: 'Invoice No', visible: true },
  { key: 'invoiceDate', label: 'Invoice Date', visible: true },
  { key: 'billMonth', label: 'Bill Month', visible: true },
  { key: 'irn', label: 'IRN Number', visible: true },
  { key: 'ackNo', label: 'ACK Number', visible: true },
  { key: 'ackDate', label: 'ACK Date', visible: true },
  { key: 'consignorName', label: 'Consignor', visible: true },
  { key: 'consignorGstin', label: 'Consignor GSTIN', visible: true },
  { key: 'consignorState', label: 'Consignor State', visible: true },
  { key: 'buyerName', label: 'Consignee', visible: true },
  { key: 'consigneeGstin', label: 'Consignee GSTIN', visible: true },
  { key: 'consigneeState', label: 'Consignee State', visible: true },
  { key: 'shipToPartyName', label: 'Ship to Party', visible: true },
  { key: 'itemDescription', label: 'Item Manifest', visible: true },
  { key: 'hsnSac', label: 'HSN/SAC', visible: true },
  { key: 'qty', label: 'Qty', visible: true },
  { key: 'uom', label: 'UOM', visible: true },
  { key: 'rate', label: 'Rate', visible: true },
  { key: 'amount', label: 'Amount', visible: true },
  { key: 'taxableAmount', label: 'Taxable Amount', visible: true },
  { key: 'gstRate', label: 'GST Rate %', visible: true },
  { key: 'cgstAmount', label: 'CGST Amt', visible: true },
  { key: 'sgstAmount', label: 'SGST Amt', visible: true },
  { key: 'igstAmount', label: 'IGST Amt', visible: true },
  { key: 'totalNetPayable', label: 'Total Net Payable', visible: true },
  { key: 'receiptAmount', label: 'Paid Amount', visible: true },
  { key: 'tdsAmount', label: 'TDS Amount', visible: true },
  { key: 'interestAmount', label: 'Interest Amount', visible: true },
  { key: 'paymentDate', label: 'Paid Date', visible: true },
  { key: 'bankingRef', label: 'BANK UTR', visible: true },
  { key: 'paymentAdvise', label: 'Payment Advise', visible: true },
  { key: 'balanceAmount', label: 'Balance Amount', visible: true },
  { key: 'paymentStatus', label: 'Status', visible: true }
];

export default function ResultGrid({ criteria, onBack }: ResultGridProps) {
  const { toast } = useToast();
  const router = useRouter();
  const firestore = useFirestore();
  
  const [searchTerm, setSearchTerm] = useState('');
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null);
  const [isLayoutModalOpen, setIsLayoutModalOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 15;

  const [columns, setColumns] = useState<ColumnDef[]>(INITIAL_COLUMNS);

  const invoicesQuery = useMemoFirebase(() => 
    firestore ? query(collection(firestore, "invoices"), where("plantId", "==", criteria.plantId)) : null, 
    [firestore, criteria.plantId]
  );
  const { data: dbInvoices, isLoading, error: dbError } = useCollection<Invoice>(invoicesQuery);

  const partiesQuery = useMemoFirebase(() => firestore ? query(collection(firestore, "parties")) : null, [firestore]);
  const { data: parties } = useCollection<Party>(partiesQuery);

  const itQuery = useMemoFirebase(() => firestore ? query(collection(firestore, "master_invoice_types")) : null, [firestore]);
  const ctQuery = useMemoFirebase(() => firestore ? query(collection(firestore, "master_charge_types")) : null, [firestore]);
  const { data: invoiceTypes } = useCollection<any>(itQuery);
  const { data: chargeTypes } = useCollection<any>(ctQuery);

  const plantsQuery = useMemoFirebase(() => firestore ? query(collection(firestore, "accounts_plants")) : null, [firestore]);
  const { data: plants } = useCollection<any>(plantsQuery);

  useEffect(() => {
    const storageKey = `zinv_layout_v5_${criteria.plantId}`;
    const saved = localStorage.getItem(storageKey);
    if (saved) setColumns(JSON.parse(saved));
  }, [criteria.plantId]);

  const reportData = useMemo(() => {
    const rawData = dbInvoices || [];
    const start = criteria.fromDate;
    const end = new Date(criteria.toDate);
    end.setHours(23, 59, 59, 999);

    const rows: any[] = [];
    rawData.forEach(inv => {
        if (inv.paymentStatus === 'Draft') return;

        const invDate = inv.invoiceDate instanceof Timestamp ? inv.invoiceDate.toDate() : new Date(inv.invoiceDate);
        if (invDate < start || invDate > end) return;

        const buyer = parties?.find(p => p.id === inv.consigneeId);
        const consignorNode = plants?.find(p => p.id === inv.consignorId);
        
        const resolvedIT = invoiceTypes?.find(it => it.id === inv.invoiceType)?.name || inv.invoiceType;
        const resolvedCT = chargeTypes?.find(ct => ct.id === inv.chargeType)?.name || inv.chargeType;

        let shipToName = inv.isShipToSame ? (buyer?.name || inv.consigneeId) : (parties?.find(p => p.id === inv.shipToId)?.name || inv.shipToId || '--');

        const payments = inv.payments || [];
        const lastPayment = payments.length > 0 ? payments[payments.length - 1] : null;
        const totalPaid = payments.reduce((sum, p) => sum + (p.receiptAmount || 0) + (p.tdsAmount || 0), 0);
        const totalTds = payments.reduce((sum, p) => sum + (p.tdsAmount || 0), 0);
        const totalInterest = payments.reduce((sum, p) => sum + (p.interestAmount || 0), 0);

        const totalNetPayableValue = inv.totals?.grandTotal || (inv.totals as any)?.grand || 0;

        inv.items.forEach((item: any) => {
            rows.push({
                ...inv,
                ...item,
                invoiceId: inv.id,
                invoiceType: resolvedIT,
                chargeType: resolvedCT,
                irn: inv.irn?.trim() ? inv.irn : 'IRN Pending', // IRN Pending Logic for ZINV
                consignorName: consignorNode?.name || inv.consignorId,
                consignorGstin: consignorNode?.gstin || '--',
                consignorState: consignorNode ? `${consignorNode.state} (${consignorNode.stateCode})` : '--',
                buyerName: buyer?.name || inv.consigneeId,
                consigneeGstin: buyer?.gstin || '--',
                consigneeState: buyer ? `${buyer.state} (${buyer.stateCode})` : '--',
                shipToPartyName: shipToName,
                invoiceDate: invDate,
                ackDate: inv.ackDate instanceof Timestamp ? inv.ackDate.toDate() : (inv.ackDate ? new Date(inv.ackDate) : null),
                amount: item.amount,
                taxableAmount: item.amount,
                cgstAmount: inv.totals?.cgst || 0,
                sgstAmount: inv.totals?.sgst || 0,
                igstAmount: inv.totals?.igst || 0,
                totalNetPayable: totalNetPayableValue,
                receiptAmount: totalPaid,
                tdsAmount: totalTds,
                interestAmount: totalInterest,
                migoNumber: lastPayment?.migoNumber || '--',
                paymentDate: lastPayment?.paymentDate instanceof Timestamp ? lastPayment.paymentDate.toDate() : (lastPayment?.paymentDate ? new Date(lastPayment.paymentDate) : null),
                bankingRef: lastPayment?.bankingRef || '--',
                paymentAdvise: lastPayment?.paymentAdvise || '--',
                balanceAmount: totalNetPayableValue - totalPaid,
                paymentStatus: inv.paymentStatus,
                uom: item.uom || 'MT',
                registrySortTime: (inv.lastUpdatedAt instanceof Timestamp ? inv.lastUpdatedAt.toDate() : (inv.createdAt instanceof Timestamp ? inv.createdAt.toDate() : invDate)).getTime(),
                ...inv.docCustomValues,
                ...item.itemCustomValues,
            });
        });
    });
    
    return rows.sort((a, b) => b.registrySortTime - a.registrySortTime);
  }, [dbInvoices, criteria, parties, plants, invoiceTypes, chargeTypes]);

  const filteredData = useMemo(() => {
    if (!searchTerm) return reportData;
    const s = searchTerm.toLowerCase();
    return reportData.filter(row => Object.values(row).some(v => v?.toString().toLowerCase().includes(s)));
  }, [reportData, searchTerm]);

  const sortedData = useMemo(() => {
    if (!sortConfig) return filteredData;
    return [...filteredData].sort((a, b) => {
        const aVal = a[sortConfig.key] || '';
        const bVal = b[sortConfig.key] || '';
        if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
        if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
    });
  }, [filteredData, sortConfig]);

  const paginatedData = sortedData.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);
  const totalPages = Math.ceil(sortedData.length / ITEMS_PER_PAGE);

  const handleExport = () => {
    const visibleCols = columns.filter(c => c.visible);
    const dataToExport = sortedData.map(row => {
        const exportRow: any = {};
        visibleCols.forEach(col => {
            let val = row[col.key];
            if (val instanceof Date) val = format(val, 'dd.MM.yyyy');
            exportRow[col.label] = val !== undefined && val !== null && val !== '' ? val : (typeof val === 'number' ? 0 : '--');
        });
        return exportRow;
    });
    const ws = XLSX.utils.json_to_sheet(dataToExport);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "ZINV_Report");
    XLSX.writeFile(wb, `ZINV_${criteria.plantId}_${format(new Date(), 'yyyyMMdd')}.xlsx`);
  };

  const handleLayoutSave = (newCols: ColumnDef[]) => {
    setColumns(newCols);
    localStorage.setItem(`zinv_layout_v5_${criteria.plantId}`, JSON.stringify(newCols));
    toast({ title: "Layout Persisted", description: "Column configuration updated." });
  };

  const visibleColumns = useMemo(() => columns.filter(c => c.visible), [columns]);

  const handleSort = (key: string) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
        direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  return (
    <div className="flex flex-col h-full bg-[#f8fafc] animate-in fade-in duration-500">
        <div className="sticky top-0 z-30 bg-white border-b px-8 py-4 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-sm print:hidden">
            <div className="flex items-center gap-4">
                <Button onClick={onBack} variant="ghost" size="icon" className="h-10 w-10 rounded-xl"><ArrowLeft className="h-5 w-5 text-slate-400" /></Button>
                <div>
                    <h1 className="text-xl font-black text-slate-800 uppercase tracking-tight">ZINV – Result List</h1>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Node: {criteria.plantId} | {sortedData.length} records</p>
                </div>
            </div>
            <div className="flex items-center gap-4">
                <div className="relative group">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 group-focus-within:text-blue-900" />
                    <Input placeholder="Filter..." value={searchTerm} onChange={e => {setSearchTerm(e.target.value); setCurrentPage(1);}} className="pl-10 w-[280px] h-10 rounded-xl bg-slate-50 border-slate-200 font-bold" />
                </div>
                <Button variant="outline" size="icon" onClick={() => setIsLayoutModalOpen(true)} className="h-10 w-10 text-slate-400 hover:text-blue-900 shadow-sm"><Layout className="h-5 w-5" /></Button>
                <Button variant="outline" size="sm" onClick={handleExport} className="h-10 px-6 font-black text-[11px] uppercase border-slate-200 text-emerald-700 bg-white shadow-sm">
                    <FileDown className="h-4 w-4 mr-2" /> Export Excel
                </Button>
            </div>
        </div>

        <div className="flex-1 p-8 overflow-hidden">
            <Card className="h-full border-none shadow-2xl rounded-[2.5rem] bg-white overflow-hidden flex flex-col">
                <CardContent className="p-0 flex-1 flex flex-col overflow-hidden">
                    <div className="overflow-auto flex-1 custom-scrollbar select-text">
                        <Table className="border-collapse w-auto min-w-full">
                            <TableHeader className="sticky top-0 bg-slate-100 z-10 border-b">
                                <TableRow className="hover:bg-transparent">
                                    {visibleColumns.map((col) => (
                                        <TableHead key={col.key} className="px-6 py-4 border-r border-slate-200 last:border-r-0 whitespace-nowrap min-w-[180px] text-center">
                                            <Button variant="ghost" onClick={() => handleSort(col.key)} className="h-auto px-2 py-1 text-[11px] font-black uppercase tracking-wider text-slate-700 hover:bg-white transition-all gap-2 mx-auto">
                                                {col.label} <ArrowUpDown className="h-3 w-3 text-slate-400" />
                                            </Button>
                                        </TableHead>
                                    ))}
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {isLoading ? (
                                    Array.from({ length: 10 }).map((_, i) => (<TableRow key={i} className="h-12"><TableCell colSpan={visibleColumns.length} className="px-4"><Skeleton className="h-6 w-full opacity-50" /></TableCell></TableRow>))
                                ) : sortedData.length === 0 ? (
                                    <TableRow><TableCell colSpan={visibleColumns.length} className="h-64 text-center text-slate-400 italic font-medium uppercase tracking-[0.3em] opacity-40">No Records Found in Registry</TableCell></TableRow>
                                ) : (
                                    paginatedData.map((row, index) => (
                                        <TableRow key={`${row.invoiceId}-${index}`} onDoubleClick={() => router.push(`/sikka-accounts/invoice/edit?invoiceId=${row.invoiceId}`)} className="h-12 hover:bg-blue-50/30 cursor-pointer border-b border-slate-50 last:border-0 group transition-colors">
                                            {visibleColumns.map((col) => {
                                                const val = row[col.key];
                                                const isIrn = col.key === 'irn';
                                                const isNumeric = typeof val === 'number' && col.key !== 'ackNo' && col.key !== 'irn';
                                                return (
                                                    <TableCell key={col.key} className={cn("px-6 py-3 border-r border-slate-50 last:border-r-0 text-[11px] font-medium", isNumeric && "text-right font-black text-blue-900")}>
                                                        {isIrn && val === 'IRN Pending' ? <Badge className="bg-red-50 text-red-600 border-red-100 text-[9px] font-black">{val}</Badge> : 
                                                         val instanceof Date ? format(val, 'dd.MM.yyyy') : 
                                                         val !== undefined && val !== null && val !== '' ? val : (typeof val === 'number' ? 0 : '--')}
                                                    </TableCell>
                                                );
                                            })}
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </div>
                    <div className="bg-slate-50 border-t px-8 py-3 print:hidden">
                        <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} itemCount={sortedData.length} canPreviousPage={currentPage > 1} canNextPage={currentPage < totalPages} />
                    </div>
                </CardContent>
            </Card>
        </div>
        {isLayoutModalOpen && <ColumnSelectionModal isOpen={isLayoutModalOpen} onClose={() => setIsLayoutModalOpen(false)} columns={columns} onSave={handleLayoutSave} defaultColumns={INITIAL_COLUMNS} />}
    </div>
  );
}
