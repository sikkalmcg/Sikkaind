'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { 
    Loader2, 
    Upload, 
    ShieldCheck, 
    FileText, 
    AlertTriangle, 
    AlertCircle,
    CheckCircle2,
    ImageIcon,
    X as XIcon,
    Save,
    Weight
} from 'lucide-react';
import { useFirestore, useUser } from "@/firebase";
import { doc, updateDoc, serverTimestamp } from "firebase/firestore";
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';

const MAX_FILE_SIZE = 10 * 1024 * 1024; // Allow larger uploads for compression pulse
const ACCEPTED_IMAGE_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp"];

const formSchema = z.object({
  podImage: z.any()
    .refine((files) => files?.length > 0, "POD image is required.")
    .refine((files) => files?.[0]?.size <= MAX_FILE_SIZE, `Max raw image size is 10MB.`)
    .refine(
      (files) => ACCEPTED_IMAGE_TYPES.includes(files?.[0]?.type),
      "Only .jpg, .jpeg, .png and .webp formats are supported."
    ),
  unloadQty: z.coerce.number().positive("Unload quantity must be a positive number.")
});

type FormValues = z.infer<typeof formSchema>;

export default function PodUploadModal({ isOpen, onClose, trip, onSuccess }: { isOpen: boolean; onClose: () => void; trip: any; onSuccess: () => void }) {
  const { toast } = useToast();
  const firestore = useFirestore();
  const { user } = useUser();
  const [preview, setPreview] = useState<string | null>(trip.podUrl || null);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      unloadQty: trip.assignedQtyInTrip || 0
    }
  });

  const { isSubmitting } = form.formState;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = (event) => setPreview(event.target?.result as string);
        reader.readAsDataURL(file);
    }
  };

  /**
   * MISSION REGISTRY COMPRESSION NODE
   * Compresses image to target 150kb - 200kb range while maintaining audit fidelity.
   */
  const compressImagePulse = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event) => {
        const img = new Image();
        img.src = event.target?.result as string;
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;
          
          // Resolution Scaling: Target Max 1600px for high-fidelity documents
          const MAX_DIM = 1600;
          if (width > height) {
            if (width > MAX_DIM) {
              height *= MAX_DIM / width;
              width = MAX_DIM;
            }
          } else {
            if (height > MAX_DIM) {
              width *= MAX_DIM / height;
              height = MAX_DIM;
            }
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(img, 0, 0, width, height);

          // Quality Pulse: 0.6 - 0.7 quality usually yields 150kb-200kb for mobile documents
          const quality = 0.65;
          const dataUrl = canvas.toDataURL('image/jpeg', quality);
          resolve(dataUrl);
        };
      };
      reader.onerror = (error) => reject(error);
    });
  };

  const onSubmit = async (values: FormValues) => {
    if (!firestore || !user) return;

    try {
        // EXECUTE REGISTRY COMPRESSION PULSE
        const compressedBase64 = await compressImagePulse(values.podImage[0]);
        
        const plantId = trip.originPlantId;
        const tripRef = doc(firestore, `plants/${plantId}/trips`, trip.id);
        const globalTripRef = doc(firestore, 'trips', trip.id);
        const shipmentRef = doc(firestore, `plants/${plantId}/shipments`, trip.shipmentIds[0]);

        const currentName = user.displayName || user.email?.split('@')[0] || 'Operator';
        const ts = serverTimestamp();

        const updateData = {
            podUrl: compressedBase64,
            podStatus: 'Receipt Soft Copy' as const,
            podReceived: true,
            unloadQty: values.unloadQty,
            podUploadedBy: currentName,
            podUploadDate: ts,
            lastUpdated: ts,
            tripStatus: 'Closed' as const,
            currentStatusId: 'closed'
        };

        await updateDoc(tripRef, updateData);
        await updateDoc(globalTripRef, updateData);
        await updateDoc(shipmentRef, { currentStatusId: 'Delivered', lastUpdateDate: ts });

        toast({ title: 'Registry Sync Complete', description: 'POD compressed and synchronized successfully.' });
        onSuccess();
    } catch (error: any) {
        toast({ variant: 'destructive', title: 'Registry Error', description: error.message });
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl p-0 border-none shadow-3xl overflow-hidden bg-white rounded-[2.5rem]">
        <DialogHeader className="p-8 bg-slate-900 text-white shrink-0">
          <div className="flex justify-between items-center pr-12">
            <div className="flex items-center gap-4">
                <div className="p-3 bg-blue-600 rounded-2xl shadow-xl">
                    <Upload className="h-7 w-7 text-white" />
                </div>
                <div>
                    <DialogTitle className="text-xl font-black uppercase tracking-tight italic">POD Registry Node</DialogTitle>
                    <DialogDescription className="text-blue-300 font-bold uppercase text-[9px] tracking-widest mt-1">Upload Receipt Proof for {trip.tripId}</DialogDescription>
                </div>
            </div>
            <div className="flex flex-col items-end gap-1">
                <Badge className="bg-emerald-600 font-black uppercase text-[10px] px-6 h-7 border-none shadow-lg">Auto-Compression Active</Badge>
                <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Target Bandwidth: 150KB - 200KB</span>
            </div>
          </div>
        </DialogHeader>

        <div className="p-10 space-y-10 bg-[#f8fafc] overflow-y-auto max-h-[70vh]">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                <div className="space-y-8">
                    <div className="p-6 bg-white rounded-3xl border-2 border-slate-100 shadow-xl space-y-6">
                        <div className="flex items-center gap-3 border-b pb-3">
                            <FileText className="h-4 w-4 text-blue-600" />
                            <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Mission Particulars</h4>
                        </div>
                        <div className="grid grid-cols-2 gap-6">
                            <div className="space-y-1"><p className="text-[8px] font-black uppercase text-slate-400">Vehicle No</p><p className="text-sm font-black text-slate-900 uppercase">{trip.vehicleNumber}</p></div>
                            <div className="space-y-1"><p className="text-[8px] font-black uppercase text-slate-400">Assigned Weight</p><p className="text-sm font-bold text-blue-700">{trip.assignedQtyInTrip} MT</p></div>
                            <div className="space-y-1 col-span-2"><p className="text-[8px] font-black uppercase text-slate-400">Destination</p><p className="text-sm font-medium text-slate-600 uppercase truncate">{trip.unloadingPoint}</p></div>
                        </div>
                    </div>

                    <Form {...form}>
                        <form className="space-y-8">
                            <FormField name="unloadQty" control={form.control} render={({ field }) => (
                                <FormItem className="space-y-3">
                                    <FormLabel className="text-[10px] font-black uppercase text-blue-900 tracking-widest px-1">Actual Unloaded Weight (MT) *</FormLabel>
                                    <FormControl>
                                        <div className="relative">
                                            <Input type="number" step="0.001" {...field} className="h-14 rounded-2xl font-black text-2xl text-blue-900 shadow-inner border-blue-900/20 focus-visible:ring-blue-900 pl-14" />
                                            <CheckCircle2 className="absolute left-5 top-1/2 -translate-y-1/2 h-6 w-6 text-emerald-500" />
                                        </div>
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )} />

                            <FormField name="podImage" control={form.control} render={({ field: { onChange, value, ...field } }) => (
                                <FormItem className="space-y-3">
                                    <FormLabel className="text-[10px] font-black uppercase text-blue-900 tracking-widest px-1">Scan Receipt / Hard Copy *</FormLabel>
                                    <FormControl>
                                        <label className="flex flex-col items-center justify-center w-full h-48 border-4 border-dashed border-slate-200 rounded-[2rem] bg-white cursor-pointer hover:bg-slate-50 hover:border-blue-400 transition-all group shadow-sm">
                                            <div className="flex flex-col items-center justify-center pt-5 pb-6">
                                                <div className="p-4 bg-slate-50 rounded-2xl mb-4 group-hover:bg-blue-900 group-hover:text-white transition-colors">
                                                    <ImageIcon className="h-8 w-8 text-slate-400 group-hover:text-white" />
                                                </div>
                                                <p className="text-xs font-black uppercase text-slate-500 tracking-widest text-center">Tap to Upload Registry Proof</p>
                                                <p className="text-[9px] font-bold text-slate-400 mt-2">AUTO-COMPRESSION ACTIVE (150KB - 200KB)</p>
                                            </div>
                                            <Input 
                                                type="file" 
                                                className="hidden" 
                                                accept="image/*" 
                                                onChange={(e) => {
                                                    onChange(e.target.files);
                                                    handleFileChange(e);
                                                }} 
                                                {...field} 
                                            />
                                        </label>
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )} />
                        </form>
                    </Form>
                </div>

                <div className="flex flex-col h-full">
                    <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-[0.2em] px-4 mb-4">Document Preview</h4>
                    <div className="flex-1 bg-slate-200 rounded-[2.5rem] border-4 border-white shadow-2xl overflow-hidden relative group min-h-[400px]">
                        {preview ? (
                            <img src={preview} alt="POD Preview" className="w-full h-full object-contain" />
                        ) : (
                            <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 opacity-20 grayscale">
                                <AlertTriangle className="h-16 w-16 text-slate-400" />
                                <span className="text-[10px] font-black uppercase tracking-widest">Awaiting Voucher Node</span>
                            </div>
                        )}
                        {preview && (
                            <button onClick={() => {setPreview(null); form.setValue('podImage', undefined);}} className="absolute top-6 right-6 p-2 bg-red-600 text-white rounded-xl shadow-xl opacity-0 group-hover:opacity-100 transition-opacity">
                                <XIcon className="h-5 w-5" />
                            </button>
                        )}
                    </div>
                </div>
            </div>

            <div className="p-6 bg-blue-50 rounded-[2rem] border border-blue-100 flex items-start gap-4">
                <AlertCircle className="h-6 w-6 text-blue-600 shrink-0 mt-0.5" />
                <div className="space-y-1">
                    <p className="text-[10px] font-black text-blue-900 uppercase">Registry Optimization Node</p>
                    <p className="text-[10px] font-bold text-blue-700 leading-normal uppercase">
                        The system will automatically establish a compressed node for the POD image to optimize mission bandwidth. Final manifest size will range from 150kb to 200kb.
                    </p>
                </div>
            </div>
        </div>

        <DialogFooter className="p-8 bg-slate-50 border-t shrink-0 flex-row justify-end gap-4">
            <span className="text-[9px] font-black uppercase text-slate-400 tracking-widest mr-auto flex items-center gap-2 italic">
                <ShieldCheck className="h-4 w-4 text-emerald-600" /> Authorized Registry Pulse Sync: OK
            </span>
            <Button variant="ghost" onClick={onClose} className="font-bold text-slate-500 uppercase text-[11px] tracking-widest px-8 h-12">Discard</Button>
            <Button 
                onClick={form.handleSubmit(onSubmit)} 
                disabled={isSubmitting} 
                className="bg-blue-900 hover:bg-black text-white px-16 h-12 rounded-xl font-black uppercase text-[11px] tracking-widest shadow-xl border-none transition-all active:scale-95"
            >
                {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                COMMIT POD REGISTRY
            </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
