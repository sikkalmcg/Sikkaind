'use client';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, PlusCircle, Trash2 } from 'lucide-react';
import type { Carrier, Plant } from '@/types';
import { useFirestore, useCollection, useMemoFirebase } from "@/firebase";
import { collection, query } from "firebase/firestore";

const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2MB
const ACCEPTED_IMAGE_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
const mobileRegex = /^(\s*\d{10}\s*)(,\s*\d{10}\s*)*$/;

const formSchema = z.object({
  plantId: z.string().min(1, 'Plant is required'),
  logo: z.any().optional()
    .refine((files) => !files || files?.length === 0 || files?.[0]?.size <= MAX_FILE_SIZE, `Max image size is 2MB.`)
    .refine(
      (files) => !files || files?.length === 0 || ACCEPTED_IMAGE_TYPES.includes(files?.[0]?.type),
      "Only .jpg, .jpeg, .png and .webp formats are supported."
    ),
  name: z.string().min(1, 'Carrier Name is required'),
  address: z.string().min(1, 'Address is required'),
  gstin: z.string().min(15, 'GSTIN must be 15 characters').max(15),
  pan: z.string().min(10, 'PAN must be 10 characters').max(10),
  stateName: z.string().min(1, 'State Name is required'),
  stateCode: z.string().min(1, 'State Code is required'),
  email: z.string().email('Invalid email address'),
  mobile: z.string().regex(mobileRegex, 'Enter valid 10-digit mobile numbers, separated by commas.'),
  website: z.string().url('Invalid URL').optional().or(z.literal('')),
  terms: z.array(z.object({ value: z.string().min(1, "Term cannot be empty.") })),
});

type FormValues = z.infer<typeof formSchema>;

interface CreateCarrierFormProps {
  onCarrierCreated: (carrier: Omit<Carrier, 'id'>) => void;
}

export default function CreateCarrierForm({ onCarrierCreated }: CreateCarrierFormProps) {
  const firestore = useFirestore();

  const plantsQuery = useMemoFirebase(() => 
    firestore ? query(collection(firestore, "logistics_plants")) : null, 
    [firestore]
  );
  const { data: plants, isLoading: isLoadingPlants } = useCollection<Plant>(plantsQuery);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      plantId: '',
      name: '',
      address: '',
      gstin: '',
      pan: '',
      stateName: '',
      stateCode: '',
      email: '',
      mobile: '',
      website: '',
      terms: [{ value: '' }],
    },
  });
  
  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'terms'
  });

  const { isSubmitting } = form.formState;

  const convertFileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = (error) => reject(error);
    });
  };

  const onSubmit = async (values: FormValues) => {
    let logoUrl = '/placeholder.svg';
    if (values.logo?.[0]) {
      logoUrl = await convertFileToBase64(values.logo[0]);
    }

    const newCarrier = {
      ...values,
      logoUrl,
      terms: values.terms.map(t => t.value),
    };
    
    delete (newCarrier as any).logo;
    onCarrierCreated(newCarrier);
    form.reset();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Create New Carrier</CardTitle>
        <CardDescription>Enter details for the new carrier. Select an authorized plant from your database.</CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <FormField control={form.control} name="plantId" render={({ field }) => (
                    <FormItem>
                        <FormLabel>Plant</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                                <SelectTrigger>
                                    <SelectValue placeholder={isLoadingPlants ? "Loading..." : "Select a plant"} />
                                </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                                {plants?.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                            </SelectContent>
                        </Select>
                        <FormMessage />
                    </FormItem>
                )} />

                <FormField control={form.control} name="logo" render={({ field }) => (
                    <FormItem className="md:col-span-2">
                        <FormLabel>Logo (Max 2MB)</FormLabel>
                        <FormControl><Input type="file" accept="image/*" onChange={e => field.onChange(e.target.files)} /></FormControl>
                        <FormMessage />
                    </FormItem>
                )} />

                <FormField control={form.control} name="name" render={({ field }) => (
                    <FormItem><FormLabel>Carrier Name</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="address" render={({ field }) => (
                    <FormItem className="md:col-span-2"><FormLabel>Address</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                )} />

                <FormField control={form.control} name="gstin" render={({ field }) => (
                    <FormItem><FormLabel>GSTIN</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="pan" render={({ field }) => (
                    <FormItem><FormLabel>PAN</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="stateName" render={({ field }) => (
                    <FormItem><FormLabel>State Name</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                 <FormField control={form.control} name="stateCode" render={({ field }) => (
                    <FormItem><FormLabel>State Code</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="email" render={({ field }) => (
                    <FormItem><FormLabel>Email ID</FormLabel><FormControl><Input type="email" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="mobile" render={({ field }) => (
                    <FormItem>
                        <FormLabel>Mobile Number(s)</FormLabel>
                        <FormControl><Input placeholder="e.g. 9876543210, 8877665544" {...field} /></FormControl>
                        <FormMessage />
                    </FormItem>
                )} />
                 <FormField control={form.control} name="website" render={({ field }) => (
                    <FormItem className="md:col-span-3"><FormLabel>Website</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                )} />

                <div className="md:col-span-3 space-y-4">
                  <FormLabel>Terms & Conditions</FormLabel>
                  {fields.map((field, index) => (
                    <FormField key={field.id} control={form.control} name={`terms.${index}.value`} render={({ field }) => (
                      <FormItem className="flex items-center gap-2">
                        <FormControl><Textarea placeholder={`Term ${index + 1}`} {...field} className="resize-y" /></FormControl>
                        <Button type="button" variant="ghost" size="icon" onClick={() => remove(index)} disabled={fields.length <= 1}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </FormItem>
                    )} />
                  ))}
                  <Button type="button" variant="outline" size="sm" onClick={() => append({ value: "" })}>
                    <PlusCircle className="mr-2 h-4 w-4" /> Add Term
                  </Button>
                </div>
            </div>

            <div className="flex gap-4">
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Create
              </Button>
              <Button type="button" variant="destructive" onClick={() => form.reset()}>
                Cancel
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
