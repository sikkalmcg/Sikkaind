'use client';
import { useState, useMemo, useEffect } from 'react';
import { format } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { FileDown, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import type { MasterDataItem, Plant, WithId } from '@/types';
import { mockMasterDataItems, mockAccountPlants } from '@/lib/mock-data';
import Pagination from '@/components/dashboard/vehicle-management/Pagination';
import { Badge } from '@/components/ui/badge';

const ITEMS_PER_PAGE = 15;

interface ItemHistoryTableProps {
    onEdit: (item: WithId<MasterDataItem>) => void;
    onDelete: (itemId: string) => void;
}

export default function ItemHistoryTable({ onEdit, onDelete }: ItemHistoryTableProps) {
    const { toast } = useToast();
    const [items, setItems] = useState<WithId<MasterDataItem>[]>([]);
    const [plants, setPlants] = useState<WithId<Plant>[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [currentPage, setCurrentPage] = useState(1);

    useEffect(() => {
        setLoading(true);
        setTimeout(() => {
            setItems([...mockMasterDataItems]);
            setPlants(mockAccountPlants);
            setLoading(false);
        }, 500);
    }, []);

    const handleExport = () => {
        toast({ title: "Export Not Available", description: "Excel export feature is not implemented in this demo." });
    };

    const enrichedItems = useMemo(() => items.map(item => ({
        ...item,
        plantName: plants.find(p => p.id === item.plantId)?.name || item.plantId
    })), [items, plants]);

    const filteredItems = useMemo(() =>
        enrichedItems.filter(c =>
            Object.values(c).some(val => val?.toString().toLowerCase().includes(searchTerm.toLowerCase()))
        ), [enrichedItems, searchTerm]
    );

    const totalPages = Math.ceil(filteredItems.length / ITEMS_PER_PAGE);
    const paginatedItems = filteredItems.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

    return (
        <Card>
            <CardHeader>
                <div className="flex justify-between items-center">
                    <CardTitle>Master Data History</CardTitle>
                    <div className="flex items-center gap-4">
                        <Input placeholder="Search history..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="max-w-sm" />
                        <Button variant="outline" size="sm" onClick={handleExport}><FileDown className="mr-2 h-4 w-4" />Export to Excel</Button>
                    </div>
                </div>
            </CardHeader>
            <CardContent>
                <div className="rounded-md border">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Plant</TableHead>
                                <TableHead>Invoice Type</TableHead>
                                <TableHead>Charge Type</TableHead>
                                <TableHead>Item Description</TableHead>
                                <TableHead>HSN/SAC</TableHead>
                                <TableHead>Rate</TableHead>
                                <TableHead>GST</TableHead>
                                <TableHead>GST %</TableHead>
                                <TableHead>Valid From</TableHead>
                                <TableHead>Valid To</TableHead>
                                <TableHead className="text-right">Action</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {loading ? (
                                <TableRow><TableCell colSpan={11} className="h-24 text-center"><Loader2 className="animate-spin" /></TableCell></TableRow>
                            ) : paginatedItems.length > 0 ? (
                                paginatedItems.map(item => (
                                    <TableRow key={item.id}>
                                        <TableCell>{item.plantName}</TableCell>
                                        <TableCell>{item.invoiceType}</TableCell>
                                        <TableCell>{item.chargeType}</TableCell>
                                        <TableCell>{item.itemDescription}</TableCell>
                                        <TableCell>{item.hsnSac}</TableCell>
                                        <TableCell>{item.rate}</TableCell>
                                        <TableCell><Badge variant={item.isGstApplicable ? 'default' : 'secondary'}>{item.isGstApplicable ? 'Yes' : 'No'}</Badge></TableCell>
                                        <TableCell>{item.gstRate ?? 'N/A'}</TableCell>
                                        <TableCell>{format(item.validFrom, 'PP')}</TableCell>
                                        <TableCell>{format(item.validTo, 'PP')}</TableCell>
                                        <TableCell className="text-right space-x-2">
                                            <Button variant="outline" size="sm" onClick={() => onEdit(item)}>Edit</Button>
                                            <AlertDialog>
                                                <AlertDialogTrigger asChild><Button variant="destructive" size="sm">Remove</Button></AlertDialogTrigger>
                                                <AlertDialogContent>
                                                    <AlertDialogHeader><AlertDialogTitle>Are you sure?</AlertDialogTitle><AlertDialogDescription>This will permanently delete this master data item.</AlertDialogDescription></AlertDialogHeader>
                                                    <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={() => onDelete(item.id)}>Confirm</AlertDialogAction></AlertDialogFooter>
                                                </AlertDialogContent>
                                            </AlertDialog>
                                        </TableCell>
                                    </TableRow>
                                ))
                            ) : (
                                <TableRow><TableCell colSpan={11} className="h-24 text-center">No items found.</TableCell></TableRow>
                            )}
                        </TableBody>
                    </Table>
                </div>
                <Pagination
                    currentPage={currentPage}
                    totalPages={totalPages}
                    onPageChange={setCurrentPage}
                    canPreviousPage={currentPage > 1}
                    canNextPage={currentPage < totalPages}
                    itemCount={filteredItems.length}
                />
            </CardContent>
        </Card>
    );
}
