
'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Loader2 } from 'lucide-react';
import type { WithId, Trip, ChargeType, PaymentMethod, Shipment } from '@/types';
import { ChargeTypes, PaymentMethods } from '@/lib/constants';

type EnrichedTrip = WithId<Trip> & {
    shipment: WithId<Shipment>;
    plantName?: string;
}

interface AddPaymentMethodModalProps {
  isOpen: boolean;
  onClose: () => void;
  trip: EnrichedTrip;
  onSave: (tripId: string, details: FormValues) => void;
}

const MAX_FILE_SIZE = 1024 * 1024; // 1MB
const ACCEPTED_IMAGE_TYPES = ["image/jpeg", "image/jpg", "image/png"];

const formSchema = z.object({
  // Add Charge section
  chargeAmount: z.coerce.number().optional(),
  chargeType: z.enum(ChargeTypes).optional(),
  chargeRemark: z.string().optional(),

  // Payment Method section
  paymentMethod: z.enum(PaymentMethods, { required_error: 'Payment Method is required.' }),
  receiverName: z.string().min(1, 'Receiver Name is required.'),
  
  // Banking fields
  bankName: z.string().optional(),
  accountNumber: z.string().optional(),
  ifsc: z.string().optional(),

  // UPI fields
  upiId: z.string().optional(),

  // QR Code field
  qrCode: z.any().optional()
    .refine((files) => !files || files?.length == 1, "Only one QR code image is allowed.")
    .refine((files) => !files || files?.[0]?.size <= MAX_FILE_SIZE, `Max file size is 1MB.`)
    .refine(
      (files) => !files || ACCEPTED_IMAGE_TYPES.includes(files?.[0]?.type),
      "Only .jpg, .jpeg, and .png formats are supported."
    ),
}).superRefine((data, ctx) => {
    if (data.chargeAmount || data.chargeType || data.chargeRemark) {
        if (!data.chargeAmount) {
             ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Amount is required.', path: ['chargeAmount'] });
        }
        if (!data.chargeType) {
            ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Charge type is required.', path: ['chargeType'] });
        }
        if (data.chargeType === 'Other' && !data.chargeRemark) {
            ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Remark is required for "Other" charge type.', path: ['chargeRemark'] });
        }
    }

    switch(data.paymentMethod) {
        case 'Banking':
            if (!data.bankName) ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Bank Name is required.', path: ['bankName'] });
            if (!data.accountNumber) ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Account Number is required.', path: ['accountNumber'] });
            if (!data.ifsc) ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'IFSC Code is required.', path: ['ifsc'] });
            break;
        case 'UPI':
            if (!data.upiId) ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'UPI ID is required.', path: ['upiId'] });
            break;
    }
});


type FormValues = z.infer<typeof formSchema>;

export default function AddPaymentMethodModal({ isOpen, onClose, trip, onSave }: AddPaymentMethodModalProps) {
  
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
        receiverName: trip.freightReceiverName || '',
        paymentMethod: trip.paymentMethod,
        bankName: trip.bankName || '',
        accountNumber: trip.accountNumber || '',
        ifsc: trip.ifsc || '',
        upiId: trip.upiId || '',
        qrCode: undefined,
        chargeAmount: undefined,
        chargeType: undefined,
        chargeRemark: '',
    },
  });

  const { watch, formState: { isSubmitting } } = form;
  const chargeType = watch('chargeType');
  const paymentMethod = watch('paymentMethod');

  const tripDetails = [
    { label: "Trip ID", value: trip.tripId },
    { label: "LR Number", value: `LR-${trip.tripId.slice(-4)}`},
    { label: "Vehicle Number", value: trip.vehicleNumber },
    { label: "Loading Point", value: trip.plantName || trip.shipment.loadingPoint },
    { label: "Ship to Party", value: trip.shipToParty },
    { label: "Unloading Point", value: trip.unloadingPoint },
    { label: "Assigned Qty", value: `${trip.assignedQtyInTrip} ${trip.shipment.materialTypeId}` },
    { label: "Freight Rate", value: trip.freightRate?.toLocaleString('en-IN') },
    { label: "Freight Amount", value: trip.freightAmount?.toLocaleString('en-IN') },
  ];

  const onSubmit = async (values: FormValues) => {
    // In a real app, you would upload the file and get a URL.
    // For build mode, we'll just pass the file info.
    const details = { ...values, qrCodeUrl: values.qrCode?.[0]?.name ? `/mock/qrcodes/${values.qrCode?.[0]?.name}` : trip.qrCodeUrl };
    onSave(trip.id, details);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>Add/Edit Payment Method</DialogTitle>
          <DialogDescription>Update payment receiver details and add charges for Trip ID: {trip.tripId}</DialogDescription>
        </DialogHeader>
        
        <div className="grid grid-cols-3 gap-x-4 gap-y-2 text-sm p-4 border rounded-md">
          {tripDetails.map(d => (
            <div key={d.label}>
              <p className="font-medium text-muted-foreground">{d.label}</p>
              <p className="font-semibold">{d.value || 'N/A'}</p>
            </div>
          ))}
        </div>

        <Separator />

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            
            <div>
                 <h3 className="text-md font-medium mb-2">Add Extra Charges</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                     <FormField control={form.control} name="chargeAmount" render={({ field }) => (
                        <FormItem><FormLabel>Amount</FormLabel><FormControl><Input type="number" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>
                    )} />
                    <FormField control={form.control} name="chargeType" render={({ field }) => (
                        <FormItem>
                            <FormLabel>Charge Type</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                                <FormControl><SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger></FormControl>
                                <SelectContent>{ChargeTypes.map(ct => <SelectItem key={ct} value={ct}>{ct}</SelectItem>)}</SelectContent>
                            </Select>
                            <FormMessage />
                        </FormItem>
                    )} />
                     {chargeType === 'Other' && (
                        <FormField control={form.control} name="chargeRemark" render={({ field }) => (
                            <FormItem><FormLabel>Remark for Other</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                        )} />
                    )}
                </div>
            </div>

            <Separator />

            <div>
                <h3 className="text-md font-medium mb-2">Payment Method</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <FormField control={form.control} name="paymentMethod" render={({ field }) => (
                        <FormItem>
                            <FormLabel>Method</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                                <FormControl><SelectTrigger><SelectValue placeholder="Select method" /></SelectTrigger></FormControl>
                                <SelectContent>{PaymentMethods.map(pm => <SelectItem key={pm} value={pm}>{pm}</SelectItem>)}</SelectContent>
                            </Select>
                            <FormMessage />
                        </FormItem>
                    )} />
                </div>
                {paymentMethod === 'Banking' && (
                    <div className='grid grid-cols-1 md:grid-cols-4 gap-4 mt-4'>
                        <FormField control={form.control} name="receiverName" render={({ field }) => (
                            <FormItem><FormLabel>Receiver Name</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                        )} />
                        <FormField control={form.control} name="bankName" render={({ field }) => (
                            <FormItem><FormLabel>Bank Name</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                        )} />
                        <FormField control={form.control} name="accountNumber" render={({ field }) => (
                            <FormItem><FormLabel>Account Number</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                        )} />
                        <FormField control={form.control} name="ifsc" render={({ field }) => (
                            <FormItem><FormLabel>IFSC Code</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                        )} />
                    </div>
                )}
                 {paymentMethod === 'UPI' && (
                    <div className='grid grid-cols-1 md:grid-cols-2 gap-4 mt-4'>
                        <FormField control={form.control} name="receiverName" render={({ field }) => (
                            <FormItem><FormLabel>Receiver Name</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                        )} />
                        <FormField control={form.control} name="upiId" render={({ field }) => (
                            <FormItem><FormLabel>UPI ID</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                        )} />
                    </div>
                )}
                 {paymentMethod === 'QR code' && (
                    <div className='grid grid-cols-1 md:grid-cols-2 gap-4 mt-4'>
                        <FormField control={form.control} name="receiverName" render={({ field }) => (
                            <FormItem><FormLabel>Receiver Name</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                        )} />
                         <FormField control={form.control} name="qrCode" render={({ field }) => (
                            <FormItem>
                                <FormLabel>QR Code Image (Max 1MB)</FormLabel>
                                <FormControl>
                                    <Input 
                                    type="file" 
                                    accept="image/png, image/jpeg, image/jpg"
                                    onChange={(e) => field.onChange(e.target.files)}
                                    />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )} />
                    </div>
                )}
            </div>

            <DialogFooter>
              <Button type="button" variant="destructive" onClick={onClose}>Cancel</Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save Details
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
