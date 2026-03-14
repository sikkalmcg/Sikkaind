
'use client';

import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Loader2 } from 'lucide-react';
import type { MarketVehicle, WithId } from '@/types';

const panRegex = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;

const formSchema = z.object({
  vehicleNumber: z.string().min(1, 'Vehicle Number is required.'),
  driverName: z.string().optional().default(''),
  driverMobile: z.string().optional().default('').refine(val => !val || /^\d{10}$/.test(val), 'Mobile number must be 10 digits.'),
  licenseNumber: z.string().optional().default(''),
  transporterName: z.string().min(1, 'Transporter Name is required.'),
  address: z.string().optional(),
  transporterMobile: z.string().regex(/^\d{10}$/, 'Transporter mobile must be 10 digits.'),
  pan: z.string().regex(panRegex, 'Invalid PAN format.').optional().or(z.literal('')),
});

type FormValues = z.infer<typeof formSchema>;

interface EditMarketVehicleModalProps {
  isOpen: boolean;
  onClose: () => void;
  vehicle: WithId<MarketVehicle>;
  onSave: (id: string, data: FormValues) => void;
}

export default function EditMarketVehicleModal({ isOpen, onClose, vehicle, onSave }: EditMarketVehicleModalProps) {
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
  });

  useEffect(() => {
    if (vehicle) {
      form.reset(vehicle);
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
          <DialogTitle>Edit Market Vehicle</DialogTitle>
          <DialogDescription>Update details for vehicle {vehicle.vehicleNumber}.</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 max-h-[70vh] overflow-y-auto pr-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <FormField control={form.control} name="vehicleNumber" render={({ field }) => (<FormItem><FormLabel>Vehicle Number</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
              <FormField control={form.control} name="driverName" render={({ field }) => (<FormItem><FormLabel>Pilot Name</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
              <FormField control={form.control} name="driverMobile" render={({ field }) => (<FormItem><FormLabel>Pilot Contact</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
              <FormField control={form.control} name="licenseNumber" render={({ field }) => (<FormItem><FormLabel>DL Registry</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
              <FormField control={form.control} name="transporterName" render={({ field }) => (<FormItem><FormLabel>Transporter Name</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
              <FormField control={form.control} name="address" render={({ field }) => (<FormItem><FormLabel>Address (Optional)</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
              <FormField control={form.control} name="transporterMobile" render={({ field }) => (<FormItem><FormLabel>Transporter Mobile</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
              <FormField control={form.control} name="pan" render={({ field }) => (<FormItem><FormLabel>PAN (Optional)</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
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
