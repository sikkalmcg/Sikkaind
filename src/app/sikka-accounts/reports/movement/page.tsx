'use client';

import { useState, Suspense, useEffect, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { DatePicker } from '@/components/date-picker';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Search, Factory, ShieldCheck, TrendingUp, ArrowRightLeft, FileText, WifiOff } from 'lucide-react';
import type { WithId, Plant, SubUser, Party } from '@/types';
import { useFirestore, useUser, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, orderBy, doc, getDoc, getDocs } from 'firebase/firestore';
import SearchHelpModal from '../invoice/SearchHelpModal';
import { useSikkaAccountsPage } from '@/context/SikkaAccountsPageContext';
import ResultList from './ResultList';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

/**
 * @fileOverview MB5B - Plant Movement Report Selection Screen.
 * Handshakes with Account ERP node registry to define report scope.
 */

const formSchema = z.object({
  plantId: z.string().min(1, 'Plant ID is mandatory.'),
  fromDate: z.date({ required_error: 'From Date is required.' }),
  toDate: z.date({ required_error: 'To Date is required.' }),
}).refine(data => data.fromDate <= data.toDate, {
  message: 'From Date cannot be after To Date.',
  path: ['toDate'],
});

export type MB5BCriteria = z.infer<typeof formSchema>;

export default function MB5BPage() {
    const { toast } = useToast();
    const firestore = useFirestore();
    const { user } = useUser();
    const { setExecuteAction, setStatusBar } = useSikkaAccountsPage();
    
    const [authorizedPlants, setAuthorizedPlants] = useState<WithId<Plant>[]>([]);
    const [searchHelpOpen, setSearchHelpOpen] = useState(false);
    const [selectionCriteria, setSelectionCriteria] = useState<MB5BCriteria | null>(null);

    const plantsQuery = useMemoFirebase(() => 
        firestore ? query(collection(firestore, "accounts_plants"), orderBy("createdAt", "desc")) : null, 
        [firestore]
    );
    const { data: dbPlants, isLoading: isLoadingPlants } = useCollection<Plant>(plantsQuery);

    const isAdminSession = user?.email === 'sikkaind.admin@sikka.com' || user?.email === 'sikkalmcg@gmail.com';

    useEffect(() => {
        if (!dbPlants || !user || !firestore) return;
        const syncAuth = async () => {
            const userDoc = await getDoc(doc(firestore, "users", user.uid));
            let authIds: string[] = [];
            if (userDoc.exists()) {
                const data = userDoc.data() as SubUser;
                authIds = (data.username === 'sikkaind' || isAdminSession) ? dbPlants.map(p => p.id) : (data.accounts_plant_ids || []);
            } else if (isAdminSession) {
                authIds = dbPlants.map(p => p.id);
            }
            setAuthorizedPlants(dbPlants.filter(p => authIds.includes(p.id)));
        };
        syncAuth();
    }, [dbPlants, user, isAdminSession, firestore]);

    const form = useForm<MB5BCriteria>({
        resolver: zodResolver(formSchema),
        defaultValues: { plantId: '', fromDate: new Date(), toDate: new Date() }
    });

    const handleExecute = useCallback((values: MB5BCriteria) => {
        setSelectionCriteria(values);
        setStatusBar({ message: "Movement analysis extracted successfully.", type: 'success' });
    }, [setStatusBar]);

    useEffect(() => {
        setExecuteAction(() => form.handleSubmit(handleExecute)());
        return () => setExecuteAction(null);
    }, [form, handleExecute, setExecuteAction]);

    if (selectionCriteria) {
        return <ResultList criteria={selectionCriteria} onBack={() => setSelectionCriteria(null)} />;
    }

    return (
        <div className="flex-1 p-8 space-y-10 bg-slate-50/50 animate-in fade-in duration-500 h-full overflow-y-auto">
            <div className="flex items-center justify-between border-b pb-6">
                <div className="flex items-center gap-6">
                    <TooltipProvider>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <button 
                                    onClick={form.handleSubmit(handleExecute)} 
                                    className="h-16 w-16 rounded-2xl bg-white border-2 border-slate-200 hover:border-blue-600 shadow-xl transition-all active:scale-95 flex items-center justify-center group overflow-hidden"
                                >
                                    <img 
                                        src="https://c8.alamy.com/comp/T6WNK3/real-time-icon-in-transparent-style-clock-vector-illustration-on-isolated-background-watch-business-concept-T6WNK3.jpg" 
                                        alt="Execute" 
                                        className="h-full w-full object-cover group-hover:scale-110 transition-transform"
                                    />
                                </button>
                            </TooltipTrigger>
                            <TooltipContent side="bottom" className="bg-slate-900 text-white font-black uppercase text-[10px] px-4 py-2 border-none">Execute Report (F8)</TooltipContent>
                        </Tooltip>
                    </TooltipProvider>

                    <div className="h-12 w-px bg-slate-200 mx-2" />
                    
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-blue-900 text-white rounded-2xl shadow-xl rotate-3">
                            <ArrowRightLeft className="h-8 w-8" />
                        </div>
                        <div>
                            <h1 className="text-3xl font-black text-slate-800 uppercase tracking-tight italic">MB5B – Plant Movement Ledger</h1>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em]">Opening, Outward & Inward Balance Registry</p>
                        </div>
                    </div>
                </div>
            </div>

            <Form {...form}>
                <form className="max-w-4xl p-10 border rounded-[3rem] bg-white shadow-2xl space-y-12 relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-12 opacity-[0.03] rotate-12 group-hover:scale-110 transition-transform duration-1000">
                        <TrendingUp className="h-64 w-64" />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                        <FormField name="plantId" control={form.control} render={({ field }) => (
                            <FormItem>
                                <FormLabel className="text-[10px] font-black uppercase text-slate-400 tracking-widest flex items-center gap-2 px-1">
                                    <Factory className="h-3 w-3" /> Plant Node ID Registry *
                                </FormLabel>
                                <div className="flex gap-2">
                                    <FormControl>
                                        <Input 
                                            {...field} 
                                            placeholder="F4 for Help" 
                                            onKeyDown={(e) => e.key === 'F4' && setSearchHelpOpen(true)} 
                                            className="h-12 rounded-xl font-black text-blue-900 uppercase shadow-inner bg-slate-50 border-slate-200 focus-visible:ring-blue-900"
                                        />
                                    </FormControl>
                                    <Button type="button" variant="outline" size="icon" onClick={() => setSearchHelpOpen(true)} className="h-12 w-12 rounded-xl border-slate-200 bg-white hover:bg-slate-50 transition-colors">
                                        <Search className="h-4 w-4 text-blue-600" />
                                    </Button>
                                </div>
                                <FormMessage />
                            </FormItem>
                        )} />

                        <div className="grid grid-cols-2 gap-6">
                            <FormField name="fromDate" control={form.control} render={({ field }) => (
                                <FormItem className="flex flex-col">
                                    <FormLabel className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Date From *</FormLabel>
                                    <FormControl>
                                        <DatePicker 
                                            date={field.value} 
                                            setDate={field.onChange} 
                                            className="h-12 rounded-xl" 
                                            calendarProps={{ disabled: { after: new Date() } }}
                                        />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )} />
                            <FormField name="toDate" control={form.control} render={({ field }) => (
                                <FormItem className="flex flex-col">
                                    <FormLabel className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Date To *</FormLabel>
                                    <FormControl>
                                        <DatePicker 
                                            date={field.value} 
                                            setDate={field.onChange} 
                                            className="h-12 rounded-xl" 
                                            calendarProps={{ disabled: { after: new Date() } }}
                                        />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )} />
                        </div>
                    </div>

                    <div className="pt-10 border-t border-slate-100">
                        <div className="p-6 bg-blue-50 rounded-2xl border border-blue-100 flex items-start gap-4 shadow-sm">
                            <ShieldCheck className="h-6 w-6 text-blue-600 shrink-0 mt-0.5" />
                            <div className="space-y-1">
                                <p className="text-xs font-black text-blue-900 uppercase">Movement Extraction Policy</p>
                                <p className="text-[10px] font-bold text-blue-700 leading-normal uppercase">
                                    Calculates Opening Amount, Outward (VF01) and Inward (MIGO) flows. The Closing Balance reflects the real-time liability at the selected end date.
                                </p>
                            </div>
                        </div>
                    </div>
                </form>
            </Form>

            {searchHelpOpen && (
                <SearchHelpModal 
                    isOpen={searchHelpOpen} 
                    onClose={() => setSearchHelpOpen(false)} 
                    title="Select Authorized Plant ID" 
                    data={authorizedPlants} 
                    onSelect={(code) => { form.setValue('plantId', code); setSearchHelpOpen(false); }} 
                />
            )}
        </div>
    );
}
