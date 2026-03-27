'use client';

import React, { useMemo, useState, useCallback, useRef } from 'react';
import * as XLSX from 'xlsx';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { WithId, LR, Plant } from '@/types';
import { format } from 'date-fns';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { FileDown, Edit2, History } from 'lucide-react';
import Pagination from '@/components/dashboard/vehicle-management/Pagination';
import { useUser } from '@/firebase';
import { Timestamp } from 'firebase/firestore';
import { cn } from '@/lib/utils';
import { mockPlants } from '@/lib/mock-data';

interface ConsignmentDetailsProps {
    lrs: WithId<LR>[];
    onEdit: (lr: WithId<LR>) => void;
    plants: WithId<Plant>[];
}

const ITEMS_PER_PAGE = 10;

const formatSafeDate = (date: any, formatStr: string) => {
    if (!date) return 'N/A';
    try {
        const d = date instanceof Timestamp ? date.toDate() : new Date(date);
        if (isNaN(d.getTime())) return 'Invalid Date';
        return format(d, formatStr);
    } catch (e) {
        return 'N/A';
    }
}

export default function ConsignmentDetails({ lrs, onEdit, plants }: ConsignmentDetailsProps) {
    const [searchTerm, setSearchTerm] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const { user } = useUser();

    // Admin detection logic matching system standards
    const isAdmin = user?.email === 'sikkaind.admin@sikka.com' || user?.email === 'sikkalmcg@gmail.com';

    // Resizable Header Logic
    const [widths, setWidths] = useState<Record<string, number>>({
        plant: 120,
        tripId: 120,
        lrNumber: 140,
        date: 110,
        consignor: 160,
        from: 120,
        billTo: 160,
        shipTo: 160,
        to: 120,
        units: 80,
        invoice: 120,
        weight: 100,
        action: 100
    });

    const resizerRef = useRef<{ column: string; startX: number; startWidth: number } | null>(null);

    const startResizing = useCallback((column: string, e: React.MouseEvent) => {
        resizerRef.current = {
            column,
            startX: e.pageX,
            startWidth: widths[column]
        };
        document.body.style.cursor = 'col-resize';
        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', stopResizing);
    }, [widths]);

    const handleMouseMove = useCallback((e: MouseEvent) => {
        if (!resizerRef.current) return;
        const { column, startX, startWidth } = resizerRef.current;
        const delta = e.pageX - startX;
        const newWidth = Math.max(50, startWidth + delta);
        setWidths(prev => ({ ...prev, [column]: newWidth }));
    }, []);

    const stopResizing = useCallback(() => {
        resizerRef.current = null;
        document.body.style.cursor = 'default';
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', stopResizing);
    }, [handleMouseMove]);

    const handleExport = () => {
        const dataToExport = filteredLrs.map(lr => {
            const items = lr.items || [];
            const plantName = plants.find(p => p.id === lr.originPlantId)?.name || lr.originPlantId || 'N/A';
            return {
                'Plant': plantName,
                'Trip ID': lr.tripId || 'N/A',
                'LR / CN Number': lr.lrNumber,
                'Date': formatSafeDate(lr.date, 'dd-MMM-yyyy'),
                'Consignor': lr.consignorName,
                'From': lr.from,
                'Bill to': lr.buyerName,
                'Ship to': lr.shipToParty,
                'To': lr.to,
                'Units': items.reduce((sum, item) => sum + (Number(item.units) || 0), 0),
                'Invoice': items.map(i => i.invoiceNumber).join(', '),
                'Weight': lr.weightSelection === 'Assigned Weight' ? lr.assignedTripWeight : items.reduce((sum, item) => sum + (Number(item.weight) || 0), 0),
            };
        });

        const worksheet = XLSX.utils.json_to_sheet(dataToExport);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Consignments");
        XLSX.writeFile(workbook, "ConsignmentDetails.xlsx");
    };

    const filteredLrs = useMemo(() => {
        return lrs.filter(lr => {
            const plantName = plants.find(p => p.id === lr.originPlantId)?.name || '';
            return (
                lr.lrNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
                lr.from.toLowerCase().includes(searchTerm.toLowerCase()) ||
                lr.to.toLowerCase().includes(searchTerm.toLowerCase()) ||
                lr.consignorName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                lr.shipToParty.toLowerCase().includes(searchTerm.toLowerCase()) ||
                lr.tripId?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                plantName.toLowerCase().includes(searchTerm.toLowerCase())
            );
        });
    }, [lrs, searchTerm, plants]);

    const paginatedLrs = useMemo(() => {
        return filteredLrs.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);
    }, [filteredLrs, currentPage]);

    const totalPages = Math.ceil(filteredLrs.length / ITEMS_PER_PAGE);

    const ResizableHeader = ({ id, label }: { id: string; label: string }) => (
        <TableHead 
            style={{ width: widths[id], minWidth: widths[id] }} 
            className="relative select-none font-bold bg-muted/50 border-r"
        >
            <span className="truncate block">{label}</span>
            <div 
                onMouseDown={(e) => startResizing(id, e)}
                className="absolute right-0 top-0 h-full w-1 cursor-col-resize hover:bg-primary/50 transition-colors z-10"
            />
        </TableHead>
    );

    return (
        <Card>
            <CardHeader>
                <div className="flex justify-between items-center">
                    <div>
                        <CardTitle className="flex items-center gap-2">
                            Consignment Details
                            <History className="h-4 w-4 text-muted-foreground" />
                        </CardTitle>
                        <CardDescription>Permanent digital registry of all LRs. Records are immutable and stored for audit compliance.</CardDescription>
                    </div>
                     <div className="flex items-center gap-4">
                        <Input
                            placeholder="Search by LR#, Trip ID, Plant, or Party"
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            className="max-w-sm"
                        />
                        <Button variant="outline" size="sm" onClick={handleExport}>
                            <FileDown className="mr-2 h-4 w-4" />
                            Export to Excel
                        </Button>
                    </div>
                </div>
            </CardHeader>
            <CardContent>
                <div className="rounded-md border overflow-x-auto">
                    <Table style={{ tableLayout: 'fixed', width: 'auto' }}>
                        <TableHeader>
                            <TableRow className="hover:bg-transparent">
                                <ResizableHeader id="plant" label="Plant" />
                                <ResizableHeader id="tripId" label="Trip ID" />
                                <ResizableHeader id="lrNumber" label="LR / CN Number" />
                                <ResizableHeader id="date" label="Date" />
                                <ResizableHeader id="consignor" label="Consignor" />
                                <ResizableHeader id="from" label="From" />
                                <ResizableHeader id="billTo" label="Bill to" />
                                <ResizableHeader id="shipTo" label="Ship to" />
                                <ResizableHeader id="to" label="To" />
                                <ResizableHeader id="units" label="Units" />
                                <ResizableHeader id="invoice" label="Invoice" />
                                <ResizableHeader id="weight" label="Weight" />
                                <TableHead style={{ width: widths.action }} className="font-bold text-right bg-muted/50">Action</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {paginatedLrs.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={13} className="text-center h-24">No LRs found for this criteria.</TableCell>
                                </TableRow>
                            ) : (
                                paginatedLrs.map(lr => {
                                    const items = lr.items || [];
                                    const totalUnits = items.reduce((sum, item) => sum + (Number(item.units) || 0), 0);
                                    const invoices = items.map(i => i.invoiceNumber).join(', ');
                                    const totalWeight = lr.weightSelection === 'Assigned Weight' ? lr.assignedTripWeight : items.reduce((sum, item) => sum + (Number(item.weight) || 0), 0);
                                    const plantName = plants.find(p => p.id === lr.originPlantId)?.name || lr.originPlantId || 'N/A';
                                    
                                    // Rule: Sub-User can edit only if trip is active. Admin always can.
                                    const isTripActive = !['delivered', 'cancelled'].includes(lr.tripStatus?.toLowerCase() || '');
                                    const canEdit = isAdmin || isTripActive;

                                    return (
                                        <TableRow key={lr.id}>
                                            <TableCell className="truncate font-medium" title={plantName}>{plantName}</TableCell>
                                            <TableCell className="font-mono text-xs truncate" title={lr.tripId}>{lr.tripId || 'N/A'}</TableCell>
                                            <TableCell className="font-semibold truncate" title={lr.lrNumber}>{lr.lrNumber}</TableCell>
                                            <TableCell className="truncate">{formatSafeDate(lr.date, 'dd-MMM-yyyy')}</TableCell>
                                            <TableCell className="truncate" title={lr.consignorName}>{lr.consignorName}</TableCell>
                                            <TableCell className="truncate" title={lr.from}>{lr.from}</TableCell>
                                            <TableCell className="truncate" title={lr.buyerName}>{lr.buyerName}</TableCell>
                                            <TableCell className="truncate" title={lr.shipToParty}>{lr.shipToParty}</TableCell>
                                            <TableCell className="truncate" title={lr.to}>{lr.to}</TableCell>
                                            <TableCell className="truncate">{totalUnits}</TableCell>
                                            <TableCell className="truncate" title={invoices}>{invoices}</TableCell>
                                            <TableCell className="truncate">{totalWeight} {lr.weightSelection === 'Assigned Weight' ? 'MT' : ''}</TableCell>
                                            <TableCell className="text-right">
                                                <Button 
                                                    variant="outline" 
                                                    size="sm" 
                                                    disabled={!canEdit} 
                                                    onClick={() => onEdit(lr)}
                                                >
                                                    <Edit2 className="mr-2 h-3 w-3" />
                                                    Edit
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    );
                                })
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
                    itemCount={filteredLrs.length}
                />
            </CardContent>
        </Card>
    );
}
