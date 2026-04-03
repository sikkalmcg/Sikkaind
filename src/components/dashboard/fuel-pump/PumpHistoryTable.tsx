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
import { Search, Edit2, Trash2, Loader2, MapPin, Smartphone, Truck, Layers } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

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
    p.mobile?.includes(searchTerm) ||
    p.route?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.category?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (p.pan && p.pan.toLowerCase().includes(searchTerm.toLowerCase()))
  );
  
  return (
    <Card className="border-none shadow-none bg-transparent">
      <CardHeader className="px-0 pb-6">
        <div className="flex items-center justify-between">
            <CardTitle className="text-xl font-black text-slate-800 uppercase italic">Vendor Registry History</CardTitle>
            <div className="relative group">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 group-focus-within:text-blue-900 transition-colors" />
                <Input
                    placeholder="Search name, route, mobile, category..."
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    className="pl-10 w-[350px] h-11 rounded-2xl border-slate-200 bg-white font-bold shadow-sm focus-visible:ring-blue-900"
                />
            </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="rounded-[2.5rem] border border-slate-200 shadow-xl bg-white overflow-hidden">
            <div className="overflow-x-auto">
                <Table className="min-w-[1400px]">
                    <TableHeader className="bg-slate-50/50">
                        <TableRow className="h-14 hover:bg-transparent border-b border-slate-100">
                            <TableHead className="text-[10px] font-black uppercase px-8 text-slate-400">Vendor Identity</TableHead>
                            <TableHead className="text-[10px] font-black uppercase px-4 text-slate-400 text-center">Fleet Category</TableHead>
                            <TableHead className="text-[10px] font-black uppercase px-4 text-slate-400">Contact Node</TableHead>
                            <TableHead className="text-[10px] font-black uppercase px-4 text-slate-400">Route Registry</TableHead>
                            <TableHead className="text-[10px] font-black uppercase px-4 text-slate-400">TAX Node</TableHead>
                            <TableHead className="text-[10px] font-black uppercase px-8 text-right text-slate-400 sticky right-0 bg-slate-50/50">Action</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {isLoading ? (
                            <TableRow><TableCell colSpan={6} className="h-64 text-center"><Loader2 className="h-10 w-10 animate-spin inline-block text-blue-900 opacity-20" /></TableCell></TableRow>
                        ) : filteredPumps.length === 0 ? (
                            <TableRow><TableCell colSpan={6} className="h-64 text-center text-slate-400 italic font-medium uppercase tracking-[0.3em] opacity-40">No vendors detected in registry.</TableCell></TableRow>
                        ) : (
                            filteredPumps.map(pump => (
                                <TableRow key={pump.id} className="h-20 hover:bg-blue-50/20 transition-colors border-b border-slate-50 last:border-0 group">
                                    <TableCell className="px-8">
                                        <div className="flex flex-col">
                                            <span className="font-black text-slate-900 uppercase text-sm tracking-tight">{pump.name}</span>
                                            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1 mt-1">
                                                <MapPin className="h-2 w-2" /> {pump.address || 'N/A'}
                                            </span>
                                        </div>
                                    </TableCell>
                                    <TableCell className="px-4 text-center">
                                        <Badge className="bg-blue-50 text-blue-700 border-blue-100 font-black uppercase text-[9px] h-6 px-3 shadow-sm">
                                            <Layers className="h-3 w-3 mr-1.5 opacity-40" />
                                            {pump.category || 'All Type'}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="px-4">
                                        <div className="space-y-1">
                                            <div className="flex items-center gap-2 text-blue-900 font-mono font-black text-xs">
                                                <Smartphone className="h-3 w-3 opacity-40" /> +91 {pump.mobile}
                                            </div>
                                            {pump.phone && (
                                                <div className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">Phone: {pump.phone}</div>
                                            )}
                                        </div>
                                    </TableCell>
                                    <TableCell className="px-4">
                                        <div className="flex items-center gap-2">
                                            <div className="p-1.5 bg-blue-50 rounded-lg"><Truck className="h-3.5 w-3.5 text-blue-600" /></div>
                                            <span className="text-xs font-black text-blue-900 uppercase tracking-widest">{pump.route || '--'}</span>
                                        </div>
                                    </TableCell>
                                    <TableCell className="px-4">
                                        <div className="flex flex-col gap-1">
                                            <span className="text-[10px] font-black text-slate-900 font-mono tracking-widest">{pump.pan || '--'}</span>
                                            <Badge className="bg-emerald-50 text-emerald-700 border-emerald-100 text-[8px] font-black uppercase w-fit h-4 px-1.5">{pump.gstin ? 'GST REG' : 'NO GST'}</Badge>
                                        </div>
                                    </TableCell>
                                    <TableCell className="px-8 text-right sticky right-0 bg-white/80 group-hover:bg-blue-50/80 backdrop-blur-sm shadow-[-4px_0_10px_rgba(0,0,0,0.02)]">
                                        <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-all duration-300">
                                            <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl text-blue-600 hover:bg-blue-50 border border-blue-50" onClick={() => onEdit(pump)}>
                                                <Edit2 className="h-4 w-4" />
                                            </Button>
                                            <AlertDialog>
                                                <AlertDialogTrigger asChild>
                                                    <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl text-red-600 hover:bg-red-50 border border-red-50">
                                                        <Trash2 className="h-4 w-4" />
                                                    </Button>
                                                </AlertDialogTrigger>
                                                <AlertDialogContent className="border-none shadow-3xl rounded-[2rem] p-0 overflow-hidden bg-white">
                                                    <div className="p-8 bg-red-50 border-b border-red-100 flex items-center gap-5">
                                                        <div className="p-3 bg-red-600 text-white rounded-2xl shadow-xl"><Trash2 className="h-6 w-6" /></div>
                                                        <div>
                                                            <AlertDialogTitle className="text-xl font-black uppercase tracking-tight text-red-900 italic">Revoke Vendor Identity?</AlertDialogTitle>
                                                            <AlertDialogDescription className="text-red-700 font-bold text-[9px] uppercase tracking-widest mt-1">Authorized Registry Disposal node</AlertDialogDescription>
                                                        </div>
                                                    </div>
                                                    <div className="p-10">
                                                        <p className="text-sm font-medium text-slate-600 leading-relaxed italic border-l-4 border-red-100 pl-4">
                                                            "Executing this action will permanently remove **{pump.name}** from the mission registry. Associated history will be moved to system archive."
                                                        </p>
                                                    </div>
                                                    <AlertDialogFooter className="bg-slate-50 p-6 flex-row justify-end gap-3 border-t">
                                                        <AlertDialogCancel className="font-bold border-slate-200 h-11 px-8 rounded-xl m-0">Abort</AlertDialogCancel>
                                                        <AlertDialogAction onClick={() => onDelete(pump.id)} className="bg-red-600 hover:bg-red-700 text-white font-black uppercase text-[10px] tracking-widest px-10 h-11 rounded-xl shadow-lg border-none transition-all active:scale-95">Confirm Purge</AlertDialogAction>
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
        </div>
      </CardContent>
    </Card>
  );
}
