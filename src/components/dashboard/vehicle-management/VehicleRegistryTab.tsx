'use client';

import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { 
    Search, 
    Plus, 
    Edit2, 
    Trash2, 
    ShieldCheck, 
    Calendar, 
    User, 
    Smartphone, 
    IdCard,
    Factory,
    ArrowRightLeft,
    Loader2
} from 'lucide-react';
import { useFirestore, useCollection, useMemoFirebase, useUser } from '@/firebase';
import { collection, query, where, deleteDoc, doc, addDoc, serverTimestamp, getDoc } from 'firebase/firestore';
import { format, isBefore, addDays } from 'date-fns';
import type { Vehicle, WithId, Plant } from '@/types';
import VehicleFormModal from './VehicleFormModal';
import { useToast } from '@/hooks/use-toast';
import { useLoading } from '@/context/LoadingContext';
import { cn, normalizePlantId } from '@/lib/utils';
import Pagination from './Pagination';

const ITEMS_PER_PAGE = 10;

export default function VehicleRegistryTab({ type }: { type: 'Own Vehicle' | 'Contract Vehicle' | 'Market Vehicle' }) {
    const { toast } = useToast();
    const firestore = useFirestore();
    const { user } = useUser();
    const { showLoader, hideLoader } = useLoading();
    
    const [searchTerm, setSearchTerm] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingVehicle, setEditingVehicle] = useState<WithId<Vehicle> | null>(null);

    const vehicleQuery = useMemoFirebase(() => 
        firestore ? query(collection(firestore, "vehicles"), where("vehicleType", "==", type), where("isDeleted", "==", false)) : null, 
        [firestore, type]
    );
    const { data: vehicles, isLoading } = useCollection<Vehicle>(vehicleQuery);

    const plantsQuery = useMemoFirebase(() => 
        firestore ? query(collection(firestore, "logistics_plants")) : null, 
        [firestore]
    );
    const { data: plants } = useCollection<Plant>(plantsQuery);

    const filteredVehicles = useMemo(() => {
        if (!vehicles) return [];
        return vehicles.filter(v => 
            v.vehicleNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
            v.driverName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            v.driverMobile?.toLowerCase().includes(searchTerm.toLowerCase())
        ).sort((a, b) => a.vehicleNumber.localeCompare(b.vehicleNumber));
    }, [vehicles, searchTerm]);

    const paginatedVehicles = filteredVehicles.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);
    const totalPages = Math.ceil(filteredVehicles.length / ITEMS_PER_PAGE);

    const handleDelete = async (id: string) => {
        if (!firestore) return;
        showLoader();
        try {
            const vehicleRef = doc(firestore, "vehicles", id);
            const snap = await getDoc(vehicleRef);
            if (snap.exists()) {
                const data = snap.data();
                await addDoc(collection(firestore, "recycle_bin"), {
                    pageName: "Vehicle Registry",
                    userName: user?.email?.split('@')[0] || "Admin",
                    deletedAt: serverTimestamp(),
                    data: { ...data, id, type: 'Vehicle' }
                });
                await updateDoc(vehicleRef, { isDeleted: true, status: 'Inactive', updatedAt: serverTimestamp() });
                toast({ title: "Registry Updated", description: "Vehicle moved to system archive." });
            }
        } catch (e: any) {
            toast({ variant: 'destructive', title: "Error", description: e.message });
        } finally {
            hideLoader();
        }
    };

    const getExpiryBadge = (date: any) => {
        if (!date) return <Badge variant="outline" className="text-[8px] opacity-30">N/A</Badge>;
        const d = date instanceof Date ? date : (date?.toDate ? date.toDate() : new Date(date));
        const isExpired = isBefore(d, new Date());
        const isExpiringSoon = isBefore(d, addDays(new Date(), 30));

        return (
            <Badge className={cn(
                "text-[9px] font-black uppercase border-none",
                isExpired ? "bg-red-600 text-white" : (isExpiringSoon ? "bg-amber-500 text-white" : "bg-emerald-600 text-white")
            )}>
                {format(d, 'dd MMM yy')}
            </Badge>
        );
    };

    return (
        <Card className="border-none shadow-xl rounded-[2.5rem] bg-white overflow-hidden">
            <CardHeader className="bg-slate-50 border-b p-8 flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div>
                    <CardTitle className="text-sm font-black uppercase tracking-widest text-slate-700">{type} Handbook</CardTitle>
                    <CardDescription className="text-[10px] font-bold text-slate-400 uppercase">Operational Asset Registry</CardDescription>
                </div>
                <div className="flex items-center gap-4">
                    <div className="relative group">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 group-focus-within:text-blue-900 transition-colors" />
                        <Input 
                            placeholder="Search registry..." 
                            value={searchTerm} 
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-10 h-11 w-[300px] rounded-xl bg-white border-slate-200 font-bold shadow-inner"
                        />
                    </div>
                    <Button 
                        onClick={() => { setEditingVehicle(null); setIsModalOpen(true); }}
                        className="h-11 px-8 rounded-xl bg-blue-900 hover:bg-black text-white font-black uppercase text-[10px] tracking-widest shadow-xl border-none transition-all active:scale-95"
                    >
                        <Plus className="h-4 w-4 mr-2" /> Provision Asset
                    </Button>
                </div>
            </CardHeader>
            <CardContent className="p-0">
                <div className="overflow-x-auto">
                    <Table>
                        <TableHeader className="bg-slate-50">
                            <TableRow className="h-12 hover:bg-transparent text-[10px] font-black uppercase text-slate-400">
                                <TableHead className="px-8">Vehicle Number</TableHead>
                                <TableHead className="px-4">Lifting Node</TableHead>
                                <TableHead className="px-4">Pilot Detail</TableHead>
                                <TableHead className="px-4 text-center">GPS Link</TableHead>
                                {type === 'Own Vehicle' && (
                                    <>
                                        <TableHead className="px-4 text-center">Pollution Exp.</TableHead>
                                        <TableHead className="px-4 text-center">Fitness Exp.</TableHead>
                                    </>
                                )}
                                {(type === 'Contract Vehicle' || type === 'Market Vehicle') && (
                                    <TableHead className="px-4">Transporter/Owner</TableHead>
                                )}
                                <TableHead className="px-4 text-center">Status</TableHead>
                                <TableHead className="px-8 text-right">Action</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isLoading ? (
                                Array.from({length: 5}).map((_, i) => (
                                    <TableRow key={i} className="h-16"><TableCell colSpan={8} className="px-8"><div className="h-8 w-full bg-slate-100 animate-pulse rounded-lg" /></TableCell></TableRow>
                                ))
                            ) : paginatedVehicles.length === 0 ? (
                                <TableRow><TableCell colSpan={8} className="h-64 text-center text-slate-400 italic font-medium uppercase tracking-widest opacity-40">No assets detected in this category node.</TableCell></TableRow>
                            ) : (
                                paginatedVehicles.map((vehicle) => (
                                    <TableRow key={vehicle.id} className="h-16 hover:bg-blue-50/20 transition-all border-b border-slate-50 last:border-0 group">
                                        <TableCell className="px-8 font-black text-slate-900 uppercase text-xs tracking-tighter">{vehicle.vehicleNumber}</TableCell>
                                        <TableCell className="px-4 text-[10px] font-black uppercase text-slate-400">
                                            {plants?.find(p => normalizePlantId(p.id) === normalizePlantId(vehicle.plantId))?.name || vehicle.plantId}
                                        </TableCell>
                                        <TableCell className="px-4">
                                            <div className="flex flex-col">
                                                <span className="text-xs font-bold text-slate-700 uppercase">{vehicle.driverName || '--'}</span>
                                                <span className="text-[10px] font-mono text-slate-400">{vehicle.driverMobile || '--'}</span>
                                            </div>
                                        </TableCell>
                                        <TableCell className="px-4 text-center">
                                            <Badge variant="outline" className={cn(
                                                "text-[8px] font-black uppercase px-2 h-5",
                                                vehicle.gps_enabled ? "bg-blue-50 text-blue-700 border-blue-200" : "bg-slate-50 text-slate-400"
                                            )}>{vehicle.gps_enabled ? 'Active Link' : 'No GPS'}</Badge>
                                        </TableCell>
                                        {type === 'Own Vehicle' && (
                                            <>
                                                <TableCell className="px-4 text-center">{getExpiryBadge((vehicle as any).pollutionCertValidity)}</TableCell>
                                                <TableCell className="px-4 text-center">{getExpiryBadge((vehicle as any).fitnessCertValidity)}</TableCell>
                                            </>
                                        )}
                                        {(type === 'Contract Vehicle' || type === 'Market Vehicle') && (
                                            <TableCell className="px-4 text-[10px] font-bold uppercase text-slate-600 truncate max-w-[150px]">
                                                {(vehicle as any).ownerName || (vehicle as any).transporterName || '--'}
                                            </TableCell>
                                        )}
                                        <TableCell className="px-4 text-center">
                                            <Badge className={cn(
                                                "font-black uppercase text-[9px] px-3 h-6 border-none shadow-sm",
                                                vehicle.status === 'Available' ? "bg-emerald-600 text-white" : "bg-blue-900 text-white"
                                            )}>{vehicle.status}</Badge>
                                        </TableCell>
                                        <TableCell className="px-8 text-right sticky right-0 bg-white/80 group-hover:bg-blue-50/80 backdrop-blur-sm shadow-[-4px_0_10px_rgba(0,0,0,0.02)]">
                                            <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-all">
                                                <Button variant="ghost" size="icon" className="h-8 w-8 text-blue-600 hover:bg-blue-50" onClick={() => { setEditingVehicle(vehicle); setIsModalOpen(true); }}>
                                                    <Edit2 className="h-4 w-4" />
                                                </Button>
                                                <Button variant="ghost" size="icon" className="h-8 w-8 text-red-600 hover:bg-red-50" onClick={() => handleDelete(vehicle.id)}>
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </div>
                <div className="p-6 bg-slate-50 border-t flex items-center justify-between">
                    <Pagination 
                        currentPage={currentPage} 
                        totalPages={totalPages} 
                        onPageChange={setCurrentPage} 
                        itemCount={filteredVehicles.length}
                        canPreviousPage={currentPage > 1}
                        canNextPage={currentPage < totalPages}
                    />
                </div>
            </CardContent>
            {isModalOpen && (
                <VehicleFormModal 
                    isOpen={isModalOpen}
                    onClose={() => setIsModalOpen(false)}
                    vehicle={editingVehicle}
                    type={type}
                    plants={plants || []}
                />
            )}
        </Card>
    );
}
