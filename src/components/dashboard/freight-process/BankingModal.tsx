'use client';

import { useState, useMemo, useEffect } from 'react';
import { useForm, useFieldArray, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { 
    Loader2, 
    Landmark, 
    CreditCard, 
    ShieldCheck, 
    Upload, 
    Image as ImageIcon, 
    PlusCircle, 
    Trash2, 
    User, 
    Calculator, 
    AlertTriangle,
    Search,
    Smartphone,
    Save,
    ArrowRightLeft,
    AlertCircle,
    Sparkles
} from 'lucide-react';
import { PaymentMethods, LiquidationRoles, PaymentPurposes } from '@/lib/constants';
import { useFirestore, useUser } from "@/firebase";
import { doc, updateDoc, serverTimestamp } from "firebase/firestore";
import HeaderSummary from './HeaderSummary';
import ConfirmationModal from './ConfirmationModal';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';

const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2MB
const ACCEPTED_FILE_TYPES = ["image/jpeg", "image/png", "image/jpg"];

const accountSchema = z.object({
  id: z.string(),
  role: z.enum(LiquidationRoles, { required_error: "Role is required" }),
  purpose: z.enum(PaymentPurposes, { required_error: "Purpose is required" }),
  accountHolderName: z.string().min(1, "Account Holder Name is required"),
  paymentMethod: z.enum(PaymentMethods, { required_error: "Method is required" }),
  bankName: z.string().optional().default(''),
  accountNumber: z.string().regex(/^\d*$/, "Numeric only").optional().default(''),
  ifsc: z.string().regex(/^[A-Z]{4}0[A-Z0-9]{6}$/, "Invalid IFSC format").optional().default(''),
  branchCity: z.string().optional().default(''),
  upiId: z.string().regex(/^[\w.-]+@[\w.-]+$/, "Invalid UPI format (example@bank)").optional().default(''),
  qrCodeUrl: z.string().optional().default(''),
}).superRefine((data, ctx) => {
  if (data.paymentMethod === 'Banking') {
    if (!data.bankName) ctx.addIssue({ code: 'custom', message: "Bank name mandatory", path: ['bankName'] });
    if (!data.accountNumber) ctx.addIssue({ code: 'custom', message: "A/C number mandatory", path: ['accountNumber'] });
    if (!data.ifsc) ctx.addIssue({ code: 'custom', message: "IFSC code mandatory", path: ['ifsc'] });
  }
  if (data.paymentMethod === 'UPI Payment') {
    if (!data.upiId) ctx.addIssue({ code: 'custom', message: "UPI ID mandatory", path: ['upiId'] });
  }
  if (data.paymentMethod === 'QR Payment') {
    if (!data.qrCodeUrl) ctx.addIssue({ code: 'custom', message: "QR Code mandatory", path: ['qrCodeUrl'] });
  }
});

const formSchema = z.object({
  accounts: z.array(accountSchema).min(1, "At least one account is required"),
});

type FormValues = z.infer<typeof formSchema>;

export default function BankingModal({ isOpen, onClose, trip, onSuccess }: { isOpen: boolean; onClose: () => void; trip: any; onSuccess: () => void }) {
  const { toast } = useToast();
  const firestore = useFirestore();
  const { user } = useUser();
  const [showConfirm, setShowConfirm] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      accounts: trip.bankingAccounts?.length > 0 
        ? trip.bankingAccounts.map((acc: any) => ({
            ...acc,
            bankName: acc.bankName || '',
            accountNumber: acc.accountNumber || '',
            ifsc: acc.ifsc || '',
            branchCity: acc.branchCity || '',
            upiId: acc.upiId || '',
            qrCodeUrl: acc.qrCodeUrl || '',
          }))
        : [
        {
          id: `acc-${Date.now()}`,
          role: 'Vehicle Driver',
          purpose: 'Advance Freight',
          accountHolderName: trip.driverName || '',
          paymentMethod: 'Banking',
          bankName: '',
          accountNumber: '',
          ifsc: '',
          branchCity: '',
          upiId: '',
          qrCodeUrl: '',
        }
      ],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "accounts",
  });

  const { watch, handleSubmit, setValue } = form;
  const watchedAccounts = watch('accounts');

  const purposeCounts = useMemo(() => {
    return (watchedAccounts || []).reduce((acc, curr) => {
        if (curr?.purpose) {
            acc[curr.purpose] = (acc[curr.purpose] || 0) + 1;
        }
        return acc;
    }, {} as Record<string, number>);
  }, [watchedAccounts]);

  const hasDuplicatePurpose = Object.values(purposeCounts).some(count => count > 1);

  // Razorpay IFSC API Handshake Node
  const handleIfscChange = async (index: number, code: string) => {
    const uppercaseCode = code.toUpperCase().replace(/\s/g, '');
    setValue(`accounts.${index}.ifsc`, uppercaseCode, { shouldValidate: true });
    
    if (uppercaseCode.length === 11) {
        try {
            const response = await fetch(`https://ifsc.razorpay.com/${uppercaseCode}`);
            if (response.ok) {
                const data = await response.json();
                // Registry Sync: Auto-populate Bank and Branch City
                setValue(`accounts.${index}.bankName`, data.BANK || '', { shouldValidate: true });
                setValue(`accounts.${index}.branchCity`, `${data.BRANCH || ''}, ${data.CITY || ''}`, { shouldValidate: true });
                toast({ 
                    title: "IFSC Resolved", 
                    description: `Node established: ${data.BANK} (${data.BRANCH})` 
                });
            } else {
                setValue(`accounts.${index}.branchCity`, 'INVALID IFSC');
                setValue(`accounts.${index}.bankName`, '');
            }
        } catch (e) {
            console.error("IFSC API Handshake Failure:", e);
        }
    } else {
        setValue(`accounts.${index}.branchCity`, '');
    }
  };

  const handleQrUpload = (index: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > MAX_FILE_SIZE) {
        toast({ variant: 'destructive', title: "Registry Violation", description: "QR manifest image must be under 2MB." });
        return;
      }
      const reader = new FileReader();
      reader.onload = (event) => {
        setValue(`accounts.${index}.qrCodeUrl`, event.target?.result as string, { shouldValidate: true });
      };
      reader.readAsDataURL(file);
    }
  };

  const onPreSave = () => {
    if (hasDuplicatePurpose) {
        toast({ variant: 'destructive', title: "Registry Error", description: "Duplicate Purpose mapping detected. Only one account per purpose is allowed." });
        return;
    }
    setShowConfirm(true);
  };

  const handleSave = async () => {
    if (!firestore || !user) return;
    
    setIsSaving(true);
    const values = form.getValues();
    const currentName = (user.email === 'sikkaind.admin@sikka.com' || user.email === 'sikkalmcg@gmail.com') ? 'AJAY SOMRA' : (user.displayName || user.email?.split('@')[0]);

    try {
        const tripRef = doc(firestore, `plants/${trip.originPlantId}/trips`, trip.id);
        
        const accountsWithAudit = values.accounts.map(acc => ({
            ...acc,
            timestamp: new Date().toISOString(),
            createdBy: acc.createdBy || currentName,
            modifiedBy: currentName
        }));

        await updateDoc(tripRef, {
            bankingAccounts: accountsWithAudit,
            lastUpdated: serverTimestamp()
        });

        toast({ title: "Registry Committed", description: "Trip Banking Registry successfully synchronized." });
        onSuccess();
    } catch (error: any) {
        toast({ variant: 'destructive', title: "Commit Failed", description: error.message });
    } finally {
        setIsSaving(false);
        setShowConfirm(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-[95vw] w-[1500px] h-[95vh] flex flex-col p-0 overflow-hidden border-none shadow-3xl bg-[#f1f5f9]">
        <DialogHeader className="p-6 bg-slate-900 text-white shrink-0 pr-12">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-blue-600 rounded-2xl shadow-xl rotate-3">
                <ShieldCheck className="h-7 w-7 text-white" />
            </div>
            <div>
                <DialogTitle className="text-2xl font-black uppercase tracking-tight italic">Trip Banking Registry</DialogTitle>
                <DialogDescription className="text-blue-300 font-bold uppercase text-[9px] tracking-widest mt-1">
                    Independent Settlement Authorization handbook
                </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto p-10 space-y-10">
          <HeaderSummary trip={trip} />

          <Form {...form}>
            <form className="space-y-10">
                <div className="flex items-center justify-between px-2">
                    <h3 className="text-sm font-black uppercase tracking-[0.3em] text-slate-400 flex items-center gap-2">
                        <CreditCard className="h-4 w-4 text-blue-600"/> Liquidation Accounts Ledger
                    </h3>
                    <Button 
                        type="button" 
                        variant="outline" 
                        size="sm" 
                        onClick={() => append({ 
                            id: `acc-${Date.now()}`, 
                            role: 'Transporter', 
                            purpose: 'POD Amount', 
                            accountHolderName: '', 
                            paymentMethod: 'Banking',
                            bankName: '',
                            accountNumber: '',
                            ifsc: '',
                            branchCity: '',
                            upiId: '',
                            qrCodeUrl: ''
                        })}
                        className="h-10 px-6 gap-2 font-black text-[11px] uppercase border-blue-200 text-blue-700 bg-white hover:bg-blue-50 shadow-md transition-all active:scale-95"
                    >
                        <PlusCircle className="h-4 w-4" /> Add Multi-Row Node
                    </Button>
                </div>

                <div className="space-y-8">
                    {fields.map((field, index) => (
                        <Card key={field.id} className="border-none shadow-2xl rounded-[3rem] overflow-hidden bg-white group transition-all">
                            <div className="bg-slate-900 px-8 py-3 border-b border-white/5 flex items-center justify-between">
                                <div className="flex items-center gap-4">
                                    <div className="h-8 w-8 rounded-full bg-blue-600 text-white flex items-center justify-center font-black text-xs shadow-lg">
                                        {index + 1}
                                    </div>
                                    <Badge variant="outline" className="bg-white/5 border-white/10 text-blue-300 font-black uppercase text-[10px] px-4 h-6 tracking-widest">Registry Account Node</Badge>
                                </div>
                                <Button type="button" variant="ghost" size="icon" onClick={() => remove(index)} disabled={fields.length <= 1} className="h-8 w-8 text-white/20 hover:text-red-500 hover:bg-white/10 rounded-xl">
                                    <Trash2 className="h-4 w-4" />
                                </Button>
                            </div>
                            
                            <div className="p-10 grid grid-cols-1 md:grid-cols-12 gap-10 items-start">
                                {/* LEFT SECTION: ACCOUNT INFO */}
                                <div className="md:col-span-4 space-y-6">
                                    <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-widest border-b pb-2 flex items-center gap-2"><User className="h-3 w-3" /> Account Context</h4>
                                    <FormField name={`accounts.${index}.role`} control={form.control} render={({ field: roleField }) => (
                                        <FormItem>
                                            <FormLabel className="text-[10px] font-black uppercase text-slate-500">Authorized Role *</FormLabel>
                                            <Select onValueChange={roleField.onChange} value={roleField.value ?? ''}>
                                                <FormControl>
                                                    <SelectTrigger className="h-12 rounded-xl font-bold border-slate-200 bg-slate-50/50">
                                                        <SelectValue placeholder="Pick Role" />
                                                    </SelectTrigger>
                                                </FormControl>
                                                <SelectContent className="rounded-xl">
                                                    {LiquidationRoles.map(r => <SelectItem key={r} value={r} className="font-bold py-2.5">{r}</SelectItem>)}
                                                </SelectContent>
                                            </Select>
                                            <FormMessage />
                                        </FormItem>
                                    )} />
                                    <FormField name={`accounts.${index}.purpose`} control={form.control} render={({ field: purposeField }) => (
                                        <FormItem>
                                            <FormLabel className="text-[10px] font-black uppercase text-slate-500">Payment Purpose *</FormLabel>
                                            <Select onValueChange={purposeField.onChange} value={purposeField.value ?? ''}>
                                                <FormControl>
                                                    <SelectTrigger className="h-12 rounded-xl font-black text-blue-900 border-blue-900/20 shadow-inner">
                                                        <SelectValue placeholder="Pick Purpose" />
                                                    </SelectTrigger>
                                                </FormControl>
                                                <SelectContent className="rounded-xl">
                                                    {PaymentPurposes.map(p => <SelectItem key={p} value={p} className="font-bold py-2.5">{p}</SelectItem>)}
                                                </SelectContent>
                                            </Select>
                                            <FormMessage />
                                        </FormItem>
                                    )} />
                                </div>

                                {/* CENTRE SECTION: PAYMENT TYPE */}
                                <div className="md:col-span-3 space-y-6">
                                    <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-widest border-b pb-2 flex items-center gap-2"><ArrowRightLeft className="h-3.5 w-3.5" /> Registry Method</h4>
                                    <FormField name={`accounts.${index}.paymentMethod`} control={form.control} render={({ field: methodField }) => (
                                        <FormItem>
                                            <FormLabel className="text-[10px] font-black uppercase text-slate-500">Method *</FormLabel>
                                            <Select onValueChange={methodField.onChange} value={methodField.value ?? ''}>
                                                <FormControl>
                                                    <SelectTrigger className="h-12 rounded-xl font-bold border-slate-200">
                                                        <SelectValue placeholder="Select Type" />
                                                    </SelectTrigger>
                                                </FormControl>
                                                <SelectContent className="rounded-xl">
                                                    {PaymentMethods.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                                                </SelectContent>
                                            </Select>
                                            <FormMessage />
                                        </FormItem>
                                    )} />
                                </div>

                                {/* RIGHT SECTION: DYNAMIC FIELDS */}
                                <div className="md:col-span-5 space-y-6">
                                    <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-widest border-b pb-2 flex items-center gap-2"><Calculator className="h-3.5 w-3.5" /> Registry Handshake Particulars</h4>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6 animate-in fade-in duration-500">
                                        <FormField name={`accounts.${index}.accountHolderName`} control={form.control} render={({ field: nameField }) => (
                                            <FormItem className="md:col-span-2">
                                                <FormLabel className="text-[10px] font-black uppercase text-slate-500">Account Holder Name *</FormLabel>
                                                <FormControl><Input placeholder="Legal name as per registry" {...nameField} value={nameField.value ?? ''} className="h-11 rounded-xl font-black uppercase text-slate-900" /></FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )} />

                                        {watchedAccounts[index].paymentMethod === 'Banking' && (
                                            <>
                                                <FormField name={`accounts.${index}.bankName`} control={form.control} render={({ field: bankField }) => (
                                                    <FormItem><FormLabel className="text-[10px] font-black uppercase text-slate-500">Bank Registry</FormLabel><FormControl><Input {...bankField} value={bankField.value ?? ''} className="h-11 rounded-xl font-bold bg-slate-50/50" /></FormControl></FormItem>
                                                )} />
                                                <FormField name={`accounts.${index}.accountNumber`} control={form.control} render={({ field: acField }) => (
                                                    <FormItem><FormLabel className="text-[10px] font-black uppercase text-slate-500">Account Number</FormLabel><FormControl><Input type="text" {...acField} value={acField.value ?? ''} className="h-11 rounded-xl font-mono font-black" /></FormControl></FormItem>
                                                )} />
                                                <FormField name={`accounts.${index}.ifsc`} control={form.control} render={({ field: ifscField }) => (
                                                    <FormItem>
                                                        <FormLabel className="text-[10px] font-black uppercase text-blue-600 tracking-widest flex items-center justify-between">
                                                            IFSC Registry
                                                            {ifscField.value?.length === 11 && <Sparkles className="h-3 w-3 animate-pulse" />}
                                                        </FormLabel>
                                                        <FormControl><Input placeholder="e.g. SBIN0001234" {...ifscField} value={ifscField.value ?? ''} onChange={e => handleIfscChange(index, e.target.value)} className="h-11 rounded-xl font-mono uppercase font-black text-blue-700" /></FormControl>
                                                        <FormMessage />
                                                    </FormItem>
                                                )} />
                                                <div className="space-y-1.5 pt-1.5">
                                                    <label className="text-[10px] font-black uppercase text-slate-400">Branch City Node</label>
                                                    <div className="h-11 px-4 flex items-center bg-slate-100/50 rounded-xl border border-slate-200 text-[11px] font-black text-slate-500 uppercase tracking-tighter shadow-inner overflow-hidden truncate">
                                                        {watchedAccounts[index].branchCity || '-- AUTO RESOLVE (F4) --'}
                                                    </div>
                                                </div>
                                            </>
                                        )}

                                        {watchedAccounts[index].paymentMethod === 'UPI Payment' && (
                                            <FormField name={`accounts.${index}.upiId`} control={form.control} render={({ field: upiField }) => (
                                                <FormItem className="md:col-span-2">
                                                    <FormLabel className="text-[10px] font-black uppercase text-slate-500">UPI ID Registry *</FormLabel>
                                                    <FormControl>
                                                        <div className="relative group">
                                                            <Smartphone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-300 group-focus-within:text-blue-600 transition-colors" />
                                                            <Input placeholder="example@bank" {...upiField} value={upiField.value ?? ''} className="h-11 rounded-xl font-mono font-black text-blue-900 pl-10" />
                                                        </div>
                                                    </FormControl>
                                                    <FormMessage />
                                                </FormItem>
                                            )} />
                                        )}

                                        {watchedAccounts[index].paymentMethod === 'QR Payment' && (
                                            <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-3 gap-6 items-center bg-slate-50 p-6 rounded-[2.5rem] border border-slate-200">
                                                <div className="md:col-span-2 space-y-3">
                                                    <label className="text-[10px] font-black uppercase text-blue-600 block px-1 tracking-widest">QR Manifest Upload (Max 2MB)</label>
                                                    <label className="flex items-center justify-center w-full h-14 border-2 border-dashed border-slate-300 rounded-2xl cursor-pointer hover:bg-white hover:border-blue-400 transition-all gap-3 bg-white/50 shadow-sm group">
                                                        <Upload className="h-5 w-5 text-slate-400 group-hover:text-blue-600" />
                                                        <span className="text-xs font-bold text-slate-500 uppercase tracking-tight group-hover:text-slate-900">
                                                            {watchedAccounts[index].qrCodeUrl ? "Voucher Re-upload" : "Capture QR Node"}
                                                        </span>
                                                        <input type="file" className="hidden" accept="image/jpeg,image/png" onChange={(e) => handleQrUpload(index, e)} />
                                                    </label>
                                                </div>
                                                <div className="flex justify-center">
                                                    {watchedAccounts[index].qrCodeUrl ? (
                                                        <div className="relative h-20 w-20 bg-white rounded-2xl border-2 border-white shadow-xl overflow-hidden ring-4 ring-slate-100">
                                                            <img src={watchedAccounts[index].qrCodeUrl} alt="QR Registry" className="h-full w-full object-contain" />
                                                        </div>
                                                    ) : (
                                                        <div className="flex flex-col items-center opacity-20 gap-1.5"><ImageIcon className="h-8 w-8 text-slate-400" /><span className="text-[8px] font-black uppercase">Awaiting Node</span></div>
                                                    )}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </Card>
                    ))}
                </div>
            </form>
          </Form>
        </div>

        <DialogFooter className="p-8 bg-slate-900 text-white flex-row items-center justify-between sm:justify-between shrink-0">
          <div className="flex items-center gap-10">
            <div className="p-4 bg-white/5 rounded-2xl border border-white/10 flex items-center gap-4">
                <Calculator className="h-6 w-6 text-blue-400" />
                <div className="flex flex-col">
                    <span className="text-[9px] font-black uppercase text-slate-500 tracking-widest">Active Accounts</span>
                    <span className="text-2xl font-black tracking-tighter">{(watchedAccounts || []).length} Registry Nodes</span>
                </div>
            </div>
            {hasDuplicatePurpose && (
                <div className="flex items-center gap-3 px-6 py-3 bg-red-600 rounded-2xl animate-in zoom-in duration-300 shadow-xl shadow-red-900/20">
                    <AlertTriangle className="h-5 w-5 text-white animate-pulse" />
                    <span className="text-[10px] font-black uppercase tracking-widest text-white leading-tight">
                        Registry Violation: Purpose Nodes must be Unique
                    </span>
                </div>
            )}
          </div>
          <div className="flex gap-4">
            <Button variant="ghost" onClick={onClose} disabled={isSaving} className="text-slate-400 hover:text-white font-black uppercase text-[11px] tracking-widest px-8">Discard</Button>
            <Button 
                onClick={onPreSave} 
                disabled={isSaving || hasDuplicatePurpose}
                className="bg-blue-600 hover:bg-blue-700 text-white px-16 h-14 rounded-[1.5rem] font-black uppercase text-[11px] tracking-widest shadow-xl border-none transition-all active:scale-95 border-none"
            >
                {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                Sync Registry (F8)
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>

      <ConfirmationModal
        isOpen={showConfirm}
        onClose={() => setShowConfirm(false)}
        onConfirm={handleSave}
        title="Commit Banking Registry?"
        message="Please verify all beneficiary nodes. Modification may be restricted once financial liquidation is initiated."
      />
    </Dialog>
  );
}
