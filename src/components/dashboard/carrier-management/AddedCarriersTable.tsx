'use client';
import { useState, useMemo } from 'react';
import Image from 'next/image';
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
import type { Carrier, Plant, WithId } from '@/types';
import { normalizePlantId } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Search, Edit2, Trash2, Factory } from 'lucide-react';

interface AddedCarriersTableProps {
  carriers: WithId<Carrier>[];
  plants: WithId<Plant>[];
  onEdit: (carrier: WithId<Carrier>) => void;
  onDelete: (carrierId: string) => void;
}

export default function AddedCarriersTable({ carriers, plants, onEdit, onDelete }: AddedCarriersTableProps) {
  const [searchTerm, setSearchTerm] = useState('');
  
  const resolvedCarriers = useMemo(() => {
    return carriers.map(carrier => {
        const normalizedCarrierPlantId = normalizePlantId(carrier.plantId);
        const plant = plants.find(p => 
            p.id === carrier.plantId || 
            normalizePlantId(p.id) === normalizedCarrierPlantId
        );
        return {
            ...carrier,
            resolvedPlantName: plant?.name || carrier.plantId || 'N/A'
        };
    });
  }, [carriers, plants]);

  const filteredCarriers = resolvedCarriers.filter(c => 
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.gstin.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.resolvedPlantName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.pan.toLowerCase().includes(searchTerm.toLowerCase())
  );
  
  return (
    <div className="space-y-4">
        <div className="flex items-center gap-3 max-w-sm bg-white border border-slate-200 rounded-xl px-3 py-1.5 shadow-sm group focus-within:ring-2 focus-within:ring-blue-900 transition-all">
            <Search className="h-4 w-4 text-slate-400 group-focus-within:text-blue-900" />
            <Input
                placeholder="Search carriers or plants..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="border-none bg-transparent shadow-none focus-visible:ring-0 h-8 font-medium"
            />
        </div>

        <div className="rounded-[1.5rem] border border-slate-200 shadow-xl bg-white overflow-hidden">
            <div className="overflow-x-auto">
                <Table>
                    <TableHeader className="bg-slate-50/50">
                        <TableRow className="hover:bg-transparent border-b border-slate-100">
                            <TableHead className="text-[10px] font-black uppercase tracking-widest h-14 px-6">Logo</TableHead>
                            <TableHead className="text-[10px] font-black uppercase tracking-widest h-14 px-4">Lifting Node</TableHead>
                            <TableHead className="text-[10px] font-black uppercase tracking-widest h-14 px-4">Carrier Name</TableHead>
                            <TableHead className="text-[10px] font-black uppercase tracking-widest h-14 px-4">GSTIN</TableHead>
                            <TableHead className="text-[10px] font-black uppercase tracking-widest h-14 px-4">PAN</TableHead>
                            <TableHead className="text-[10px] font-black uppercase tracking-widest h-14 px-4 text-center">State</TableHead>
                            <TableHead className="text-[10px] font-black uppercase tracking-widest h-14 px-6 text-right sticky right-0 bg-slate-50/50">Action</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {filteredCarriers.length === 0 ? (
                            <TableRow><TableCell colSpan={7} className="text-center h-48 text-slate-400 italic">No carriers detected in mission registry.</TableCell></TableRow>
                        ) : (
                            filteredCarriers.map(carrier => {
                                return (
                                    <TableRow key={carrier.id} className="hover:bg-blue-50/20 transition-colors h-16 border-b border-slate-50 last:border-0 group">
                                        <TableCell className="px-6">
                                            <div className="h-10 w-10 relative border rounded-lg bg-white p-1 shadow-sm">
                                                <Image src={carrier.logoUrl || '/placeholder.svg'} alt={`${carrier.name}`} fill className="object-contain" />
                                            </div>
                                        </TableCell>
                                        <TableCell className="px-4">
                                            <div className="flex items-center gap-2">
                                                <div className="h-1.5 w-1.5 rounded-full bg-blue-600" />
                                                <span className="font-black text-blue-900 uppercase text-[11px] tracking-tight">{carrier.resolvedPlantName}</span>
                                            </div>
                                        </TableCell>
                                        <TableCell className="px-4 font-black text-slate-800 uppercase text-xs truncate max-w-[200px]">{carrier.name}</TableCell>
                                        <TableCell className="px-4 font-mono text-[11px] font-bold text-slate-500 tracking-widest">{carrier.gstin}</TableCell>
                                        <TableCell className="px-4 font-mono text-[11px] font-bold text-slate-500">{carrier.pan}</TableCell>
                                        <TableCell className="px-4 text-center">
                                            <Badge variant="outline" className="bg-slate-50 text-slate-600 border-slate-200 font-black uppercase text-[9px] px-3">{carrier.stateName}</Badge>
                                        </TableCell>
                                        <TableCell className="px-6 text-right sticky right-0 bg-white/80 group-hover:bg-blue-50/80 backdrop-blur-sm shadow-[-4px_0_10px_rgba(0,0,0,0.02)]">
                                            <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-all">
                                                <Button variant="ghost" size="icon" className="h-8 w-8 text-blue-600 hover:bg-blue-50" onClick={() => onEdit(carrier)}>
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
                                                            <div className="flex items-center gap-3 mb-2">
                                                                <div className="p-2 bg-red-100 text-red-600 rounded-lg"><Factory className="h-5 w-5" /></div>
                                                                <AlertDialogTitle className="font-black uppercase tracking-tight text-red-900">Revoke Carrier node?</AlertDialogTitle>
                                                            </div>
                                                            <AlertDialogDescription className="text-sm font-medium">
                                                                This will permanently erase **{carrier.name}** from the registry. This action cannot be reversed by mission control.
                                                            </AlertDialogDescription>
                                                        </AlertDialogHeader>
                                                        <AlertDialogFooter className="bg-slate-50 -mx-6 -mb-6 p-6 flex-row justify-end gap-3 border-t mt-4">
                                                            <AlertDialogCancel className="font-bold border-slate-200">Abort</AlertDialogCancel>
                                                            <AlertDialogAction onClick={() => onDelete(carrier.id)} className="bg-red-600 hover:bg-red-700 text-white font-black uppercase text-[10px] tracking-widest px-8 border-none shadow-lg">Confirm Purge</AlertDialogAction>
                                                        </AlertDialogFooter>
                                                    </AlertDialogContent>
                                                </AlertDialog>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                );
                            })
                        )}
                    </TableBody>
                </Table>
            </div>
        </div>
    </div>
  );
}
