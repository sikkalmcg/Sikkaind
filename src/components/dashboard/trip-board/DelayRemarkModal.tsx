
'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Textarea } from '@/components/ui/textarea';
import { MessageSquare, Clock, AlertTriangle, ShieldCheck, Save, X, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';

const formSchema = z.object({
  remark: z.string().min(1, "Justification node is mandatory for delay registry."),
});

type FormValues = z.infer<typeof formSchema>;

interface DelayRemarkModalProps {
  isOpen: boolean;
  onClose: () => void;
  shipment: any;
  onSuccess: (remark: string) => void;
}

/**
 * @fileOverview Allocation Delay Remark Terminal.
 * Operational Handbook Node: Used to document reasons for >12h unassigned missions.
 */
export default function DelayRemarkModal({ isOpen, onClose, shipment, onSuccess }: DelayRemarkModalProps) {
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { remark: shipment?.delayRemark || '' }
  });

  const { handleSubmit, formState: { isSubmitting } } = form;

  if (!shipment) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md p-0 border-none shadow-3xl overflow-hidden bg-white rounded-[2.5rem]">
        <DialogHeader className="p-8 bg-amber-600 text-white shrink-0 relative">
          <button 
            onClick={onClose}
            className="absolute top-4 right-4 text-white/60 hover:text-white transition-colors"
          >
            <X size={20} />
          </button>
          <div className="flex items-center gap-4">
            <div className="p-2.5 bg-white/20 rounded-xl backdrop-blur-md border border-white/20 shadow-lg">
                <MessageSquare className="h-6 w-6 text-white" />
            </div>
            <div>
                <DialogTitle className="text-xl font-black uppercase tracking-tight italic leading-none">
                    Delay Remark Node
                </DialogTitle>
                <DialogDescription className="text-amber-100 font-bold uppercase text-[9px] tracking-widest mt-2 opacity-80">
                    Registry Justification Handbook
                </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="p-8 space-y-8 bg-white">
            <div className="p-5 bg-slate-50 rounded-2xl border-2 border-slate-100 space-y-4">
                <div className="flex items-center justify-between">
                    <Badge variant="outline" className="bg-white text-blue-900 border-slate-200 font-black uppercase text-[8px] px-3 h-5">ID: {shipment.shipmentId}</Badge>
                    <div className="flex items-center gap-1.5 text-[8px] font-black text-slate-400 uppercase tracking-widest">
                        <Clock size={10} />
                        Awaiting Allocation
                    </div>
                </div>
                <div className="space-y-1">
                    <p className="text-[10px] font-black text-slate-400 uppercase">Consignee Registry</p>
                    <p className="text-sm font-bold text-slate-900 truncate uppercase">{shipment.billToParty}</p>
                </div>
            </div>

            <Form {...form}>
                <form onSubmit={handleSubmit((v) => onSuccess(v.remark))} className="space-y-6">
                    <FormField name="remark" control={form.control} render={({ field }) => (
                        <FormItem className="space-y-3">
                            <FormLabel className="text-[10px] font-black uppercase text-slate-400 tracking-widest px-1">Mandatory Justification *</FormLabel>
                            <FormControl>
                                <div className="relative group">
                                    <Textarea 
                                        placeholder="State the reason for allocation latency (e.g. Vehicle Shortage, Customer Wait)..." 
                                        {...field} 
                                        rows={4}
                                        className="resize-none rounded-[1.5rem] border-slate-200 font-bold p-5 shadow-inner bg-white focus-visible:ring-amber-500 transition-all italic text-sm" 
                                    />
                                    <div className="absolute bottom-4 right-4 opacity-5 pointer-events-none group-focus-within:opacity-10 transition-opacity">
                                        <Save size={32} />
                                    </div>
                                </div>
                            </FormControl>
                            <FormMessage className="text-[9px] font-black uppercase" />
                        </FormItem>
                    )} />

                    <div className="p-4 bg-amber-50 rounded-xl border border-amber-100 flex items-start gap-3 shadow-inner">
                        <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
                        <p className="text-[9px] font-bold text-amber-800 leading-normal uppercase">
                            Authorized Note: This remark will be synchronized with the public tracking terminal for customer visibility.
                        </p>
                    </div>

                    <DialogFooter className="pt-6 border-t flex-row justify-end gap-3 -mx-8 -mb-8 p-6 bg-slate-50">
                        <Button variant="ghost" type="button" onClick={onClose} className="font-black text-slate-400 uppercase text-[10px] tracking-widest px-8">Abort</Button>
                        <Button 
                            type="submit" 
                            disabled={isSubmitting}
                            className="bg-amber-600 hover:bg-slate-900 text-white px-10 h-11 rounded-xl font-black uppercase text-[10px] tracking-widest shadow-xl border-none transition-all active:scale-95 flex items-center justify-center min-w-[180px]"
                        >
                            {isSubmitting ? <Loader2 className="animate-spin h-4 w-4 mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                            Sync Remark (F8)
                        </Button>
                    </DialogFooter>
                </form>
            </Form>
        </div>
      </DialogContent>
    </Dialog>
  );
}
