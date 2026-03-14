
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
import type { OwnVehicle, WithId } from '@/types';

const formSchema = z.object({
  vehicleNumber: z.string().min(1, 'Vehicle Number is required.'),
  driverName: z.string().optional().default(''),
  driverMobile: z.string().optional().default('').refine(val => !val || /^\d{10}$/.test(val), 'Mobile number must be 10 digits.'),
  licenseNumber: z.string().optional().default(''),
  pollutionCertValidity: z.date().optional(),
  fitnessCertValidity: z.date().optional(),
  permitCertValidity: z.date().optional(),
  ownerName: z.string().optional().default(''),
  ownerMobile: z.string().optional().default('').refine(val => !val || /^\d{10}$/.test(val), 'Mobile number must be 10 digits.'),
  gpsImeiNo: z.string().optional().default(''),
});

type FormValues = z.infer<typeof formSchema>;

interface EditOwnVehicleModalProps {
  isOpen: boolean;
  onClose: () => void;
  vehicle: WithId<OwnVehicle>;
  onSave: (id: string, data: FormValues) => void;
}

export default function EditOwnVehicleModal({ isOpen, onClose, vehicle, onSave }: EditOwnVehicleModalProps) {
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
  });

  useEffect(() => {
    if (vehicle) {
      form.reset({
        ...vehicle,
        pollutionCertValidity: vehicle.pollutionCertValidity ? new Date(vehicle.pollutionCertValidity) : undefined,
        fitnessCertValidity: vehicle.fitnessCertValidity ? new Date(vehicle.fitnessCertValidity) : undefined,
        permitCertValidity: vehicle.permitCertValidity ? new Date(vehicle.permitCertValidity) : undefined,
        ownerName: vehicle.ownerName || '',
        ownerMobile: vehicle.ownerMobile || '',
        gpsImeiNo: vehicle.gpsImeiNo || '',
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
          <DialogTitle>Edit Own Vehicle</DialogTitle>
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
              <FormField control={form.control} name="ownerMobile" render={({ field }) => (<FormItem><FormLabel>Owner Mobile No.</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
              <FormField control={form.control} name="pollutionCertValidity" render={({ field }) => (<FormItem className="flex flex-col"><FormLabel>Pollution Cert. Validity</FormLabel><FormControl><DatePicker date={field.value} setDate={field.onChange} /></FormControl><FormMessage /></FormItem>)} />
              <FormField control={form.control} name="fitnessCertValidity" render={({ field }) => (<FormItem className="flex flex-col"><FormLabel>Fitness Cert. Validity</FormLabel><FormControl><DatePicker date={field.value} setDate={field.onChange} /></FormControl><FormMessage /></FormItem>)} />
              <FormField control={form.control} name="permitCertValidity" render={({ field }) => (<FormItem className="flex flex-col"><FormLabel>Permit Cert. Validity</FormLabel><FormControl><DatePicker date={field.value} setDate={field.onChange} /></FormControl><FormMessage /></FormItem>)} />
              <FormField control={form.control} name="gpsImeiNo" render={({ field }) => (<FormItem><FormLabel>GPS IMEI NO.</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
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
