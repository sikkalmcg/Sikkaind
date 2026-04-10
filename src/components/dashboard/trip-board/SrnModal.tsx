
'use client';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { DatePicker } from '@/components/date-picker';
import { format } from 'date-fns';
import { FileCheck, ShieldAlert, Package, Truck } from 'lucide-react';

const formSchema = z.object({
  srnNumber: z.string().min(1, "SRN Number is mandatory."),
  srnDate: z.date({ required_error: "Date is required." }),
});

export default function SrnModal({ isOpen, onClose, trip, onPost }: { isOpen: boolean; onClose: () => void; trip: any; onPost: (data: any) => void }) {
  const form = useForm({
    resolver: zodResolver(formSchema),
    defaultValues: { srnNumber: '', srnDate: new Date() }
  });

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl p-0 border-none shadow-3xl overflow-hidden rounded-[2.5rem]">
        <DialogHeader className="p-8 bg-slate-900 text-white shrink-0">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-blue-600 rounded-2xl shadow-xl"><FileCheck className="h-7 w-7" /></div>
            <DialogTitle className="text-xl font-black uppercase italic">Service Return Note (SRN)</DialogTitle>
          </div>
          <div className="grid grid-cols-2 gap-x-8 gap-y-4 mt-8">
            <div className="space-y-1"><span className="text-[8px] font-black text-slate-500 uppercase">Rejected By</span><p className="text-[10px] font-black text-red-400 uppercase">{trip.rejectedBy || trip.rejectReason || 'Customer'}</p></div>
            <div className="space-y-1"><span className="text-[8px] font-black text-slate-500 uppercase">Vehicle</span><p className="text-[10px] font-bold">{trip.vehicleNumber}</p></div>
            <div className="space-y-1"><span className="text-[8px] font-black text-slate-500 uppercase">LR Number</span><p className="text-[10px] font-black text-blue-400">{trip.lrNumber}</p></div>
            <div className="space-y-1"><span className="text-[8px] font-black text-slate-500 uppercase">Weight</span><p className="text-[10px] font-black text-emerald-400">{trip.assignedQtyInTrip} MT</p></div>
          </div>
        </DialogHeader>
        <div className="p-10 bg-white">
          <Form {...form}>
            <form className="space-y-8">
              <FormField name="srnNumber" control={form.control} render={({ field }) => (
                <FormItem><FormLabel className="text-[10px] font-black uppercase text-slate-400 px-1">SRN Number Registry *</FormLabel><FormControl><Input placeholder="ENTER SRN#" {...field} className="h-14 rounded-2xl font-black text-blue-900 uppercase border-2 shadow-inner" /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField name="srnDate" control={form.control} render={({ field }) => (
                <FormItem className="flex flex-col"><FormLabel className="text-[10px] font-black uppercase text-slate-400 px-1">SRN Registry Date *</FormLabel><FormControl><DatePicker date={field.value} setDate={field.onChange} className="h-14" /></FormControl></FormItem>
              )} />
            </form>
          </Form>
        </div>
        <DialogFooter className="p-8 bg-slate-50 border-t flex-row justify-end gap-4">
          <Button variant="ghost" onClick={onClose} className="font-black uppercase text-[10px] text-slate-400">Discard</Button>
          <Button onClick={form.handleSubmit(onPost)} className="bg-slate-900 hover:bg-black text-white px-12 h-12 rounded-xl font-black uppercase text-[10px] shadow-xl">Commit & Close Mission</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
