'use client';
import { useState, useMemo, useEffect } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { format, isValid } from 'date-fns';
import { Truck, ArrowUpDown, MoreVertical, Eye, Ban, ListX, RotateCcw, AlertTriangle, ListX as CancelIcon, ExternalLink, Edit2 } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuPortal,
} from "@/components/ui/dropdown-menu";
import { DEFAULT_COLUMNS, PENDING_FIXED_COLUMNS, CANCELLED_COLUMNS } from './LayoutSettingsModal';
import Pagination from '@/components/dashboard/vehicle-management/Pagination';
import { cn } from '@/lib/utils';
import { Timestamp } from 'firebase/firestore';

const ITEMS_PER_PAGE = 10;

interface OrdersTableProps {
  data: any[];
  tab: 'pending' | 'process' | 'dispatched' | 'cancelled';
  onAssign: (shipment: any) => void;
  onEditAssignment: (shipment: any, trip: any) => void;
  onViewOrder: (shipment: any) => void;
  onViewTrip: (trip: any) => void;
  onShortClose: (id: string) => void;
  onCancelOrder: (id: string) => void;
  onRestoreOrder: (id: string) => void;
  onCancelAssignment: (tripId: string, shipId: string, qty: number) => void;
  isAdmin: boolean;
}

const getStatusColor = (status: string) => {
  if (!status) return 'bg-slate-100 text-slate-800 border-slate-200';
  switch(status.toLowerCase()) {
    case 'pending': return 'bg-orange-500 text-white border-transparent shadow-sm shadow-orange-200';
    case 'partly vehicle assigned': return 'bg-amber-500 text-white border-transparent shadow-sm shadow-amber-200';
    case 'assigned': return 'bg-blue-600 text-white border-transparent shadow-sm shadow-blue-200';
    case 'in-transit': return 'bg-indigo-600 text-white border-transparent shadow-sm shadow-indigo-200';
    case 'delivered': return 'bg-emerald-600 text-white border-transparent shadow-sm shadow-emerald-200';
    case 'cancelled':
    case 'short closed': return 'bg-red-600 text-white border-transparent shadow-sm shadow-red-200';
    default: return 'bg-slate-100 text-slate-800 border-slate-200';
  }
};

export default function OrdersTable({ 
    data, tab, onAssign, onEditAssignment, onViewOrder, onViewTrip, onShortClose, onCancelOrder, onRestoreOrder, onCancelAssignment, isAdmin 
}: OrdersTableProps) {
  const [currentPage, setCurrentPage] = useState(1);
  const [displayedColumns, setDisplayedColumns] = useState<any[]>([]);
  const [sortConfig, setSortConfig] = useState<{ key: string, direction: 'asc' | 'desc' } | null>(null);

  useEffect(() => {
    if (tab === 'pending') {
      const saved = localStorage.getItem('pending_orders_layout');
      const base = [...PENDING_FIXED_COLUMNS, { id: 'userName', label: 'Order Create Username' }, { id: 'currentStatusId', label: 'Status' }];
      if (saved) {
        const ids = JSON.parse(saved) as string[];
        setDisplayedColumns(ids.map(id => base.find(c => c.id === id)).filter(Boolean));
      } else {
        setDisplayedColumns(base);
      }
    } else {
      const storageKey = `open_orders_layout_${tab}`;
      const saved = localStorage.getItem(storageKey);
      const masterList = tab === 'cancelled' ? CANCELLED_COLUMNS : DEFAULT_COLUMNS;
      
      if (saved) {
        const ids = JSON.parse(saved) as string[];
        setDisplayedColumns(ids.map(id => masterList.find(c => c.id === id)).filter(Boolean));
      } else {
        setDisplayedColumns(masterList);
      }
    }
    setCurrentPage(1);
  }, [tab]);

  const handleSort = (key: string) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') direction = 'desc';
    setSortConfig({ key, direction });
  };

  const sortedData = useMemo(() => {
    let items = [...data];
    if (sortConfig) {
      items.sort((a, b) => {
        const aVal = a[sortConfig.key] || '';
        const bVal = b[sortConfig.key] || '';
        if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
        if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }
    return items;
  }, [data, sortConfig]);

  const totalPages = Math.ceil(sortedData.length / ITEMS_PER_PAGE);
  const paginatedData = sortedData.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  const formatValue = (key: string, value: any) => {
    if (value === undefined || value === null || value === '') return '--';
    if (key.toLowerCase().includes('date')) {
      try {
        const d = value instanceof Timestamp ? value.toDate() : new Date(value);
        if (!isValid(d)) return '--';
        return format(d, key.toLowerCase().includes('create') ? 'dd/MM/yy HH:mm' : 'dd/MM/yy');
      } catch (e) {
        return '--';
      }
    }
    if (typeof value === 'number') return value.toFixed(2);
    return value;
  };

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-slate-200 shadow-md bg-white overflow-hidden">
        <div className="overflow-x-auto">
          <Table className="border-collapse">
            <TableHeader className="bg-slate-100/80 sticky top-0 z-10 border-b border-slate-200">
              <TableRow className="hover:bg-transparent">
                {displayedColumns.map((col, i) => (
                  <TableHead 
                    key={col.id} 
                    className={cn(
                        "h-12 px-4 py-3 border-r border-slate-200 last:border-r-0",
                        i < 2 && "sticky left-0 bg-slate-100 z-20 shadow-[2px_0_5px_rgba(0,0,0,0.05)]"
                    )}
                  >
                    <Button 
                      variant="ghost" 
                      onClick={() => handleSort(col.id)}
                      className="h-7 px-1 -ml-1 text-[13px] font-black uppercase tracking-wider text-slate-700 hover:bg-white transition-all gap-2"
                    >
                      {col.label}
                      <ArrowUpDown className="h-3 w-3 text-slate-400" />
                    </Button>
                  </TableHead>
                ))}
                <TableHead className="h-12 px-4 text-right font-black text-[13px] uppercase tracking-wider text-slate-700 sticky right-0 bg-slate-100 z-20 shadow-[-4px_0_10px_rgba(0,0,0,0.05)]">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedData.length === 0 ? (
                <TableRow><TableCell colSpan={displayedColumns.length + 1} className="h-48 text-center text-slate-400 italic font-medium text-sm">
                    <div className="flex flex-col items-center gap-2">
                        <CancelIcon className="h-12 w-12 opacity-10" />
                        <span>No records found matching current criteria.</span>
                    </div>
                </TableCell></TableRow>
              ) : (
                paginatedData.map((row, idx) => (
                  <TableRow key={row.id || idx} className="group hover:bg-blue-50/30 transition-colors h-14 text-[13px] font-medium text-slate-600 odd:bg-slate-50/30">
                    {displayedColumns.map((col, i) => (
                      <TableCell 
                        key={col.id} 
                        className={cn(
                            "px-4 py-2 border-r border-slate-100 last:border-r-0 whitespace-nowrap",
                            i < 2 && "sticky left-0 bg-white group-hover:bg-blue-50/30 z-10 group-odd:bg-slate-50/30 shadow-[2px_0_5px_rgba(0,0,0,0.02)]"
                        )}
                      >
                        {col.id === 'shipmentId' ? (
                            <button onClick={() => onViewOrder(row)} className="font-black text-blue-700 hover:underline flex items-center gap-1.5">
                                {row[col.id]} <ExternalLink className="h-3 w-3" />
                            </button>
                        ) : col.id === 'lrNumber' ? (
                            // Logic: If trip assigned show bold, else show regular draft
                            <span className={cn("font-black uppercase", row.linkedTrips?.length > 0 ? "text-blue-900" : "text-slate-400 italic")}>
                                {row[col.id] || '--'}
                            </span>
                        ) : col.id === 'tripId' ? (
                            <button onClick={() => onViewTrip(row.linkedTrips?.[0])} className="font-bold text-slate-900 hover:text-blue-700 underline decoration-slate-300 underline-offset-4">
                                {formatValue(col.id, row[col.id])}
                            </button>
                        ) : col.id === 'currentStatusId' ? (
                            <Badge className={cn("text-[10px] h-6 font-black uppercase tracking-tighter rounded-full px-3", getStatusColor(row[col.id]))}>
                                {row[col.id]}
                            </Badge>
                        ) : col.id === 'balanceQty' ? (
                            <span className="font-black text-red-600 bg-red-50 px-2 py-1 rounded border border-red-100">{formatValue(col.id, row[col.id])}</span>
                        ) : col.id === 'dispatchQty' ? (
                            <span className="font-bold text-emerald-700">{formatValue(col.id, row[col.id])}</span>
                        ) : formatValue(col.id, row[col.id])}
                      </TableCell>
                    ))}
                    
                    <TableCell className="text-right px-4 sticky right-0 bg-white/95 group-hover:bg-blue-50/95 group-odd:bg-slate-50/95 backdrop-blur-sm z-30 shadow-[-4px_0_10px_rgba(0,0,0,0.05)] border-l">
                        <div className="flex justify-end items-center gap-3">
                            {tab === 'pending' && row.balanceQty > 0 && (
                                <Button size="sm" className="h-8 bg-blue-900 hover:bg-slate-900 text-white shadow-md gap-2 font-black text-[11px] uppercase tracking-widest px-4 border-none" onClick={() => onAssign(row)}>
                                    <Truck className="h-3.5 w-3.5" /> Assign
                                </Button>
                            )}

                            {tab === 'cancelled' && isAdmin && (
                                <Button variant="outline" size="sm" onClick={() => onRestoreOrder(row.id)} className="h-8 gap-2 font-black text-[11px] uppercase border-emerald-600 text-emerald-700 hover:bg-emerald-50 bg-white">
                                    <RotateCcw className="h-3.5 w-3.5" /> Restore
                                </Button>
                            )}

                            <DropdownMenu modal={false}>
                                <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full text-slate-400 hover:text-blue-900 hover:bg-white"><MoreVertical className="h-4 w-4" /></Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuPortal>
                                    <DropdownMenuContent align="end" className="w-56 p-2 border-slate-200 shadow-xl z-[100] bg-white">
                                        <DropdownMenuLabel className="text-[10px] uppercase tracking-widest text-slate-400 mb-1">Modify Order</DropdownMenuLabel>
                                        <DropdownMenuItem onClick={() => onViewOrder(row)} className="gap-3 cursor-pointer py-2 px-3 rounded-md font-bold text-slate-700">
                                            <Eye className="h-4 w-4 text-blue-600" /> View Detailed Drawer
                                        </DropdownMenuItem>
                                        
                                        {tab !== 'dispatched' && tab !== 'cancelled' && (
                                            <>
                                                <DropdownMenuSeparator className="my-1 bg-slate-100" />
                                                {tab === 'process' && row.linkedTrips?.[0]?.tripStatus === 'Assigned' && (
                                                    <DropdownMenuItem onClick={() => onEditAssignment(row, row.linkedTrips[0])} className="gap-3 cursor-pointer py-2.5 px-3 rounded-md font-bold text-blue-600 hover:bg-blue-50 focus:bg-blue-50">
                                                        <Edit2 className="h-4 w-4" /> Edit Mission Allocation
                                                    </DropdownMenuItem>
                                                )}
                                                <DropdownMenuItem onClick={() => onShortClose(row.id)} className="gap-3 cursor-pointer py-2.5 px-3 rounded-md font-bold text-orange-600 hover:bg-orange-50 focus:bg-orange-50">
                                                    <AlertTriangle className="h-4 w-4" /> Short Close Order
                                                </DropdownMenuItem>
                                            </>
                                        )}
                                        {tab === 'process' && (
                                            <>
                                                <DropdownMenuSeparator className="my-1 bg-slate-100" />
                                                <DropdownMenuItem onClick={() => onCancelAssignment(row.linkedTrips?.[0]?.id, row.id, row.linkedTrips?.[0]?.assignedQtyInTrip)} className="gap-3 cursor-pointer py-2.5 px-3 rounded-md font-bold text-red-700 hover:bg-red-50 focus:bg-red-50">
                                                    <Ban className="h-4 w-4" /> Detach Vehicle Assignment
                                                </DropdownMenuItem>
                                            </>
                                        )}
                                    </DropdownMenuContent>
                                </DropdownMenuPortal>
                            </DropdownMenu>
                        </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>
      
      <div className="bg-slate-50 border border-slate-200 rounded-lg px-4 py-2 flex items-center justify-between">
        <Pagination 
            currentPage={currentPage} 
            totalPages={totalPages} 
            onPageChange={setCurrentPage} 
            itemCount={sortedData.length}
            canPreviousPage={currentPage > 1}
            canNextPage={currentPage < totalPages}
        />
      </div>
    </div>
  );
}
