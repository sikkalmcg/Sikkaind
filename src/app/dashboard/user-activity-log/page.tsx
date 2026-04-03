'use client';
import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DatePicker } from '@/components/date-picker';
import { Loader2, WifiOff, History, AlertCircle, Search } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import type { WithId, SubUser, Activity } from '@/types';
import { mockSubUsers } from '@/lib/mock-data';
import ActivityLogModal from '../../../components/dashboard/user-activity-log/ActivityLogModal';
import { subDays, startOfDay, endOfDay, isAfter, isBefore } from 'date-fns';
import { useFirestore, useUser, useCollection, useMemoFirebase } from "@/firebase";
import { collection, query, where, getDocs, orderBy, Timestamp } from "firebase/firestore";

const formSchema = z.object({
  userId: z.string().min(1, 'A user must be selected.'),
  date: z.date({ required_error: "A date must be selected." }),
});

type FormValues = z.infer<typeof formSchema>;

export default function UserActivityLogPage() {
  const { toast } = useToast();
  const firestore = useFirestore();
  const { user: currentUser } = useUser();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [dbError, setDbError] = useState(false);
  const [errorDetails, setErrorDetails] = useState<string | null>(null);
  const [investigationData, setInvestigationData] = useState<{ user: WithId<SubUser>, date: Date, logs: Activity[] } | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const usersQuery = useMemoFirebase(() => 
    firestore ? query(collection(firestore, "users"), orderBy("fullName")) : null, 
    [firestore]
  );
  const { data: dbUsers, isLoading: isLoadingUsers, error: usersError } = useCollection<SubUser>(usersQuery);

  const users = dbUsers || (mockSubUsers as WithId<SubUser>[]);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { userId: '', date: new Date() },
  });

  const onSubmit = async (values: FormValues) => {
    if (!firestore) return;

    const selectedUser = users.find(u => u.id === values.userId);
    if (!selectedUser) {
      toast({ variant: 'destructive', title: 'Error', description: 'Could not find selected user.' });
      return;
    }
    
    setIsSubmitting(true);
    setDbError(false);
    setErrorDetails(null);

    try {
        const dayStart = startOfDay(values.date);
        const dayEnd = endOfDay(values.date);
        const twentyOneDaysAgo = startOfDay(subDays(new Date(), 21));
        
        if (isBefore(dayStart, twentyOneDaysAgo)) {
            toast({ 
                variant: 'destructive', 
                title: 'Out of Retention', 
                description: 'Logs older than 21 days are purged from the database.' 
            });
            setIsSubmitting(false);
            return;
        }

        // IDENTITY HANDSHAKE: Use the internal UID node if available, otherwise fallback to document ID
        const targetUserId = (selectedUser as any).uid || selectedUser.id;

        const logsRef = collection(firestore, "activity_logs");
        const q = query(logsRef, where("userId", "==", targetUserId));
        const snapshot = await getDocs(q);
        
        let userLogs: Activity[] = snapshot.docs.map(doc => {
            const data = doc.data();
            return {
                id: doc.id,
                ...data,
                timestamp: data.timestamp instanceof Timestamp ? data.timestamp.toDate() : new Date(data.timestamp)
            } as Activity;
        }).filter(log => {
            const logDate = log.timestamp;
            return logDate >= dayStart && logDate <= dayEnd;
        });

        userLogs.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

        if (userLogs.length === 0) {
            toast({ title: 'No Activity', description: 'No activity recorded for selected user on this date.' });
        }

        setInvestigationData({ user: selectedUser, date: values.date, logs: userLogs });
        setIsModalOpen(true);
    } catch (error: any) {
        setDbError(true);
        setErrorDetails('Cloud Query Failed: A connection issue occurred.');
        toast({ variant: 'destructive', title: 'Investigation Failed', description: 'Database Error' });
    } finally {
        setInvestigationData(prev => prev); // maintain state
        setIsSubmitting(false);
    }
  };

  if (!mounted) return <main className="p-8"><Loader2 className="animate-spin mx-auto mt-20" /></main>;

  return (
    <>
      <main className="flex flex-1 flex-col gap-4 p-4 md:gap-8 md:p-8">
        <div className="flex items-center justify-between">
            <h1 className="text-2xl font-semibold font-headline text-blue-900 uppercase">User Activity Investigation</h1>
            {(dbError || usersError) && (
                <div className="flex items-center gap-2 text-orange-600 bg-orange-50 px-3 py-1 rounded-full text-xs font-medium border border-orange-200">
                    <WifiOff className="h-3 w-3" />
                    <span>Cloud Sync Issue</span>
                </div>
            )}
        </div>

        <Card className="rounded-[2rem] border-none shadow-xl overflow-hidden bg-white">
          <CardHeader className="bg-slate-50 border-b p-8">
            <div className="flex items-center gap-3">
                <div className="p-2 bg-white rounded-lg border shadow-sm"><History className="h-5 w-5 text-blue-900" /></div>
                <div>
                    <CardTitle className="text-lg font-black uppercase italic text-blue-900 leading-none">Investigate Personnel Activity</CardTitle>
                    <CardDescription className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mt-2">Authorized audit node - 21 day retention scope</CardDescription>
                </div>
            </div>
          </CardHeader>
          <CardContent className="p-10 space-y-8">
            {errorDetails && <div className="p-4 bg-red-50 border border-red-100 rounded-xl flex items-start gap-3 text-red-800 text-sm font-bold uppercase text-[10px]"><AlertCircle className="h-4 w-4 mt-0.5 shrink-0" /><p>{errorDetails}</p></div>}
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-10">
                <div className="flex flex-wrap items-end gap-8 max-w-4xl">
                  <FormField control={form.control} name="userId" render={({ field }) => (
                      <FormItem className="flex-1 min-w-[300px]">
                        <FormLabel className="text-[10px] font-black uppercase text-slate-400 tracking-widest px-1">Operator Identity *</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger className="h-14 rounded-2xl font-black text-blue-900 border-slate-200 bg-slate-50/30 shadow-inner">
                                <SelectValue placeholder={isLoadingUsers ? "Syncing personnel..." : "Pick operator node"} />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent className="rounded-2xl shadow-2xl">
                            {users.map(user => (
                                <SelectItem key={user.id} value={user.id} className="py-3 px-4 font-bold uppercase italic text-black">
                                    {user.fullName} (@{user.username})
                                </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )} />
                  <FormField control={form.control} name="date" render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-[10px] font-black uppercase text-slate-400 tracking-widest px-1">Activity Period node *</FormLabel>
                        <FormControl>
                            <DatePicker date={field.value} setDate={field.onChange} className="h-14 rounded-2xl bg-white border-slate-200 font-bold px-6 shadow-sm" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                </div>
                <div className="flex gap-4 pt-4">
                  <Button type="submit" disabled={isSubmitting} className="h-14 px-12 bg-blue-900 hover:bg-black text-white rounded-2xl font-black uppercase text-xs tracking-widest shadow-xl transition-all active:scale-95 border-none">
                    {isSubmitting ? <Loader2 className="mr-3 h-5 w-5 animate-spin" /> : <Search className="mr-3 h-5 w-5" />} 
                    EXECUTE INVESTIGATION
                  </Button>
                  <Button type="button" variant="ghost" onClick={() => form.reset({ userId: '', date: new Date() })} className="h-14 px-8 font-black uppercase text-[10px] tracking-widest text-slate-400">Clear Terminal</Button>
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>
      </main>
      {investigationData && <ActivityLogModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} data={investigationData} />}
    </>
  );
}
