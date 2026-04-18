
'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { format } from 'date-fns';
import { Truck, AlertCircle, X, ShieldAlert, Calendar, Clock, MessageSquare } from 'lucide-react';
import { cn } from '@/lib/utils';

const formSchema = z.object({
  rejectDate: z.date({ required_error: "Date is required." }),
  rejectTime: z.string().min(1, "Time node is required."),
  rejectedBy: z.enum(['Customer Reject', 'Customer Not Unloading', 'Order Cancelled', 'Others'], {
    required_error: "Reason node selection is mandatory."
  }),
  remark: z.string().min(1, "Remark node is mandatory for audit trail."),
});

type FormValues = z.infer<typeof formSchema>;

export default function RejectModal({ 
    isOpen, 
    onClose, 
    trip, 
    onPost 
}: { 
    isOpen: boolean; 
    onClose: () => void; 
    trip: any; 
    onPost: (data: any) => void 
}) {
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { 
        rejectDate: new Date(), 
        rejectTime: format(new Date(), 'HH:mm'), 
        rejectedBy: 'Customer Reject', 
        remark: '' 
    }
  });

  const { handleSubmit, control, formState: { isSubmitting } } = form;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md p-0 border-none shadow-3xl overflow-hidden bg-white rounded-[2rem]">
        <DialogHeader className="p-8 bg-red-600 text-white shrink-0 relative">
          <button 
            onClick={onClose}
            className="absolute top-4 right-4 text-white/60 hover:text-white transition-colors"
          >
            <X size={20} />
          </button>
          <DialogTitle className="text-2xl font-black uppercase italic tracking-tighter leading-none">
            SHIPMENT REJECTION NODE
          </DialogTitle>
          <div className="flex items-center gap-3 mt-4 text-red-100">
            <Truck size={16} className="shrink-0" />
            <p className="text-[11px] font-black uppercase tracking-widest leading-none">
                {trip.vehicleNumber} <span className="mx-2 opacity-40">|</span> {trip.tripId}
            </p>
          </div>
        </DialogHeader>

        <div className="p-8 space-y-8 bg-white">
          <Form {...form}>
            <form className="space-y-8">
              <div className="grid grid-cols-2 gap-6">
                <FormField name="rejectDate" control={control} render={({ field }) => (
                    <FormItem className="space-y-2">
                        <FormLabel className="text-[10px] font-black uppercase text-slate-400 tracking-widest px-1">DATE</FormLabel>
                        <FormControl>
                            <div className="relative group">
                                <Input 
                                    type="date" 
                                    value={field.value ? format(field.value, 'yyyy-MM-dd') : ''} 
                                    onChange={e => field.onChange(new Date(e.target.value))} 
                                    className="h-12 rounded-xl border-slate-200 bg-slate-50/50 font-black text-slate-700 shadow-inner group-focus-within:bg-white" 
                                />
                                <Calendar className="absolute right-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-300" />
                            </div>
                        </FormControl>
                    </FormItem>
                )} />
                <FormField name="rejectTime" control={control} render={({ field }) => (
                    <FormItem className="space-y-2">
                        <FormLabel className="text-[10px] font-black uppercase text-slate-400 tracking-widest px-1">TIME</FormLabel>
                        <FormControl>
                            <div className="relative group">
                                <Input 
                                    type="time" 
                                    {...field} 
                                    className="h-12 rounded-xl border-slate-200 bg-slate-50/50 font-black text-slate-700 shadow-inner group-focus-within:bg-white" 
                                />
                                <Clock className="absolute right-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-300" />
                            </div>
                        </FormControl>
                    </FormItem>
                )} />
              </div>

              <FormField name="rejectedBy" control={control} render={({ field }) => (
                <FormItem className="space-y-2">
                    <FormLabel className="text-[10px] font-black uppercase text-slate-400 tracking-widest px-1">REASON NODE *</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                            <SelectTrigger className="h-14 rounded-2xl font-black text-slate-900 border-2 border-slate-100 shadow-sm focus:ring-red-500">
                                <SelectValue placeholder="Select Reason" />
                            </SelectTrigger>
                        </FormControl>
                        <SelectContent className="rounded-2xl">
                            {['Customer Reject', 'Customer Not Unloading', 'Order Cancelled', 'Others'].map(r => (
                                <SelectItem key={r} value={r} className="font-black py-3 uppercase text-xs tracking-tight">{r}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <FormMessage className="text-[9px] font-black uppercase" />
                </FormItem>
              )} />

              <FormField name="remark" control={control} render={({ field }) => (
                <FormItem className="space-y-2">
                    <FormLabel className="text-[10px] font-black uppercase text-red-600 tracking-widest px-1">REMARK NODE *</FormLabel>
                    <FormControl>
                        <div className="relative group">
                            <Input 
                                placeholder="State specific reason for rejection..." 
                                {...field} 
                                className="h-14 rounded-2xl font-bold text-slate-700 border-slate-200 bg-slate-50/30 shadow-inner focus-visible:ring-red-600 transition-all pl-12" 
                            />
                            <MessageSquare className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-300 group-focus-within:text-red-500" />
                        </div>
                    </FormControl>
                    <FormMessage className="text-[9px] font-black uppercase" />
                </FormItem>
              )} />
            </form>
          </Form>
        </div>

        <DialogFooter className="p-8 bg-slate-50 border-t flex flex-row items-center justify-between sm:justify-between shrink-0">
            <button 
                type="button" 
                onClick={onClose} 
                className="text-[11px] font-black uppercase tracking-[0.3em] text-slate-400 hover:text-slate-900 transition-all"
            >
                DISCARD
            </button>
            <Button 
                onClick={handleSubmit(onPost)} 
                disabled={isSubmitting}
                className="bg-red-600 hover:bg-red-700 text-white px-12 h-14 rounded-2xl font-black uppercase text-[11px] tracking-widest shadow-xl shadow-red-100 border-none transition-all active:scale-95 flex items-center justify-center min-w-[200px]"
            >
                {isSubmitting ? <Loader2 className="animate-spin h-5 w-5" /> : "COMMIT REJECTION"}
            </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
