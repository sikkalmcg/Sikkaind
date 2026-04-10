'use client';

import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import type { Plant, Shipment, WithId, MasterQtyType } from '@/types';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';
import { mockPlants, mockMasterQtyTypes } from '@/lib/mock-data';
import { Timestamp } from "firebase/firestore";

interface EditShipmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  shipment: WithId<Shipment>;
  onShipmentUpdated: (shipmentId: string, data: Partial<Omit<Shipment, 'id'>>) => void;
}

const formSchema = z.object({
  originPlantId: z.string().min(1, 'Plant is required'),
  consignor: z.string().min(1, 'Consignor is required'),
  consignorAddress: z.string().optional().default(''),
  loadingPoint: z.string().min(1, 'Loading point is required'),
  billToParty: z.string().min(1, 'Consignee is required'),
  isSameAsBillTo: z.boolean().default(false),
  shipToParty: z.string().min(1, 'Ship to is required'),
  unloadingPoint: z.string().min(1, 'Unloading point is required'),
  quantity: z.coerce.number().positive('Weight must be positive'),
  materialTypeId: z.string({ required_error: 'Qty Type is required' }).min(1, 'Qty Type is required'),
});

type FormValues = z.infer<typeof formSchema>;

export default function EditShipmentModal({ isOpen, onClose, shipment, onShipmentUpdated }: EditShipmentModalProps) {
  const { toast } = useToast();
  const [plants, setPlants] = useState<WithId<Plant>[]>([]);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
  });

  const { isSubmitting, watch, setValue, reset } = form;
  const billToParty = watch('billToParty');
  const isSameAsBillTo = watch('isSameAsBillTo');

  useEffect(() => {
    setPlants(mockPlants);
  }, []);

  useEffect(() => {
    if (shipment) {
      reset({
        originPlantId: shipment.originPlantId,
        consignor: shipment.consignor || '',
        consignorAddress: shipment.consignorAddress || '',
        loadingPoint: shipment.loadingPoint || '',
        billToParty: shipment.billToParty || '',
        shipToParty: shipment.shipToParty || '',
        isSameAsBillTo: shipment.billToParty === shipment.shipToParty,
        unloadingPoint: shipment.unloadingPoint || '',
        quantity: shipment.quantity,
        materialTypeId: shipment.materialTypeId === 'Metric Ton' ? 'MT' : shipment.materialTypeId,
      });
    }
  }, [shipment, reset]);

  useEffect(() => {
    if (isSameAsBillTo) {
      setValue('shipToParty', billToParty);
    }
  }, [isSameAsBillTo, billToParty, setValue]);

  const onSubmit = (values: FormValues) => {
    onShipmentUpdated(shipment.id, {
        ...values,
        weight: (values.quantity || 0) * 1000,
        balanceQty: values.quantity - (shipment.assignedQty || 0),
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>Edit Shipment Plan</DialogTitle>
          <DialogDescription>
            Editing shipment ID: {shipment.shipmentId}
          </DialogDescription>
        </DialogHeader>
        <div className="max-h-[70vh] overflow-y-auto pr-6 -mr-6">
            <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <FormField control={form.control} name="originPlantId" render={({ field }) => (
                        <FormItem>
                        <FormLabel>Plant</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value} disabled={true}>
                            <FormControl><SelectTrigger><SelectValue placeholder="Select a plant" /></SelectTrigger></FormControl>
                            <SelectContent>{plants?.map((plant) => (<SelectItem key={plant.id} value={plant.id}>{plant.name}</SelectItem>))}</SelectContent>
                        </Select>
                        <FormMessage />
                        </FormItem>
                    )} />
                    <FormField control={form.control} name="consignor" render={({ field }) => (
                        <FormItem><FormLabel>Consignor</FormLabel><FormControl><Input placeholder="e.g., Tata Steel" {...field} /></FormControl><FormMessage /></FormItem>
                    )} />
                    <FormField control={form.control} name="consignorAddress" render={({ field }) => (
                        <FormItem><FormLabel>Consignor Address</FormLabel><FormControl><Input placeholder="Full Address" {...field} /></FormControl><FormMessage /></FormItem>
                    )} />
                    <FormField control={form.control} name="loadingPoint" render={({ field }) => (
                        <FormItem><FormLabel>Loading Point</FormLabel><FormControl><Input placeholder="e.g., Ghaziabad" {...field} /></FormControl><FormMessage /></FormItem>
                    )} />
                    <FormField control={form.control} name="billToParty" render={({ field }) => (
                        <FormItem><FormLabel>Consignee</FormLabel><FormControl><Input placeholder="Consignee details" {...field} /></FormControl><FormMessage /></FormItem>
                    )} />
                    <FormField control={form.control} name="shipToParty" render={({ field }) => (
                        <FormItem>
                        <FormLabel>Ship to</FormLabel>
                        <FormControl><Input placeholder="Party to receive shipment" {...field} disabled={isSameAsBillTo} /></FormControl>
                        <FormMessage />
                        </FormItem>
                    )} />
                     <FormField control={form.control} name="isSameAsBillTo" render={({ field }) => (
                        <FormItem className="flex flex-row items-end space-x-2 pb-2">
                        <FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                        <FormLabel className="!mt-0 font-normal">Ship to is same as Consignee</FormLabel>
                        </FormItem>
                    )} />
                    <FormField control={form.control} name="unloadingPoint" render={({ field }) => (
                        <FormItem><FormLabel>Unloading Point</FormLabel><FormControl><Input placeholder="e.g., Mumbai Warehouse" {...field} /></FormControl><FormMessage /></FormItem>
                    )} />
                    <FormField control={form.control} name="quantity" render={({ field }) => (
                        <FormItem>
                            <FormLabel>Order Qty</FormLabel>
                            <FormControl><Input type="number" placeholder="Total weight" {...field} value={field.value ?? ''} /></FormControl>
                            <FormMessage />
                        </FormItem>
                    )} />
                    <FormField control={form.control} name="materialTypeId" render={({ field }) => (
                        <FormItem>
                        <FormLabel>Qty Type</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value ?? ''}>
                            <FormControl><SelectTrigger className="h-10"><SelectValue placeholder="Select a type" /></SelectTrigger></FormControl>
                            <SelectContent>
                                <SelectItem value="MT">MT</SelectItem>
                                <SelectItem value="Other">Other</SelectItem>
                            </SelectContent>
                        </Select>
                        <FormMessage />
                        </FormItem>
                    )} />
                </div>
                 <DialogFooter className="pt-4">
                    <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
                    <Button type="submit" disabled={isSubmitting} className="bg-green-600 hover:bg-green-700 text-white">
                        {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Update Shipment
                    </Button>
                </DialogFooter>
            </form>
            </Form>
        </div>
      </DialogContent>
    </Dialog>
  );
}