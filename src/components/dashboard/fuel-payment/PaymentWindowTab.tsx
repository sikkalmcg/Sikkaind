'use client';
import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { subDays } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DatePicker } from '@/components/date-picker';
import { Loader2, ShieldCheck, Factory, Signal, WifiOff, Calculator, CheckCircle2 } from 'lucide-react';
import { mockFuelPumps, mockPlants } from '@/lib/mock-data';
import type { WithId, FuelPump, FuelPayment, FuelEntry, SubUser, Plant } from '@/types';
import MakePaymentModal from './MakePaymentModal';
import { useFirestore, useUser, useCollection, useMemoFirebase } from "@/firebase";
import { collection, getDocs, query, where, doc, getDoc, Timestamp, orderBy, limit } from "firebase/firestore";
import { normalizePlantId } from '@/lib/utils';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';

interface PaymentWindowTabProps {
    onPaymentMade: (paymentData: Omit<FuelPayment, 'id'>) => void;
}

const formSchema = z.object({
  pumpId: z.string().min(1, 'Pump selection is required.'),
  fromDate: z.date(),
  toDate: z.date(),
});

type FormValues = z.infer<typeof formSchema>;

export default function PaymentWindowTab({ onPaymentMade }: PaymentWindowTabProps) {
    const firestore = useFirestore();
    const { user } = useUser();
    const [pumps, setPumps] = useState<WithId<FuelPump>[]>([]);
    const [isLoadingMeta, setIsLoadingMeta] = useState(true);
    const [totalAmount, setTotalAmount] = useState<number | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [relevantEntries, setRelevantEntries] = useState<WithId<FuelEntry>[]>([]);
    const [dbError, setDbError] = useState(false);
    
    // Master Plants for ID resolution
    const plantsQuery = useMemoFirebase(() => 
        firestore ? query(collection(firestore, "logistics_plants")) : null, 
        [firestore]
    );
    const { data: masterPlants } = useCollection<Plant>(plantsQuery);

    const form = useForm<FormValues>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            fromDate: subDays(new Date(), 30),
            toDate: new Date(),
        },
    });

    const { watch, formState: { isSubmitting }, handleSubmit } = form;
    const { pumpId, fromDate, toDate } = watch();
    const selectedPump = pumps.find(p => p.id === pumpId);

    useEffect(() => {
        if (!firestore) return;
        const fetchPumps = async () => {
            setIsLoadingMeta(true);
            try {
                const snapshot = await getDocs(collection(firestore, "fuel_pumps"));
                const pumpList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as WithId<FuelPump>));
                setPumps(pumpList.length > 0 ? pumpList : mockFuelPumps);
            } catch (error) {
                console.error("Error fetching pumps:", error);
                setPumps(mockFuelPumps);
            } finally {
                setIsLoadingMeta(false);
            }
        }
        fetchPumps();
    }, [firestore]);

    const onSubmit = async (values: FormValues) => {
        if (!firestore || !user) return;
        setTotalAmount(null);
        setRelevantEntries([]);
        setDbError(false);
        
        try {
            // 1. HIGH-FIDELITY IDENTITY HANDSHAKE
            const lastIdentity = localStorage.getItem('slmc_last_identity');
            const searchEmail = user.email || (lastIdentity?.includes('@') ? lastIdentity : `${lastIdentity}@sikka.com`);
            
            let userDocSnap = null;
            const userQ = query(collection(firestore, "users"), where("email", "==", searchEmail), limit(1));
            const userQSnap = await getDocs(userQ);
            
            if (!userQSnap.empty) {
                userDocSnap = userQSnap.docs[0];
            } else {
                const directRef = doc(firestore, "users", user.uid);
                const directSnap = await getDoc(directRef);
                if (directSnap.exists()) userDocSnap = directSnap;
            }

            let authorizedPlantIds: string[] = [];
            const isAdminSession = user.email === 'sikkaind.admin@sikka.com' || user.email === 'sikkalmcg@gmail.com' || userDocSnap?.data()?.username === 'sikkaind';

            if (userDocSnap) {
                const userData = userDocSnap.data() as SubUser;
                const isRoot = userData.username?.toLowerCase() === 'sikkaind' || isAdminSession;
                const basePlants = masterPlants && masterPlants.length > 0 ? masterPlants : mockPlants;
                authorizedPlantIds = isRoot ? basePlants.map(p => p.id) : (userData.plantIds || []);
            } else if (isAdminSession) {
                const basePlants = masterPlants && masterPlants.length > 0 ? masterPlants : mockPlants;
                authorizedPlantIds = basePlants.map(p => p.id);
            }

            if (authorizedPlantIds.length === 0) {
                setTotalAmount(0);
                return;
            }

            // 2. REGISTRY EXTRACTION LOOP
            const allEntries: WithId<FuelEntry>[] = [];
            const toDateWithTime = new Date(values.toDate);
            toDateWithTime.setHours(23, 59, 59, 999);

            for (const pId of authorizedPlantIds) {
                // Simplified query: bypasses complex index requirements by filtering balance in memory
                const q = query(
                    collection(firestore, `plants/${pId}/fuel_entries`),
                    where("pumpId", "==", values.pumpId)
                );
                
                const snapshot = await getDocs(q);
                snapshot.forEach(docSnap => {
                    const data = docSnap.data();
                    const balance = Number(data.balanceAmount || 0);
                    
                    if (balance > 0.01) {
                        const entryDate = data.date instanceof Timestamp ? data.date.toDate() : new Date(data.date);
                        if (entryDate >= values.fromDate && entryDate <= toDateWithTime) {
                            allEntries.push({ 
                                id: docSnap.id, 
                                ...data, 
                                plantId: pId,
                                date: entryDate
                            } as WithId<FuelEntry>);
                        }
                    }
                });
            }

            const sum = allEntries.reduce((acc, entry) => acc + (Number(entry.balanceAmount) || 0), 0);
            setTotalAmount(sum);
            setRelevantEntries(allEntries);
        } catch (error) {
            console.error("Payment calculation error:", error);
            setDbError(true);
        }
    };

    return (
        <>
        <Card className="border-none shadow-xl rounded-2xl overflow-hidden bg-white">
            <CardHeader className="bg-slate-50 border-b p-6">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-blue-900 text-white rounded-lg shadow-lg rotate-3"><Calculator className="h-5 w-5" /></div>
                        <div>
                            <CardTitle className="text-xl font-black uppercase text-blue-900 italic">Payment Window</CardTitle>
                            <CardDescription className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Calculate liabilities for authorized lifting nodes</CardDescription>
                        </div>
                    </div>
                    {dbError && (
                        <div className="flex items-center gap-2 text-orange-600 bg-orange-50 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border border-orange-200">
                            <WifiOff className="h-3 w-3" /> <span>Registry Unstable</span>
                        </div>
                    )}
                </div>
            </CardHeader>
            <CardContent className="p-8">
                <Form {...form}>
                    <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
                        <div className="flex flex-wrap items-end gap-6 p-6 bg-slate-50 rounded-[2rem] border border-slate-100 shadow-inner">
                            <FormField name="fromDate" control={form.control} render={({ field }) => (
                                <FormItem className="flex flex-col">
                                    <FormLabel className="text-[10px] font-black uppercase text-slate-400 tracking-widest px-1">Period From</FormLabel>
                                    <FormControl><DatePicker date={field.value} setDate={field.onChange} className="h-11 rounded-xl shadow-sm border-slate-200 bg-white" /></FormControl>
                                    <FormMessage />
                                </FormItem>
                            )} />
                            <FormField name="toDate" control={form.control} render={({ field }) => (
                                <FormItem className="flex flex-col">
                                    <FormLabel className="text-[10px] font-black uppercase text-slate-400 tracking-widest px-1">Period To</FormLabel>
                                    <FormControl><DatePicker date={field.value} setDate={field.onChange} className="h-11 rounded-xl shadow-sm border-slate-200 bg-white" /></FormControl>
                                    <FormMessage />
                                </FormItem>
                            )} />
                            <FormField name="pumpId" control={form.control} render={({ field }) => (
                                <FormItem className="flex-1 min-w-[240px]">
                                    <FormLabel className="text-[10px] font-black uppercase text-slate-400 tracking-widest px-1">Pump Node Registry *</FormLabel>
                                    <Select onValueChange={field.onChange} value={field.value} disabled={isLoadingMeta}>
                                        <FormControl>
                                            <SelectTrigger className="h-11 bg-white rounded-xl font-black text-blue-900 border-slate-200 shadow-sm">
                                                <SelectValue placeholder={isLoadingMeta ? "Syncing..." : "Select Pump"} />
                                            </SelectTrigger>
                                        </FormControl>
                                        <SelectContent className="rounded-xl">
                                            {pumps.map(p => <SelectItem key={p.id} value={p.id} className="font-bold py-2.5">{p.name}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                    <FormMessage />
                                </FormItem>
                            )} />
                            <Button 
                                type="submit" 
                                disabled={isSubmitting || !pumpId} 
                                className="h-11 px-10 rounded-xl bg-blue-900 hover:bg-slate-900 text-white font-black uppercase text-[11px] tracking-[0.2em] shadow-lg shadow-blue-100 transition-all active:scale-95 border-none"
                            >
                                {isSubmitting ? <Loader2 className="mr-3 h-4 w-4 animate-spin" /> : <Signal className="mr-3 h-4 w-4" />}
                                Sync Registry
                            </Button>
                        </div>
                    </form>
                </Form>

                {totalAmount !== null && (
                    <div className="mt-10 animate-in fade-in slide-in-from-top-4 duration-500">
                        <div className="p-8 rounded-[3rem] bg-slate-900 text-white shadow-2xl flex flex-col md:flex-row items-center justify-between gap-8 relative overflow-hidden group">
                            <div className="absolute top-0 right-0 p-8 opacity-5 rotate-12 transition-transform duration-1000 group-hover:scale-110">
                                <Factory className="h-48 w-48" />
                            </div>
                            
                            <div className="relative z-10 space-y-2">
                                <div className="flex items-center gap-3 text-blue-400 mb-2">
                                    <ShieldCheck className="h-5 w-5" />
                                    <span className="text-[10px] font-black uppercase tracking-[0.3em]">Authorized Balance Manifest</span>
                                </div>
                                <p className="text-sm font-bold text-slate-400 uppercase tracking-widest leading-none">Outstanding for: {selectedPump?.name}</p>
                                <h4 className="text-6xl font-black tracking-tighter text-shadow-2xl">₹ {totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</h4>
                                <div className="flex items-center gap-2 mt-4">
                                    <Badge variant="outline" className="bg-white/5 border-white/10 text-white font-black uppercase text-[9px] px-3">{relevantEntries.length} Registry Slips Found</Badge>
                                </div>
                            </div>

                            {totalAmount > 0 ? (
                                <Button 
                                    size="lg" 
                                    onClick={() => setIsModalOpen(true)}
                                    className="bg-white hover:bg-blue-50 text-blue-900 h-16 px-12 rounded-2xl font-black uppercase text-xs tracking-widest shadow-xl transition-all active:scale-95 border-none relative z-10"
                                >
                                    Proceed to Settlement
                                </Button>
                            ) : (
                                <div className="flex flex-col items-center gap-2 opacity-40 grayscale">
                                    <CheckCircle2 className="h-12 w-12" />
                                    <span className="text-[10px] font-black uppercase tracking-widest">Registry Fully Cleared</span>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </CardContent>
        </Card>
        
        {isModalOpen && selectedPump && totalAmount !== null && (
            <MakePaymentModal 
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                pump={selectedPump}
                totalAmount={totalAmount}
                fromDate={fromDate}
                toDate={toDate}
                relevantEntries={relevantEntries}
                onSave={onPaymentMade}
            />
        )}
        </>
    );
}
