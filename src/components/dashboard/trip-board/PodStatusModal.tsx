
'use client';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FileCheck, ShieldCheck, Factory, Package } from 'lucide-react';

const formSchema = z.object({
  podStatus: z.enum(['Pending', 'Received']),
});

export default function PodStatusModal({ isOpen, onClose, trip, onPost }: { isOpen: boolean; onClose: () => void; trip: any; onPost: (data: any) => void }) {
  const form = useForm({
    resolver: zodResolver(formSchema),
    defaultValues: { podStatus: (trip.podReceived ? 'Received' : 'Pending') as any }
  });

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-xl p-0 border-none shadow-3xl overflow-hidden rounded-[2.5rem]">
        <DialogHeader className="p-8 bg-slate-900 text-white">
          <DialogTitle className="text-xl font-black uppercase italic tracking-tight">POD Registry Status</DialogTitle>
          <div className="grid grid-cols-2 gap-4 mt-6">
            <div className="space-y-1"><span className="text-[8px] font-black text-slate-500 uppercase">Consignor</span><p className="text-[10px] font-bold truncate">{trip.consignor}</p></div>
            <div className="space-y-1"><span className="text-[8px] font-black text-slate-500 uppercase">Consignee</span><p className="text-[10px] font-bold truncate">{trip.consignee}</p></div>
            <div className="space-y-1"><span className="text-[8px] font-black text-slate-500 uppercase">LR Number</span><p className="text-[10px] font-black text-blue-400">{trip.lrNumber}</p></div>
            <div className="space-y-1"><span className="text-[8px] font-black text-slate-500 uppercase">Manifest Weight</span><p className="text-[10px] font-black text-emerald-400">{trip.assignedQtyInTrip} MT</p></div>
          </div>
        </DialogHeader>
        <div className="p-8 bg-white">
          <Form {...form}>
            <form className="space-y-6">
              <FormField name="podStatus" control={form.control} render={({ field }) => (
                <FormItem>
                    <FormLabel className="text-[10px] font-black uppercase text-slate-400 px-1">Verified POD Status *</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl><SelectTrigger className="h-14 rounded-2xl font-black text-blue-900 border-2 shadow-inner"><SelectValue /></SelectTrigger></FormControl>
                        <SelectContent className="rounded-xl">
                            <SelectItem value="Pending" className="font-bold py-3 text-red-600">PENDING NODE</SelectItem>
                            <SelectItem value="Received" className="font-bold py-3 text-emerald-600">RECEIVED & VERIFIED</SelectItem>
                        </SelectContent>
                    </Select>
                </FormItem>
              )} />
            </form>
          </Form>
        </div>
        <DialogFooter className="p-6 bg-slate-50 border-t flex-row justify-end gap-3">
          <Button variant="ghost" onClick={onClose} className="font-black uppercase text-[10px] text-slate-400">Discard</Button>
          <Button onClick={form.handleSubmit((v) => onPost({ podReceived: v.podStatus === 'Received', podStatus: v.podStatus }))} className="bg-blue-900 hover:bg-black text-white px-12 h-12 rounded-xl font-black uppercase text-[10px]">Update Registry</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
