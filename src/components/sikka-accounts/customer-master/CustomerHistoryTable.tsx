'use client';
import { useState, useMemo, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { FileDown, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import type { Customer, Plant, WithId, Party } from '@/types';
import { mockCustomers } from '@/lib/mock-data';
import Pagination from '@/components/dashboard/vehicle-management/Pagination';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, orderBy } from 'firebase/firestore';

const ITEMS_PER_PAGE = 15;

interface CustomerHistoryTableProps {
    onEdit: (customer: WithId<Customer>) => void;
    onDelete: (customerId: string) => void;
    plants: WithId<Plant>[];
}

export default function CustomerHistoryTable({ onEdit, onDelete, plants }: CustomerHistoryTableProps) {
    const { toast } = useToast();
    const firestore = useFirestore();
    const [searchTerm, setSearchTerm] = useState('');
    const [currentPage, setCurrentPage] = useState(1);

    const partiesQuery = useMemoFirebase(() => 
        firestore ? query(collection(firestore, "parties"), orderBy("name")) : null, 
        [firestore]
    );
    const { data: parties, isLoading } = useCollection<Party>(partiesQuery);

    const handleExport = () => {
        toast({
            title: "Export Not Available",
            description: "Excel export feature is not implemented in this demo.",
        });
    };

    const enrichedCustomers = useMemo(() => (parties || []).map(party => ({
        ...party,
        clientType: party.type as any,
        plantCode: plants.find(p => p.id === (party as any).plantId)?.name || (party as any).plantId || 'GLOBAL'
    })), [parties, plants]);

    const filteredCustomers = useMemo(() =>
        enrichedCustomers.filter(c =>
            Object.values(c).some(val =>
                val?.toString().toLowerCase().includes(searchTerm.toLowerCase())
            )
        ), [enrichedCustomers, searchTerm]
    );

    const totalPages = Math.ceil(filteredCustomers.length / ITEMS_PER_PAGE);
    const paginatedCustomers = filteredCustomers.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

    return (
        <Card>
            <CardHeader>
                <div className="flex justify-between items-center">
                    <div>
                        <CardTitle>Party History Registry</CardTitle>
                        <CardDescription>Live monitor of all registered parties from cloud database.</CardDescription>
                    </div>
                    <Button variant="outline" size="sm" onClick={handleExport}><FileDown className="mr-2 h-4 w-4" />Export to Excel</Button>
                </div>
            </CardHeader>
            <CardContent>
                <Input
                    placeholder="Search across all columns..."
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    className="max-w-sm mb-4"
                />
                <div className="rounded-md border">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Plant Context</TableHead>
                                <TableHead>Party Type</TableHead>
                                <TableHead>Name</TableHead>
                                <TableHead>GSTIN</TableHead>
                                <TableHead>PAN</TableHead>
                                <TableHead>State</TableHead>
                                <TableHead>State Code</TableHead>
                                <TableHead className="text-right">Action</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isLoading ? (
                                <TableRow><TableCell colSpan={8} className="h-24 text-center"><Loader2 className="animate-spin inline-block mr-2" /> Syncing Cloud Registry...</TableCell></TableRow>
                            ) : paginatedCustomers.length > 0 ? (
                                paginatedCustomers.map(customer => (
                                    <TableRow key={customer.id}>
                                        <TableCell>{customer.plantCode}</TableCell>
                                        <TableCell>{customer.clientType}</TableCell>
                                        <TableCell className="font-bold">{customer.name}</TableCell>
                                        <TableCell className="font-mono text-xs">{customer.gstin}</TableCell>
                                        <TableCell className="font-mono text-xs">{customer.pan}</TableCell>
                                        <TableCell>{customer.state}</TableCell>
                                        <TableCell>{customer.stateCode}</TableCell>
                                        <TableCell className="text-right space-x-2">
                                            <Button variant="outline" size="sm" onClick={() => onEdit(customer as any)}>Edit</Button>
                                            <AlertDialog>
                                                <AlertDialogTrigger asChild><Button variant="destructive" size="sm">Remove</Button></AlertDialogTrigger>
                                                <AlertDialogContent>
                                                    <AlertDialogHeader><AlertDialogTitle>Are you sure?</AlertDialogTitle><AlertDialogDescription>This will permanently delete the customer record.</AlertDialogDescription></AlertDialogHeader>
                                                    <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={() => onDelete(customer.id)}>Confirm</AlertDialogAction></AlertDialogFooter>
                                                </AlertDialogContent>
                                            </AlertDialog>
                                        </TableCell>
                                    </TableRow>
                                ))
                            ) : (
                                <TableRow><TableCell colSpan={8} className="h-24 text-center text-muted-foreground italic">No parties found in database.</TableCell></TableRow>
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
                    itemCount={filteredCustomers.length}
                />
            </CardContent>
        </Card>
    );
}
