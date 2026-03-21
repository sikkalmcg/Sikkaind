
'use client';

import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { DatePicker } from '@/components/date-picker';
import { Loader2 } from 'lucide-react';
import type { ContractVehicle, WithId } from '@/types';

const panRegex = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;

const formSchema = z.object({
  vehicleNumber: z.string().min(1, 'Vehicle Number is required.'),
  driverName: z.string().optional().default(''),
  driverMobile: z.string().optional().default('').refine(val => !val || /^\d{10}$/.test(val), 'Mobile number must be 10 digits.'),
  licenseNumber: z.string().optional().default(''),
  ownerName: z.string().min(1, 'Owner Name is required.'),
  ownerMobile: z.string().regex(/^\d{10}$/, 'Owner mobile must be 10 digits.'),
  pan: z.string().regex(panRegex, 'Invalid PAN format.'),
  contractFrom: z.date({ required_error: "Contract start date is required."}),
  validUpto: z.date({ required_error: "Contract end date is required."}),
});

type FormValues = z.infer<typeof formSchema>;

interface EditContractVehicleModalProps {
  isOpen: boolean;
  onClose: () => void;
  vehicle: WithId<ContractVehicle>;
  onSave: (id: string, data: FormValues) => void;
}

export default function EditContractVehicleModal({ isOpen, onClose, vehicle, onSave }: EditContractVehicleModalProps) {
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
  });

  useEffect(() => {
    if (vehicle) {
      form.reset({
        ...vehicle,
        contractFrom: new Date(vehicle.contractFrom),
        validUpto: new Date(vehicle.validUpto),
      });
    }
  }, [vehicle, form]);

  const { isSubmitting } = form.formState;

  const onSubmit = (values: FormValues) => {
    onSave(vehicle.id, values);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>Edit Contract Vehicle</DialogTitle>
          <DialogDescription>Update details for vehicle {vehicle.vehicleNumber}.</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 max-h-[70vh] overflow-y-auto pr-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <FormField control={form.control} name="vehicleNumber" render={({ field }) => (<FormItem><FormLabel>Vehicle Number</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
              <FormField control={form.control} name="driverName" render={({ field }) => (<FormItem><FormLabel>Pilot Name</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
              <FormField control={form.control} name="driverMobile" render={({ field }) => (<FormItem><FormLabel>Pilot Contact</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
              <FormField control={form.control} name="licenseNumber" render={({ field }) => (<FormItem><FormLabel>DL Registry</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
              <FormField control={form.control} name="ownerName" render={({ field }) => (<FormItem><FormLabel>Owner Name</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
              <FormField control={form.control} name="ownerMobile" render={({ field }) => (<FormItem><FormLabel>Owner Mobile</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
              <FormField control={form.control} name="pan" render={({ field }) => (<FormItem><FormLabel>PAN Number</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
              <FormField control={form.control} name="contractFrom" render={({ field }) => (<FormItem className="flex flex-col"><FormLabel>Contract From</FormLabel><FormControl><DatePicker date={field.value} setDate={field.onChange} /></FormControl><FormMessage /></FormItem>)} />
              <FormField control={form.control} name="validUpto" render={({ field }) => (<FormItem className="flex flex-col"><FormLabel>Valid Upto</FormLabel><FormControl><DatePicker date={field.value} setDate={field.onChange} /></FormControl><FormMessage /></FormItem>)} />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Update Vehicle
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
