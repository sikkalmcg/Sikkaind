
'use client';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { format } from 'date-fns';
import { MapPin, Truck, Calendar, Clock } from 'lucide-react';

const formSchema = z.object({
  arrivedDate: z.date(),
  arrivedTime: z.string().min(1, "Required"),
});

export default function ArrivedModal({ isOpen, onClose, trip, onPost }: { isOpen: boolean; onClose: () => void; trip: any; onPost: (data: any) => void }) {
  const form = useForm({
    resolver: zodResolver(formSchema),
    defaultValues: { arrivedDate: new Date(), arrivedTime: format(new Date(), 'HH:mm') }
  });

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md p-0 border-none shadow-3xl overflow-hidden rounded-[2.5rem]">
        <DialogHeader className="p-8 bg-blue-900 text-white">
          <DialogTitle className="text-xl font-black uppercase italic tracking-tight">Vehicle Arrival Node</DialogTitle>
          <div className="grid grid-cols-1 gap-2 mt-4 text-blue-200">
            <div className="flex items-center gap-2 text-xs font-bold uppercase"><Truck size={14}/> {trip.vehicleNumber}</div>
            <div className="flex items-center gap-2 text-xs font-bold uppercase"><MapPin size={14}/> {trip.loadingPoint} → {trip.unloadingPoint}</div>
          </div>
        </DialogHeader>
        <div className="p-8 bg-white">
          <Form {...form}>
            <form className="space-y-6">
              <FormField name="arrivedDate" control={form.control} render={({ field }) => (
                <FormItem><FormLabel className="text-[10px] font-black uppercase text-slate-400">Arrived Date</FormLabel><FormControl><Input type="date" value={field.value ? format(field.value, 'yyyy-MM-dd') : ''} onChange={e => field.onChange(new Date(e.target.value))} className="h-12 rounded-xl" /></FormControl></FormItem>
              )} />
              <FormField name="arrivedTime" control={form.control} render={({ field }) => (
                <FormItem><FormLabel className="text-[10px] font-black uppercase text-slate-400">Arrived Time</FormLabel><FormControl><Input type="time" {...field} className="h-12 rounded-xl" /></FormControl></FormItem>
              )} />
            </form>
          </Form>
        </div>
        <DialogFooter className="p-6 bg-slate-50 border-t flex-row justify-end gap-3">
          <Button variant="ghost" onClick={onClose} className="font-black uppercase text-[10px] text-red-600 px-8">Cancel</Button>
          <Button onClick={form.handleSubmit(onPost)} className="bg-blue-900 hover:bg-black text-white px-10 h-11 rounded-xl font-black uppercase text-[10px]">Post Registry</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
