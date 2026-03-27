'use client';
import { useState } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { MoreHorizontal, Landmark, Wallet, MinusCircle, User, ArrowRightLeft, Printer, Edit2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import Pagination from '@/components/dashboard/vehicle-management/Pagination';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuPortal,
} from "@/components/ui/dropdown-menu";
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';

const ITEMS_PER_PAGE = 10;

interface TripFreightTableProps {
  data: any[];
  isAdmin: boolean;
  operatorName: string;
  onAction: (type: 'banking' | 'freight' | 'charges' | 'debit' | 'print' | 'edit-selection', trip: any) => void;
}

export default function TripFreightTable({ data, isAdmin, operatorName, onAction }: TripFreightTableProps) {
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
                <TableHead className="text-[11px] font-black uppercase tracking-wider h-12 px-4 text-right">LR Qty</TableHead>
                <TableHead className="text-[11px] font-black uppercase tracking-wider h-12 px-4 text-right">Freight</TableHead>
                <TableHead className="text-[11px] font-black uppercase tracking-wider h-12 px-4 text-center">POD Status</TableHead>
                <TableHead className="text-[11px] font-black uppercase tracking-wider h-12 px-4 text-center">Payment Status</TableHead>
                <TableHead className="sticky right-0 bg-slate-50 z-20 shadow-[-2px_0_5px_rgba(0,0,0,0.05)] text-[11px] font-black uppercase tracking-wider h-12 px-4 text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedData.length === 0 ? (
                <TableRow><TableCell colSpan={13} className="h-48 text-center text-slate-400 italic">No records detected in registry.</TableCell></TableRow>
              ) : (
                paginatedData.map((row) => {
                  const freight = row.freightData;
                  const balance = freight?.balanceAmount || 0;
                  const isPaidCompletely = balance <= 50;
                  const isPaymentInitiated = row.freightStatus === 'Under Process' || row.freightStatus === 'Paid';
                  const hasOwnership = isAdmin || operatorName === row.userName;

                  return (
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
                      <TableCell className="px-4 truncate max-w-[120px] font-bold text-blue-900 uppercase">{row.shipToParty}</TableCell>
                      <TableCell className="px-4 text-center truncate max-w-[120px] uppercase">{row.unloadingPoint}</TableCell>
                      <TableCell className="px-4 text-right font-black text-blue-900">{(Number(row.quantity) || 0).toFixed(3)}</TableCell>
                      <TableCell className="px-4 text-right font-black text-emerald-600">{`₹${(Number(row.totalFreightAmount) || 0).toLocaleString()}`}</TableCell>
                      <TableCell className="px-4 text-center">
                        <Badge variant={row.podReceived ? "default" : "destructive"} className="text-[9px] uppercase font-black px-2 h-5 border-none">
                            {row.podReceived ? 'Received' : 'Pending'}
                        </Badge>
                      </TableCell>
                      <TableCell className="px-4 text-center">
                        <Badge variant="outline" className={cn(
                            "text-[9px] uppercase font-black px-3 h-6",
                            isPaidCompletely ? "bg-emerald-600 text-white" : "bg-blue-50 text-blue-700 border-blue-200"
                        )}>
                            {row.freightStatus || 'Not Requested'}
                        </Badge>
                      </TableCell>
                      <TableCell className="sticky right-0 bg-white group-hover:bg-blue-50/30 z-30 border-l shadow-[-2px_0_5px_rgba(0,0,0,0.02)] px-4 text-right">
                        <DropdownMenu modal={false}>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full hover:bg-white text-slate-400 hover:text-blue-900 transition-colors"><MoreHorizontal className="h-4 w-4" /></Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuPortal>
                            <DropdownMenuContent align="end" className="w-64 p-2 border-slate-200 shadow-xl z-[100] bg-white rounded-xl">
                                <DropdownMenuLabel className="text-[9px] uppercase tracking-widest text-slate-400 mb-1 px-2">Control Node</DropdownMenuLabel>
                                
                                <DropdownMenuItem disabled={!hasOwnership || isPaymentInitiated} onClick={() => onAction('banking', row)} className="gap-3 font-bold py-2.5 cursor-pointer rounded-lg">
                                    <Landmark className="h-4 w-4 text-blue-600" /> 
                                    {isPaymentInitiated ? 'Add Banking (Locked)' : 'Add Banking'}
                                </DropdownMenuItem>

                                <DropdownMenuItem disabled={!hasOwnership || isPaymentInitiated} onClick={() => onAction('freight', row)} className="gap-3 font-bold py-2.5 cursor-pointer rounded-lg">
                                    <ArrowRightLeft className="h-4 w-4 text-emerald-600" /> 
                                    {isPaymentInitiated ? 'Freight Request (Locked)' : 'Freight Request'}
                                </DropdownMenuItem>

                                <DropdownMenuItem disabled={!hasOwnership} onClick={() => onAction('charges', row)} className="gap-3 font-bold py-2.5 cursor-pointer rounded-lg">
                                    <Wallet className="h-4 w-4 text-amber-600" /> 
                                    Add Charge
                                </DropdownMenuItem>

                                <DropdownMenuItem disabled={!hasOwnership} onClick={() => onAction('debit', row)} className="gap-3 font-bold py-2.5 text-red-600 cursor-pointer rounded-lg">
                                    <MinusCircle className="h-4 w-4 text-red-600" /> 
                                    Add Deduction
                                </DropdownMenuItem>

                                <DropdownMenuSeparator className="my-1 bg-slate-100" />

                                <DropdownMenuItem disabled={!hasOwnership} onClick={() => onAction('edit-selection', row)} className="gap-3 font-bold py-2.5 cursor-pointer rounded-lg bg-blue-600 text-white hover:bg-blue-700 focus:bg-blue-700">
                                    <Edit2 className="h-4 w-4" /> 
                                    Edit Details
                                </DropdownMenuItem>

                                <DropdownMenuItem onClick={() => onAction('print', row)} className="gap-3 font-bold py-2.5 text-blue-900 cursor-pointer rounded-lg">
                                    <Printer className="h-4 w-4 text-blue-900" /> 
                                    Print Voucher
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenuPortal>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </div>
      <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} itemCount={data.length} canPreviousPage={currentPage > 1} canNextPage={currentPage < totalPages} />
    </div>
  );
}
