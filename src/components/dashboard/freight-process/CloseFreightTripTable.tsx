'use client';
import { useState } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { format } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import Pagination from '@/components/dashboard/vehicle-management/Pagination';
import { cn } from '@/lib/utils';
import { User, Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';

const ITEMS_PER_PAGE = 10;

interface CloseFreightTripTableProps {
  data: any[];
  onView: (trip: any) => void;
}

export default function CloseFreightTripTable({ data, onView }: CloseFreightTripTableProps) {
  const [currentPage, setCurrentPage] = useState(1);

  const totalPages = Math.ceil(data.length / ITEMS_PER_PAGE);
  const paginatedData = data.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-slate-200 shadow-md bg-white overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-slate-50/80 sticky top-0 z-10 border-b">
              <TableRow className="hover:bg-transparent">
                <TableHead className="text-[11px] font-black uppercase tracking-wider h-12 px-4">Plant</TableHead>
                <TableHead className="text-[11px] font-black uppercase tracking-wider h-12 px-4">Trip ID</TableHead>
                <TableHead className="text-[11px] font-black uppercase tracking-wider h-12 px-4">Assigned User</TableHead>
                <TableHead className="text-[11px] font-black uppercase tracking-wider h-12 px-4">LR Number</TableHead>
                <TableHead className="text-[11px] font-black uppercase tracking-wider h-12 px-4">LR Date</TableHead>
                <TableHead className="text-[11px] font-black uppercase tracking-wider h-12 px-4">From</TableHead>
                <TableHead className="text-[11px] font-black uppercase tracking-wider h-12 px-4">Ship To</TableHead>
                <TableHead className="text-[11px] font-black uppercase tracking-wider h-12 px-4 text-center">Destination</TableHead>
                <TableHead className="text-[11px] font-black uppercase tracking-wider h-12 px-4">Vehicle</TableHead>
                <TableHead className="text-[11px] font-black uppercase tracking-wider h-12 px-4 text-right">LR Qty</TableHead>
                <TableHead className="text-[11px] font-black uppercase tracking-wider h-12 px-4 text-center">POD Status</TableHead>
                <TableHead className="text-[11px] font-black uppercase tracking-wider h-12 px-4 text-center">Payment Status</TableHead>
                <TableHead className="text-[11px] font-black uppercase tracking-wider h-12 px-4 text-right sticky right-0 bg-slate-50 shadow-[-2px_0_5px_rgba(0,0,0,0.05)]">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedData.length === 0 ? (
                <TableRow><TableCell colSpan={13} className="h-48 text-center text-slate-400 italic font-medium uppercase tracking-[0.3em] opacity-40">No closed mission nodes detected.</TableCell></TableRow>
              ) : (
                paginatedData.map((row) => (
                    <TableRow key={row.id} className="hover:bg-blue-50/30 h-14 text-[13px] font-medium text-slate-600 transition-colors group">
                      <TableCell className="px-4 font-black text-slate-900 uppercase">{row.plantName}</TableCell>
                      <TableCell className="px-4 font-black text-blue-700 font-mono tracking-tighter uppercase">{row.tripId}</TableCell>
                      <TableCell className="px-4">
                        <div className="flex items-center gap-2">
                            <div className="h-6 w-6 rounded-full bg-slate-100 flex items-center justify-center">
                                <User className="h-3 w-3 text-slate-400" />
                            </div>
                            <span className="font-black text-slate-900 uppercase text-[10px] tracking-tight">{row.userName || 'System'}</span>
                        </div>
                      </TableCell>
                      <TableCell className="px-4 font-bold text-slate-800">{row.lrNumber || '--'}</TableCell>
                      <TableCell className="px-4 whitespace-nowrap text-slate-500">{row.lrDate ? format(new Date(row.lrDate), 'dd/MM/yy') : '--'}</TableCell>
                      <TableCell className="px-4 truncate max-w-[120px] uppercase">{row.from}</TableCell>
                      <TableCell className="px-4 truncate max-w-[120px] font-bold text-slate-800 uppercase">{row.shipToParty}</TableCell>
                      <TableCell className="px-4 text-center truncate max-w-[120px] uppercase">{row.unloadingPoint}</TableCell>
                      <TableCell className="px-4 font-black text-slate-900 tracking-tighter uppercase">{row.vehicleNumber}</TableCell>
                      <TableCell className="px-4 text-right font-black text-blue-900">{(Number(row.quantity) || 0).toFixed(3)}</TableCell>
                      <TableCell className="px-4 text-center">
                        <Badge variant={row.podReceived ? "default" : "destructive"} className="text-[9px] uppercase font-black px-2 h-5 border-none">
                            {row.podReceived ? 'Received' : 'Pending'}
                        </Badge>
                      </TableCell>
                      <TableCell className="px-4 text-center">
                        <Badge className="text-[9px] uppercase font-black px-3 h-6 border-none bg-slate-900 text-white">
                          Closed
                        </Badge>
                      </TableCell>
                      <TableCell className="px-4 text-right sticky right-0 bg-white group-hover:bg-blue-50/30 transition-colors shadow-[-2px_0_5px_rgba(0,0,0,0.05)]">
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-blue-600 hover:bg-blue-50" onClick={() => onView(row)}>
                            <Eye className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>
      <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} itemCount={data.length} canPreviousPage={currentPage > 1} canNextPage={currentPage < totalPages} />
    </div>
  );
}
