'use client';

import { useState, useMemo, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';
import { mockShipments } from '@/lib/mock-data';
import type { WithId, Trip, Shipment } from '@/types';
import { cn } from '@/lib/utils';
import { useFirestore } from '@/firebase';
import { doc, getDoc } from 'firebase/firestore';

const MAX_FILE_SIZE = 1500 * 1024; // 1500 KB
const ACCEPTED_IMAGE_TYPES = ["image/jpeg", "image/jpg", "image/png", "application/pdf"];

const formSchema = z.object({
  unloadQty: z.coerce.number().positive("Unload quantity must be a positive number."),
  pod: z
    .any()
    .optional()
    .refine((files) => !files || files?.length === 0 || files?.length === 1, "Only one file is allowed.")
    .refine((files) => !files || files?.length === 0 || files?.[0]?.size <= MAX_FILE_SIZE, `Max file size is 1500KB.`)
    .refine(
      (files) => !files || files?.length === 0 || ACCEPTED_IMAGE_TYPES.includes(files?.[0]?.type),
      "Only .jpg, .jpeg, .png and .pdf formats are supported."
    ),
});

type FormValues = z.infer<typeof formSchema>;

interface DeliveredModalProps {
  isOpen: boolean;
  onClose: () => void;
  trip: WithId<Trip>;
  onSave: (trip: WithId<Trip>, unloadQty: number, podBase64: string) => void;
}

export default function DeliveredModal({ isOpen, onClose, trip, onSave }: DeliveredModalProps) {
  const { toast } = useToast();
  const firestore = useFirestore();
  const [shipment, setShipment] = useState<WithId<Shipment> | null>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);

  useEffect(() => {
    const fetchShipment = async () => {
        if (!isOpen || !firestore) return;
        setLoadingDetails(true);
        try {
            const shipId = trip.shipmentIds[0];
            const shipRef = doc(firestore, `plants/${trip.originPlantId}/shipments`, shipId);
            const shipSnap = await getDoc(shipRef);
            if (shipSnap.exists()) {
                setShipment({ id: shipSnap.id, ...shipSnap.data() } as WithId<Shipment>);
            } else {
                setShipment(mockShipments.find(s => s.id === shipId) || null);
            }
        } catch (e) {
            console.error("Error fetching shipment details:", e);
        } finally {
            setLoadingDetails(false);
        }
    };
    fetchShipment();
  }, [isOpen, trip, firestore]);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { unloadQty: trip.assignedQtyInTrip },
  });

  const { watch, formState: { isSubmitting } } = form;
  const unloadQty = watch('unloadQty');
  
  const difference = useMemo(() => (trip.assignedQtyInTrip || 0) - (unloadQty || 0), [trip.assignedQtyInTrip, unloadQty]);

  const details = [
    { label: "Trip ID", value: trip.tripId },
    { label: "Vehicle Number", value: trip.vehicleNumber },
    { label: "Driver Name", value: trip.driverName },
    { label: "Driver Mobile", value: trip.driverMobile },
    { label: "LR Number", value: trip.lrNumber || "N/A" },
    { label: "Loading Point", value: shipment?.loadingPoint },
    { label: "Consignor", value: shipment?.consignor },
    { label: "Bill To Party", value: shipment?.billToParty },
    { label: "Ship To Party", value: trip.shipToParty },
    { label: "Unloading Point", value: trip.unloadingPoint },
    { label: "Assigned Qty", value: `${trip.assignedQtyInTrip} ${shipment?.materialTypeId || 'MT'}` },
  ];

  const convertFileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = (error) => reject(error);
    });
  };

  const onSubmit = async (values: FormValues) => {
    try {
        let podBase64 = '';
        if (values.pod && values.pod.length > 0) {
            podBase64 = await convertFileToBase64(values.pod[0]);
        }
        onSave(trip, values.unloadQty, podBase64);
    } catch (e: any) {
        toast({ variant: 'destructive', title: 'File Error', description: 'Could not process the uploaded file.' });
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Complete Trip: Delivered</DialogTitle>
          <DialogDescription>Confirm delivery details and upload Proof of Delivery.</DialogDescription>
        </DialogHeader>
        
        <div className="grid grid-cols-3 gap-x-4 gap-y-2 text-sm p-4 border rounded-md max-h-[30vh] overflow-y-auto relative">
          {loadingDetails && <div className="absolute inset-0 bg-background/50 flex items-center justify-center"><Loader2 className="animate-spin" /></div>}
          {details.map(d => (
            <div key={d.label}>
              <p className="font-medium text-muted-foreground">{d.label}</p>
              <p className="font-semibold">{d.value || 'N/A'}</p>
            </div>
          ))}
        </div>

        <Separator />

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 items-center gap-4">
               <FormField
                control={form.control}
                name="unloadQty"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Unload Qty</FormLabel>
                    <FormControl><Input type="number" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormItem>
                <FormLabel>Difference</FormLabel>
                <div className={cn("font-bold text-lg p-2 rounded-md", 
                  difference > 0 ? "text-red-600" :
                  difference < 0 ? "text-green-600" :
                  "text-foreground"
                )}>
                  {difference > 0 ? `Shortage: ${difference}` : difference < 0 ? `Excess: ${Math.abs(difference)}` : "0"}
                </div>
              </FormItem>
            </div>

            <FormField
              control={form.control}
              name="pod"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>POD Upload (Optional - JPG, PNG, PDF, max 1.5MB)</FormLabel>
                  <FormControl>
                    <Input 
                      type="file" 
                      accept=".jpg,.jpeg,.png,.pdf"
                      onChange={(e) => field.onChange(e.target.files)}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button type="button" variant="destructive" onClick={onClose}>Cancel</Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save & Deliver
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
