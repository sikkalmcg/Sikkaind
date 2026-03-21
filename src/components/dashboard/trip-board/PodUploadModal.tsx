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
import { useToast } from '@/hooks/use-toast';
import { Loader2, Upload, FileText, CheckCircle2, AlertTriangle, ShieldCheck } from 'lucide-react';
import { useFirestore, useUser } from "@/firebase";
import { doc, updateDoc, serverTimestamp } from "firebase/firestore";
import { format } from 'date-fns';
import type { PODStatus } from '@/types';
import { cn } from '@/lib/utils';

const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2MB
const ACCEPTED_FILE_TYPES = ["image/jpeg", "image/png", "image/jpg", "application/pdf"];

const formSchema = z.object({
  podType: z.enum(['Receipt Soft Copy', 'Receipt Hard Copy'], { required_error: "POD Type is required" }),
  podFile: z.any()
    .refine((files) => files?.length === 1, "POD Attachment is mandatory.")
    .refine((files) => files?.[0]?.size <= MAX_FILE_SIZE, "Max file size is 2MB.")
    .refine((files) => ACCEPTED_FILE_TYPES.includes(files?.[0]?.type), "Only Image & PDF are supported.")
});

export default function PodUploadModal({ isOpen, onClose, trip, onSuccess }: { isOpen: boolean; onClose: () => void; trip: any; onSuccess: () => void }) {
  const { toast } = useToast();
  const firestore = useFirestore();
  const { user } = useUser();
  const [isUploading, setIsUploading] = useState(false);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: { podType: undefined, podFile: undefined }
  });

  const convertFileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = (error) => reject(error);
    });
  };

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    if (!firestore || !user) return;
    setIsUploading(true);
    try {
        const podBase64 = await convertFileToBase64(values.podFile[0]);
        const tripRef = doc(firestore, `plants/${trip.originPlantId}/trips`, trip.id);
        const currentName = user.email === 'sikkaind.admin@sikka.com' || user.email === 'sikkalmcg@gmail.com' ? 'AJAY SOMRA' : (user.displayName || user.email?.split('@')[0]);

        const updateData = {
            podReceived: true,
            // STATUS MANAGEMENT RULE: Sync POD Status based on type
            podStatus: values.podType as PODStatus,
            podUrl: podBase64,
            podUploadedBy: currentName,
            podUploadedAt: serverTimestamp(),
            lastUpdated: serverTimestamp()
        };

        await updateDoc(tripRef, updateData);

        toast({ title: "POD Registry Updated", description: `Proof of delivery node established for ${trip.lrNumber}.` });
        onSuccess();
    } catch (error: any) {
        toast({ variant: 'destructive', title: "Upload Failed", description: error.message });
    } finally {
        setIsUploading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl border-none shadow-2xl p-0 overflow-hidden bg-white">
        <DialogHeader className="p-6 bg-slate-900 text-white">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-600 rounded-lg"><ShieldCheck className="h-5 w-5" /></div>
            <div>
                <DialogTitle className="text-xl font-black uppercase tracking-tight">SIKKA LMC POD Registry</DialogTitle>
                <DialogDescription className="text-blue-300 font-bold uppercase text-[10px] tracking-widest mt-1">Lifting Node: {trip.plantName}</DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="p-8 space-y-8">
            {/* TRIP CONTEXT (READ ONLY) */}
            <div className="grid grid-cols-2 gap-x-8 gap-y-4 p-6 bg-slate-50 rounded-xl border border-slate-200">
                {[
                    { label: 'LR Number', value: trip.lrNumber },
                    { label: 'LR Date', value: trip.lrDate ? format(new Date(trip.lrDate), 'dd-MMM-yyyy') : 'N/A' },
                    { label: 'Vehicle Number', value: trip.vehicleNumber, bold: true },
                    { label: 'Consignor', value: trip.consignor },
                    { label: 'Consignee', value: trip.billToParty },
                    { label: 'Destination', value: trip.unloadingPoint },
                    { label: 'Quantity', value: `${trip.assignedQtyInTrip} MT`, color: 'text-blue-700' },
                ].map((item, i) => (
                    <div key={i} className="flex flex-col gap-0.5">
                        <span className="text-[9px] font-black uppercase text-slate-400 tracking-wider">{item.label}</span>
                        <span className={cn("text-xs font-bold truncate", item.bold && "text-slate-900 font-black", item.color)}>{item.value || '--'}</span>
                    </div>
                ))}
            </div>

            <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <FormField control={form.control} name="podType" render={({ field }) => (
                            <FormItem>
                                <FormLabel className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Registry POD Type *</FormLabel>
                                <Select onValueChange={field.onChange} value={field.value}>
                                    <FormControl><SelectTrigger className="h-11 bg-slate-50 border-slate-200 font-bold"><SelectValue placeholder="Select type" /></SelectTrigger></FormControl>
                                    <SelectContent>
                                        <SelectItem value="Receipt Soft Copy" className="font-bold py-2.5">Receipt Soft Copy (Scan)</SelectItem>
                                        <SelectItem value="Receipt Hard Copy" className="font-bold py-2.5">Receipt Hard Copy (Original)</SelectItem>
                                    </SelectContent>
                                </Select>
                                <FormMessage />
                            </FormItem>
                        )} />

                        <FormField control={form.control} name="podFile" render={({ field }) => (
                            <FormItem>
                                <FormLabel className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Document Attachment *</FormLabel>
                                <FormControl>
                                    <label className="flex items-center justify-center w-full h-11 px-4 border-2 border-dashed border-slate-200 rounded-xl cursor-pointer hover:bg-slate-50 hover:border-blue-400 transition-all gap-2 group">
                                        <Upload className="h-4 w-4 text-slate-400 group-hover:text-blue-600" />
                                        <span className="text-xs font-bold text-slate-500 group-hover:text-slate-900 truncate">
                                            {field.value?.[0]?.name || "Pick PDF / Image (Max 2MB)"}
                                        </span>
                                        <input type="file" className="hidden" accept=".jpg,.jpeg,.png,.pdf" onChange={e => field.onChange(e.target.files)} />
                                    </label>
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )} />
                    </div>

                    <div className="flex items-start gap-3 p-4 bg-blue-50 rounded-xl border border-blue-100">
                        <AlertTriangle className="h-5 w-5 text-blue-600 shrink-0 mt-0.5" />
                        <p className="text-[10px] font-bold text-blue-800 leading-normal uppercase">
                            Registry Notice: POD submission transitions the mission node. Ensure the attachment matches the Lorry Receipt particulars for successful audit handshake.
                        </p>
                    </div>

                    <DialogFooter className="bg-slate-50 -mx-8 -mb-8 p-6 border-t flex-row justify-end gap-3">
                        <Button type="button" variant="ghost" onClick={onClose} className="font-bold text-slate-400">Cancel</Button>
                        <Button type="submit" disabled={isUploading} className="bg-blue-900 hover:bg-slate-900 px-12 h-11 gap-2 font-black uppercase text-[11px] tracking-[0.2em] shadow-lg shadow-blue-100 border-none transition-all active:scale-95">
                            {isUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                            Sync POD Registry
                        </Button>
                    </DialogFooter>
                </form>
            </Form>
        </div>
      </DialogContent>
    </Dialog>
  );
}
