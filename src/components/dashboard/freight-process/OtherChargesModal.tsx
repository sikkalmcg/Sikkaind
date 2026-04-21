
'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { Wallet, ShieldCheck, Loader2 } from 'lucide-react';
import { useFirestore, useUser } from "@/firebase";
import { doc, updateDoc, arrayUnion, serverTimestamp } from "firebase/firestore";
import HeaderSummary from './HeaderSummary';
import ConfirmationModal from './ConfirmationModal';

const formSchema = z.object({
  chargeAmount: z.coerce.number().positive("Amount must be positive"),
  chargeType: z.enum(['Labor', 'Detention', 'Additional Distance', 'Multiple Delivery', 'Others'], { required_error: "Type is required" }),
  remark: z.string().optional(),
});

export default function OtherChargesModal({ isOpen, onClose, trip, onSuccess }: { isOpen: boolean; onClose: () => void; trip: any; onSuccess: () => void }) {
  const { toast } = useToast();
  const firestore = useFirestore();
  const { user } = useUser();
  const [showConfirm, setShowConfirm] = useState(false);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: { chargeAmount: 0, chargeType: 'Others', remark: '' },
  });

  const handlePost = async () => {
    if (!firestore || !user) return;
    const values = form.getValues();
    try {
        const tripRef = doc(firestore, `plants/${trip.originPlantId}/trips`, trip.id);
        const currentName = user.email === 'sikkaind.admin@sikka.com' || user.email === 'sikkalmcg@gmail.com' ? 'AJAY SOMRA' : (user.displayName || user.email?.split('@')[0]);

        await updateDoc(tripRef, {
            otherCharges: arrayUnion({
                id: `chg-${Date.now()}`,
                amount: values.chargeAmount,
                type: values.chargeType,
                remark: values.remark || '',
                postedBy: currentName,
                postedAt: new Date()
            }),
            lastUpdated: serverTimestamp(),
            // CRITICAL: Set flag to move trip to "Freight Request" tab in Settlement Hub
            isFreightPosted: true
        });

        toast({ title: "Charges Added", description: "Other charges successfully added to the trip." });
        onSuccess();
    } catch (e: any) {
        toast({ variant: 'destructive', title: "Post Failed", description: e.message });
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-[60vw] h-[80vh] flex flex-col p-0 overflow-hidden border-none shadow-2xl">
        <DialogHeader className="p-6 bg-slate-50 border-b">
          <DialogTitle className="text-2xl font-bold text-blue-900 uppercase">Additional Charges</DialogTitle>
          <DialogDescription className="text-slate-500">Record miscellaneous expenses associated with the trip.</DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto p-8 space-y-10">
          <HeaderSummary trip={trip} />

          <Form {...form}>
            <form className="space-y-8">
              <section className="space-y-6">
                <h3 className="text-xs font-black uppercase tracking-[0.2em] text-slate-400 flex items-center gap-2"><Wallet className="h-4 w-4 text-blue-600"/> Charge Details</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 p-6 border rounded-xl bg-white shadow-sm">
                  <FormField name="chargeAmount" control={form.control} render={({ field }) => (
                    <FormItem><FormLabel className="font-bold">Charge Amount *</FormLabel><FormControl><Input type="number" {...field} className="h-11" /></FormControl><FormMessage /></FormItem>
                  )} />
                  <FormField name="chargeType" control={form.control} render={({ field }) => (
                    <FormItem>
                      <FormLabel className="font-bold">Charge Type *</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl><SelectTrigger className="h-11"><SelectValue /></SelectTrigger></FormControl>
                        <SelectContent>
                          {['Labor', 'Detention', 'Additional Distance', 'Multiple Delivery', 'Others'].map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField name="remark" control={form.control} render={({ field }) => (
                    <FormItem className="md:col-span-2">
                      <FormLabel className="font-bold text-slate-600">Administrative Remark</FormLabel>
                      <FormControl><Textarea {...field} placeholder="Reason for additional charge..." /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>
              </section>
            </form>
          </Form>
        </div>

        <DialogFooter className="p-6 bg-slate-50 border-t">
          <Button variant="ghost" onClick={onClose}>Discard</Button>
          <Button onClick={form.handleSubmit(() => setShowConfirm(true))} className="bg-blue-900 hover:bg-slate-900 text-white px-10">Post Charge</Button>
        </DialogFooter>
      </DialogContent>

      <ConfirmationModal
        isOpen={showConfirm}
        onClose={() => setShowConfirm(false)}
        onConfirm={handlePost}
        title="Post Other Charges"
        message="Are you sure you want to post these additional charges? This will be added to the final settlement."
      />
    </Dialog>
  );
}
