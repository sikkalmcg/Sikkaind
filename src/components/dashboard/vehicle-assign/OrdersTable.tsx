'use client';

import React from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
    PlusCircle, 
    Edit2, 
    Trash2, 
    Eye, 
    Ban, 
    RotateCcw,
    Truck,
    Clock,
    CheckCircle2,
    AlertCircle,
    UserCircle,
    MapPin,
    ArrowRightLeft,
    MoreHorizontal
} from 'lucide-react';
import { cn, parseSafeDate } from '@/lib/utils';
import { format, isValid } from 'date-fns';
import { Timestamp } from 'firebase/firestore';
import { 
    DropdownMenu, 
    DropdownMenuContent, 
    DropdownMenuItem, 
    DropdownMenuTrigger,
    DropdownMenuSeparator,
    DropdownMenuLabel
} from '@/components/ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface OrdersTableProps {
  data: any[];
  tab: string;
  onAssign: (order: any) => void;
  onEditAssignment: (order: any, trip: any) => void;
  onViewOrder: (order: any) => void;
  onViewTrip: (trip: any) => void;
  onViewLR: (row: any) => void;
  onShortClose: (id: string) => void;
  onCancelOrder: (id: string) => void;
  onRestoreOrder: (id: string) => void;
  onCancelAssignment: (tripId: string, shipId: string, qty: number) => void;
  isAdmin: boolean;
}

const getStatusColor = (status: string) => {
    const s = status?.toLowerCase() || '';
    switch(s) {
        case 'pending': return 'bg-yellow-500/10 text-yellow-700 border-yellow-200';
        case 'partly vehicle assigned': return 'bg-orange-500/10 text-orange-700 border-orange-200';
        case 'assigned': return 'bg-emerald-500/10 text-emerald-700 border-emerald-200';
        case 'cancelled': return 'bg-red-500/10 text-red-700 border-red-200';
        case 'short closed': return 'bg-slate-500/10 text-slate-700 border-slate-200';
        default: return 'bg-gray-500/10 text-gray-700 border-gray-200';
    }
}

const formatSafeDateString = (date: any, formatStr: string = 'dd/MM/yy') => {
    const d = parseSafeDate(date);
    if (!d) return '--';
    return format(d, formatStr);
}

export default function OrdersTable({ 
    data, 
    tab, 
    onAssign, 
    onEditAssignment,
    onViewOrder,
    onViewTrip,
    onViewLR,
    onShortClose,
    onCancelOrder,
    onRestoreOrder,
    onCancelAssignment,
    isAdmin 
}: OrdersTableProps) {
  
  return (
    <div className="rounded-[2rem] border border-slate-200 shadow-xl bg-white overflow-hidden">
      <div className="overflow-x-auto">
        <Table className="border-collapse w-full min-w-[2200px] table-fixed">
          <TableHeader className="bg-slate-50/80 sticky top-0 z-10 border-b">
            <TableRow className="h-14 hover:bg-transparent">
              <TableHead className="text-[10px] font-black uppercase px-6 text-slate-500 w-32">Plant</TableHead>
              <TableHead className="text-[10px] font-black uppercase px-4 text-slate-500 w-36">Order ID</TableHead>
              <TableHead className="text-[10px] font-black uppercase px-4 text-slate-500 w-36">LR Number</TableHead>
              <TableHead className="text-[10px] font-black uppercase px-4 text-center text-slate-500 w-32">LR Date</TableHead>
              <TableHead className="text-[10px] font-black uppercase px-4 text-slate-500 w-48">Consignor</TableHead>
              <TableHead className="text-[10px] font-black uppercase px-4 text-slate-500 w-48">Consignee</TableHead>
              <TableHead className="text-[10px] font-black uppercase px-4 text-slate-500 w-64">Item description</TableHead>
              <TableHead className="text-[10px] font-black uppercase px-4 text-center text-slate-500 w-24">Units</TableHead>
              <TableHead className="text-[10px] font-black uppercase px-4 text-slate-500 w-40">Destination</TableHead>
              <TableHead className="text-[10px] font-black uppercase px-4 text-slate-500 w-24 text-center">Unit</TableHead>
              <TableHead className="text-[10px] font-black uppercase px-4 text-slate-500 w-32 text-right">Order Qty</TableHead>
              <TableHead className="text-[10px] font-black uppercase px-4 text-slate-500 w-32 text-right">Balance Qty</TableHead>
              <TableHead className="text-[10px] font-black uppercase px-4 text-slate-500 w-40 text-center">Status</TableHead>
              <TableHead className="text-[10px] font-black uppercase px-8 text-right sticky right-0 bg-slate-50 shadow-[-2px_0_5px_rgba(0,0,0,0.05)] w-32">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.length === 0 ? (
              <TableRow>
                <TableCell colSpan={14} className="h-64 text-center text-slate-400 italic font-medium uppercase tracking-[0.3em] opacity-40">
                  No mission plans detected in current registry view.
                </TableCell>
              </TableRow>
            ) : (
              data.map((order) => {
                const isCancelled = ['Cancelled', 'Short Closed'].includes(order.currentStatusId);
                const assignedTrips = order.linkedTrips || [];

                return (
                  <React.Fragment key={order.id}>
                    <TableRow className="h-16 hover:bg-blue-50/20 transition-all border-b border-slate-100 group">
                      <TableCell className="px-6 font-bold text-slate-600 uppercase truncate">{order.plantName}</TableCell>
                      <TableCell className="px-4 font-black text-blue-700 font-mono tracking-tighter text-xs">{order.shipmentId}</TableCell>
                      <TableCell className="px-4 text-center">
                        {order.lrNumber ? (
                            <button onClick={() => onViewLR(order)} className="font-black text-blue-700 hover:underline text-[11px] uppercase tracking-tighter">
                                {order.lrNumber}
                            </button>
                        ) : '--'}
                      </TableCell>
                      <TableCell className="px-4 text-center text-[11px] font-bold text-slate-500">
                        {formatSafeDateString(order.lrDate)}
                      </TableCell>
                      <TableCell className="px-4 truncate font-bold text-slate-800 uppercase text-xs" title={order.consignor}>{order.consignor}</TableCell>
                      <TableCell className="px-4 truncate font-bold text-slate-800 uppercase text-xs" title={order.billToParty}>{order.billToParty}</TableCell>
                      <TableCell className="px-4 truncate font-medium text-slate-500 uppercase italic text-[10px]" title={order.summarizedItems}>"{order.summarizedItems}"</TableCell>
                      <TableCell className="px-4 text-center font-black text-slate-900">{order.totalUnitsCount || '--'}</TableCell>
                      <TableCell className="px-4 truncate font-black text-slate-900 uppercase text-xs" title={order.unloadingPoint}>{order.unloadingPoint}</TableCell>
                      <TableCell className="px-4 text-center font-bold text-slate-400 text-xs">{order.materialTypeId}</TableCell>
                      <TableCell className="px-4 text-right font-black text-slate-900 text-xs">{(order.quantity || 0).toFixed(3)}</TableCell>
                      <TableCell className="px-4 text-right font-black text-orange-600 text-xs bg-orange-50/10">{(order.balanceQty || 0).toFixed(3)}</TableCell>
                      <TableCell className="px-4 text-center">
                        <Badge variant="outline" className={cn("text-[9px] font-black uppercase px-2 h-6 border shadow-sm", getStatusColor(order.currentStatusId))}>
                            {order.currentStatusId}
                        </Badge>
                      </TableCell>
                      <TableCell className="px-8 text-right sticky right-0 bg-white group-hover:bg-blue-50/20 transition-all shadow-[-4px_0_10px_rgba(0,0,0,0.02)]">
                        <DropdownMenu modal={false}>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl hover:bg-white text-slate-400 hover:text-blue-900 transition-all"><MoreHorizontal className="h-5 w-5" /></Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-56 p-2 rounded-2xl border-slate-200 shadow-2xl">
                            <DropdownMenuLabel className="text-[10px] font-black uppercase text-slate-400 px-2 pb-2">Mission Control</DropdownMenuLabel>
                            <DropdownMenuItem onClick={() => onViewOrder(order)} className="gap-3 font-bold py-2.5 cursor-pointer rounded-xl hover:bg-blue-50">
                                <Eye className="h-4 w-4 text-blue-600" /> View Payload
                            </DropdownMenuItem>
                            {tab === 'pending' && !isCancelled && (
                                <DropdownMenuItem onClick={() => onAssign(order)} className="gap-3 font-black py-2.5 cursor-pointer rounded-xl bg-blue-900 text-white hover:bg-slate-900 focus:bg-slate-900 focus:text-white">
                                    <PlusCircle className="h-4 w-4" /> Assign Fleet
                                </DropdownMenuItem>
                            )}
                            {!isCancelled && (
                                <>
                                    <DropdownMenuSeparator className="bg-slate-100" />
                                    <DropdownMenuItem onClick={() => onShortClose(order.id)} className="gap-3 font-bold py-2.5 text-orange-600 cursor-pointer rounded-xl hover:bg-orange-50">
                                        <ArrowRightLeft className="h-4 w-4" /> Short Close Node
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => onCancelOrder(order.id)} className="gap-3 font-bold py-2.5 text-red-600 cursor-pointer rounded-xl hover:bg-red-50">
                                        <Ban className="h-4 w-4" /> Cancel Registry
                                    </DropdownMenuItem>
                                </>
                            )}
                            {isCancelled && isAdmin && (
                                <DropdownMenuItem onClick={() => onRestoreOrder(order.id)} className="gap-3 font-bold py-2.5 text-emerald-600 cursor-pointer rounded-xl hover:bg-emerald-50">
                                    <RotateCcw className="h-4 w-4" /> Restore Mission
                                </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                    {assignedTrips.map((trip: any, tIdx: number) => (
                        <TableRow key={trip.id} className="h-14 bg-slate-50/50 hover:bg-blue-50/10 border-b border-slate-100 last:border-slate-200 transition-colors group/trip">
                            <TableCell colSpan={2} className="px-6">
                                <div className="flex items-center gap-3 pl-4">
                                    <div className="h-6 w-px bg-slate-200" />
                                    <div className="p-1.5 bg-blue-100 rounded-lg"><Truck className="h-3 w-3 text-blue-700" /></div>
                                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Fleet Node {tIdx + 1}</span>
                                </div>
                            </TableCell>
                            <TableCell colSpan={2} className="px-4 font-black text-slate-900 uppercase text-xs tracking-tighter">
                                {trip.vehicleNumber}
                                <span className="ml-3 font-mono font-bold text-blue-600 text-[10px] opacity-60">ID: {trip.tripId}</span>
                            </TableCell>
                            <TableCell className="px-4">
                                <div className="flex items-center gap-2">
                                    <div className="h-5 w-5 rounded-full bg-slate-200 flex items-center justify-center"><UserCircle className="h-3 w-3 text-slate-500" /></div>
                                    <span className="text-[11px] font-bold text-slate-600 uppercase truncate max-w-[150px]">{trip.driverName || 'Pilot N/A'}</span>
                                </div>
                            </TableCell>
                            <TableCell colSpan={5} className="px-4">
                                <div className="flex items-center gap-4">
                                    <Badge variant="outline" className={cn(
                                        "text-[8px] font-black uppercase px-2 h-5 border-none",
                                        trip.entry?.status === 'OUT' ? "bg-emerald-600 text-white" : "bg-blue-600 text-white"
                                    )}>
                                        {trip.entry?.status === 'OUT' ? 'DISPATCHED' : (trip.entry?.status === 'IN' ? 'IN-YARD' : 'ASSIGNED')}
                                    </Badge>
                                    <span className="text-[9px] font-black text-blue-900 uppercase">Load: {(trip.assignedQtyInTrip || 0).toFixed(3)} MT</span>
                                </div>
                            </TableCell>
                            <TableCell colSpan={2} className="px-4 text-center">
                                <Badge variant="outline" className="text-[9px] font-black bg-white border-slate-200 text-slate-500 uppercase h-5">{trip.tripStatus || 'Awaiting Node'}</Badge>
                            </TableCell>
                            <TableCell className="px-8 text-right sticky right-0 bg-slate-50 group-hover/trip:bg-blue-50/20 transition-all border-l border-slate-100">
                                <div className="flex justify-end gap-1 opacity-0 group-hover/trip:opacity-100 transition-opacity">
                                    <TooltipProvider>
                                        <Tooltip>
                                            <TooltipTrigger asChild>
                                                <Button size="icon" variant="ghost" className="h-7 w-7 text-blue-600 hover:bg-white" onClick={() => onEditAssignment(order, trip)} disabled={trip.entry?.status === 'OUT'}>
                                                    <Edit2 className="h-3.5 w-3.5" />
                                                </Button>
                                            </TooltipTrigger>
                                            <TooltipContent className="bg-slate-900 text-white text-[9px] font-black uppercase">Edit Assignment</TooltipContent>
                                        </Tooltip>
                                    </TooltipProvider>
                                    <TooltipProvider>
                                        <Tooltip>
                                            <TooltipTrigger asChild>
                                                <Button size="icon" variant="ghost" className="h-7 w-7 text-red-600 hover:bg-white" onClick={() => onCancelAssignment(trip.id, order.id, trip.assignedQtyInTrip)} disabled={trip.entry?.status === 'OUT'}>
                                                    <Trash2 className="h-3.5 w-3.5" />
                                                </Button>
                                            </TooltipTrigger>
                                            <TooltipContent className="bg-slate-900 text-white text-[9px] font-black uppercase">Revoke Fleet Node</TooltipContent>
                                        </Tooltip>
                                    </TooltipProvider>
                                </div>
                            </TableCell>
                        </TableRow>
                    ))}
                  </React.Fragment>
                )
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
