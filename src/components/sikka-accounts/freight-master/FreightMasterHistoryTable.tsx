
'use client';
import { useState, useMemo, useEffect, useCallback } from 'react';
import { format } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { FileDown, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import type { FreightMaster, Plant, WithId, MasterChargeType, FreightMasterLog } from '@/types';
import { mockFreightMasters, mockAccountPlants, deleteMockFreightMaster, updateMockFreightMaster, mockMasterChargeTypes, getFreightMasterLogs } from '@/lib/mock-data';
import Pagination from '@/components/dashboard/vehicle-management/Pagination';
import EditFreightMasterModal from './EditFreightMasterModal';
import FreightMasterLogModal from './FreightMasterLogModal';

const ITEMS_PER_PAGE = 15;

export default function FreightMasterHistoryTable() {
    const { toast } = useToast();
    const [items, setItems] = useState<WithId<FreightMaster>[]>([]);
    const [plants, setPlants] = useState<WithId<Plant>[]>([]);
    const [chargeTypes, setChargeTypes] = useState<WithId<MasterChargeType>[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const [editingItem, setEditingItem] = useState<WithId<FreightMaster> | null>(null);
    const [viewingLogs, setViewingLogs] = useState<WithId<FreightMaster> | null>(null);
    const [logData, setLogData] = useState<FreightMasterLog[]>([]);

    const refreshData = useCallback(() => {
        setLoading(true);
        setTimeout(() => {
            setItems([...mockFreightMasters]);
            setPlants(mockAccountPlants);
            setChargeTypes(mockMasterChargeTypes);
            setLoading(false);
        }, 300);
    }, []);

    useEffect(() => {
        refreshData();
    }, [refreshData]);

    const handleExport = () => {
        toast({ title: "Export Not Available", description: "Excel export feature is not implemented in this demo." });
    };

    const handleDelete = (id: string) => {
        deleteMockFreightMaster(id);
        toast({ title: 'Success', description: 'Freight master record deleted.' });
        refreshData();
    };

    const handleUpdate = (id: string, data: Partial<Omit<FreightMaster, 'id'>>) => {
        try {
            updateMockFreightMaster(id, data);
            toast({ title: 'Success', description: 'Freight master updated successfully.' });
            setEditingItem(null);
            refreshData();
        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Error', description: error.message });
        }
    };
    
    const handleViewLog = (item: WithId<FreightMaster>) => {
        setLogData(getFreightMasterLogs(item.id));
        setViewingLogs(item);
    };

    const enrichedItems = useMemo(() => items.map(item => ({
        ...item,
        plantName: plants.find(p => p.id === item.plantId)?.name || item.plantId,
        chargeTypeName: chargeTypes.find(c => c.id === item.chargeTypeId)?.name || 'N/A',
    })), [items, plants, chargeTypes]);

    const filteredItems = useMemo(() =>
        enrichedItems.filter(c =>
            Object.values(c).some(val => val?.toString().toLowerCase().includes(searchTerm.toLowerCase()))
        ), [enrichedItems, searchTerm]
    );

    const totalPages = Math.ceil(filteredItems.length / ITEMS_PER_PAGE);
    const paginatedItems = filteredItems.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

    return (
        <>
        <Card>
            <CardHeader>
                <div className="flex justify-between items-center">
                    <div>
                        <CardTitle>Freight Master Data</CardTitle>
                        <CardDescription>History of all saved freight master records.</CardDescription>
                    </div>
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
                                <TableHead>Charge Type</TableHead>
                                <TableHead>From</TableHead>
                                <TableHead>Destination</TableHead>
                                <TableHead>Rate</TableHead>
                                <TableHead>GST %</TableHead>
                                <TableHead>Valid From</TableHead>
                                <TableHead>Valid To</TableHead>
                                <TableHead>OTA</TableHead>
                                <TableHead>Log</TableHead>
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
                                        <TableCell>{item.chargeTypeName}</TableCell>
                                        <TableCell>{item.from}</TableCell>
                                        <TableCell>{item.destination}</TableCell>
                                        <TableCell>{item.rate.toLocaleString()}</TableCell>
                                        <TableCell>{item.isGstApplicable ? item.gstRate : 'N/A'}</TableCell>
                                        <TableCell>{item.validFrom ? format(new Date(item.validFrom), 'PP') : 'N/A'}</TableCell>
                                        <TableCell>{item.validTo ? format(new Date(item.validTo), 'PP') : 'N/A'}</TableCell>
                                        <TableCell>{item.ota ? 'Yes' : 'No'}</TableCell>
                                        <TableCell><Button variant="link" size="sm" onClick={() => handleViewLog(item)}>View</Button></TableCell>
                                        <TableCell className="text-right space-x-2">
                                            <Button variant="outline" size="sm" onClick={() => setEditingItem(item)}>Edit</Button>
                                            <AlertDialog>
                                                <AlertDialogTrigger asChild><Button variant="destructive" size="sm">Remove</Button></AlertDialogTrigger>
                                                <AlertDialogContent>
                                                    <AlertDialogHeader><AlertDialogTitle>Are you sure?</AlertDialogTitle><AlertDialogDescription>This action cannot be undone.</AlertDialogDescription></AlertDialogHeader>
                                                    <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={() => handleDelete(item.id)}>Confirm</AlertDialogAction></AlertDialogFooter>
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
        {editingItem && <EditFreightMasterModal isOpen={!!editingItem} onClose={() => setEditingItem(null)} item={editingItem} onSave={handleUpdate} plants={plants} />}
        {viewingLogs && <FreightMasterLogModal isOpen={!!viewingLogs} onClose={() => setViewingLogs(null)} logs={logData} />}
        </>
    );
}
