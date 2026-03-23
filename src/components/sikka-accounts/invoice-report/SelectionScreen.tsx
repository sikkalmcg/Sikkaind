'use client';

import { useState, useEffect, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { DatePicker } from '@/components/date-picker';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Search, PlayCircle, ShieldCheck } from 'lucide-react';
import type { WithId, Plant, Customer, SubUser } from '@/types';
import SearchHelpModal from './SearchHelpModal';
import { useSikkaAccountsPage } from '@/context/SikkaAccountsPageContext';
import { useFirestore, useUser, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, orderBy, doc, getDoc } from 'firebase/firestore';

export type SelectionCriteria = z.infer<typeof formSchema>;

const formSchema = z.object({
  plantId: z.string().min(1, 'Plant ID is a mandatory field.'),
  fromDate: z.date({ required_error: 'From Date is a mandatory field.' }),
  toDate: z.date({ required_error: 'To Date is a mandatory field.' }),
  consignorId: z.string().optional(),
  buyerId: z.string().optional(),
  consigneeId: z.string().optional(),
}).refine(data => data.fromDate <= data.toDate, {
  message: 'From Date cannot be after To Date.',
  path: ['fromDate'],
});

interface SelectionScreenProps {
  onExecute: (criteria: SelectionCriteria) => void;
}

type SearchHelpState = {
    type: 'plant' | 'consignor' | 'buyer' | 'consignee';
    data: any[];
    title: string;
} | null;


export default function SelectionScreen({ onExecute }: SelectionScreenProps) {
    const { toast } = useToast();
    const firestore = useFirestore();
    const { user } = useUser();
    const { setExecuteAction, setSearchHelpAction, setStatusBar } = useSikkaAccountsPage();
    
    const [authorizedPlants, setAuthorizedPlants] = useState<WithId<Plant>[]>([]);
    const [searchHelpState, setSearchHelpState] = useState<SearchHelpState>(null);

    // XD01 Registry Handshake
    const plantsQuery = useMemoFirebase(() => 
        firestore ? query(collection(firestore, "accounts_plants"), orderBy("createdAt", "desc")) : null, 
        [firestore]
    );
    const { data: dbPlants, isLoading: isLoadingPlants } = useCollection<Plant>(plantsQuery);

    const partiesQuery = useMemoFirebase(() => 
        firestore ? query(collection(firestore, "parties"), orderBy("name")) : null, 
        [firestore]
    );
    const { data: dbParties } = useCollection<Customer>(partiesQuery);

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

    const form = useForm<SelectionCriteria>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            plantId: '', fromDate: undefined, toDate: undefined, consignorId: '', buyerId: '', consigneeId: ''
        }
    });

    const { isSubmitting } = form.formState;

    const openSearchHelp = (type: NonNullable<SearchHelpState>['type']) => {
        const parties = dbParties || [];
        switch(type) {
            case 'plant':
                setSearchHelpState({ type, data: authorizedPlants, title: 'Select Authorized Plant ID' });
                break;
            case 'consignor':
                 setSearchHelpState({ type, data: parties.filter(c => (c as any).clientType === 'Consignor' || (c as any).type === 'Consignor'), title: 'Select Consignor' });
                break;
            case 'buyer':
                 setSearchHelpState({ type, data: parties.filter(c => (c as any).clientType === 'Consignee & Ship to' || (c as any).type === 'Consignee & Ship to'), title: 'Select Buyer' });
                break;
            case 'consignee':
                 setSearchHelpState({ type, data: parties.filter(c => (c as any).clientType === 'Consignee & Ship to' || (c as any).type === 'Consignee & Ship to'), title: 'Select Consignee' });
                break;
        }
    }
    
    const handleSelect = (code: string) => {
        if (searchHelpState) {
            const fieldMap: Record<NonNullable<SearchHelpState>['type'], keyof SelectionCriteria> = {
                plant: 'plantId',
                consignor: 'consignorId',
                buyer: 'buyerId',
                consignee: 'consigneeId',
            };
            form.setValue(fieldMap[searchHelpState.type], code, { shouldValidate: true });
        }
        setSearchHelpState(null);
    }

    const handleF4 = (e: React.KeyboardEvent, type: NonNullable<SearchHelpState>['type']) => {
        if (e.key === 'F4') {
            e.preventDefault();
            openSearchHelp(type);
        }
    }
    
    const onSubmit = (values: SelectionCriteria) => {
        const isValidPlant = authorizedPlants.some(p => p.id.toUpperCase() === values.plantId.toUpperCase() || p.name.toUpperCase() === values.plantId.toUpperCase());
        if (!isValidPlant) {
            toast({ variant: 'destructive', title: 'Registry Error', description: `Plant ID ${values.plantId} is not recognized in the XD01 Registry.` });
            return;
        }
        onExecute(values);
    };

    useEffect(() => {
        setExecuteAction(() => form.handleSubmit(onSubmit));
        setSearchHelpAction(() => () => openSearchHelp('plant'));
        return () => {
            setExecuteAction(null);
            setSearchHelpAction(null);
        };
    }, [form, onSubmit]);

    return (
        <>
            <div className="p-8 space-y-8 animate-in fade-in duration-500">
                {/* TOP COMMAND BAR - EXECUTE AT TOP LEFT */}
                <div className="flex items-center gap-4 border-b pb-6">
                    <Button 
                        onClick={form.handleSubmit(onSubmit)} 
                        disabled={isSubmitting}
                        className="bg-blue-900 hover:bg-slate-900 text-white font-black uppercase text-[11px] tracking-[0.2em] px-10 h-12 rounded-2xl shadow-xl shadow-blue-100 border-none active:scale-95 transition-all"
                    >
                        {isSubmitting ? <Loader2 className="mr-3 h-4 w-4 animate-spin"/> : <PlayCircle className="mr-3 h-4 w-4" />}
                        Execute Report (F8)
                    </Button>
                    <div className="h-8 w-px bg-slate-200 mx-2" />
                    <div className="flex flex-col">
                        <h1 className="text-2xl font-black text-slate-800 uppercase tracking-tight italic">ZINV – Invoice Report</h1>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">LMC Registry Audit & Extraction</p>
                    </div>
                </div>

                <Form {...form}>
                    <form className="max-w-4xl p-10 border rounded-[2.5rem] bg-white shadow-2xl space-y-10 relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-8 opacity-[0.03] rotate-12">
                            <ShieldCheck className="h-48 w-48" />
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                            <FormField name="plantId" control={form.control} render={({ field }) => (
                                <FormItem>
                                    <FormLabel className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Plant ID Registry *</FormLabel>
                                    <div className="flex gap-2">
                                        <FormControl>
                                            <Input 
                                                {...field} 
                                                placeholder="F4 for Help" 
                                                onKeyDown={(e) => handleF4(e, 'plant')} 
                                                className="h-12 rounded-xl font-black text-blue-900 uppercase shadow-inner bg-slate-50 border-slate-200"
                                            />
                                        </FormControl>
                                        <Button type="button" variant="outline" size="icon" onClick={() => openSearchHelp('plant')} className="h-12 w-12 rounded-xl border-slate-200 bg-white">
                                            <Search className="h-4 w-4 text-blue-600" />
                                        </Button>
                                    </div>
                                    <FormMessage />
                                </FormItem>
                            )} />

                            <div className="grid grid-cols-2 gap-6">
                                <FormField name="fromDate" control={form.control} render={({ field }) => (
                                    <FormItem className="flex flex-col">
                                        <FormLabel className="text-[10px] font-black uppercase text-slate-400 tracking-widest">From Date *</FormLabel>
                                        <FormControl><DatePicker date={field.value} setDate={field.onChange} className="h-12 rounded-xl border-slate-200" /></FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )} />
                                <FormField name="toDate" control={form.control} render={({ field }) => (
                                    <FormItem className="flex flex-col">
                                        <FormLabel className="text-[10px] font-black uppercase text-slate-400 tracking-widest">To Date *</FormLabel>
                                        <FormControl><DatePicker date={field.value} setDate={field.onChange} className="h-12 rounded-xl border-slate-200" /></FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )} />
                            </div>

                            <FormField name="consignorId" control={form.control} render={({ field }) => (
                                <FormItem>
                                    <FormLabel className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Consignor Entity</FormLabel>
                                    <div className="flex gap-2">
                                        <FormControl>
                                            <Input {...field} placeholder="F4 Help" onKeyDown={(e) => handleF4(e, 'consignor')} className="h-12 rounded-xl font-bold" />
                                        </FormControl>
                                        <Button type="button" variant="outline" size="icon" onClick={() => openSearchHelp('consignor')} className="h-12 w-12 rounded-xl">
                                            <Search className="h-4 w-4" />
                                        </Button>
                                    </div>
                                </FormItem>
                            )} />

                            <FormField name="buyerId" control={form.control} render={({ field }) => (
                                <FormItem>
                                    <FormLabel className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Buyer Node</FormLabel>
                                    <div className="flex gap-2">
                                        <FormControl>
                                            <Input {...field} placeholder="F4 Help" onKeyDown={(e) => handleF4(e, 'buyer')} className="h-12 rounded-xl font-bold" />
                                        </FormControl>
                                        <Button type="button" variant="outline" size="icon" onClick={() => openSearchHelp('buyer')} className="h-12 w-12 rounded-xl">
                                            <Search className="h-4 w-4" />
                                        </Button>
                                    </div>
                                </FormItem>
                            )} />
                        </div>

                        <div className="pt-6 border-t border-slate-100">
                            <div className="p-4 bg-blue-50 rounded-2xl border border-blue-100 flex items-start gap-4">
                                <ShieldCheck className="h-5 w-5 text-blue-600 shrink-0 mt-0.5" />
                                <p className="text-[10px] font-bold text-blue-800 leading-normal uppercase">
                                    Registry Policy: Report filters are applied globally across the selected Plant ID. Results include IRN, ACK, and Manifest particulars.
                                </p>
                            </div>
                        </div>
                    </form>
                </Form>
            </div>
            {searchHelpState && (
                <SearchHelpModal 
                    isOpen={!!searchHelpState} 
                    onClose={() => setSearchHelpState(null)} 
                    title={searchHelpState.title} 
                    data={searchHelpState.data} 
                    onSelect={handleSelect} 
                />
            )}
        </>
    );
}
