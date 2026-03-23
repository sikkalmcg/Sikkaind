'use client';
import { useState, useMemo, useEffect } from 'react';
import { format } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { FileDown, Loader2, WifiOff, Edit2 as EditIcon, Trash2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import type { MasterDataItem, Plant, WithId, MasterInvoiceType, MasterChargeType, MasterUnitType } from '@/types';
import { mockAccountPlants } from '@/lib/mock-data';
import Pagination from '@/components/dashboard/vehicle-management/Pagination';
import { Badge } from '@/components/ui/badge';
import { useFirestore, useCollection } from '@/firebase';
import { collection, query, orderBy, Timestamp } from 'firebase/firestore';
import { cn } from '@/lib/utils';

const ITEMS_PER_PAGE = 15;

interface ItemHistoryTableProps {
    onEdit: (item: WithId<MasterDataItem>) => void;
    onDelete: (itemId: string) => void;
}

export default function ItemHistoryTable({ onEdit, onDelete }: ItemHistoryTableProps) {
    const { toast } = useToast();
    const firestore = useFirestore();
    const [searchTerm, setSearchTerm] = useState('');
    const [currentPage, setCurrentPage] = useState(1);

    const itQuery = useMemo(() => firestore ? query(collection(firestore, "master_invoice_types")) : null, [firestore]);
    const ctQuery = useMemo(() => firestore ? query(collection(firestore, "master_charge_types")) : null, [firestore]);
    const utQuery = useMemo(() => firestore ? query(collection(firestore, "master_unit_types")) : null, [firestore]);
    const itemsQuery = useMemo(() => firestore ? query(collection(firestore, "master_items"), orderBy("createdAt", "desc")) : null, [firestore]);

    const { data: allInvoiceTypes } = useCollection<MasterInvoiceType>(itQuery);
    const { data: allChargeTypes } = useCollection<MasterChargeType>(ctQuery);
    const { data: allUnitTypes } = useCollection<MasterUnitType>(utQuery);
    const { data: allItems, isLoading, error: dbError } = useCollection<MasterDataItem>(itemsQuery);

    const enrichedItems = useMemo(() => (allItems || []).map(item => ({
        ...item,
        plantName: mockAccountPlants.find(p => p.id === item.plantId)?.name || item.plantId,
        invoiceTypeName: allInvoiceTypes?.find(it => it.id === item.invoiceTypeId)?.name || 'N/A',
        chargeTypeName: allChargeTypes?.find(ct => ct.id === item.chargeTypeId)?.name || 'N/A',
        unitTypeName: allUnitTypes?.find(ut => ut.id === item.unitTypeId)?.name || 'N/A',
        validFrom: item.validFrom instanceof Timestamp ? item.validFrom.toDate() : (item.validFrom ? new Date(item.validFrom) : null),
        validTo: item.validTo instanceof Timestamp ? item.validTo.toDate() : (item.validTo ? new Date(item.validTo) : null),
        createdAt: item.createdAt instanceof Timestamp ? item.createdAt.toDate() : (item.createdAt ? new Date(item.createdAt) : null),
    })), [allItems, allInvoiceTypes, allChargeTypes, allUnitTypes]);

    const filteredItems = useMemo(() =>
        enrichedItems.filter(c =>
            Object.values(c).some(val => val?.toString().toLowerCase().includes(searchTerm.toLowerCase()))
        ), [enrichedItems, searchTerm]
    );

    const totalPages = Math.ceil(filteredItems.length / ITEMS_PER_PAGE);
    const paginatedItems = filteredItems.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

    const handleExport = () => {
        const exportData = filteredItems.map(item => ({
            'Plant': item.plantName,
            'Invoice Type': item.invoiceTypeName,
            'Charge Type': item.chargeTypeName,
            'Item Description': item.itemDescription,
            'HSN/SAC': item.hsnSac,
            'Rate': item.rate,
            'UOM': item.unitTypeName,
            'GST Rate': item.isGstApplicable ? `${item.gstRate}%` : 'N/A',
            'Valid From': item.validFrom ? format(item.validFrom, 'dd/MM/yy') : '--',
            'Valid To': item.validTo ? format(item.validTo, 'dd/MM/yy') : '--'
        }));
        const ws = XLSX.utils.json_to_sheet(exportData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Material Master");
        XLSX.writeFile(wb, "MaterialMasterRegistry.xlsx");
    };

    return (
        <Card className="border-none shadow-md overflow-hidden bg-white">
            <CardHeader className="bg-slate-50 border-b">
                <div className="flex justify-between items-center">
                    <CardTitle className="flex items-center gap-2">
                        Material Master Registry
                        {dbError && <WifiOff className="h-4 w-4 text-orange-500" />}
                    </CardTitle>
                    <div className="flex items-center gap-4">
                        <div className="relative">
                            <Input placeholder="Search registry..." value={searchTerm} onChange={e => {setSearchTerm(e.target.value); setCurrentPage(1);}} className="pl-9 w-64" />
                        </div>
                        <Button variant="outline" size="sm" onClick={handleExport}><FileDown className="mr-2 h-4 w-4" />Export</Button>
                    </div>
                </div>
            </CardHeader>
            <CardContent className="p-0">
                <div className="overflow-x-auto">
                    <Table>
                        <TableHeader className="bg-slate-50">
                            <TableRow className="text-[10px] font-black uppercase tracking-widest h-12">
                                <TableHead className="px-4">Plant</TableHead>
                                <TableHead>Invoice Type</TableHead>
                                <TableHead>Charge Type</TableHead>
                                <TableHead>Item Description</TableHead>
                                <TableHead>HSN/SAC</TableHead>
                                <TableHead className="text-right">Rate</TableHead>
                                <TableHead className="text-center">UOM</TableHead>
                                <TableHead className="text-center">GST %</TableHead>
                                <TableHead className="text-center">OTA</TableHead>
                                <TableHead>Valid From</TableHead>
                                <TableHead>Valid To</TableHead>
                                <TableHead className="text-right px-6">Action</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isLoading ? (
                                <TableRow><TableCell colSpan={12} className="h-32 text-center"><Loader2 className="animate-spin inline-block mr-2" /> Loading Registry...</TableCell></TableRow>
                            ) : paginatedItems.length > 0 ? (
                                paginatedItems.map(item => (
                                    <TableRow key={item.id} className="h-14 hover:bg-slate-50/50 transition-colors border-b last:border-0 text-[11px] font-medium text-slate-600">
                                        <TableCell className="px-4 font-bold text-slate-900">{item.plantName}</TableCell>
                                        <TableCell>{item.invoiceTypeName}</TableCell>
                                        <TableCell>{item.chargeTypeName}</TableCell>
                                        <TableCell className="font-bold text-slate-800">{item.itemDescription}</TableCell>
                                        <TableCell className="font-mono">{item.hsnSac}</TableCell>
                                        <TableCell className="text-right font-black text-blue-900">₹{item.rate.toLocaleString()}</TableCell>
                                        <TableCell className="text-center font-bold">{item.unitTypeName}</TableCell>
                                        <TableCell className="text-center">
                                            {item.isGstApplicable ? <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-100">{item.gstRate}%</Badge> : '--'}
                                        </TableCell>
                                        <TableCell className="text-center">
                                            <Badge variant="secondary" className={cn("text-[9px] font-black uppercase px-2", item.ota ? "bg-amber-100 text-amber-700" : "bg-slate-100 text-slate-400")}>{item.ota ? 'Yes' : 'No'}</Badge>
                                        </TableCell>
                                        <TableCell className="whitespace-nowrap">{item.validFrom ? format(item.validFrom, 'dd/MM/yy') : '--'}</TableCell>
                                        <TableCell className="whitespace-nowrap">{item.validTo ? format(item.validTo, 'dd/MM/yy') : '--'}</TableCell>
                                        <TableCell className="text-right px-6 space-x-2">
                                            <Button variant="ghost" size="icon" className="h-8 w-8 text-blue-600" onClick={() => onEdit(item as any)}><EditIcon className="h-4 w-4"/></Button>
                                            <AlertDialog>
                                                <AlertDialogTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8 text-red-600"><Trash2 className="h-4 w-4" /></Button></AlertDialogTrigger>
                                                <AlertDialogContent>
                                                    <AlertDialogHeader><AlertDialogTitle>Confirm Registry Disposal?</AlertDialogTitle><AlertDialogDescription>This will permanently erase the material master from the cloud.</AlertDialogDescription></AlertDialogHeader>
                                                    <AlertDialogFooter><AlertDialogCancel>Abort</AlertDialogCancel><AlertDialogAction onClick={() => onDelete(item.id)} className="bg-red-600">Confirm</AlertDialogAction></AlertDialogFooter>
                                                </AlertDialogContent>
                                            </AlertDialog>
                                        </TableCell>
                                    </TableRow>
                                ))
                            ) : (
                                <TableRow><TableCell colSpan={12} className="h-32 text-center text-muted-foreground italic">No material master found in database.</TableCell></TableRow>
                            )}
                        </TableBody>
                    </Table>
                </div>
                <div className="px-6 py-4 bg-slate-50/50 border-t">
                    <Pagination
                        currentPage={currentPage}
                        totalPages={totalPages}
                        onPageChange={setCurrentPage}
                        canPreviousPage={currentPage > 1}
                        canNextPage={currentPage < totalPages}
                        itemCount={filteredItems.length}
                    />
                </div>
            </CardContent>
        </Card>
    );
}
