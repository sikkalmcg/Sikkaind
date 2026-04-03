
'use client';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { format } from 'date-fns';
import { XCircle, Truck, AlertTriangle } from 'lucide-react';

const formSchema = z.object({
  rejectDate: z.date(),
  rejectTime: z.string(),
  rejectedBy: z.enum(['Customer Reject', 'Customer Not Unloading', 'Order Cancelled', 'Others']),
  remark: z.string().optional(),
}).superRefine((data, ctx) => {
    if (data.rejectedBy === 'Others' && !data.remark) {
        ctx.addIssue({ code: 'custom', message: "Remark is required for 'Others'", path: ['remark'] });
    }
});

export default function RejectModal({ isOpen, onClose, trip, onPost }: { isOpen: boolean; onClose: () => void; trip: any; onPost: (data: any) => void }) {
  const form = useForm({
    resolver: zodResolver(formSchema),
    defaultValues: { rejectDate: new Date(), rejectTime: format(new Date(), 'HH:mm'), rejectedBy: 'Customer Reject' as any, remark: '' }
  });

  const rejectedBy = form.watch('rejectedBy');

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md p-0 border-none shadow-3xl overflow-hidden rounded-[2.5rem]">
        <DialogHeader className="p-8 bg-red-600 text-white">
          <DialogTitle className="text-xl font-black uppercase italic tracking-tight">Shipment Rejection node</DialogTitle>
          <div className="flex items-center gap-2 mt-4 text-red-100 text-xs font-bold uppercase"><Truck size={14}/> {trip.vehicleNumber} | {trip.tripId}</div>
        </DialogHeader>
        <div className="p-8 bg-white">
          <Form {...form}>
            <form className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <FormField name="rejectDate" control={form.control} render={({ field }) => (
                    <FormItem><FormLabel className="text-[10px] font-black uppercase text-slate-400">Date</FormLabel><FormControl><Input type="date" value={field.value ? format(field.value, 'yyyy-MM-dd') : ''} onChange={e => field.onChange(new Date(e.target.value))} className="h-11 rounded-xl" /></FormControl></FormItem>
                )} />
                <FormField name="rejectTime" control={form.control} render={({ field }) => (
                    <FormItem><FormLabel className="text-[10px] font-black uppercase text-slate-400">Time</FormLabel><FormControl><Input type="time" {...field} className="h-11 rounded-xl" /></FormControl></FormItem>
                )} />
              </div>
              <FormField name="rejectedBy" control={form.control} render={({ field }) => (
                <FormItem>
                    <FormLabel className="text-[10px] font-black uppercase text-slate-400">Reason Node *</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl><SelectTrigger className="h-11 rounded-xl font-bold"><SelectValue /></SelectTrigger></FormControl>
                        <SelectContent className="rounded-xl">
                            {['Customer Reject', 'Customer Not Unloading', 'Order Cancelled', 'Others'].map(r => <SelectItem key={r} value={r} className="font-bold py-2.5">{r}</SelectItem>)}
                        </SelectContent>
                    </Select>
                </FormItem>
              )} />
              {rejectedBy === 'Others' && (
                <FormField name="remark" control={form.control} render={({ field }) => (
                    <FormItem><FormLabel className="text-[10px] font-black uppercase text-slate-400">Mandatory Remark</FormLabel><FormControl><Input {...field} className="h-11 rounded-xl" /></FormControl><FormMessage /></FormItem>
                )} />
              )}
            </form>
          </Form>
        </div>
        <DialogFooter className="p-6 bg-slate-50 border-t flex-row justify-end gap-3">
          <Button variant="ghost" onClick={onClose} className="font-black uppercase text-[10px] text-slate-400">Discard</Button>
          <Button onClick={form.handleSubmit(onPost)} className="bg-red-600 hover:bg-red-700 text-white px-10 h-11 rounded-xl font-black uppercase text-[10px]">Commit Rejection</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
