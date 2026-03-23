'use client';
import { useState, useMemo, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { FileDown, Search, Truck } from 'lucide-react';
import { format } from 'date-fns';
import type { Shipment, WithId } from '@/types';
import { Timestamp } from "firebase/firestore";

interface PendingShipmentsProps {
  shipments: (WithId<Shipment> & { plantName?: string })[];
  onAssignClick: (shipment: WithId<Shipment>) => void;
}

const formatSafeDate = (date: any, formatStr: string) => {
    if (!date) return 'Pending...';
    try {
        const d = date instanceof Timestamp ? date.toDate() : new Date(date);
        if (isNaN(d.getTime())) return 'Invalid Date';
        return format(d, formatStr);
    } catch (e) {
        return 'N/A';
    }
}

export default function PendingShipments({ shipments, onAssignClick }: PendingShipmentsProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);

  const filteredShipments = useMemo(() => {
    return shipments.filter(s =>
      Object.values(s).some(val =>
        val?.toString().toLowerCase().includes(searchTerm.toLowerCase())
      )
    );
  }, [shipments, searchTerm]);

  useEffect(() => {
    const timer = setTimeout(() => setLoading(false), 500);
    return () => clearTimeout(timer);
  }, []);
  
  const handleDownload = () => {
    const dataToExport = filteredShipments.map(s => ({
        'Plant': s.plantName,
        'Shipment ID': s.shipmentId,
        'Date': formatSafeDate(s.creationDate, 'dd/MM/yy HH:mm'),
        'Consignor': s.consignor,
        'Ship to Party': s.shipToParty,
        'Loading Point': s.loadingPoint,
        'Unloading Point': s.unloadingPoint,
        'Order Qty': s.quantity,
        'Assigned Qty': s.assignedQty,
        'Balance Qty': s.balanceQty,
    }));

    const worksheet = XLSX.utils.json_to_sheet(dataToExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Pending Shipments");
    XLSX.writeFile(workbook, "PendingShipments.xlsx");
  };

  return (
    <Card className="border-none shadow-md">
      <CardHeader className="pb-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <CardTitle className="text-xl font-bold">Awaiting Vehicle Assignment</CardTitle>
              <CardDescription className="text-xs font-medium">New shipment plans requiring vehicle and pilot allocation.</CardDescription>
            </div>
            <div className="flex items-center gap-3">
                <div className="relative">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Filter shipments..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-9 w-[240px] h-9 bg-muted/50 border-none focus-visible:ring-1"
                    />
                </div>
                <Button variant="outline" size="sm" onClick={handleDownload} className="h-9 gap-2">
                    <FileDown className="h-4 w-4" />
                    Excel
                </Button>
            </div>
        </div>
      </CardHeader>
      <CardContent className="p-0 border-t">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-muted/30">
              <TableRow className="hover:bg-transparent">
                <TableHead className="text-[13px] font-bold uppercase tracking-wider h-10">Plant</TableHead>
                <TableHead className="text-[13px] font-bold uppercase tracking-wider h-10">Shipment ID</TableHead>
                <TableHead className="text-[13px] font-bold uppercase tracking-wider h-10">Date</TableHead>
                <TableHead className="text-[13px] font-bold uppercase tracking-wider h-10">Consignor</TableHead>
                <TableHead className="text-[13px] font-bold uppercase tracking-wider h-10">Ship to Party</TableHead>
                <TableHead className="text-[13px] font-bold uppercase tracking-wider h-10">Loading Point</TableHead>
                <TableHead className="text-[13px] font-bold uppercase tracking-wider h-10">Unloading Point</TableHead>
                <TableHead className="text-[13px] font-bold uppercase tracking-wider h-10 text-right">Order Qty</TableHead>
                <TableHead className="text-[13px] font-bold uppercase tracking-wider h-10 text-right">Assigned Qty</TableHead>
                <TableHead className="text-[13px] font-bold uppercase tracking-wider h-10 text-right">Balance Qty</TableHead>
                <TableHead className="text-[13px] font-bold uppercase tracking-wider h-10 text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <TableRow key={i}><TableCell colSpan={11} className="py-4"><Skeleton className="h-6 w-full" /></TableCell></TableRow>
                ))
              ) : filteredShipments.length === 0 ? (
                <TableRow><TableCell colSpan={11} className="text-center h-32 text-muted-foreground italic text-sm">No pending assignments in registry.</TableCell></TableRow>
              ) : (
                filteredShipments.map(s => (
                  <TableRow key={s.id} className="hover:bg-muted/30 transition-colors h-12 text-[14px]">
                    <TableCell className="font-bold text-slate-600">{s.plantName}</TableCell>
                    <TableCell className="font-mono text-blue-600 font-bold">{s.shipmentId}</TableCell>
                    <TableCell className="whitespace-nowrap text-slate-500">{formatSafeDate(s.creationDate, 'dd/MM/yy HH:mm')}</TableCell>
                    <TableCell className="max-w-[120px] truncate font-medium">{s.consignor}</TableCell>
                    <TableCell className="max-w-[120px] truncate font-medium">{s.shipToParty}</TableCell>
                    <TableCell className="max-w-[150px] truncate">{s.loadingPoint || '--'}</TableCell>
                    <TableCell className="max-w-[150px] truncate">{s.unloadingPoint || '--'}</TableCell>
                    <TableCell className="text-right font-medium">{s.quantity.toFixed(2)}</TableCell>
                    <TableCell className="text-right font-medium text-blue-600">{s.assignedQty.toFixed(2)}</TableCell>
                    <TableCell className="text-right font-black text-red-600 tracking-tight">{s.balanceQty.toFixed(2)} {s.materialTypeId.substring(0,2)}</TableCell>
                    <TableCell className="text-right pr-4">
                      <Button size="sm" className="h-7 text-[10px] px-3 font-bold bg-blue-600 hover:bg-blue-700 gap-1.5" onClick={() => onAssignClick(s)} disabled={s.balanceQty <= 0}>
                        <TruckIcon className="h-3 w-3" />
                        Assign
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}

const TruckIcon = ({ className }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M5 18m-2 0a2 2 0 1 0 4 0a2 2 0 1 0 -4 0"/><path d="M19 18m-2 0a2 2 0 1 0 4 0a2 2 0 1 0 -4 0"/><path d="M2 5h15v11H2z"/><path d="M17 9h4l3 3v4h-7z"/></svg>
);