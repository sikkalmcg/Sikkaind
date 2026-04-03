
'use client';
import { useState } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import type { FuelPump, WithId } from '@/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Search, Edit2, Trash2, User } from 'lucide-react';

interface PumpHistoryTableProps {
  pumps: WithId<FuelPump>[];
  isLoading: boolean;
  onEdit: (pump: WithId<FuelPump>) => void;
  onDelete: (pumpId: string) => void;
}

export default function PumpHistoryTable({ pumps, isLoading, onEdit, onDelete }: PumpHistoryTableProps) {
  const [searchTerm, setSearchTerm] = useState('');
  
  const filteredPumps = pumps.filter(p => 
    p.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.ownerName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.mobile?.includes(searchTerm) ||
    (p.pan && p.pan.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (p.paymentMethod && p.paymentMethod.toLowerCase().includes(searchTerm.toLowerCase()))
  );
  
  return (
    <Card className="border-none shadow-none bg-transparent">
      <CardHeader className="px-0 pb-6">
        <div className="flex items-center justify-between">
            <CardTitle className="text-xl font-black text-slate-800 uppercase italic">Vendor Registry History</CardTitle>
            <div className="relative group">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 group-focus-within:text-blue-900 transition-colors" />
                <Input
                    placeholder="Search vendors..."
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    className="pl-10 w-[300px] h-10 rounded-xl border-slate-200 bg-white font-bold"
                />
            </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="rounded-[2rem] border border-slate-200 shadow-xl bg-white overflow-hidden">
            <Table>
                <TableHeader className="bg-slate-50/50">
                    <TableRow className="h-14 hover:bg-transparent">
                        <TableHead className="text-[10px] font-black uppercase px-8 text-slate-400">Vendor Name</TableHead>
                        <TableHead className="text-[10px] font-black uppercase px-4 text-slate-400">Owner Name</TableHead>
                        <TableHead className="text-[10px] font-black uppercase px-4 text-slate-400">Mobile</TableHead>
                        <TableHead className="text-[10px] font-black uppercase px-4 text-slate-400">PAN / GSTIN</TableHead>
                        <TableHead className="text-[10px] font-black uppercase px-4 text-slate-400">Payment Method</TableHead>
                        <TableHead className="text-[10px] font-black uppercase px-8 text-right text-slate-400">Action</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {isLoading ? (
                        <TableRow><TableCell colSpan={6} className="h-48 text-center"><Loader2 className="h-8 w-8 animate-spin inline-block text-blue-900 opacity-20" /></TableCell></TableRow>
                    ) : filteredPumps.length === 0 ? (
                        <TableRow><TableCell colSpan={6} className="h-64 text-center text-slate-400 italic font-medium uppercase tracking-widest opacity-40">No vendors detected in registry.</TableCell></TableRow>
                    ) : (
                        filteredPumps.map(pump => (
                            <TableRow key={pump.id} className="h-16 hover:bg-blue-50/20 transition-colors border-b border-slate-50 last:border-0 group">
                                <TableCell className="px-8 font-black text-slate-900 uppercase text-xs tracking-tight">{pump.name}</TableCell>
                                <TableCell className="px-4">
                                    <div className="flex items-center gap-2">
                                        <div className="h-6 w-6 rounded-full bg-slate-100 flex items-center justify-center">
                                            <User className="h-3 w-3 text-slate-400" />
                                        </div>
                                        <span className="font-bold text-slate-700 text-xs uppercase">{pump.ownerName}</span>
                                    </div>
                                </TableCell>
                                <TableCell className="px-4 font-mono text-[11px] font-bold text-slate-500">{pump.mobile}</TableCell>
                                <TableCell className="px-4">
                                    <div className="flex flex-col">
                                        <span className="text-[10px] font-black text-blue-900 font-mono">{pump.pan || '--'}</span>
                                        <span className="text-[8px] font-bold text-slate-400 uppercase">{pump.gstin || 'NO GSTIN'}</span>
                                    </div>
                                </TableCell>
                                <TableCell className="px-4">
                                    <Badge variant="outline" className="bg-slate-50 text-slate-600 border-slate-200 font-black uppercase text-[9px] px-3">{pump.paymentMethod || 'N/A'}</Badge>
                                </TableCell>
                                <TableCell className="px-8 text-right">
                                    <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-all duration-300">
                                        <Button variant="ghost" size="icon" className="h-8 w-8 text-blue-600 hover:bg-blue-50" onClick={() => onEdit(pump)}>
                                            <Edit2 className="h-4 w-4" />
                                        </Button>
                                        <AlertDialog>
                                            <AlertDialogTrigger asChild>
                                                <Button variant="ghost" size="icon" className="h-8 w-8 text-red-600 hover:bg-red-50">
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </AlertDialogTrigger>
                                            <AlertDialogContent className="border-none shadow-2xl">
                                                <AlertDialogHeader>
                                                    <AlertDialogTitle className="font-black uppercase tracking-tight text-red-900 italic">Revoke Vendor Node?</AlertDialogTitle>
                                                    <AlertDialogDescription className="text-sm font-medium">
                                                        This will permanently erase **{pump.name}** from the mission registry.
                                                    </AlertDialogDescription>
                                                </AlertDialogHeader>
                                                <AlertDialogFooter className="bg-slate-50 -mx-6 -mb-6 p-6 flex-row justify-end gap-3 border-t mt-4">
                                                    <AlertDialogCancel className="font-bold border-slate-200">Abort</AlertDialogCancel>
                                                    <AlertDialogAction onClick={() => onDelete(pump.id)} className="bg-red-600 hover:bg-red-700 text-white font-black uppercase text-[10px] tracking-widest px-8 border-none">Confirm Purge</AlertDialogAction>
                                                </AlertDialogFooter>
                                            </AlertDialogContent>
                                        </AlertDialog>
                                    </div>
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
