
'use client';
import { useState, useEffect, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { format } from 'date-fns';
import * as XLSX from 'xlsx';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowUpDown, Layout, ArrowLeft, WifiOff, FileDown, Search } from 'lucide-react';

import type { WithId, Invoice, Party, Plant } from '@/types';
import { type SelectionCriteria } from './SelectionScreen';
import ColumnSelectionModal from './ColumnSelectionModal';
import { useSikkaAccountsPage } from '@/context/SikkaAccountsPageContext';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where, orderBy, Timestamp } from 'firebase/firestore';
import { cn, normalizePlantId } from '@/lib/utils';

interface ResultGridProps {
  criteria: SelectionCriteria;
  onBack: () => void;
}

type ColumnDefinition = { key: string; label: string };

const STATIC_COLUMNS: ColumnDefinition[] = [
  { key: 'plantId', label: 'Plant ID' },
  { key: 'invoiceNo', label: 'Invoice No' },
  { key: 'invoiceDate', label: 'Invoice Date' },
  { key: 'billMonth', label: 'Bill Month' },
  { key: 'irn', label: 'IRN Number' },
  { key: 'ackNo', label: 'ACK Number' },
  { key: 'ackDate', label: 'ACK Date' },
  { key: 'consignorName', label: 'Consignor' },
  { key: 'buyerName', label: 'Buyer (Bill to)' },
  { key: 'consigneeName', label: 'Consignee (Ship to)' },
  { key: 'chargeType', label: 'Charge Type' },
  { key: 'itemDescription', label: 'Item Description' },
  { key: 'hsnSac', label: 'HSN/SAC' },
  { key: 'qty', label: 'Qty' },
  { key: 'uom', label: 'Unit' },
  { key: 'rate', label: 'Rate' },
  { key: 'taxableAmount', label: 'Taxable Amount' },
  { key: 'cgstAmount', label: 'CGST Amount' },
  { key: 'sgstAmount', label: 'SGST Amount' },
  { key: 'igstAmount', label: 'IGST Amount' },
  { key: 'interestAmount', label: 'Interest Amount' },
  { key: 'totalInvoiceAmount', label: 'Gross Amount' },
  { key: 'receiptAmount', label: 'Paid Amount' },
  { key: 'balanceAmount', label: 'Outstanding Balance' },
  { key: 'paymentStatus', label: 'Status' },
];

export default function ResultGrid({ criteria, onBack }: ResultGridProps) {
  const { toast } = useToast();
  const router = useRouter();
  const firestore = useFirestore();
  const { setExportAction } = useSikkaAccountsPage();
  
  const [searchTerm, setSearchTerm] = useState('');
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null);
  const [isLayoutModalOpen, setIsLayoutModalOpen] = useState(false);
  
  const [allColumns] = useState<ColumnDefinition[]>(STATIC_COLUMNS);
  const [visibleColumns, setVisibleColumns] = useState<string[]>(STATIC_COLUMNS.map(c => c.key));

  const invoicesQuery = useMemoFirebase(() => 
    firestore ? query(collection(firestore, "invoices"), where("plantId", "==", criteria.plantId)) : null, 
    [firestore, criteria.plantId]
  );
  const { data: dbInvoices, isLoading, error: dbError } = useCollection<Invoice>(invoicesQuery);

  const partiesQuery = useMemoFirebase(() => firestore ? query(collection(firestore, "parties")) : null, [firestore]);
  const plantsQuery = useMemoFirebase(() => firestore ? query(collection(firestore, "accounts_plants")) : null, [firestore]);
  
  const { data: parties } = useCollection<Party>(partiesQuery);
  const { data: plants } = useCollection<Plant>(plantsQuery);

  const reportData = useMemo(() => {
    const rawData = dbInvoices || [];
    
    const start = criteria.fromDate;
    const end = new Date(criteria.toDate);
    end.setHours(23, 59, 59, 999);

    const rows: any[] = [];
    rawData.forEach(inv => {
        const invDate = inv.invoiceDate instanceof Timestamp ? inv.invoiceDate.toDate() : new Date(inv.invoiceDate);
        if (invDate < start || invDate > end) return;

        const consignor = (plants || []).find(p => p.id === inv.consignorId);
        const consignee = (parties || []).find(p => p.id === inv.consigneeId);
        const shipTo = (parties || []).find(p => p.id === inv.shipToId) || consignee;
        
        const payments = inv.payments || [];
        const totalPaid = payments.reduce((sum, p) => sum + (p.receiptAmount || 0) + (p.tdsAmount || 0), 0);
        const totalInterest = payments.reduce((sum, p) => sum + (p.interestAmount || 0), 0);

        const irnDisplay = inv.irn?.trim() ? inv.irn : 'IRN Pending';

        inv.items.forEach(item => {
            rows.push({
                ...inv,
                ...item,
                invoiceId: inv.id,
                irn: irnDisplay, // IRN Pending Compliance Node
                consignorName: consignor?.name || inv.consignorId,
                buyerName: consignee?.name || inv.consigneeId,
                consigneeName: shipTo?.name || inv.consigneeId,
                invoiceDate: invDate,
                ackDate: inv.ackDate instanceof Timestamp ? inv.ackDate.toDate() : (inv.ackDate ? new Date(inv.ackDate) : null),
                taxableAmount: item.amount,
                cgstAmount: inv.totals?.cgst || 0,
                sgstAmount: inv.totals?.sgst || 0,
                igstAmount: inv.totals?.igst || 0,
                interestAmount: totalInterest,
                totalInvoiceAmount: inv.totals?.grandTotal || (inv.totals as any)?.grand || 0,
                receiptAmount: totalPaid,
                balanceAmount: (inv.totals?.grandTotal || (inv.totals as any)?.grand || 0) - totalPaid,
                uom: item.uom || 'MT',
            });
        });
    });
    return rows;
  }, [dbInvoices, criteria, parties, plants]);

  const filteredData = useMemo(() => reportData.filter(row =>
    visibleColumns.some(colKey => row[colKey]?.toString().toLowerCase().includes(searchTerm.toLowerCase()))
  ), [reportData, searchTerm, visibleColumns]);

  const sortedData = useMemo(() => {
    let sortableItems = [...filteredData];
    if (sortConfig) {
        sortableItems.sort((a, b) => {
            const aVal = a[sortConfig.key] || '';
            const bVal = b[sortConfig.key] || '';
            if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
            if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
            return 0;
        });
    }
    return sortableItems;
  }, [filteredData, sortConfig]);

  const handleExport = useCallback(() => {
    const dataToExport = sortedData.map(row => {
        const selectedRow: any = {};
        visibleColumns.forEach(key => {
            const col = allColumns.find(c => c.key === key);
            let value = row[key];
            if (value instanceof Date) {
                value = format(value, 'dd/MM/yyyy');
            }
            selectedRow[col?.label || key] = value;
        });
        return selectedRow;
    });

    const worksheet = XLSX.utils.json_to_sheet(dataToExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Invoice Report");
    XLSX.writeFile(workbook, `ZINV_${criteria.plantId}_${format(new Date(), 'yyyyMMdd')}.xlsx`);
  }, [sortedData, visibleColumns, allColumns, criteria.plantId]);

  useEffect(() => {
    setExportAction(() => handleExport);
    return () => setExportAction(null);
  }, [handleExport, setExportAction]);

  const handleSort = (key: string) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') direction = 'desc';
    setSortConfig({ key, direction });
  };

  const getStatusColor = (status: string) => {
    if (status === 'Paid') return 'bg-emerald-600 text-white';
    if (status === 'Partly Paid') return 'bg-amber-50 text-amber-700 border-amber-200';
    if (status === 'Unpaid') return 'bg-red-600 text-white';
    return 'bg-slate-400';
  };

  const visibleColumnDetails = useMemo(() => allColumns.filter(c => visibleColumns.includes(c.key)), [visibleColumns, allColumns]);

  return (
    <div className="flex flex-col h-full bg-[#f8fafc] animate-in fade-in duration-500">
        <div className="sticky top-0 z-30 bg-white border-b px-8 py-4 flex items-center justify-between shadow-sm">
            <div className="flex items-center gap-4">
                <Button onClick={onBack} variant="ghost" size="icon" className="h-10 w-10 rounded-xl hover:bg-slate-100 text-slate-400">
                    <ArrowLeft className="h-5 w-5"/>
                </Button>
                <div>
                    <h1 className="text-xl font-black text-slate-800 uppercase tracking-tight italic">ZINV – Invoice Handbook Result</h1>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Lifting Node: {criteria.plantId} | {sortedData.length} records extracted</p>
                </div>
            </div>
            
            <div className="flex items-center gap-4">
                <div className="relative group">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 group-focus-within:text-blue-900 transition-colors" />
                    <Input 
                        placeholder="Registry Filter..." 
                        value={searchTerm} 
                        onChange={e => setSearchTerm(e.target.value)} 
                        className="pl-10 w-[280px] h-10 rounded-xl bg-slate-50 border-slate-200 shadow-inner font-bold" 
                    />
                </div>
                <Button variant="outline" size="icon" onClick={() => setIsLayoutModalOpen(true)} className="h-10 w-10 rounded-xl text-slate-400 hover:text-blue-900 shadow-sm">
                    <Layout className="h-5 w-5" />
                </Button>
                <Button variant="outline" size="sm" onClick={handleExport} className="h-10 px-6 gap-2 font-black text-[11px] uppercase border-slate-200 text-emerald-700 bg-white shadow-sm hover:bg-emerald-50">
                    <FileDown className="h-4 w-4" /> Export Registry
                </Button>
            </div>
        </div>

        <div className="flex-1 p-8 overflow-hidden">
            <Card className="h-full border-none shadow-2xl rounded-[2.5rem] bg-white overflow-hidden flex flex-col">
                <CardContent className="p-0 flex-1 overflow-hidden flex flex-col">
                    <div className="overflow-auto flex-1 custom-scrollbar">
                        <Table className="border-collapse w-auto min-w-full">
                            <TableHeader className="sticky top-0 bg-slate-100/95 backdrop-blur z-10 border-b">
                                <TableRow className="hover:bg-transparent">
                                    {visibleColumnDetails.map(({ key, label }) => (
                                        <TableHead key={key} className="px-6 py-4 border-r border-slate-200 last:border-r-0 whitespace-nowrap min-w-[180px]">
                                            <Button variant="ghost" onClick={() => handleSort(key)} className="h-7 px-1 -ml-1 text-[11px] font-black uppercase tracking-wider text-slate-700 hover:bg-white transition-all gap-2">
                                                {label} <ArrowUpDown className="h-3 w-3 text-slate-400" />
                                            </Button>
                                        </TableHead>
                                    ))}
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {isLoading ? (
                                    Array.from({ length: 15 }).map((_, i) => (
                                        <TableRow key={i} className="h-12"><TableCell colSpan={visibleColumns.length} className="px-4"><Skeleton className="h-6 w-full" /></TableCell></TableRow>
                                    ))
                                ) : sortedData.length === 0 ? (
                                    <TableRow><TableCell colSpan={visibleColumns.length} className="h-64 text-center text-slate-400 italic font-medium">No results matching current registry scope.</TableCell></TableRow>
                                ) : (
                                    sortedData.map((row, index) => (
                                        <TableRow key={`${row.invoiceId}-${index}`} onDoubleClick={() => router.push(`/sikka-accounts/invoice/edit?invoiceId=${row.invoiceId}`)} className="h-12 hover:bg-blue-50/30 cursor-pointer border-b border-slate-50 last:border-0 group transition-colors">
                                            {visibleColumnDetails.map(({ key }) => (
                                                <TableCell key={key} className={cn("px-6 py-3 border-r border-slate-50 last:border-r-0 text-[11px] font-medium", typeof row[key] === 'number' ? 'text-right font-black text-blue-900' : '')}>
                                                    {key === 'irn' && row[key] === 'IRN Pending' ? <Badge className="bg-red-50 text-red-600 border-red-100 text-[9px] font-black">{row[key]}</Badge>
                                                    : key === 'paymentStatus' ? <Badge className={cn("text-[9px] uppercase font-black border-none shadow-sm px-3", getStatusColor(row[key]))}>{row[key]}</Badge>
                                                    : key === 'invoiceNo' ? <span className="font-black text-blue-700">{row[key]}</span>
                                                    : row[key] instanceof Date ? format(row[key], 'dd/MM/yyyy')
                                                    : row[key]}
                                                </TableCell>
                                            ))}
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>
        </div>
        {isLayoutModalOpen && <ColumnSelectionModal isOpen={isLayoutModalOpen} onClose={() => setIsLayoutModalOpen(false)} allColumns={allColumns} visibleColumns={visibleColumns} onSave={setVisibleColumns} />}
    </div>
  );
}
