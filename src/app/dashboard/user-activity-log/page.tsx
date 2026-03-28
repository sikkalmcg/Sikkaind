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
import { Loader2, WifiOff, History, AlertCircle } from 'lucide-react';
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

        const logsRef = collection(firestore, "activity_logs");
        const q = query(logsRef, where("userId", "==", values.userId));
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
        setIsSubmitting(false);
    }
  };

  if (!mounted) return <main className="p-8"><Loader2 className="animate-spin mx-auto mt-20" /></main>;

  return (
    <>
      <main className="flex flex-1 flex-col gap-4 p-4 md:gap-8 md:p-8">
        <div className="flex items-center justify-between">
            <h1 className="text-2xl font-semibold font-headline">User Activity Log</h1>
            {(dbError || usersError) && (
                <div className="flex items-center gap-2 text-orange-600 bg-orange-50 px-3 py-1 rounded-full text-xs font-medium border border-orange-200">
                    <WifiOff className="h-3 w-3" />
                    <span>Cloud Sync Issue</span>
                </div>
            )}
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2"><CardTitle>Investigate User Activity</CardTitle><History className="h-4 w-4 text-muted-foreground" /></div>
            <CardDescription>Select a user and a date to view their activity log (last 21 days).</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {errorDetails && <div className="p-3 bg-red-50 border border-red-100 rounded-md flex items-start gap-3 text-red-800 text-sm"><AlertCircle className="h-4 w-4 mt-0.5 shrink-0" /><p>{errorDetails}</p></div>}
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <div className="flex flex-wrap items-end gap-4 max-w-2xl">
                  <FormField control={form.control} name="userId" render={({ field }) => (
                      <FormItem className="flex-1 min-w-[250px]">
                        <FormLabel>User Selection</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl><SelectTrigger><SelectValue placeholder={isLoadingUsers ? "Loading users..." : "Select a user"} /></SelectTrigger></FormControl>
                          <SelectContent>{users.map(user => (<SelectItem key={user.id} value={user.id}>{user.fullName} (@{user.username})</SelectItem>))}</SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )} />
                  <FormField control={form.control} name="date" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Activity Date</FormLabel>
                        <DatePicker date={field.value} setDate={field.onChange} />
                        <FormMessage />
                      </FormItem>
                    )} />
                </div>
                <div className="flex gap-4">
                  <Button type="submit" disabled={isSubmitting} className="bg-blue-600 hover:bg-blue-700 min-w-[120px]">{isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 'Investigate'}</Button>
                  <Button type="button" variant="outline" onClick={() => form.reset({ userId: '', date: new Date() })}>Clear</Button>
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
