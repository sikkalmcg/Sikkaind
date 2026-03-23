'use client';

import { useEffect, useState, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import * as XLSX from 'xlsx';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Search, FileDown, Upload } from 'lucide-react';
import type { Customer, CustomerClientType, Plant, WithId } from '@/types';
import { statesAndUTs } from '@/lib/states';
import { useSikkaAccountsPage } from '@/context/SikkaAccountsPageContext';
import SearchHelpModal from '@/components/sikka-accounts/invoice-report/SearchHelpModal';
import { Separator } from '@/components/ui/separator';

const clientTypes = ['Consignee', 'Ship to', 'Vendor'] as const;

const gstinRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
const panRegex = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;
const MAX_FILE_SIZE = 1 * 1024 * 1024; // 1MB
const ACCEPTED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/jpg"];

const formSchema = z.object({
  plantId: z.string().min(1, "Plant is required."),
  clientType: z.enum(clientTypes, { required_error: "Client Type is required." }),
  logo: z.any().optional(),
  name: z.string().min(1, "Name is required."),
  address: z.string().min(1, "Address is required."),
  gstin: z.string().regex(gstinRegex, 'Invalid GSTIN format.'),
  pan: z.string().regex(panRegex, 'Invalid PAN format.'),
  state: z.string().min(1, 'State is required.'),
  stateCode: z.string().min(1, 'State code is required.'),
  contactPerson: z.string().optional(),
  mobile: z.string().optional(),
  email: z.string().email().optional().or(z.literal('')),
  bankName: z.string().optional(),
  accountNumber: z.string().optional(),
  ifsc: z.string().optional(),
  upiId: z.string().optional(),
  qrCode: z.any().optional()
    .refine((files) => !files || files?.length === 0 || files?.[0]?.size <= MAX_FILE_SIZE, `Max image size is 1MB.`)
    .refine((files) => !files || files?.length === 0 || ACCEPTED_IMAGE_TYPES.includes(files?.[0]?.type), "Only .jpg, .jpeg, and .png formats are supported."),
}).superRefine((data, ctx) => {
    if (data.clientType === 'Vendor') {
        if (!data.bankName) ctx.addIssue({ code: 'custom', message: 'Bank Name is required for Vendors.', path: ['bankName'] });
        if (!data.accountNumber) ctx.addIssue({ code: 'custom', message: 'Account Number is required for Vendors.', path: ['accountNumber'] });
        if (!data.ifsc) ctx.addIssue({ code: 'custom', message: 'IFSC is required for Vendors.', path: ['ifsc'] });
    }
});


type FormValues = z.infer<typeof formSchema>;

interface CustomerMasterFormProps {
    onSave: (data: Omit<Customer, 'id' | 'clientType'> & { clientType: CustomerClientType }) => void;
    plants: WithId<Plant>[];
}

export default function CustomerMasterForm({ onSave, plants }: CustomerMasterFormProps) {
  const { setSaveAction, setStatusBar } = useSikkaAccountsPage();
  const [searchHelpState, setSearchHelpState] = useState<any>(null);
  const [isUploading, setIsUploading] = useState(false);
  
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema.refine((data) => plants.some(p => p.id === data.plantId), {
        message: "Invalid Plant. Please use F4 help to select a valid Plant.",
        path: ["plantId"],
    })),
    defaultValues: {
        plantId: '',
        clientType: undefined,
        name: '',
        address: '',
        gstin: '',
        pan: '',
        state: '',
        stateCode: '',
        contactPerson: '',
        mobile: '',
        email: '',
        bankName: '',
        accountNumber: '',
        ifsc: '',
        upiId: '',
    },
  });
  
  const { watch, setValue, handleSubmit, formState: { isDirty } } = form;
  const clientType = watch('clientType');
  const gstin = watch('gstin');

  const openSearchHelp = () => {
    setSearchHelpState({ type: 'plant', data: plants, title: 'Select a Plant' });
  };

  const handleSelect = (code: string) => {
    setValue('plantId', code, { shouldValidate: true });
    setSearchHelpState(null);
  };

  const handleF4 = (e: React.KeyboardEvent) => {
    if (e.key === 'F4') {
        e.preventDefault();
        openSearchHelp();
    }
  };

  const convertFileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = (error) => reject(error);
    });
  };

  // Auto-fill state from GSTIN
  useEffect(() => {
    if (gstin && gstin.length >= 2) {
        const code = gstin.substring(0, 2);
        const stateInfo = statesAndUTs.find(s => s.code === code);
        if (stateInfo) {
            setValue('state', stateInfo.name, { shouldValidate: true });
            setValue('stateCode', stateInfo.code, { shouldValidate: true });
        }
    }
  }, [gstin, setValue]);

  const onSubmit = useCallback(async (values: FormValues) => {
    let qrCodeUrl = undefined;
    if (values.qrCode?.[0]) {
      qrCodeUrl = await convertFileToBase64(values.qrCode[0]);
    }

    const dataToSave = {
      ...values,
      qrCodeUrl,
    } as Omit<Customer, 'id' | 'clientType'> & { clientType: CustomerClientType };
    
    // Cleanup internal fields
    delete (dataToSave as any).qrCode;
    delete (dataToSave as any).logo;

    onSave(dataToSave);
    form.reset();
  }, [onSave, form]);

  useEffect(() => {
    setSaveAction(() => handleSubmit(onSubmit));
    return () => setSaveAction(null);
  }, [setSaveAction, handleSubmit, onSubmit]);

  const handleTemplateDownload = () => {
    const headers = ["Plant", "Client Type", "Name", "Address", "GSTIN", "PAN", "Contact Person", "Mobile", "Email", "Bank Name", "Account Number", "IFSC", "UPI ID"];
    const sampleData = [
        ["ID20", "Vendor", "Sikka Logistics", "Ghaziabad", "09AABCU9567L1Z1", "AABCU9567L", "Ajay Somra", "8860091900", "ajay@sikka.com", "SBI", "1234567890", "SBIN0001", "sikka@upi"],
        ["1426", "Consignee", "BigMart", "Delhi", "07AABCD1234E1Z3", "AABCD1234E", "Manager", "9876543210", "contact@bigmart.com", "", "", "", ""]
    ];
    const ws = XLSX.utils.aoa_to_sheet([headers, ...sampleData]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Customer Template");
    XLSX.writeFile(wb, "Customer_XD01_Template.xlsx");
  };

  const handleBulkUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonData = XLSX.utils.sheet_to_json(sheet) as any[];

        let successCount = 0;
        let errorCount = 0;

        for (const row of jsonData) {
          try {
            // Simplified validation for upload
            if (!row.Plant || !row["Client Type"] || !row.Name) throw new Error("Mandatory fields missing");
            
            onSave({
                plantId: row.Plant,
                clientType: row["Client Type"] as CustomerClientType,
                name: row.Name,
                address: row.Address || 'N/A',
                gstin: row.GSTIN || '',
                pan: row.PAN || '',
                state: 'N/A',
                stateCode: 'N/A',
                contactPerson: row["Contact Person"] || '',
                mobile: row.Mobile?.toString() || '',
                email: row.Email || '',
                bankName: row["Bank Name"] || '',
                accountNumber: row["Account Number"]?.toString() || '',
                ifsc: row.IFSC || '',
                upiId: row["UPI ID"] || '',
            });
            successCount++;
          } catch (err) {
            errorCount++;
          }
        }

        setStatusBar({ 
            message: `Bulk Upload: Success ${successCount}, Errors ${errorCount}`, 
            type: errorCount > 0 ? 'warning' : 'success' 
        });
      } catch (err) {
        setStatusBar({ message: 'Invalid file format.', type: 'error' });
      } finally {
        setIsUploading(false);
        event.target.value = '';
      }
    };
    reader.readAsArrayBuffer(file);
  };

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Add Customer</CardTitle>
            <CardDescription>Manage Consignees, Ship to parties, and Vendors.</CardDescription>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleTemplateDownload}>
              <FileDown className="mr-2 h-4 w-4" /> Bulk Template
            </Button>
            <Button variant="outline" size="sm" asChild>
              <label className="cursor-pointer">
                {isUploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
                Bulk Upload
                <input type="file" className="hidden" accept=".xls,.xlsx,.csv" onChange={handleBulkUpload} disabled={isUploading} />
              </label>
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form className="space-y-6">
              <div className='grid grid-cols-1 md:grid-cols-4 gap-4'>
                  <FormField control={form.control} name="clientType" render={({ field }) => (
                      <FormItem><FormLabel>Client Type</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Select a client type" /></SelectTrigger></FormControl>
                          <SelectContent>{clientTypes.map(type => <SelectItem key={type} value={type}>{type}</SelectItem>)}</SelectContent>
                          </Select><FormMessage />
                      </FormItem>
                  )} />
              </div>

              {clientType && (
                  <>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-start">
                      <FormField control={form.control} name="plantId" render={({ field }) => (
                          <FormItem><FormLabel>Plant</FormLabel>
                              <div className="flex gap-1">
                                  <FormControl><Input {...field} onKeyDown={handleF4} /></FormControl>
                                  <Button type="button" variant="outline" size="icon" onClick={openSearchHelp}><Search className="h-4 w-4" /></Button>
                              </div>
                              <FormMessage />
                          </FormItem>
                      )} />
                      <FormField control={form.control} name="name" render={({ field }) => (<FormItem><FormLabel>{clientType} Name</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                      <FormField control={form.control} name="address" render={({ field }) => (<FormItem><FormLabel>Address</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                      <FormField control={form.control} name="gstin" render={({ field }) => (<FormItem><FormLabel>GSTIN</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                      <FormField control={form.control} name="pan" render={({ field }) => (<FormItem><FormLabel>PAN</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                      <FormField control={form.control} name="state" render={({ field }) => (<FormItem><FormLabel>State</FormLabel><FormControl><Input {...field} disabled /></FormControl><FormMessage /></FormItem>)} />
                      <FormField control={form.control} name="stateCode" render={({ field }) => (<FormItem><FormLabel>State Code</FormLabel><FormControl><Input {...field} disabled /></FormControl><FormMessage /></FormItem>)} />
                      <FormField control={form.control} name="contactPerson" render={({ field }) => (<FormItem><FormLabel>Contact Person (Optional)</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                      <FormField control={form.control} name="mobile" render={({ field }) => (<FormItem><FormLabel>Mobile (Optional)</FormLabel><FormControl><Input type="tel" {...field} /></FormControl><FormMessage /></FormItem>)} />
                      <FormField control={form.control} name="email" render={({ field }) => (<FormItem><FormLabel>Email (Optional)</FormLabel><FormControl><Input type="email" {...field} /></FormControl><FormMessage /></FormItem>)} />
                  </div>

                  {clientType === 'Vendor' && (
                      <>
                        <Separator />
                        <h3 className="font-semibold text-lg">Financial Details</h3>
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-start">
                            <FormField control={form.control} name="bankName" render={({ field }) => (<FormItem><FormLabel>Bank Name *</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                            <FormField control={form.control} name="accountNumber" render={({ field }) => (<FormItem><FormLabel>Account Number *</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                            <FormField control={form.control} name="ifsc" render={({ field }) => (<FormItem><FormLabel>IFSC *</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                            <FormField control={form.control} name="upiId" render={({ field }) => (<FormItem><FormLabel>UPI ID (Optional)</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                            <FormField control={form.control} name="qrCode" render={({ field }) => (
                                <FormItem><FormLabel>QR Code (Max 1MB)</FormLabel><FormControl><Input type="file" accept="image/png, image/jpeg" onChange={e => field.onChange(e.target.files)} /></FormControl><FormMessage /></FormItem>
                            )} />
                        </div>
                      </>
                  )}
                  </>
              )}
            </form>
          </Form>
        </CardContent>
      </Card>
      {searchHelpState && <SearchHelpModal isOpen={!!searchHelpState} onClose={() => setSearchHelpState(null)} title={searchHelpState.title} data={searchHelpState.data} onSelect={handleSelect} />}
    </>
  );
}