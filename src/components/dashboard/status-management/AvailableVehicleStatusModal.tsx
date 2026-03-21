'use client';

import { useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, ShieldCheck, AlertCircle, Save } from 'lucide-react';
import type { VehicleEntryExit, WithId } from '@/types';

interface AvailableVehicleStatusModalProps {
  isOpen: boolean;
  onClose: () => void;
  item: WithId<VehicleEntryExit>;
  plantName: string;
  onSave: (status: string) => Promise<void>;
}

const formSchema = z.object({
  status: z.string().min(1, 'Target operational status selection is required.'),
});

type FormValues = z.infer<typeof formSchema>;

export default function AvailableVehicleStatusModal({ isOpen, onClose, item, plantName, onSave }: AvailableVehicleStatusModalProps) {
  const currentStatus = item.remarks || (item.purpose === 'Unloading' ? 'In Process' : 'Available');

  // Rules Implementation
  const allowedOptions = useMemo(() => {
    if (item.purpose === 'Unloading') {
        return ['Unloaded', 'Not Unload'];
    }
    
    if (item.purpose === 'Loading') {
        return ['Available', 'Under Maintenance', 'Break-down', 'Pilot Not Available'];
    }

    return [];
  }, [item.purpose]);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      status: '',
    }
  });

  const { isSubmitting } = form.formState;

  const onSubmit = async (values: FormValues) => {
    await onSave(values.status);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-lg border-none shadow-2xl p-0 overflow-hidden bg-white">
        <DialogHeader className="p-6 bg-slate-900 text-white">
          <DialogTitle className="text-xl font-black uppercase tracking-tight flex items-center gap-3">
            <ShieldCheck className="h-6 w-6 text-blue-400" /> Update Operational Status
          </DialogTitle>
          <DialogDescription className="text-blue-300 font-bold uppercase text-[9px] tracking-widest mt-1">
            Gate Presence Node Transition
          </DialogDescription>
        </DialogHeader>

        <div className="p-8 space-y-8">
            <div className="grid grid-cols-2 gap-6 p-6 bg-slate-50 rounded-2xl border border-slate-200">
                <div className="space-y-1">
                    <p className="text-[9px] font-black uppercase text-slate-400 tracking-wider">Mission Purpose</p>
                    <p className="text-sm font-black text-blue-900 uppercase italic">{item.purpose}</p>
                </div>
                <div className="space-y-1 text-right">
                    <p className="text-[9px] font-black uppercase text-slate-400 tracking-wider">Current Registry Status</p>
                    <p className="text-sm font-black text-slate-800">{currentStatus}</p>
                </div>
                <div className="col-span-full pt-4 border-t border-slate-100 flex justify-between items-center">
                    <span className="text-[10px] font-black text-slate-400 uppercase">Vehicle Registry</span>
                    <span className="font-black text-slate-900 tracking-tighter uppercase">{item.vehicleNumber}</span>
                </div>
            </div>

            <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
                    <FormField
                        control={form.control}
                        name="status"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel className="text-[10px] font-black uppercase tracking-widest text-slate-500">Target Operational Status *</FormLabel>
                                <Select onValueChange={field.onChange} value={field.value}>
                                    <FormControl>
                                        <SelectTrigger className="h-12 bg-white rounded-xl font-black text-blue-900 border-blue-900/20 shadow-sm focus:ring-blue-900">
                                            <SelectValue placeholder="Select Transition Node" />
                                        </SelectTrigger>
                                    </FormControl>
                                    <SelectContent className="rounded-xl">
                                        {allowedOptions.map((status) => (
                                            <SelectItem key={status} value={status} className="font-bold py-3">
                                                {status}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                <FormMessage />
                            </FormItem>
                        )}
                    />

                    <div className="flex items-start gap-3 p-4 bg-blue-50 rounded-xl border border-blue-100 shadow-inner">
                        <AlertCircle className="h-5 w-5 text-blue-600 shrink-0" />
                        <p className="text-[10px] font-bold text-blue-800 leading-normal uppercase">
                            Registry Notice: Transitioning this status will be permanently logged in the system audit registry. Verify current yard conditions before committing.
                        </p>
                    </div>

                    <DialogFooter className="bg-slate-50 -mx-8 -mb-8 p-6 border-t flex-row justify-end gap-3">
                        <Button type="button" variant="ghost" onClick={onClose} disabled={isSubmitting} className="font-bold text-slate-400">Discard</Button>
                        <Button type="submit" disabled={isSubmitting} className="bg-blue-900 hover:bg-slate-900 px-12 h-11 rounded-xl gap-2 font-black uppercase text-[11px] tracking-widest shadow-lg shadow-blue-100 border-none transition-all active:scale-95">
                            {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                            Commit Status Change
                        </Button>
                    </DialogFooter>
                </form>
            </Form>
        </div>
      </DialogContent>
    </Dialog>
  );
}
