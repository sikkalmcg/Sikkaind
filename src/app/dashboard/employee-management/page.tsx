'use client';

import { useState, useMemo, useEffect, useCallback } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { DatePicker } from '@/components/date-picker';
import { useToast } from '@/hooks/use-toast';
import { useFirestore, useCollection, useMemoFirebase, useUser } from "@/firebase";
import { collection, query, addDoc, serverTimestamp, doc, deleteDoc, getDoc, getDocs, orderBy, Timestamp, where, runTransaction, onSnapshot, limit, setDoc, updateDoc, arrayUnion } from "firebase/firestore";
import { Loader2, UserCircle, UserPlus, Search, FileDown, Trash2, History, ShieldCheck, Save, TrendingUp, Calculator, Trophy, CheckCircle2, XCircle, Landmark, Briefcase, CreditCard, ToggleLeft, ToggleRight, Sparkles, Printer, Plus, Edit2, Wallet, Building2, Upload, X, ShieldAlert, AlertTriangle, Info, AlertCircle, Clock, ChevronLeft, ChevronRight } from "lucide-react";
import * as XLSX from 'xlsx';
import Pagination from '@/components/dashboard/vehicle-management/Pagination';
import { format, subMonths, startOfMonth, endOfMonth, eachDayOfInterval, isSunday, isFuture, isBefore, differenceInMinutes, isSameDay, isAfter, isValid, startOfDay, endOfDay, subDays, parse } from 'date-fns';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { cn, normalizePlantId, formatSequenceId } from '@/lib/utils';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Departments, Designations } from '@/lib/constants';
import { useLoading } from '@/context/LoadingContext';
import Image from 'next/image';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const formSchema = z.object({
  firmId: z.string().min(1, 'Firm selection is mandatory.'),
  name: z.string().min(1, 'Employee Name is required.'),
  fatherName: z.string().min(1, 'Father Name is required.'),
  mobile: z.string().regex(/^\d{10}$/, 'Mobile number must be 10 digits.'),
  department: z.string().min(1, 'Department selection is mandatory.'),
  designation: z.string().min(1, 'Designation is required.'),
  address: z.string().min(1, 'Address is required.'),
  aadhar: z.string().length(12, 'Aadhar must be 12 digits.'),
  pan: z.string().min(10, 'PAN must be 10 characters.').toUpperCase(),
  joinDate: z.date({ required_error: 'Join date is required.' }),
  status: z.enum(['Active', 'Inactive']),
  
  // Bank Details
  bankName: z.string().min(1, 'Bank Name required.'),
  accountNumber: z.string().min(1, 'Account number required.'),
  ifsc: z.string().min(1, 'IFSC required.'),

  // Salary Structure
  basicSalary: z.coerce.number().min(0),
  hra: z.coerce.number().min(0),
  conveyance: z.coerce.number().min(0),
  specialAllowance: z.coerce.number().min(0),
  
  // Compliance
  pfApplicable: z.boolean().default(false),
  pfPercent: z.coerce.number().min(0).max(100).optional(),
  esiApplicable: z.boolean().default(false),
  esiPercent: z.coerce.number().min(0).max(100).optional(),
});

type FormValues = z.infer<typeof formSchema>;

const firmFormSchema = z.object({
    name: z.string().min(1, 'Firm Name required.'),
    address: z.string().min(1, 'Address mandatory.'),
    email: z.string().email('Invalid email.'),
    mobile: z.string().regex(/^\d{10}$/, '10 digit mobile required.'),
    gstin: z.string().min(15, 'Invalid GSTIN.'),
    pan: z.string().min(10, 'Invalid PAN.'),
    logo: z.any().optional(),
});

const ITEMS_PER_PAGE = 10;

export default function EmployeeManagementPage() {
  const { toast } = useToast();
  const firestore = useFirestore();
  const { user } = useUser();
  const { showLoader, hideLoader } = useLoading();
  
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [activeTab, setActiveTab] = useState('registry');
  const [editingEmployee, setEditingEmployee] = useState<any | null>(null);

  const isAdmin = user?.email === 'sikkaind.admin@sikka.com' || user?.email === 'sikkalmcg@gmail.com';

  const employeesQuery = useMemoFirebase(() => 
    firestore ? query(collection(firestore, "employees"), orderBy("createdAt", "desc")) : null, 
    [firestore]
  );
  const { data: employees, isLoading } = useCollection<any>(employeesQuery);

  const firmsQuery = useMemoFirebase(() => 
    firestore ? query(collection(firestore, "employee_firms"), orderBy("name")) : null, 
    [firestore]
  );
  const { data: firms } = useCollection<any>(firmsQuery);

  const attendanceQuery = useMemoFirebase(() => 
    firestore ? query(collection(firestore, "attendanceRecords"), orderBy("inTime", "desc")) : null, 
    [firestore]
  );
  const { data: attendance } = useCollection<any>(attendanceQuery);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { 
      firmId: '',
      name: '',
      fatherName: '',
      mobile: '',
      department: '',
      designation: '',
      address: '',
      aadhar: '',
      pan: '',
      joinDate: new Date(),
      status: 'Active',
      bankName: '',
      accountNumber: '',
      ifsc: '',
      basicSalary: 0,
      hra: 0,
      conveyance: 0,
      specialAllowance: 0,
      pfApplicable: false,
      pfPercent: 12,
      esiApplicable: false,
      esiPercent: 0.75,
    }
  });

  const { control, handleSubmit, reset, setValue, formState: { isSubmitting, errors } } = form;
  const watchedValues = useWatch({ control });

  const grossSalary = (Number(watchedValues.basicSalary) || 0) + 
                      (Number(watchedValues.hra) || 0) + 
                      (Number(watchedValues.conveyance) || 0) + 
                      (Number(watchedValues.specialAllowance) || 0);

  const pfDeduction = watchedValues.pfApplicable 
                      ? ((Number(watchedValues.basicSalary) || 0) * (Number(watchedValues.pfPercent) || 0)) / 100 
                      : 0;

  const esiDeduction = watchedValues.esiApplicable 
                       ? (grossSalary * (Number(watchedValues.esiPercent) || 0)) / 100 
                       : 0;

  const netSalary = grossSalary - pfDeduction - esiDeduction;

  const onSubmit = async (values: FormValues) => {
    if (!firestore) return;

    const isDuplicate = (employees || []).some(e => 
        (e.pan === values.pan || e.aadhar === values.aadhar) && e.id !== editingEmployee?.id
    );

    if (isDuplicate) {
        toast({ variant: 'destructive', title: 'Registry Error', description: 'Duplicate identity record not allowed. Aadhaar or PAN already exists.' });
        return;
    }

    showLoader();
    try {
      if (editingEmployee) {
          const empRef = doc(firestore, "employees", editingEmployee.id);
          const payload = {
              ...values,
              grossSalary,
              pfDeduction,
              esiDeduction,
              netSalary,
              lastUpdated: serverTimestamp(),
          };
          await updateDoc(empRef, payload);
          toast({ title: 'Success', description: 'Employee record synchronized.' });
          setEditingEmployee(null);
      } else {
          await runTransaction(firestore, async (transaction) => {
            const counterRef = doc(firestore, "counters", "employees");
            const counterSnap = await transaction.get(counterRef);
            const count = counterSnap.exists() ? counterSnap.data().count : 0;
            const newCount = count + 1;
            const empId = formatSequenceId("SIL", newCount);

            transaction.set(counterRef, { count: newCount }, { merge: true });
            
            const empRef = doc(collection(firestore, "employees"));
            const payload = {
                ...values,
                empId,
                grossSalary,
                pfDeduction,
                esiDeduction,
                netSalary,
                createdAt: serverTimestamp(),
            };
            transaction.set(empRef, payload);
          });
          toast({ title: 'Success', description: 'Employee registered in SIL master registry.' });
      }
      reset();
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Error', description: error.message });
    } finally {
        hideLoader();
    }
  };

  const handleEdit = (emp: any) => {
      setEditingEmployee(emp);
      setActiveTab('registry');
      reset({
          ...emp,
          joinDate: emp.joinDate instanceof Timestamp ? emp.joinDate.toDate() : new Date(emp.joinDate)
      });
  };

  const handleDelete = async (id: string) => {
    if (!firestore || !user) return;
    showLoader();
    try {
      const empRef = doc(firestore, "employees", id);
      const empSnap = await getDoc(empRef);
      if (empSnap.exists()) {
        const currentName = isAdmin ? 'AJAY SOMRA' : (user.email?.split('@')[0] || "Admin");
        
        await addDoc(collection(firestore, "recycle_bin"), {
          pageName: "Employee Management",
          userName: currentName,
          deletedAt: serverTimestamp(),
          data: { ...empSnap.data(), id, type: 'Employee' }
        });
        await deleteDoc(empRef);
        toast({ title: 'Moved to Bin', description: 'Employee record archived.' });
      }
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Error', description: error.message });
    } finally {
        hideLoader();
    }
  };

  const filtered = useMemo(() => (employees || []).filter((e: any) => 
    e.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    e.empId?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    e.aadhar?.includes(searchTerm)
  ), [employees, searchTerm]);

  const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE);
  const paginated = filtered.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  return (
    <div className="p-4 md:p-8 space-y-10 animate-in fade-in duration-500 bg-[#f8fafc] min-h-screen">
      <div className="flex items-center justify-between border-b pb-6">
        <div className="flex items-center gap-4">
            <div className="p-3 bg-blue-900 text-white rounded-2xl shadow-xl rotate-3">
                <UserCircle className="h-8 w-8" />
            </div>
            <div>
                <h1 className="text-3xl font-black text-slate-800 uppercase tracking-tight italic">Workforce Enterprise Hub</h1>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.4em]">Integrated Employee Lifecycle Registry</p>
            </div>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="bg-transparent border-b h-12 rounded-none gap-10 p-0 mb-8 w-full justify-start overflow-x-auto custom-scrollbar">
            <TabsTrigger value="registry" className="data-[state=active]:border-b-2 data-[state=active]:border-blue-900 data-[state=active]:bg-transparent rounded-none px-0 text-xs font-black uppercase tracking-widest text-slate-400 data-[state=active]:text-blue-900 transition-all flex items-center gap-2">
                <UserPlus className="h-4 w-4" /> Employee Master
            </TabsTrigger>
            <TabsTrigger value="firms" className="data-[state=active]:border-b-2 data-[state=active]:border-blue-900 data-[state=active]:bg-transparent rounded-none px-0 text-xs font-black uppercase tracking-widest text-slate-400 data-[state=active]:text-blue-900 transition-all flex items-center gap-2">
                <Building2 className="h-4 w-4" /> Firms Registry
            </TabsTrigger>
            <TabsTrigger value="attendance" className="data-[state=active]:border-b-2 data-[state=active]:border-blue-900 data-[state=active]:bg-transparent rounded-none px-0 text-xs font-black uppercase tracking-widest text-slate-400 data-[state=active]:text-blue-900 transition-all flex items-center gap-2">
                <TrendingUp className="h-4 w-4" /> Attendance Hub
            </TabsTrigger>
            <TabsTrigger value="payroll" className="data-[state=active]:border-b-2 data-[state=active]:border-blue-900 data-[state=active]:bg-transparent rounded-none px-0 text-xs font-black uppercase tracking-widest text-slate-400 data-[state=active]:text-blue-900 transition-all flex items-center gap-2">
                <Calculator className="h-4 w-4" /> Salary / Payroll
            </TabsTrigger>
            <TabsTrigger value="advance" className="data-[state=active]:border-b-2 data-[state=active]:border-blue-900 data-[state=active]:bg-transparent rounded-none px-0 text-xs font-black uppercase tracking-widest text-slate-400 data-[state=active]:text-blue-900 transition-all flex items-center gap-2">
                <CreditCard className="h-4 w-4" /> Advance Salary
            </TabsTrigger>
            <TabsTrigger value="ledger" className="data-[state=active]:border-b-2 data-[state=active]:border-blue-900 data-[state=active]:bg-transparent rounded-none px-0 text-xs font-black uppercase tracking-widest text-slate-400 data-[state=active]:text-blue-900 transition-all flex items-center gap-2">
                <History className="h-4 w-4" /> History Ledger
            </TabsTrigger>
        </TabsList>

        <TabsContent value="registry" className="m-0 focus-visible:ring-0 space-y-10">
            <Card className="border-none shadow-xl rounded-2xl overflow-hidden bg-white">
                <CardHeader className="bg-slate-50 border-b p-8">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-blue-900 text-white rounded-lg"><UserPlus className="h-5 w-5" /></div>
                            <div>
                                <CardTitle className="text-xl font-black uppercase text-blue-900">Employee Master Registry</CardTitle>
                                <CardDescription className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Establish permanent employee identity and compensation node</CardDescription>
                            </div>
                        </div>
                        <div className="text-right">
                            <span className="text-[10px] font-black uppercase text-slate-400 block tracking-widest">Calculated net salary</span>
                            <span className="text-3xl font-black text-blue-900 tracking-tighter">₹ {isNaN(netSalary) ? '0.00' : netSalary.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="p-10">
                <Form {...form}>
                    <form onSubmit={handleSubmit(onSubmit)} className="space-y-12">
                        <div className="space-y-6">
                            <h3 className="text-xs font-black uppercase tracking-[0.2em] text-slate-400 flex items-center gap-2 px-1">
                                <History className="h-4 w-4 text-blue-600"/> 1. IDENTITY PARTICULARS
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-8 p-8 bg-slate-50/50 rounded-3xl border border-slate-100 shadow-inner">
                                <FormField name="firmId" control={form.control} render={({ field }) => (
                                    <FormItem>
                                        <FormLabel className="text-[10px] font-black uppercase text-blue-600 tracking-widest">Select Firm *</FormLabel>
                                        <Select onValueChange={field.onChange} value={field.value}>
                                            <FormControl><SelectTrigger className="h-11 bg-white font-bold border-slate-200"><SelectValue placeholder="Select Firm" /></SelectTrigger></FormControl>
                                            <SelectContent className="rounded-xl">
                                                {firms?.map(f => <SelectItem key={f.id} value={f.id} className="font-bold py-2.5">{f.name}</SelectItem>)}
                                            </SelectContent>
                                        </Select>
                                        <FormMessage />
                                    </FormItem>
                                )} />
                                <FormField name="name" control={form.control} render={({ field }) => (<FormItem><FormLabel className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Full Name *</FormLabel><FormControl><Input {...field} className="h-11 rounded-xl font-bold bg-white" /></FormControl></FormItem>)} />
                                <FormField name="fatherName" control={form.control} render={({ field }) => (<FormItem><FormLabel className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Father's Name *</FormLabel><FormControl><Input {...field} className="h-11 rounded-xl font-bold bg-white" /></FormControl></FormItem>)} />
                                <FormField name="mobile" control={form.control} render={({ field }) => (<FormItem><FormLabel className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Mobile Number *</FormLabel><FormControl><Input {...field} maxLength={10} className="h-11 rounded-xl font-mono bg-white" /></FormControl></FormItem>)} />
                                <FormField name="aadhar" control={form.control} render={({ field }) => (<FormItem><FormLabel className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Aadhar Number *</FormLabel><FormControl><Input {...field} maxLength={12} className="h-11 rounded-xl font-mono bg-white" /></FormControl></FormItem>)} />
                                <FormField name="pan" control={form.control} render={({ field }) => (<FormItem><FormLabel className="text-[10px] font-black uppercase text-slate-400 tracking-widest">PAN Card *</FormLabel><FormControl><Input {...field} maxLength={10} className="h-11 rounded-xl font-mono uppercase bg-white" /></FormControl></FormItem>)} />
                                <FormField name="department" control={form.control} render={({ field }) => (
                                    <FormItem>
                                        <FormLabel className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Department *</FormLabel>
                                        <Select onValueChange={field.onChange} value={field.value}>
                                            <FormControl><SelectTrigger className="h-11 bg-white font-bold border-slate-200"><SelectValue /></SelectTrigger></FormControl>
                                            <SelectContent className="rounded-xl">
                                                {Departments.map(d => <SelectItem key={d} value={d} className="font-bold">{d}</SelectItem>)}
                                            </SelectContent>
                                        </Select>
                                    </FormItem>
                                )} />
                                <FormField name="designation" control={form.control} render={({ field }) => (
                                    <FormItem>
                                        <FormLabel className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Designation *</FormLabel>
                                        <Select onValueChange={field.onChange} value={field.value}>
                                            <FormControl><SelectTrigger className="h-11 bg-white font-bold border-slate-200"><SelectValue /></SelectTrigger></FormControl>
                                            <SelectContent className="rounded-xl">
                                                {Designations.map(d => <SelectItem key={d} value={d} className="font-bold">{d}</SelectItem>)}
                                            </SelectContent>
                                        </Select>
                                    </FormItem>
                                )} />
                                <FormField name="joinDate" control={form.control} render={({ field }) => (
                                    <FormItem className="flex flex-col">
                                        <FormLabel className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Joining Date *</FormLabel>
                                        <FormControl><DatePicker date={field.value} setDate={field.onChange} className="h-11 bg-white" /></FormControl>
                                    </FormItem>
                                )} />
                                <FormField name="address" control={form.control} render={({ field }) => (
                                    <FormItem className="md:col-span-2"><FormLabel className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Current Address *</FormLabel><FormControl><Input {...field} className="h-11 rounded-xl font-medium bg-white" /></FormControl></FormItem>
                                )} />
                                <FormField name="status" control={form.control} render={({ field }) => (
                                    <FormItem>
                                        <FormLabel className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Registry Status</FormLabel>
                                        <Select onValueChange={field.onChange} value={field.value}>
                                            <FormControl><SelectTrigger className="h-11 bg-white font-bold border-slate-200"><SelectValue /></SelectTrigger></FormControl>
                                            <SelectContent className="rounded-xl"><SelectItem value="Active" className="font-bold">Active</SelectItem><SelectItem value="Inactive" className="font-bold">Inactive</SelectItem></SelectContent>
                                        </Select>
                                    </FormItem>
                                )} />
                            </div>
                        </div>

                        <div className="space-y-6">
                            <h3 className="text-xs font-black uppercase tracking-[0.2em] text-slate-400 flex items-center gap-2 px-1">
                                <Landmark className="h-4 w-4 text-blue-600"/> 2. BANKING HUB
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 p-8 bg-white rounded-3xl border border-slate-200 shadow-sm">
                                <FormField name="bankName" control={form.control} render={({ field }) => (<FormItem><FormLabel className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Bank Name *</FormLabel><FormControl><Input {...field} className="h-11 rounded-xl font-bold" /></FormControl></FormItem>)} />
                                <FormField name="accountNumber" control={form.control} render={({ field }) => (<FormItem><FormLabel className="text-[10px] font-black uppercase text-slate-400 tracking-widest">A/C Number *</FormLabel><FormControl><Input {...field} className="h-11 rounded-xl font-mono font-black" /></FormControl></FormItem>)} />
                                <FormField name="ifsc" control={form.control} render={({ field }) => (<FormItem><FormLabel className="text-[10px] font-black uppercase text-slate-400 tracking-widest">IFSC Code *</FormLabel><FormControl><Input {...field} className="h-11 rounded-xl font-mono uppercase font-black text-blue-700" /></FormControl></FormItem>)} />
                            </div>
                        </div>

                        <div className="space-y-6">
                            <h3 className="text-xs font-black uppercase tracking-[0.2em] text-slate-400 flex items-center gap-2 px-1 italic">
                                <Briefcase className="h-4 w-4 text-blue-600"/> 3. SALARY STRUCTURE NODE
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-4 gap-8 p-8 bg-blue-900 text-white rounded-[2.5rem] shadow-2xl relative overflow-hidden">
                                <div className="absolute top-0 right-0 p-8 opacity-5 rotate-12"><Calculator className="h-48 w-48" /></div>
                                <FormField name="basicSalary" control={form.control} render={({ field }) => (<FormItem><FormLabel className="text-[10px] font-black uppercase text-blue-300">Basic Salary (INR) *</FormLabel><FormControl><Input type="number" {...field} className="h-12 bg-white/10 border-white/20 text-white font-black text-xl tracking-tighter" /></FormControl></FormItem>)} />
                                <FormField name="hra" control={form.control} render={({ field }) => (<FormItem><FormLabel className="text-[10px] font-black uppercase text-blue-300">House Rent (HRA)</FormLabel><FormControl><Input type="number" {...field} className="h-12 bg-white/10 border-white/20 text-white font-black text-xl tracking-tighter" /></FormControl></FormItem>)} />
                                <FormField name="conveyance" control={form.control} render={({ field }) => (<FormItem><FormLabel className="text-[10px] font-black uppercase text-blue-300">Conveyance</FormLabel><FormControl><Input type="number" {...field} className="h-12 bg-white/10 border-white/20 text-white font-black text-xl tracking-tighter" /></FormControl></FormItem>)} />
                                <FormField name="specialAllowance" control={form.control} render={({ field }) => (<FormItem><FormLabel className="text-[10px] font-black uppercase text-blue-300">Special Allowance</FormLabel><FormControl><Input type="number" {...field} className="h-12 bg-white/10 border-white/20 text-white font-black text-xl tracking-tighter" /></FormControl></FormItem>)} />
                                
                                <div className="md:col-span-4 grid grid-cols-1 md:grid-cols-3 gap-8 pt-6 border-t border-white/10 mt-4 items-center">
                                    <div className="space-y-1">
                                        <span className="text-[10px] font-black uppercase text-slate-400 block tracking-widest">Aggregate Gross</span>
                                        <p className="text-4xl font-black tracking-tighter">₹ {isNaN(grossSalary) ? '0.00' : grossSalary.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</p>
                                    </div>
                                    <div className="flex items-center gap-6 bg-white/5 p-4 rounded-2xl border border-white/10">
                                        <div className="flex flex-col gap-1">
                                            <span className="text-[9px] font-black uppercase text-slate-500">PF Deduction</span>
                                            <span className="text-lg font-black text-orange-400">₹ {isNaN(pfDeduction) ? '0.00' : pfDeduction.toLocaleString('en-IN')}</span>
                                        </div>
                                        <Separator orientation="vertical" className="h-8 bg-white/10" />
                                        <div className="flex flex-col gap-1">
                                            <span className="text-[9px] font-black uppercase text-slate-500">ESI Deduction</span>
                                            <span className="text-lg font-black text-orange-400">₹ {isNaN(esiDeduction) ? '0.00' : esiDeduction.toLocaleString('en-IN')}</span>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <span className="text-[10px] font-black uppercase text-blue-300 block tracking-widest mb-1">Take-Home Registry</span>
                                        <p className="text-4xl font-black text-emerald-400 tracking-tighter">₹ {isNaN(netSalary) ? '0.00' : netSalary.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="space-y-6">
                            <h3 className="text-xs font-black uppercase tracking-[0.2em] text-slate-400 flex items-center gap-2 px-1">
                                <ShieldCheck className="h-4 w-4 text-blue-600"/> 4. GOVERNMENT COMPLIANCE REGISTRY
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                <Card className={cn("border-2 transition-all rounded-3xl overflow-hidden group", watchedValues.pfApplicable ? "border-emerald-200 bg-emerald-50/10 shadow-lg shadow-emerald-900/5" : "border-slate-100 bg-white")}>
                                    <CardHeader className="p-6 border-b border-slate-50 flex flex-row items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <div className={cn("p-2 rounded-xl transition-colors", watchedValues.pfApplicable ? "bg-emerald-600 text-white" : "bg-slate-100 text-slate-400")}><Landmark className="h-5 w-5" /></div>
                                            <CardTitle className="text-sm font-black uppercase">PF Contribution</CardTitle>
                                        </div>
                                        <FormField name="pfApplicable" control={form.control} render={({ field }) => (<Switch checked={field.value} onCheckedChange={field.onChange} />)} />
                                    </CardHeader>
                                    <CardContent className="p-8">
                                        <FormField name="pfPercent" control={form.control} render={({ field }) => (
                                            <FormItem className={cn("transition-all duration-500", !watchedValues.pfApplicable && "opacity-30 pointer-events-none grayscale")}>
                                                <FormLabel className="text-[10px] font-black uppercase text-slate-400">Employee Contribution % *</FormLabel>
                                                <FormControl>
                                                    <div className="relative">
                                                        <Input type="number" {...field} className="h-12 rounded-xl font-black text-xl text-blue-900 pr-12 focus:ring-emerald-600" />
                                                        <span className="absolute right-4 top-1/2 -translate-y-1/2 font-black text-slate-300">%</span>
                                                    </div>
                                                </FormControl>
                                                <p className="text-[9px] font-bold text-slate-400 uppercase mt-2 italic">Applied on Basic salary node.</p>
                                            </FormItem>
                                        )} />
                                    </CardContent>
                                </Card>

                                <Card className={cn("border-2 transition-all rounded-3xl overflow-hidden group", watchedValues.esiApplicable ? "border-emerald-200 bg-emerald-50/10 shadow-lg shadow-emerald-900/5" : "border-slate-100 bg-white")}>
                                    <CardHeader className="p-6 border-b border-slate-50 flex flex-row items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <div className={cn("p-2 rounded-xl transition-colors", watchedValues.esiApplicable ? "bg-emerald-600 text-white" : "bg-slate-100 text-slate-400")}><ShieldCheck className="h-5 w-5" /></div>
                                            <CardTitle className="text-sm font-black uppercase">ESI Compliance</CardTitle>
                                        </div>
                                        <FormField name="esiApplicable" control={form.control} render={({ field }) => (
                                            <Switch checked={field.value} onCheckedChange={field.onChange} />
                                        )} />
                                    </CardHeader>
                                    <CardContent className="p-8">
                                        <FormField name="esiPercent" control={form.control} render={({ field }) => (
                                            <FormItem className={cn("transition-all duration-500", !watchedValues.esiApplicable && "opacity-30 pointer-events-none grayscale")}>
                                                <FormLabel className="text-[10px] font-black uppercase text-slate-400">Employee Contribution % *</FormLabel>
                                                <FormControl>
                                                    <div className="relative">
                                                        <Input type="number" step="0.01" {...field} className="h-12 rounded-xl font-black text-xl text-blue-900 pr-12 focus:ring-emerald-600" />
                                                        <span className="absolute right-4 top-1/2 -translate-y-1/2 font-black text-slate-300">%</span>
                                                    </div>
                                                </FormControl>
                                                <p className="text-[9px] font-bold text-slate-400 uppercase mt-2 italic">Applied on Gross salary manifest.</p>
                                            </FormItem>
                                        )} />
                                    </CardContent>
                                </Card>
                            </div>
                        </div>

                        <div className="flex gap-4 justify-end pt-10 border-t border-slate-100">
                            <Button type="button" variant="ghost" onClick={() => {reset(); setEditingEmployee(null);}} className="h-14 px-10 font-black uppercase text-[11px] tracking-widest text-slate-400 hover:text-slate-900 transition-all rounded-[1.5rem]">Discard Entry</Button>
                            <Button type="submit" disabled={isSubmitting} className="bg-blue-900 hover:bg-black text-white px-20 h-14 rounded-[1.5rem] font-black uppercase text-[11px] tracking-[0.3em] shadow-2xl shadow-blue-900/30 transition-all active:scale-95 border-none">
                                {isSubmitting ? <Loader2 className="mr-3 h-4 w-4 animate-spin" /> : <Save className="mr-3 h-4 w-4" />}
                                {editingEmployee ? 'Sync Master Record' : 'Finalize Master Registry'}
                            </Button>
                        </div>
                    </form>
                </Form>
                </CardContent>
            </Card>

            <Card className="border-none shadow-xl rounded-[2.5rem] bg-white overflow-hidden">
                <CardHeader className="bg-slate-50 border-b p-8 flex flex-col md:flex-row md:items-center justify-between gap-6">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-white rounded-lg border shadow-sm"><History className="h-5 w-5 text-blue-900" /></div>
                        <div>
                            <CardTitle className="text-lg font-black uppercase tracking-tight text-blue-900 italic">Workforce Identity Ledger</CardTitle>
                            <CardDescription className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Consolidated master records and compensation structure</CardDescription>
                        </div>
                    </div>
                    <div className="flex items-center gap-4">
                        <div className="relative group">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 group-focus-within:text-blue-900 transition-colors" />
                            <Input placeholder="Search records..." value={searchTerm} onChange={e => {setSearchTerm(e.target.value); setCurrentPage(1);}} className="pl-10 w-[320px] h-11 rounded-2xl bg-white border-slate-200 shadow-sm font-bold" />
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="p-0">
                    <div className="overflow-x-auto">
                        <Table>
                            <TableHeader className="bg-slate-50/50">
                                <TableRow className="h-14 hover:bg-transparent border-b">
                                    <TableHead className="text-[10px] font-black uppercase px-8 text-slate-400">Identity</TableHead>
                                    <TableHead className="text-[10px] font-black uppercase px-4 text-slate-400">Firm</TableHead>
                                    <TableHead className="text-[10px] font-black uppercase px-4 text-slate-400">Department</TableHead>
                                    <TableHead className="text-[10px] font-black uppercase px-4 text-slate-400">Designation</TableHead>
                                    <TableHead className="text-[10px] font-black uppercase px-4 text-right text-slate-400">Basic (₹)</TableHead>
                                    <TableHead className="text-[10px] font-black uppercase px-4 text-right text-blue-900">Gross (₹)</TableHead>
                                    <TableHead className="text-[10px] font-black uppercase px-4 text-right text-emerald-600">Net (₹)</TableHead>
                                    <TableHead className="text-[10px] font-black uppercase px-4 text-center text-slate-400">Status</TableHead>
                                    <TableHead className="text-[10px] font-black uppercase px-8 text-right text-slate-400">Action</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {isLoading ? (
                                    <TableRow><TableCell colSpan={9} className="text-center h-48"><Loader2 className="animate-spin inline-block h-8 w-8 text-blue-900" /></TableCell></TableRow>
                                ) : paginated.length === 0 ? (
                                    <TableRow><TableCell colSpan={9} className="h-48 text-center text-slate-400 italic font-medium">No records found.</TableCell></TableRow>
                                ) : (
                                    paginated.map((e) => (
                                        <TableRow key={e.id} className="h-16 hover:bg-blue-50/30 transition-colors border-b last:border-0 group">
                                            <TableCell className="px-8">
                                                <div className="flex flex-col">
                                                    <span className="font-black text-slate-900 uppercase text-xs">{e.name}</span>
                                                    <span className="text-[9px] font-mono font-bold text-blue-700">{e.empId}</span>
                                                </div>
                                            </TableCell>
                                            <TableCell className="px-4 font-black text-slate-500 uppercase text-[9px]">{firms?.find(f => f.id === e.firmId)?.name || '--'}</TableCell>
                                            <TableCell className="px-4 font-bold text-slate-700 uppercase text-[10px]">{e.department}</TableCell>
                                            <TableCell className="px-4 font-bold text-slate-700 uppercase text-[10px]">{e.designation}</TableCell>
                                            <TableCell className="px-4 text-right font-black text-slate-500">{(e.basicSalary || 0).toLocaleString()}</TableCell>
                                            <TableCell className="px-4 text-right font-black text-blue-900">₹ {(e.grossSalary || 0).toLocaleString()}</TableCell>
                                            <TableCell className="px-4 text-right font-black text-emerald-600">₹ {(e.netSalary || 0).toLocaleString()}</TableCell>
                                            <TableCell className="px-4 text-center">
                                                <Badge className={cn("text-[9px] font-black uppercase px-3 h-5 border-none shadow-sm", e.status === 'Active' ? 'bg-emerald-600 text-white' : 'bg-red-600 text-white')}>
                                                    {e.status}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="px-8 text-right">
                                                <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <Button variant="ghost" size="icon" className="h-9 w-9 text-slate-400 hover:text-blue-600" onClick={() => handleEdit(e)}><Edit2 className="h-4 w-4" /></Button>
                                                    <Button variant="ghost" size="icon" className="h-9 w-9 text-red-600 hover:bg-red-50" onClick={() => handleDelete(e.id)}><Trash2 className="h-4 w-4" /></Button>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </div>
                    <div className="p-6 bg-slate-50 border-t flex items-center justify-between">
                        <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} itemCount={filtered.length} canPreviousPage={currentPage > 1} canNextPage={currentPage < totalPages} />
                    </div>
                </CardContent>
            </Card>
        </TabsContent>

        <TabsContent value="firms" className="m-0 focus-visible:ring-0">
            <FirmsTab isAdmin={isAdmin} />
        </TabsContent>

        <TabsContent value="attendance" className="m-0 focus-visible:ring-0">
            <AttendanceSummary 
                employees={employees || []} 
                attendanceData={attendance || []} 
            />
        </TabsContent>

        <TabsContent value="payroll" className="m-0 focus-visible:ring-0">
            <SalaryPayrollTab employees={employees || []} firms={firms || []} attendanceData={attendance || []} isAdmin={isAdmin} />
        </TabsContent>

        <TabsContent value="advance" className="m-0 focus-visible:ring-0">
            <AdvanceSalaryTab employees={employees || []} isAdmin={isAdmin} />
        </TabsContent>

        <TabsContent value="ledger" className="m-0 focus-visible:ring-0">
            <HistoryLedgerTab employees={employees || []} isAdmin={isAdmin} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// --- SUB-TABS COMPONENTS ---

function FirmsTab({ isAdmin }: { isAdmin: boolean }) {
    const firestore = useFirestore();
    const { toast } = useToast();
    const [editingFirm, setEditingFirm] = useState<any | null>(null);
    const [logoPreview, setLogoPreview] = useState<string | null>(null);

    const firmsQuery = useMemoFirebase(() => 
        firestore ? query(collection(firestore, "employee_firms"), orderBy("name")) : null, 
        [firestore]
    );
    const { data: firms, isLoading } = useCollection<any>(firmsQuery);

    const form = useForm<z.infer<typeof firmFormSchema>>({
        resolver: zodResolver(firmFormSchema),
        defaultValues: { name: '', address: '', email: '', mobile: '', gstin: '', pan: '' }
    });

    const convertFileToBase64 = (file: File): Promise<string> => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = (error) => reject(error);
        });
    };

    const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            if (file.size > 500 * 1024) {
                toast({ variant: 'destructive', title: 'Registry Error', description: 'Logo size must be under 500KB.' });
                e.target.value = '';
                return;
            }
            form.setValue('logo', e.target.files);
            const reader = new FileReader();
            reader.onload = (event) => setLogoPreview(event.target?.result as string);
            reader.readAsDataURL(file);
        }
    };

    const onSubmit = async (values: any) => {
        if (!firestore) return;
        try {
            let logoUrl = editingFirm?.logoUrl || '';
            if (values.logo && values.logo[0]) {
                logoUrl = await convertFileToBase64(values.logo[0]);
            }

            const { logo, ...rest } = values;
            const payload = { ...rest, logoUrl, updatedAt: serverTimestamp() };

            if (editingFirm) {
                await updateDoc(doc(firestore, "employee_firms", editingFirm.id), payload);
                toast({ title: 'Registry Updated', description: 'Firm particulars modified.' });
                setEditingFirm(null);
            } else {
                await addDoc(collection(firestore, "employee_firms"), { ...payload, createdAt: serverTimestamp() });
                toast({ title: 'Success', description: 'New firm established in registry.' });
            }
            form.reset();
            setLogoPreview(null);
        } catch (e: any) {
            toast({ variant: 'destructive', title: 'Error', description: e.message });
        }
    };

    return (
        <div className="space-y-10">
            <Card className="border-none shadow-xl rounded-2xl overflow-hidden bg-white">
                <CardHeader className="bg-slate-50 border-b p-8">
                    <div className="flex items-center gap-3">
                        <Building2 className="h-6 w-6 text-blue-900" />
                        <div>
                            <CardTitle className="text-xl font-black uppercase text-blue-900">Firm Configuration</CardTitle>
                            <CardDescription className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Maintain corporate legal identifiers for payroll</CardDescription>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="p-10">
                    <Form {...form}>
                        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                                <FormField name="name" control={form.control} render={({ field }) => (<FormItem><FormLabel className="text-[10px] font-black uppercase text-slate-400">Firm Name *</FormLabel><FormControl><Input {...field} className="h-11 font-bold" /></FormControl></FormItem>)} />
                                <FormField name="email" control={form.control} render={({ field }) => (<FormItem><FormLabel className="text-[10px] font-black uppercase text-slate-400">Email Address *</FormLabel><FormControl><Input {...field} className="h-11 font-medium" /></FormControl></FormItem>)} />
                                <FormField name="mobile" control={form.control} render={({ field }) => (<FormItem><FormLabel className="text-[10px] font-black uppercase text-slate-400">Contact Number *</FormLabel><FormControl><Input {...field} className="h-11 font-mono" /></FormControl></FormItem>)} />
                                <FormField name="gstin" control={form.control} render={({ field }) => (
                                    <FormItem><FormLabel className="text-[10px] font-black uppercase text-blue-600">GSTIN Registry *</FormLabel><FormControl><Input {...field} className="h-11 font-mono uppercase" /></FormControl></FormItem>)} />
                                <FormField name="pan" control={form.control} render={({ field }) => (
                                    <FormItem><FormLabel className="text-[10px] font-black uppercase text-slate-400">PAN Number *</FormLabel><FormControl><Input {...field} className="h-11 font-mono uppercase" /></FormControl></FormItem>)} />
                                <div className="flex items-end gap-4">
                                    <FormField name="logo" control={form.control} render={({ field }) => (
                                        <FormItem className="flex-1">
                                            <FormLabel className="text-[10px] font-black uppercase text-slate-400 tracking-widest flex items-center gap-2"><Upload className="h-3 w-3" /> Firm Logo (Max 500KB)</FormLabel>
                                            <FormControl><Input type="file" accept="image/*" onChange={handleLogoChange} className="h-11 rounded-xl pt-2.5 text-xs bg-white" /></FormControl>
                                        </FormItem>
                                    )} />
                                    {logoPreview && (
                                        <div className="h-11 w-11 rounded-xl border border-slate-200 bg-white p-1 shadow-sm shrink-0 flex items-center justify-center relative group">
                                            <Image src={logoPreview} alt="Logo Preview" width={40} height={40} className="object-contain max-h-full max-w-full" unoptimized />
                                            <button type="button" onClick={() => {setLogoPreview(null); form.setValue('logo', undefined);}} className="absolute -top-2 -right-2 bg-red-600 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"><X className="h-3 w-3" /></button>
                                        </div>
                                    )}
                                </div>
                                <FormField name="address" control={form.control} render={({ field }) => (
                                    <FormItem className="lg:col-span-3"><FormLabel className="text-[10px] font-black uppercase text-slate-400">Registered Office Address *</FormLabel><FormControl><Input {...field} className="h-11" /></FormControl></FormItem>)} />
                            </div>
                            <div className="flex gap-3 justify-end border-t pt-6">
                                <Button type="button" variant="ghost" onClick={() => {form.reset(); setEditingFirm(null); setLogoPreview(null);}} className="font-bold text-slate-400">Cancel</Button>
                                <Button type="submit" className="bg-blue-900 hover:bg-slate-900 px-12 h-11 font-black uppercase text-[10px] tracking-widest shadow-lg border-none">
                                    {editingFirm ? 'Update Firm node' : 'Commit Registry'}
                                </Button>
                            </div>
                        </form>
                    </Form>
                </CardContent>
            </Card>

            <Card className="border-none shadow-xl rounded-[2.5rem] bg-white overflow-hidden">
                <CardHeader className="bg-slate-50 border-b p-8">
                    <div className="flex items-center gap-3">
                        <History className="h-5 w-5 text-blue-900" />
                        <CardTitle className="text-lg font-black uppercase text-blue-900">Firm History Section</CardTitle>
                    </div>
                </CardHeader>
                <CardContent className="p-0">
                    <Table>
                        <TableHeader>
                            <TableRow className="h-12 border-b bg-slate-50/50">
                                <TableHead className="px-8 text-[10px] font-black uppercase">Logo</TableHead>
                                <TableHead className="text-[10px] font-black uppercase">Firm Name</TableHead>
                                <TableHead className="text-[10px] font-black uppercase">GSTIN</TableHead>
                                <TableHead className="text-[10px] font-black uppercase text-right px-8">Action</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {firms?.map(f => (
                                <TableRow key={f.id} className="h-14 hover:bg-slate-50">
                                    <TableCell className="px-8">
                                        {f.logoUrl ? (
                                            <div className="h-10 w-10 border rounded-lg bg-white p-1 flex items-center justify-center">
                                                <Image src={f.logoUrl} alt={f.name} width={32} height={32} className="object-contain" unoptimized />
                                            </div>
                                        ) : (
                                            <div className="h-10 w-10 border rounded-lg bg-slate-50 flex items-center justify-center text-slate-300">
                                                <Building2 className="h-5 w-5" />
                                            </div>
                                        )}
                                    </TableCell>
                                    <TableCell className="font-black uppercase text-xs">{f.name}</TableCell>
                                    <TableCell className="font-mono text-xs font-bold text-blue-700">{f.gstin}</TableCell>
                                    <TableCell className="px-8 text-right space-x-2">
                                        {isAdmin && (
                                            <>
                                                <Button variant="ghost" size="icon" onClick={() => {setEditingFirm(f); form.reset(f); setLogoPreview(f.logoUrl || null);}} className="h-8 w-8 text-blue-600"><Edit2 className="h-4 w-4" /></Button>
                                                <AlertDialog>
                                                    <AlertDialogTrigger asChild>
                                                        <Button variant="ghost" size="icon" className="h-8 w-8 text-red-600"><Trash2 className="h-4 w-4" /></Button>
                                                    </AlertDialogTrigger>
                                                    <AlertDialogContent className="border-none shadow-3xl p-0 overflow-hidden bg-white">
                                                        <div className="p-8 bg-red-50 border-b border-red-100 flex items-center gap-5">
                                                            <div className="bg-red-600 p-3 rounded-2xl shadow-xl">
                                                                <ShieldAlert className="h-8 w-8 text-white" />
                                                            </div>
                                                            <div>
                                                                <AlertDialogTitle className="text-xl font-black text-red-900 uppercase tracking-tight">Revoke Firm Node?</AlertDialogTitle>
                                                                <AlertDialogDescription className="text-red-700 font-bold uppercase text-[9px] tracking-widest mt-1">Authorized Registry Disposal Required</AlertDialogDescription>
                                                            </div>
                                                        </div>
                                                        <div className="p-8">
                                                            <p className="text-sm font-medium text-slate-600 leading-relaxed italic">"You are about to permanently erase **{f.name}** from the mission database. All linked records may lose corporate branding node references."</p>
                                                        </div>
                                                        <AlertDialogFooter className="bg-slate-50 p-6 flex-row justify-end gap-3 border-t">
                                                            <AlertDialogCancel className="font-bold border-slate-200 px-8 h-10 rounded-xl m-0">Abort</AlertDialogCancel>
                                                            <AlertDialogAction onClick={async () => { 
                                                                await deleteDoc(doc(firestore!, "employee_firms", f.id));
                                                                toast({ title: 'Success', description: 'Firm node purged.' });
                                                            }} className="bg-red-600 hover:bg-red-700 text-white font-black uppercase text-[10px] tracking-widest px-8">Confirm Purge</AlertDialogAction>
                                                        </AlertDialogFooter>
                                                    </AlertDialogContent>
                                                </AlertDialog>
                                            </>
                                        )}
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    );
}

function AttendanceSummary({ employees, attendanceData }: { employees: any[], attendanceData: any[] }) {
    const [selectedEmpId, setSelectedEmpId] = useState<string>('');
    const [viewDate, setViewDate] = useState<Date | null>(null);
    const [selectedDayDetails, setSelectedDayDetails] = useState<any | null>(null);

    useEffect(() => {
        setViewDate(new Date());
    }, []);

    const selectedMonthKey = useMemo(() => viewDate && isValid(viewDate) ? format(viewDate, 'yyyy-MM') : '', [viewDate]);

    const stats = useMemo(() => {
        if (!selectedEmpId || !viewDate || !isValid(viewDate) || !selectedMonthKey) return null;

        const startMonth = startOfMonth(viewDate);
        const endMonth = endOfMonth(viewDate);
        const daysInMonth = eachDayOfInterval({ start: startMonth, end: endMonth });
        
        const workingDaysInMonth = daysInMonth.filter(d => !isSunday(d)).length;
        const totalSundays = daysInMonth.filter(d => isSunday(d)).length;

        const employeeAllLogs = attendanceData
            .filter(a => a.employeeId === selectedEmpId)
            .map(a => ({
                ...a,
                inTime: a.inTime instanceof Timestamp ? a.inTime.toDate() : new Date(a.inTime),
                outTime: a.outTime ? (a.outTime instanceof Timestamp ? a.outTime.toDate() : new Date(a.outTime)) : undefined
            }))
            .sort((a, b) => a.inTime.getTime() - b.inTime.getTime());

        const earliestLog = employeeAllLogs.length > 0 ? employeeAllLogs[0].inTime : startOfMonth(new Date());
        const startOfTime = startOfMonth(earliestLog);
        
        let poolHistory: { month: string, surplus: number }[] = [];
        let runningPoolBalance = 0;

        const allMonthsUpToSelected = eachDayOfInterval({ start: startOfTime, end: endMonth })
            .filter(d => d.getDate() === 1);

        let finalAttendance = 0;
        let adjustedFromPool = 0;
        let extraDaysInPool = 0;

        allMonthsUpToSelected.forEach(mStart => {
            const mKey = format(mStart, 'yyyy-MM');
            const mEnd = endOfMonth(mStart);
            const mWorkingDays = eachDayOfInterval({ start: mStart, end: mEnd }).filter(d => !isSunday(d)).length;
            
            const mLogs = employeeAllLogs.filter(log => log.inTime >= mStart && log.inTime <= mEnd);
            
            let mFull = 0;
            let mHalf = 0;
            let mExtra = 0;

            mLogs.forEach(log => {
                let hours = log.outTime ? (differenceInMinutes(log.outTime, log.inTime) / 60) : 0;
                
                if (!log.outTime && !isSameDay(log.inTime, new Date()) && isBefore(log.inTime, new Date())) {
                    hours = 16;
                }

                const isSun = isSunday(log.inTime);
                
                if (hours >= 5) { 
                    if (isSun) mExtra++; else mFull++; 
                }
                else if (hours >= 2) { 
                    if (isSun) mExtra += 0.5; else mHalf++; 
                }
            });

            const mRawTotal = mFull + (mHalf / 2);
            
            if (mKey === selectedMonthKey) {
                const deficit = Math.max(0, mWorkingDays - mRawTotal);
                const adjustment = Math.min(runningPoolBalance, deficit);
                
                finalAttendance = mRawTotal + adjustment;
                adjustedFromPool = adjustment;
                
                const monthlyExtra = Math.max(0, mRawTotal - mWorkingDays) + mExtra;
                extraDaysInPool = runningPoolBalance - adjustment + monthlyExtra;
            } else {
                const surplus = (mRawTotal - mWorkingDays > 0 ? mRawTotal - mWorkingDays : 0) + mExtra;
                const deficit = mWorkingDays - mRawTotal > 0 ? mWorkingDays - mRawTotal : 0;
                
                if (surplus > 0) poolHistory.push({ month: format(mStart, 'MMM-yyyy').toUpperCase(), surplus });
                
                let remainingDeficit = deficit;
                for (let h of poolHistory) {
                    if (remainingDeficit <= 0) break;
                    const deduction = Math.min(h.surplus, remainingDeficit);
                    h.surplus -= deduction;
                    remainingDeficit -= deduction;
                }
                
                runningPoolBalance = poolHistory.reduce((s, h) => s + h.surplus, 0);
            }
        });

        const activeContributionMonths = poolHistory.filter(h => h.surplus > 0).map(h => h.month);
        const periodDisplay = activeContributionMonths.length > 0 
            ? `${activeContributionMonths[0]} → ${format(viewDate, 'MMM-yyyy').toUpperCase()}` 
            : `${format(viewDate, 'MMM-yyyy').toUpperCase()}`;

        return {
            totalDays: daysInMonth.length,
            workingDays: workingDaysInMonth,
            holidays: totalSundays,
            rawAttendance: finalAttendance - adjustedFromPool,
            poolAdjustment: adjustedFromPool,
            finalAttendance,
            advancePool: extraDaysInPool,
            period: periodDisplay,
            score: Math.round((finalAttendance / workingDaysInMonth) * 100),
            daysInMonth
        };
    }, [selectedEmpId, viewDate, attendanceData, selectedMonthKey]);

    const heatmapData = useMemo(() => {
        if (!selectedEmpId || !stats || !viewDate || !isValid(viewDate)) return [];
        
        const mStart = startOfMonth(viewDate);
        const mEnd = endOfMonth(viewDate);
        const logs = attendanceData.filter(a => {
            const d = a.inTime instanceof Timestamp ? a.inTime.toDate() : new Date(a.inTime);
            return a.employeeId === selectedEmpId && d >= mStart && d <= mEnd;
        });

        return stats.daysInMonth.map(day => {
            const dateStr = format(day, 'yyyy-MM-dd');
            const dayLogs = logs.filter(l => {
                const d = l.inTime instanceof Timestamp ? l.inTime.toDate() : new Date(l.inTime);
                return format(d, 'yyyy-MM-dd') === dateStr;
            });

            const isSun = isSunday(day);
            let status: 'present' | 'half' | 'absent' | 'holiday' | 'extra' = isSun ? 'holiday' : 'absent';
            let logFound = null;
            
            if (dayLogs.length > 0) {
                const log = dayLogs[0];
                logFound = log;
                let hours = log.outTime ? (differenceInMinutes(log.outTime instanceof Timestamp ? log.outTime.toDate() : new Date(log.outTime), log.inTime instanceof Timestamp ? log.inTime.toDate() : new Date(log.inTime)) / 60) : 0;
                
                if (!log.outTime && !isSameDay(day, new Date()) && isBefore(day, new Date())) {
                    hours = 16;
                }

                if (hours >= 2) {
                    if (isSun) status = 'extra';
                    else if (hours >= 5) status = 'present';
                    else status = 'half';
                } else {
                    status = isSun ? 'holiday' : 'absent';
                }
            }

            return { 
                day: day.getDate(), 
                fullDate: day, 
                status, 
                isSunday: isSun,
                log: logFound
            };
        });
    }, [selectedEmpId, viewDate, attendanceData, stats]);

    const handleDayClick = (dayData: any) => {
        if (isFuture(dayData.fullDate)) return;

        const emp = employees.find(e => e.id === selectedEmpId);
        const labelMap: Record<string, string> = {
            present: 'Present (Full Day)',
            half: 'Half Day Node',
            extra: 'Advance Node (Sunday Work)',
            absent: 'Absent (No Record)',
            holiday: 'Holiday (Sunday)'
        };

        const inT = dayData.log?.inTime ? (dayData.log.inTime instanceof Timestamp ? dayData.log.inTime.toDate() : new Date(dayData.log.inTime)) : null;
        const outT = dayData.log?.outTime ? (dayData.log.outTime instanceof Timestamp ? dayData.log.outTime.toDate() : new Date(dayData.log.outTime)) : null;

        let dayType = '--';
        if (dayData.status === 'present') dayType = 'Full Day';
        else if (dayData.status === 'half') dayType = 'Half Day';
        else if (dayData.status === 'extra') dayType = 'Advance';
        else if (dayData.status === 'absent') dayType = 'Absent';
        else if (dayData.status === 'holiday') dayType = 'Holiday';

        setSelectedDayDetails({
            employeeName: emp?.name || 'Unknown',
            date: format(dayData.fullDate, 'dd MMMM yyyy'),
            statusLabel: labelMap[dayData.status],
            statusType: dayData.status,
            dayType,
            inTime: inT ? format(inT, 'HH:mm') : '--:--',
            outTime: outT ? format(outT, 'HH:mm') : '--:--',
        });
    };

    if (!viewDate || !isValid(viewDate)) return null;

    return (
        <div className="space-y-10 border-none shadow-xl rounded-[2.5rem] bg-white overflow-hidden p-10 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <Card className="border-none shadow-none bg-transparent overflow-hidden">
                <CardContent className="p-0 flex flex-wrap items-end gap-10 bg-slate-50 p-8 rounded-3xl shadow-inner border border-slate-100">
                    <div className="grid gap-3 flex-1 min-w-[300px]">
                        <label className="text-[10px] font-black uppercase text-slate-400 tracking-[0.2em] px-1 flex items-center gap-2">
                            <UserCircle className="h-3 w-3" /> Employee Entity *
                        </label>
                        <Select value={selectedEmpId} onValueChange={setSelectedEmpId}>
                            <SelectTrigger className="h-12 bg-white rounded-xl font-black text-blue-900 border-slate-200 shadow-sm focus:ring-blue-900">
                                <SelectValue placeholder="Select Employee" />
                            </SelectTrigger>
                            <SelectContent className="rounded-xl">
                                {employees.map(e => <SelectItem key={e.id} value={e.id} className="font-bold py-3">{e.name} ({e.empId})</SelectItem>)}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="grid gap-3 w-[240px]">
                        <label className="text-[10px] font-black uppercase text-slate-400 tracking-[0.2em] px-1 flex items-center gap-2">
                            <Clock className="h-3 w-3" /> Audit Month
                        </label>
                        <div className="flex items-center gap-3">
                            <Button variant="outline" size="icon" onClick={() => setViewDate(subMonths(viewDate, 1))} className="h-12 w-12 rounded-xl border-slate-200"><ChevronLeft /></Button>
                            <div className="h-12 flex-1 px-4 flex items-center justify-center bg-white rounded-xl border border-slate-200 font-black text-blue-900 uppercase italic shadow-sm">
                                {format(viewDate, 'MMM-yyyy').toUpperCase()}
                            </div>
                            <Button variant="outline" size="icon" onClick={() => {
                                const next = subMonths(viewDate, -1);
                                if (!isFuture(next)) setViewDate(next);
                            }} disabled={isFuture(subMonths(viewDate, -1))} className="h-12 w-12 rounded-xl border-slate-200"><ChevronRight /></Button>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {!selectedEmpId ? (
                <div className="flex flex-col items-center justify-center py-32 opacity-30 gap-4 grayscale group">
                    <History className="h-20 w-20 transition-transform duration-500 group-hover:scale-110" />
                    <p className="text-xl font-black uppercase tracking-[0.3em]">Awaiting Identity Selection</p>
                </div>
            ) : (
                <div className="space-y-10 animate-in zoom-in-95 duration-500">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                        <Card className="border-none shadow-xl rounded-[2.5rem] bg-white overflow-hidden group">
                            <CardHeader className="p-8 border-b bg-slate-50 flex flex-row items-center justify-between">
                                <div>
                                    <CardTitle className="text-[10px] font-black uppercase text-slate-400 tracking-widest leading-none mb-1">Standard Cycle Statistics</CardTitle>
                                    <p className="text-xl font-black text-slate-900 tracking-tighter">WORKING DAYS</p>
                                </div>
                                <div className="p-3 bg-white rounded-2xl shadow-sm border"><Clock className="h-5 w-5 text-blue-600" /></div>
                            </CardHeader>
                            <CardContent className="p-10 space-y-6">
                                <div className="text-5xl font-black text-blue-900 tracking-tighter leading-none">{stats?.workingDays} <span className="text-lg text-slate-300">/ {stats?.totalDays}</span></div>
                                <div className="grid grid-cols-2 gap-4 pt-4 border-t">
                                    <div className="space-y-1"><span className="text-[8px] font-black uppercase text-slate-400 block">System Holidays</span><span className="text-sm font-bold text-slate-500">{stats?.holidays} Sundays</span></div>
                                    <div className="space-y-1 text-right"><span className="text-[8px] font-black uppercase text-slate-400 block">Registry Cycle</span><span className="text-sm font-black text-slate-500">{format(viewDate, 'MMMM').toUpperCase()}</span></div>
                                </div>
                            </CardContent>
                        </Card>

                        <Card className="border-none shadow-xl rounded-[2.5rem] bg-slate-900 text-white overflow-hidden group">
                            <CardHeader className="p-8 border-b border-white/5 bg-white/5 flex flex-row items-center justify-between">
                                <div>
                                    <CardTitle className="text-[10px] font-black uppercase text-blue-400 tracking-widest mb-1">Finalized Ledger Amount</CardTitle>
                                    <p className="text-xl font-black text-white tracking-tighter">NET ATTENDANCE</p>
                                </div>
                                <div className="p-3 bg-white/10 rounded-2xl backdrop-blur-md"><ShieldCheck className="h-5 w-5 text-blue-400" /></div>
                            </CardHeader>
                            <CardContent className="p-10 space-y-6">
                                <div className="text-5xl font-black text-blue-400 tracking-tighter leading-none">{stats?.finalAttendance} <span className="text-lg text-white/30">DAYS</span></div>
                                <div className="grid grid-cols-2 gap-4 pt-4 border-t border-white/10">
                                    <div className="space-y-1"><span className="text-[8px] font-black uppercase text-slate-500 block">Registry Actuals</span><span className="text-sm font-bold text-blue-100">{stats?.rawAttendance} Days</span></div>
                                    <div className="space-y-1 text-right"><span className="text-[8px] font-black uppercase text-slate-500 block">Time-Bank Adjust</span><span className="text-sm font-black text-emerald-400">+{stats?.poolAdjustment} Days</span></div>
                                </div>
                            </CardContent>
                        </Card>

                        <Card className="border-none shadow-xl rounded-[2.5rem] bg-white overflow-hidden group border-2 border-blue-100">
                            <CardHeader className="bg-blue-50/50 p-8 border-b flex flex-row items-center justify-between">
                                <div>
                                    <CardTitle className="text-[10px] font-black uppercase text-blue-600 tracking-widest leading-none mb-1">Surplus Time Pool</CardTitle>
                                    <p className="text-xl font-black text-blue-900 tracking-tighter">ADVANCE ATTENDANCE</p>
                                </div>
                                <div className="p-3 bg-blue-600 rounded-2xl shadow-xl"><Trophy className="h-5 w-5 text-white" /></div>
                            </CardHeader>
                            <CardContent className="p-10 space-y-6">
                                <div className="text-5xl font-black text-blue-900 tracking-tighter leading-none">{stats?.advancePool} <span className="text-lg text-slate-300">DAYS</span></div>
                                <div className="space-y-2 pt-4 border-t">
                                    <span className="text-[8px] font-black uppercase text-slate-400 block tracking-[0.2em]">Contribution Period Node</span>
                                    <p className="text-[11px] font-black text-slate-700 uppercase italic truncate">{stats?.period}</p>
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    <Card className="border-none shadow-2xl rounded-[3rem] bg-white overflow-hidden">
                        <CardHeader className="bg-slate-50 border-b p-8 flex flex-col md:flex-row md:items-end justify-between gap-8">
                            <div className="space-y-2">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-slate-900 text-white rounded-lg"><Calculator className="h-4 w-4" /></div>
                                    <CardTitle className="text-sm font-black uppercase tracking-widest">Monthly Manifest Visualization</CardTitle>
                                </div>
                                <div className="flex items-center gap-6 pt-4">
                                    <div className="flex items-center gap-2"><div className="h-2 w-2 rounded-full bg-emerald-500" /><span className="text-[10px] font-black uppercase text-slate-400 tracking-tighter">Present</span></div>
                                    <div className="flex items-center gap-2"><div className="h-2 w-2 rounded-full bg-amber-400" /><span className="text-[10px] font-black uppercase text-slate-400 tracking-tighter">Half Day</span></div>
                                    <div className="flex items-center gap-2"><div className="h-2 w-2 rounded-full bg-blue-600" /><span className="text-[10px] font-black uppercase text-slate-400 tracking-tighter">Advance Node</span></div>
                                    <div className="flex items-center gap-2"><div className="h-2 w-2 rounded-full bg-red-50" /><span className="text-[10px] font-black uppercase text-slate-400 tracking-tighter">Absent</span></div>
                                    <div className="flex items-center gap-2"><div className="h-2 w-2 rounded-full bg-slate-200" /><span className="text-[10px] font-black uppercase text-slate-400 tracking-tighter">Holiday</span></div>
                                </div>
                            </div>

                            <div className="w-[350px] space-y-3">
                                <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest text-slate-400">
                                    <span>Attendance Score Node</span>
                                    <span className="text-blue-900">{stats?.score}% Registry Fidelity</span>
                                </div>
                                <Progress value={stats?.score} className="h-3 rounded-full bg-slate-100 shadow-inner overflow-hidden border border-slate-50">
                                    <div className="h-full bg-blue-900 transition-all" style={{ width: `${stats?.score}%` }} />
                                </Progress>
                                <p className="text-[9px] font-bold text-slate-400 text-right uppercase">{stats?.finalAttendance} / {stats?.workingDays} TARGET MISSION NODES</p>
                            </div>
                        </CardHeader>
                        <CardContent className="p-10">
                            <div className="grid grid-cols-7 gap-4">
                                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
                                    <div key={d} className="text-center font-black uppercase text-[10px] text-slate-300 tracking-widest pb-4">{d}</div>
                                ))}
                                {Array.from({ length: startOfMonth(viewDate).getDay() }).map((_, i) => (
                                    <div key={`empty-${i}`} />
                                ))}
                                {heatmapData.map((d, i) => {
                                    const isDayInFuture = isFuture(d.fullDate);
                                    return (
                                        <div 
                                            key={i} 
                                            onClick={() => handleDayClick(d)} 
                                            className={cn(
                                                "aspect-square rounded-[1.25rem] flex items-center justify-center relative shadow-sm border-2 transition-all",
                                                !isDayInFuture && "hover:scale-105 cursor-pointer",
                                                isDayInFuture && "opacity-40 cursor-default grayscale-[0.5]",
                                                d.status === 'present' && "bg-emerald-500/10 border-emerald-500 text-emerald-700",
                                                d.status === 'half' && "bg-amber-400/10 border-amber-400 text-amber-700",
                                                d.status === 'extra' && "bg-blue-600/10 border-blue-600 text-blue-700",
                                                d.status === 'absent' && "bg-red-50 border-slate-100 text-red-700",
                                                d.status === 'holiday' && "bg-slate-50 border-slate-100 text-slate-300"
                                            )}
                                        >
                                            <span className="text-lg font-black tracking-tighter">{d.day}</span>
                                            {d.status !== 'holiday' && d.status !== 'absent' && !isDayInFuture && (
                                                <div className="absolute top-2 right-2 h-1.5 w-1.5 rounded-full bg-current opacity-40 animate-pulse" />
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </CardContent>
                    </Card>
                </div>
            )}

            {selectedDayDetails && (
                <Dialog open={!!selectedDayDetails} onOpenChange={() => setSelectedDayDetails(null)}>
                    <DialogContent className="max-w-md border-none shadow-3xl p-0 overflow-hidden bg-white rounded-3xl">
                        <DialogHeader className="p-8 bg-blue-900 text-white flex flex-row items-center gap-5 space-y-0">
                            <div className="p-3 bg-white/20 rounded-2xl backdrop-blur-md border border-white/20">
                                <ShieldCheck className="h-8 w-8 text-white" />
                            </div>
                            <div>
                                <DialogTitle className="text-xl font-black uppercase tracking-tight italic">{selectedDayDetails.statusLabel}</DialogTitle>
                                <DialogDescription className="text-white/70 font-bold uppercase text-[9px] tracking-widest mt-1">Registry Manifest Snapshot</DialogDescription>
                            </div>
                        </DialogHeader>
                        <div className="p-10 space-y-8">
                            <div className="space-y-6">
                                <div className="flex items-center gap-4 group">
                                    <div className="p-2.5 bg-slate-100 rounded-xl group-hover:bg-blue-50 transition-colors"><UserCircle className="h-5 w-5 text-slate-400 group-hover:text-blue-600" /></div>
                                    <div className="space-y-0.5">
                                        <p className="text-[9px] font-black uppercase text-slate-400 tracking-wider">Employee Name</p>
                                        <p className="text-sm font-black text-slate-900 uppercase">{selectedDayDetails.employeeName}</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-4 group">
                                    <div className="p-2.5 bg-slate-100 rounded-xl group-hover:bg-blue-50 transition-colors"><Clock className="h-5 w-5 text-slate-400 group-hover:text-blue-600" /></div>
                                    <div className="space-y-0.5">
                                        <p className="text-[9px] font-black uppercase text-slate-400 tracking-wider">Attendance Date</p>
                                        <p className="text-sm font-bold text-slate-700">{selectedDayDetails.date}</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-4 group">
                                    <div className="p-2.5 bg-slate-100 rounded-xl group-hover:bg-blue-50 transition-colors"><ShieldCheck className="h-5 w-5 text-slate-400 group-hover:text-blue-600" /></div>
                                    <div className="space-y-0.5">
                                        <p className="text-[9px] font-black uppercase text-slate-400 tracking-wider">Attendance Type</p>
                                        <div className="flex items-center gap-2">
                                            <p className="text-sm font-black text-slate-900 uppercase">{selectedDayDetails.dayType}</p>
                                            {selectedDayDetails.dayType !== '--' && selectedDayDetails.dayType !== 'Absent' && selectedDayDetails.dayType !== 'Holiday' && (
                                                <Badge className={cn(
                                                    "text-[8px] font-black h-4 px-2 border-none",
                                                    selectedDayDetails.dayType === 'Full Day' ? "bg-emerald-600" : 
                                                    selectedDayDetails.dayType === 'Half Day' ? "bg-amber-500" : "bg-blue-600"
                                                )}>
                                                    VERIFIED
                                                </Badge>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <Separator />

                            <div className="grid grid-cols-2 gap-8">
                                <div className="space-y-2 p-5 bg-slate-50 rounded-2xl border border-slate-100 group hover:border-emerald-200 transition-all">
                                    <div className="flex items-center justify-between"><span className="text-[8px] font-black uppercase text-slate-400">IN TIME</span> <CheckCircle2 className="h-3 w-3 text-emerald-500" /></div>
                                    <p className="text-2xl font-black text-slate-900 font-mono tracking-tighter">{selectedDayDetails.inTime}</p>
                                </div>
                                <div className="space-y-2 p-5 bg-slate-50 rounded-2xl border border-slate-100 group hover:border-red-200 transition-all">
                                    <div className="flex items-center justify-between"><span className="text-[8px] font-black uppercase text-slate-400">OUT TIME</span> <XCircle className="h-3 w-3 text-red-500" /></div>
                                    <p className="text-2xl font-black text-slate-900 font-mono tracking-tighter">{selectedDayDetails.outTime}</p>
                                </div>
                            </div>
                        </div>
                        <DialogFooter className="p-6 bg-slate-50 border-t flex-row justify-end">
                            <Button onClick={() => setSelectedDayDetails(null)} className="bg-slate-900 hover:bg-black text-white px-10 h-11 rounded-xl font-black uppercase text-[10px] tracking-widest shadow-xl border-none">Close Record</Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            )}
        </div>
    );
}

function SalaryPayrollTab({ employees, firms, attendanceData, isAdmin }: { employees: any[], firms: any[], attendanceData: any[], isAdmin: boolean }) {
    const firestore = useFirestore();
    const { toast } = useToast();
    const { showLoader, hideLoader } = useLoading();
    const [month, setMonth] = useState('');
    const [payrollRecords, setPayrollRecords] = useState<any[]>([]);
    const [isLoadingPayroll, setIsLoadingPayroll] = useState(false);
    const [selectedPayroll, setSelectedPayroll] = useState<any | null>(null);
    const [payModal, setPayModal] = useState<any | null>(null);
    const [editingPayroll, setEditingPayroll] = useState<any | null>(null);

    // DEFER initialization to useEffect to avoid hydration error
    useEffect(() => {
        setMonth(format(new Date(), 'yyyy-MM'));
    }, []);

    // Rule: Enable generation only after month end
    const isMonthComplete = useMemo(() => {
        if (!month) return false;
        const today = new Date();
        const monthEndDate = endOfMonth(parse(month, 'yyyy-MM', new Date()));
        return isAfter(today, monthEndDate);
    }, [month]);

    useEffect(() => {
        if (!firestore || !month) return;
        setIsLoadingPayroll(true);
        const q = query(collection(firestore, "payrollRecords"), where("month", "==", month));
        const unsub = onSnapshot(q, (snap) => {
            const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            setPayrollRecords(data.filter(r => (r.totalAttendance || 0) > 0));
            setIsLoadingPayroll(false);
        });
        return () => unsub();
    }, [firestore, month]);

    const calculateAttendanceStats = (empId: string, monthKey: string) => {
        const [y, m] = monthKey.split('-');
        const targetMonthDate = new Date(Number(y), Number(m) - 1);
        const start = startOfMonth(targetMonthDate);
        const end = endOfMonth(targetMonthDate);
        const days = eachDayOfInterval({ start, end });
        const workDaysCount = days.filter(d => !isSunday(d)).length;

        const logs = attendanceData.filter(a => {
            const dt = a.inTime instanceof Timestamp ? a.inTime.toDate() : new Date(a.inTime);
            return a.employeeId === empId && dt >= start && dt <= end;
        });

        let full = 0, half = 0;
        logs.forEach(log => {
            const inT = log.inTime instanceof Timestamp ? log.inTime.toDate() : new Date(log.inTime);
            const outT = log.outTime ? (log.outTime instanceof Timestamp ? log.outTime.toDate() : new Date(log.outTime)) : undefined;
            let hrs = outT ? (differenceInMinutes(outT, inT) / 60) : (isBefore(inT, new Date()) ? 16 : 0);
            if (isSunday(inT)) return;
            if (hrs >= 5) full++;
            else if (hrs >= 2) half++;
        });

        const total = full + (half * 0.5);
        return { workingDays: workDaysCount, totalAttendance: total, absentDays: Math.max(0, workDaysCount - total) };
    };

    const handleGenerate = async () => {
        if (!firestore) return;
        showLoader();
        try {
            for (const emp of employees) {
                const existing = payrollRecords.find(r => r.employeeId === emp.id);
                if (existing) continue;

                const stats = calculateAttendanceStats(emp.id, month);
                if (stats.totalAttendance <= 0) continue;

                const attFactor = stats.totalAttendance / stats.workingDays;

                const advanceQ = query(collection(firestore, "advanceSalary"), where("employeeId", "==", emp.id), where("status", "==", "Pending"));
                const advanceSnap = await getDocs(advanceQ);
                const totalAdvance = advanceSnap.docs.reduce((s, d) => s + d.data().amount, 0);

                const baseSalary = (emp.basicSalary || 0) * attFactor;
                const net = (emp.netSalary || 0) * attFactor - totalAdvance;

                await addDoc(collection(firestore, "payrollRecords"), {
                    employeeId: emp.id,
                    employeeName: emp.name,
                    firmId: emp.firmId,
                    month,
                    basicSalary: emp.basicSalary || 0,
                    hra: (emp.hra || 0) * attFactor,
                    conveyance: (emp.conveyance || 0) * attFactor,
                    specialAllowance: (emp.specialAllowance || 0) * attFactor,
                    grossSalary: (emp.grossSalary || 0) * attFactor,
                    pfDeduction: (emp.pfDeduction || 0) * attFactor,
                    esiDeduction: (emp.esiDeduction || 0) * attFactor,
                    advanceDeduction: totalAdvance,
                    netSalary: Math.max(0, net),
                    workingDays: stats.workingDays,
                    totalAttendance: stats.totalAttendance,
                    absentDays: stats.absentDays,
                    status: 'Generated',
                    payments: [],
                    paidAmount: 0,
                    createdAt: serverTimestamp()
                });

                for (const advDoc of advanceSnap.docs) {
                    await updateDoc(doc(firestore, "advanceSalary", advDoc.id), { status: 'Deducted' });
                }
            }
            toast({ title: 'Payroll Node Synchronized', description: 'Monthly salary manifest generated.' });
        } catch (e: any) {
            toast({ variant: 'destructive', title: 'Generation Failed', description: e.message });
        } finally {
            hideLoader();
        }
    };

    const handlePay = async (values: any) => {
        if (!firestore || !payModal) return;
        
        // Final sanity check node
        const rem = (payModal.netSalary || 0) - (payModal.paidAmount || 0);
        if (values.amount > (rem + 0.01)) {
            toast({ variant: 'destructive', title: 'Registry Violation', description: 'Payment amount exceeds net salary balance.' });
            return;
        }

        showLoader();
        try {
            const newTotalPaid = (payModal.paidAmount || 0) + Number(values.amount);
            const netPayable = payModal.netSalary || 0;
            const nextStatus = newTotalPaid >= (netPayable - 0.01) ? 'Paid' : 'Partial';

            await updateDoc(doc(firestore, "payrollRecords", payModal.id), {
                payments: arrayUnion({
                    amount: Number(values.amount),
                    date: values.date,
                    timestamp: new Date().toISOString()
                }),
                paidAmount: newTotalPaid,
                paidDate: values.date,
                status: nextStatus
            });
            toast({ title: 'Success', description: 'Salary liquidation recorded.' });
            setPayModal(null);
        } catch (e: any) {
            toast({ variant: 'destructive', title: 'Error', description: e.message });
        } finally {
            hideLoader();
        }
    };

    const handleEditPayroll = async (values: any) => {
        if (!firestore || !editingPayroll) return;
        showLoader();
        try {
            const net = values.grossSalary - values.pfDeduction - values.esiDeduction - values.advanceDeduction;
            await updateDoc(doc(firestore, "payrollRecords", editingPayroll.id), {
                ...values,
                netSalary: Math.max(0, net),
                lastUpdated: serverTimestamp()
            });
            toast({ title: 'Registry Updated', description: 'Payroll node adjusted successfully.' });
            setEditingPayroll(null);
        } catch (e: any) {
            toast({ variant: 'destructive', title: 'Error', description: e.message });
        } finally {
            hideLoader();
        }
    }

    const handleDeletePayroll = async (id: string) => {
        if (!firestore || !isAdmin) return;
        showLoader();
        try {
            await deleteDoc(doc(firestore, "payrollRecords", id));
            toast({ title: 'Node Removed', description: 'Payroll record permanently deleted.' });
        } catch (e: any) {
            toast({ variant: 'destructive', title: 'Error', description: e.message });
        } finally {
            hideLoader();
        }
    }

    return (
        <div className="space-y-8">
            <Card className="border-none shadow-xl rounded-3xl bg-white overflow-hidden">
                <CardHeader className="bg-slate-50 border-b p-8 flex flex-row items-center justify-between">
                    <div className="flex items-center gap-3">
                        <Calculator className="h-6 w-6 text-blue-900" />
                        <div>
                            <CardTitle className="text-lg font-black uppercase">Monthly Payroll Terminal</CardTitle>
                            <CardDescription className="text-[10px] font-bold uppercase tracking-widest">Execute monthly salary liquidation</CardDescription>
                        </div>
                    </div>
                    <div className="flex items-center gap-4">
                        <Input type="month" value={month} onChange={e => setMonth(e.target.value)} className="h-10 w-40" />
                        <TooltipProvider>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <span className="inline-block">
                                        <Button 
                                            onClick={handleGenerate} 
                                            disabled={!isMonthComplete || isLoadingPayroll} 
                                            className="bg-blue-900 hover:bg-slate-900 gap-2 uppercase font-black text-[10px] h-10 px-6 disabled:bg-slate-100 disabled:text-slate-400"
                                        >
                                            <Sparkles className="h-4 w-4" /> Generate Payroll
                                        </Button>
                                    </span>
                                </TooltipTrigger>
                                {!isMonthComplete && (
                                    <TooltipContent className="bg-slate-900 text-white border-none p-3 max-w-xs shadow-2xl">
                                        <p className="text-xs font-bold uppercase flex items-center gap-2"><AlertCircle className="h-3 w-3" /> Month Incomplete</p>
                                        <p className="text-[10px] mt-1">Generation protocol enabled only after the full month cycle terminates.</p>
                                    </TooltipContent>
                                )}
                            </Tooltip>
                        </TooltipProvider>
                    </div>
                </CardHeader>
                <CardContent className="p-0">
                    <div className="overflow-x-auto">
                        <Table>
                            <TableHeader>
                                <TableRow className="text-[10px] font-black uppercase border-b bg-slate-50/50 h-12">
                                    <TableHead className="px-8">Employee</TableHead>
                                    <TableHead className="text-center">Atten / Days</TableHead>
                                    <TableHead className="text-right">Gross (₹)</TableHead>
                                    <TableHead className="text-right text-red-600">Advance (₹)</TableHead>
                                    <TableHead className="text-right text-emerald-600 font-black">Net Salary (₹)</TableHead>
                                    <TableHead className="text-right">Paid Amount</TableHead>
                                    <TableHead className="text-center">Last Paid Date</TableHead>
                                    <TableHead className="text-center">Status</TableHead>
                                    <TableHead className="text-right px-8">Action</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {isLoadingPayroll ? (
                                    <TableRow><TableCell colSpan={9} className="h-48 text-center"><Loader2 className="animate-spin inline-block h-8 w-8 text-blue-900" /></TableCell></TableRow>
                                ) : payrollRecords.length === 0 ? (
                                    <TableRow><TableCell colSpan={9} className="h-48 text-center text-slate-400 italic">No payroll nodes generated.</TableCell></TableRow>
                                ) : (
                                    payrollRecords.map(record => (
                                        <TableRow key={record.id} className="h-14 hover:bg-slate-50 border-b group">
                                            <TableCell className="px-8 font-bold text-xs uppercase">{record.employeeName}</TableCell>
                                            <TableCell className="text-center font-black text-xs text-slate-500">
                                                {record.totalAttendance || 0} / {record.workingDays || 0}
                                            </TableCell>
                                            <TableCell className="text-right font-bold">{(record.grossSalary || 0).toLocaleString()}</TableCell>
                                            <TableCell className="text-right text-red-600 font-black">{(record.advance_total || record.advanceDeduction || 0).toLocaleString()}</TableCell>
                                            <TableCell className="text-right font-black text-emerald-600">₹ {(record.netSalary || 0).toLocaleString()}</TableCell>
                                            <TableCell className="text-right">
                                                <TooltipProvider>
                                                    <Tooltip>
                                                        <TooltipTrigger asChild>
                                                            <span className="font-black text-blue-900 cursor-help underline decoration-blue-200 decoration-dashed underline-offset-4">
                                                                {record.paidAmount ? `₹ ${record.paidAmount.toLocaleString()}` : '₹ 0.00'}
                                                            </span>
                                                        </TooltipTrigger>
                                                        <TooltipContent className="p-0 border-none shadow-3xl rounded-xl overflow-hidden min-w-[300px]">
                                                            <div className="bg-slate-900 p-3 text-white text-[10px] font-black uppercase tracking-widest flex items-center gap-2">
                                                                <History className="h-3.5 w-3.5" /> Liquidation History
                                                            </div>
                                                            <div className="bg-white">
                                                                {(record.payments || []).length === 0 ? (
                                                                    <div className="p-6 text-center text-[10px] text-slate-400 italic uppercase">No payments recorded.</div>
                                                                ) : (
                                                                    <Table>
                                                                        <TableHeader className="bg-slate-50 h-8">
                                                                            <TableRow className="hover:bg-transparent">
                                                                                <TableHead className="text-[8px] font-black h-8 px-4">Post Date</TableHead>
                                                                                <TableHead className="text-[8px] font-black h-8 px-4 text-right">Amount (₹)</TableHead>
                                                                            </TableRow>
                                                                        </TableHeader>
                                                                        <TableBody>
                                                                            {record.payments.map((p: any, i: number) => (
                                                                                <TableRow key={i} className="h-8 border-b border-slate-50 last:border-0">
                                                                                    <TableCell className="text-[9px] py-1 px-4 font-bold text-slate-500">{format(p.date.toDate ? p.date.toDate() : new Date(p.date), 'dd MMM yyyy')}</TableCell>
                                                                                    <TableCell className="text-[9px] py-1 px-4 text-right font-black text-blue-900">₹ {p.amount.toLocaleString()}</TableCell>
                                                                                </TableRow>
                                                                            ))}
                                                                        </TableBody>
                                                                    </Table>
                                                                )}
                                                            </div>
                                                        </TooltipContent>
                                                    </Tooltip>
                                                </TooltipProvider>
                                            </TableCell>
                                            <TableCell className="text-center text-[10px] font-bold text-slate-400">{record.paidDate ? format(record.paidDate instanceof Timestamp ? record.paidDate.toDate() : new Date(record.paidDate), 'dd/MM/yy') : '--'}</TableCell>
                                            <TableCell className="text-center">
                                                <Badge variant={record.status === 'Paid' ? 'default' : (record.status === 'Partial' ? 'outline' : 'secondary')} className={cn("uppercase font-black text-[9px]", record.status === 'Paid' ? 'bg-emerald-600' : (record.status === 'Partial' ? 'text-amber-600 border-amber-200' : ''))}>
                                                    {record.status}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="px-8 text-right">
                                                <div className="flex justify-end gap-2">
                                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-blue-600 hover:bg-blue-50" onClick={() => setSelectedPayroll(record)}><Printer className="h-4 w-4" /></Button>
                                                    {isAdmin && (
                                                        <>
                                                            <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-slate-900" onClick={() => setEditingPayroll(record)}><Edit2 className="h-4 w-4" /></Button>
                                                            <Button variant="ghost" size="icon" className="h-8 w-8 text-red-600 hover:bg-red-50" onClick={() => handleDeletePayroll(record.id)}><Trash2 className="h-4 w-4" /></Button>
                                                        </>
                                                    )}
                                                    {record.status !== 'Paid' && (
                                                        <Button variant="ghost" size="icon" className="h-8 w-8 text-emerald-600 hover:bg-emerald-50" onClick={() => setPayModal(record)}><CheckCircle2 className="h-4 w-4" /></Button>
                                                    )}
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>

            {payModal && (
                <PayActionModal isOpen={!!payModal} onClose={() => setPayModal(null)} record={payModal} onSave={handlePay} />
            )}

            {editingPayroll && (
                <EditPayrollModal isOpen={!!editingPayroll} onClose={() => setEditingPayroll(null)} record={editingPayroll} onSave={handleEditPayroll} />
            )}

            {selectedPayroll && (
                <SalarySlipModal isOpen={!!selectedPayroll} onClose={() => setSelectedPayroll(null)} record={selectedPayroll} firm={firms.find(f => f.id === selectedPayroll.firmId)} employee={employees.find(e => e.id === selectedPayroll.employeeId)} />
            )}
        </div>
    );
}

function EditPayrollModal({ isOpen, onClose, record, onSave }: { isOpen: boolean, onClose: () => void, record: any, onSave: (v: any) => void }) {
    const form = useForm({
        defaultValues: {
            basicSalary: record.basicSalary || 0,
            hra: record.hra || 0,
            conveyance: record.conveyance || 0,
            specialAllowance: record.specialAllowance || 0,
            grossSalary: record.grossSalary || 0,
            pfDeduction: record.pfDeduction || 0,
            esiDeduction: record.esiDeduction || 0,
            advanceDeduction: record.advanceDeduction || 0
        }
    });

    const watched = useWatch({ control: form.control });
    const currentGross = (Number(watched.basicSalary) || 0) + (Number(watched.hra) || 0) + (Number(watched.conveyance) || 0) + (Number(watched.specialAllowance) || 0);
    const currentNet = currentGross - (Number(watched.pfDeduction) || 0) - (Number(watched.esiDeduction) || 0) - (Number(watched.advanceDeduction) || 0);

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-2xl p-0 overflow-hidden border-none shadow-3xl bg-white rounded-3xl">
                <DialogHeader className="p-6 bg-slate-900 text-white">
                    <DialogTitle className="text-xl font-black uppercase italic">Correct Payroll Node</DialogTitle>
                    <DialogDescription className="text-blue-300 font-bold text-[9px] uppercase tracking-widest mt-1">Manual adjustment for {record.employeeName}</DialogDescription>
                </DialogHeader>
                <div className="p-8">
                    <Form {...form}>
                        <form onSubmit={form.handleSubmit((v) => onSave({...v, grossSalary: currentGross}))} className="space-y-8">
                            <div className="grid grid-cols-2 gap-6">
                                <FormField name="basicSalary" control={form.control} render={({ field }) => (<FormItem><FormLabel className="text-[10px] font-black uppercase text-slate-400">Basic Salary</FormLabel><FormControl><Input type="number" {...field} className="h-11 font-bold" /></FormControl></FormItem>)} />
                                <FormField name="hra" control={form.control} render={({ field }) => (<FormItem><FormLabel className="text-[10px] font-black uppercase text-slate-400">HRA</FormLabel><FormControl><Input type="number" {...field} className="h-11 font-bold" /></FormControl></FormItem>)} />
                                <FormField name="conveyance" control={form.control} render={({ field }) => (<FormItem><FormLabel className="text-[10px] font-black uppercase text-slate-400">Conveyance</FormLabel><FormControl><Input type="number" {...field} className="h-11 font-bold" /></FormControl></FormItem>)} />
                                <FormField name="specialAllowance" control={form.control} render={({ field }) => (<FormItem><FormLabel className="text-[10px] font-black uppercase text-slate-400">Special Allowance</FormLabel><FormControl><Input type="number" {...field} className="h-11 font-bold" /></FormControl></FormItem>)} />
                                <FormField name="pfDeduction" control={form.control} render={({ field }) => (<FormItem><FormLabel className="text-[10px] font-black uppercase text-orange-600">PF Deduction</FormLabel><FormControl><Input type="number" {...field} className="h-11 font-bold border-orange-100" /></FormControl></FormItem>)} />
                                <FormField name="esiDeduction" control={form.control} render={({ field }) => (<FormItem><FormLabel className="text-[10px] font-black uppercase text-orange-600">ESI Deduction</FormLabel><FormControl><Input type="number" {...field} className="h-11 font-bold border-orange-100" /></FormControl></FormItem>)} />
                                <FormField name="advanceDeduction" control={form.control} render={({ field }) => (<FormItem><FormLabel className="text-[10px] font-black uppercase text-red-600">Advance Ded.</FormLabel><FormControl><Input type="number" {...field} className="h-11 font-bold border-red-100" /></FormControl></FormItem>)} />
                            </div>
                            <div className="bg-slate-50 p-6 rounded-2xl flex justify-between items-center shadow-inner">
                                <div className="space-y-1"><span className="text-[9px] font-black uppercase text-slate-400 block">Gross Amount</span><p className="text-xl font-black text-slate-900">₹ {currentGross.toLocaleString()}</p></div>
                                <div className="text-right space-y-1"><span className="text-[9px] font-black uppercase text-blue-600 block">Corrected Net Payable</span><p className="text-2xl font-black text-blue-900">₹ {Math.max(0, currentNet).toLocaleString()}</p></div>
                            </div>
                            <DialogFooter className="pt-6 border-t flex-row justify-end gap-3">
                                <Button type="button" variant="ghost" onClick={onClose} className="font-bold text-slate-400">Discard</Button>
                                <Button type="submit" className="bg-blue-900 hover:bg-slate-900 text-white px-10 h-11 rounded-xl font-black uppercase text-[10px] tracking-widest shadow-xl border-none">Save Correction</Button>
                            </DialogFooter>
                        </form>
                    </Form>
                </div>
            </DialogContent>
        </Dialog>
    );
}

function SalarySlipModal({ isOpen, onClose, record, firm, employee }: { isOpen: boolean, onClose: () => void, record: any, firm: any, employee: any }) {
    if (!record || !firm || !employee) return null;
    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-4xl p-0 overflow-hidden border-none shadow-3xl bg-white rounded-[2rem]">
                <div className="p-10 space-y-10">
                    <header className="flex justify-between items-start border-b-2 border-slate-900 pb-6">
                        <div className="flex items-center gap-6">
                            <div className="h-20 w-20 border border-slate-200 rounded-xl flex items-center justify-center p-2 bg-white shadow-inner overflow-hidden">
                                {firm.logoUrl ? (
                                    <Image src={firm.logoUrl} alt={firm.name} width={64} height={64} className="object-contain" unoptimized />
                                ) : (
                                    <Building2 className="h-10 w-10 text-slate-300" />
                                )}
                            </div>
                            <div className="space-y-1">
                                <h2 className="text-2xl font-black uppercase text-slate-900 italic tracking-tighter">{firm.name}</h2>
                                <p className="text-xs font-bold text-slate-500 uppercase">{firm.address}</p>
                                <p className="text-[10px] font-black text-blue-600 uppercase tracking-widest">{firm.email} | {firm.mobile}</p>
                            </div>
                        </div>
                        <div className="text-right">
                            <Badge className="bg-slate-900 text-white font-black uppercase tracking-[0.3em] px-6 py-1.5 border-none shadow-xl mb-4">Salary Slip</Badge>
                            <p className="text-[10px] font-black uppercase text-slate-400">Month Registry: {format(new Date(record.month), 'MMMM yyyy').toUpperCase()}</p>
                        </div>
                    </header>

                    <div className="grid grid-cols-2 gap-12 bg-slate-50/50 p-8 rounded-[2rem] border border-slate-100">
                        <div className="space-y-4">
                            <h3 className="text-[10px] font-black uppercase text-slate-400 border-b pb-1 tracking-widest">Employee Details</h3>
                            <div className="grid grid-cols-2 gap-y-3 gap-x-6 text-[11px] font-bold uppercase">
                                <span className="text-slate-400">ID Node:</span> <span className="text-blue-900 font-black">{employee.empId}</span>
                                <span className="text-slate-400">Name:</span> <span className="text-slate-900">{employee.name}</span>
                                <span className="text-slate-400">Designation:</span> <span className="text-slate-900">{employee.designation}</span>
                                <span className="text-slate-400">PAN:</span> <span className="text-slate-900 font-mono">{employee.pan}</span>
                            </div>
                        </div>
                        <div className="space-y-4">
                            <h3 className="text-[10px] font-black uppercase text-slate-400 border-b pb-1 tracking-widest">Attendance Registry</h3>
                            <div className="grid grid-cols-2 gap-y-3 gap-x-6 text-[11px] font-bold uppercase">
                                <span className="text-slate-400">Working Days:</span> <span className="text-slate-900">{record.workingDays}</span>
                                <span className="text-slate-400">Attendance:</span> <span className="text-emerald-600 font-black">{record.totalAttendance}</span>
                                <span className="text-slate-400">Absents:</span> <span className="text-red-600 font-black">{record.absentDays}</span>
                            </div>
                        </div>
                    </div>

                    <div className="border-2 border-slate-900 rounded-3xl overflow-hidden">
                        <Table>
                            <TableHeader className="bg-slate-900 text-white">
                                <TableRow className="hover:bg-transparent border-none">
                                    <TableHead className="text-[10px] font-black uppercase text-white px-8 h-10">Earnings Breakdown</TableHead>
                                    <TableHead className="text-[10px] font-black uppercase text-white px-8 text-right h-10">Amount (₹)</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                <TableRow className="h-10 border-b border-slate-100 font-bold text-xs"><TableCell className="px-8">Basic Salary</TableCell><TableCell className="px-8 text-right">{(record.basicSalary || 0).toLocaleString()}</TableCell></TableRow>
                                <TableRow className="h-10 border-b border-slate-100 font-bold text-xs"><TableCell className="px-8">HRA</TableCell><TableCell className="px-8 text-right">{(record.hra || 0).toLocaleString()}</TableCell></TableRow>
                                <TableRow className="h-10 border-b border-slate-100 font-bold text-xs"><TableCell className="px-8">Allowances</TableCell><TableCell className="px-8 text-right">{((record.conveyance || 0) + (record.specialAllowance || 0)).toLocaleString()}</TableCell></TableRow>
                                <TableRow className="h-10 bg-slate-50 font-black text-xs uppercase"><TableCell className="px-8">Gross Salary Node</TableCell><TableCell className="px-8 text-right text-blue-900">₹ {(record.grossSalary || 0).toLocaleString()}</TableCell></TableRow>
                                <TableRow className="h-10 border-b border-slate-100 text-red-600 font-bold text-xs italic"><TableCell className="px-8">PF / ESI / Advance Deductions</TableCell><TableCell className="px-8 text-right">- {((record.pfDeduction || 0) + (record.esiDeduction || 0) + (record.advanceDeduction || 0)).toLocaleString()}</TableCell></TableRow>
                                <TableRow className="h-14 bg-slate-900 text-white font-black uppercase tracking-widest"><TableCell className="px-8 text-sm">Net Payable (Registry Final)</TableCell><TableCell className="px-8 text-right text-2xl tracking-tighter text-blue-400">₹ {(record.netSalary || 0).toLocaleString()}</TableCell></TableRow>
                            </TableBody>
                        </Table>
                    </div>

                    <div className="grid grid-cols-2 gap-20 pt-16">
                        <div className="text-center border-t-2 border-slate-900 border-dashed pt-2"><p className="text-[10px] font-black uppercase text-slate-900">Receiver Signature</p></div>
                        <div className="text-center border-t-2 border-slate-900 border-dashed pt-2"><p className="text-[10px] font-black uppercase text-slate-900">Accountant Signature</p></div>
                    </div>
                </div>
                <DialogFooter className="bg-slate-50 p-6 flex justify-end gap-3">
                    <Button variant="ghost" onClick={onClose} className="font-bold text-slate-400 uppercase text-[10px]">Close Manifest</Button>
                    <Button onClick={() => window.print()} className="bg-blue-900 text-white font-black uppercase text-[10px] px-8 h-10 shadow-lg">Print Slip</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

function PayActionModal({ isOpen, onClose, record, onSave }: { isOpen: boolean, onClose: () => void, record: any, onSave: (v: any) => void }) {
    const remainingBalance = (record.netSalary || 0) - (record.paidAmount || 0);
    const form = useForm({
        resolver: zodResolver(z.object({
            amount: z.coerce.number().positive().max(remainingBalance + 0.01, "Payment cannot exceed outstanding balance."),
            date: z.date({ required_error: "Date mandatory." })
        })),
        defaultValues: { amount: Number(remainingBalance.toFixed(2)), date: new Date() }
    });
    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-md p-0 overflow-hidden rounded-3xl border-none shadow-3xl bg-white">
                <DialogHeader className="p-6 bg-emerald-600 text-white">
                    <DialogTitle className="text-xl font-black uppercase">Liquidate Salary</DialogTitle>
                    <DialogDescription className="text-emerald-100 font-bold uppercase text-[9px] mt-1">Recording payment node for {record.employeeName}</DialogDescription>
                </DialogHeader>
                <div className="p-8 space-y-6">
                    <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex justify-between items-center">
                        <span className="text-[10px] font-black uppercase text-slate-400">Total Outstanding</span>
                        <span className="text-lg font-black text-blue-900">₹ {remainingBalance.toLocaleString()}</span>
                    </div>
                    <Form {...form}>
                        <form onSubmit={form.handleSubmit(onSave)} className="space-y-6">
                            <FormField name="amount" control={form.control} render={({ field }) => (
                                <FormItem>
                                    <FormLabel className="text-[10px] font-black uppercase">Disbursed Amount (₹) *</FormLabel>
                                    <FormControl><Input type="number" step="0.01" {...field} className="h-12 rounded-xl font-black text-xl text-blue-900 shadow-inner" /></FormControl>
                                    <FormMessage className="text-[10px] font-bold" />
                                </FormItem>
                            )} />
                            <FormField name="date" control={form.control} render={({ field }) => (
                                <FormItem className="flex flex-col">
                                    <FormLabel className="text-[10px] font-black uppercase">Payment Date *</FormLabel>
                                    <FormControl>
                                        <div className="h-12 border border-slate-200 rounded-xl px-4 flex items-center bg-white shadow-sm">
                                            <DatePicker date={field.value} setDate={field.onChange} className="w-full border-none shadow-none p-0 h-10" />
                                        </div>
                                    </FormControl>
                                </FormItem>
                            )} />
                            <DialogFooter className="pt-6 border-t flex-row justify-end gap-3">
                                <Button type="button" variant="ghost" onClick={onClose} className="font-bold text-slate-400">Cancel</Button>
                                <Button type="submit" className="bg-emerald-600 hover:bg-emerald-700 text-white font-black uppercase text-[10px] tracking-widest h-11 px-8 rounded-xl shadow-lg border-none">Post Payment</Button>
                            </DialogFooter>
                        </form>
                    </Form>
                </div>
            </DialogContent>
        </Dialog>
    );
}

function AdvanceSalaryTab({ employees, isAdmin }: { employees: any[], isAdmin: boolean }) {
    const firestore = useFirestore();
    const { toast } = useToast();
    const { showLoader, hideLoader } = useLoading();
    const [isAddOpen, setIsAddOpen] = useState(false);
    const [advances, setAdvances] = useState<any[]>([]);
    const [month, setMonth] = useState('');
    const [payModal, setPayModal] = useState<any | null>(null);
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        setMonth(format(new Date(), 'yyyy-MM'));
    }, []);

    useEffect(() => {
        if (!firestore) return;
        const q = query(collection(firestore, "advanceSalary"), orderBy("createdAt", "desc"));
        const unsub = onSnapshot(q, (snap) => {
            setAdvances(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        });
        return () => unsub();
    }, [firestore]);

    const filtered = useMemo(() => advances.filter(a => {
        const matchesMonth = a.month === month || format(a.createdAt?.toDate?.() || new Date(a.createdAt), 'yyyy-MM') === month;
        if (!matchesMonth) return false;
        
        if (!searchTerm) return true;
        const s = searchTerm.toLowerCase();
        return a.employeeName?.toLowerCase().includes(s) || (a.employeeId && a.employeeId.toLowerCase().includes(s));
    }), [advances, month, searchTerm]);

    const handlePay = async (values: any) => {
        if (!firestore || !payModal) return;
        
        if (values.amount > (payModal.balance + 0.01)) {
            toast({ variant: 'destructive', title: 'Violation', description: 'Payment exceeds outstanding advance balance.' });
            return;
        }

        showLoader();
        try {
            const newTotalPaid = (payModal.paidAmount || 0) + Number(values.amount);
            const nextStatus = newTotalPaid >= (payModal.amount - 0.01) ? 'Paid' : 'Pending';

            await updateDoc(doc(firestore, "advanceSalary", payModal.id), {
                paidAmount: newTotalPaid,
                paidDate: values.date,
                balance: Math.max(0, payModal.amount - newTotalPaid),
                status: nextStatus,
                payments: arrayUnion({ amount: Number(values.amount), date: values.date })
            });
            toast({ title: 'Success', description: 'Advance repayment recorded.' });
            setPayModal(null);
        } catch (e: any) {
            toast({ variant: 'destructive', title: 'Error', description: e.message });
        } finally {
            hideLoader();
        }
    };

    return (
        <div className="space-y-8">
            <Card className="border-none shadow-xl rounded-3xl bg-white overflow-hidden">
                <CardHeader className="bg-slate-50 border-b p-8 flex flex-col md:flex-row md:items-end justify-between gap-8">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-blue-900 text-white rounded-lg shadow-lg rotate-3"><CreditCard className="h-6 w-6" /></div>
                        <div>
                            <CardTitle className="text-lg font-black uppercase">Salary Advance Ledger</CardTitle>
                            <CardDescription className="text-[10px] font-bold uppercase tracking-widest">Track employee loans and salary prepayments</CardDescription>
                        </div>
                    </div>
                    <div className="flex flex-wrap gap-4 items-end">
                        <div className="grid gap-1.5">
                            <label className="text-[10px] font-black uppercase text-slate-400">Search Registry</label>
                            <div className="relative group">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 group-focus-within:text-blue-900 transition-colors" />
                                <Input 
                                    placeholder="Search Employee..." 
                                    value={searchTerm} 
                                    onChange={e => setSearchTerm(e.target.value)} 
                                    className="pl-10 h-10 w-[240px] rounded-xl border-slate-200 font-bold" 
                                />
                            </div>
                        </div>
                        <div className="grid gap-1.5">
                            <label className="text-[10px] font-black uppercase text-slate-400">Month Filter</label>
                            <Input type="month" value={month} onChange={e => setMonth(e.target.value)} className="h-10 w-40" />
                        </div>
                        <Button onClick={() => setIsAddOpen(true)} className="bg-blue-900 hover:bg-slate-900 gap-2 uppercase font-black text-[10px] h-10 px-6 shadow-md border-none rounded-xl">
                            <Plus className="h-4 w-4" /> Add Advance Node
                        </Button>
                    </div>
                </CardHeader>
                <CardContent className="p-0">
                    <div className="overflow-x-auto">
                        <Table>
                            <TableHeader>
                                <TableRow className="text-[10px] font-black uppercase border-b bg-slate-50/50 h-12">
                                    <TableHead className="px-8">Employee</TableHead>
                                    <TableHead className="text-center">Request Date</TableHead>
                                    <TableHead className="text-right">Advance (₹)</TableHead>
                                    <TableHead className="text-center">Paid Date</TableHead>
                                    <TableHead className="text-right text-emerald-600">Paid Amt (₹)</TableHead>
                                    <TableHead className="text-right text-red-600">Balance (₹)</TableHead>
                                    <TableHead className="text-center">Status</TableHead>
                                    <TableHead className="text-right px-8">Action</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filtered.length === 0 ? (
                                    <TableRow><TableCell colSpan={8} className="h-48 text-center text-slate-400 italic">No advance nodes recorded.</TableCell></TableRow>
                                ) : (
                                    filtered.map(a => (
                                        <TableRow key={a.id} className="h-14 hover:bg-slate-50 border-b">
                                            <TableCell className="px-8 font-bold text-xs uppercase">{a.employeeName}</TableCell>
                                            <TableCell className="text-center text-[10px]">{format(a.date.toDate ? a.date.toDate() : new Date(a.date), 'dd/MM/yy')}</TableCell>
                                            <TableCell className="text-right">
                                                <TooltipProvider>
                                                    <Tooltip>
                                                        <TooltipTrigger asChild>
                                                            <span className="font-black cursor-help decoration-blue-200 underline underline-offset-4 decoration-dashed">
                                                                ₹ {(a.amount || 0).toLocaleString()}
                                                            </span>
                                                        </TooltipTrigger>
                                                        <TooltipContent className="bg-slate-900 text-white p-3 border-none shadow-2xl rounded-xl">
                                                            <div className="flex items-start gap-3">
                                                                <Info className="h-4 w-4 text-blue-400 shrink-0" />
                                                                <div>
                                                                    <p className="text-[9px] font-black uppercase text-slate-400 tracking-widest mb-1">Deduction Justification</p>
                                                                    <p className="text-xs font-medium italic">"{a.reason || 'N/A'}"</p>
                                                                </div>
                                                            </div>
                                                        </TooltipContent>
                                                    </Tooltip>
                                                </TooltipProvider>
                                            </TableCell>
                                            <TableCell className="text-center text-[10px] font-bold text-slate-400 italic">
                                                {a.paidDate ? format(a.paidDate.toDate ? a.paidDate.toDate() : new Date(a.paidDate), 'dd/MM/yy') : '--'}
                                            </TableCell>
                                            <TableCell className="text-right font-black text-emerald-600">₹ {(a.paidAmount || 0).toLocaleString()}</TableCell>
                                            <TableCell className="text-right font-black text-red-600">₹ {(a.balance || 0).toLocaleString()}</TableCell>
                                            <TableCell className="text-center"><Badge variant="outline" className={cn("uppercase font-black text-[9px]", a.status === 'Paid' ? 'bg-emerald-600 text-white border-none' : 'bg-red-50 text-red-700 border-red-100')}>{a.status}</Badge></TableCell>
                                            <TableCell className="px-8 text-right space-x-2">
                                                <div className="flex justify-end gap-2">
                                                    {a.status !== 'Paid' && (
                                                        <Button variant="ghost" size="icon" className="h-8 w-8 text-emerald-600 hover:bg-emerald-50" onClick={() => setPayModal(a)}>
                                                            <CheckCircle2 className="h-4 w-4" />
                                                        </Button>
                                                    )}
                                                    {isAdmin && (
                                                        <>
                                                            <Button variant="ghost" size="icon" className="h-8 w-8 text-blue-600 hover:bg-blue-50" onClick={() => {}}><Edit2 className="h-4 w-4" /></Button>
                                                            <AlertDialog>
                                                                <AlertDialogTrigger asChild>
                                                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-red-600 hover:bg-red-50">
                                                                        <Trash2 className="h-4 w-4" />
                                                                    </Button>
                                                                </AlertDialogTrigger>
                                                                <AlertDialogContent className="border-none shadow-3xl p-0 overflow-hidden bg-white">
                                                                    <AlertDialogHeader className="p-8 bg-red-50 border-b border-red-100 flex flex-row items-center gap-5 space-y-0">
                                                                        <div className="bg-red-600 p-3 rounded-2xl shadow-xl">
                                                                            <ShieldAlert className="h-8 w-8 text-white" />
                                                                        </div>
                                                                        <div className="text-left">
                                                                            <AlertDialogTitle className="text-xl font-black text-red-900 uppercase tracking-tight leading-none">Security Registry Purge</AlertDialogTitle>
                                                                            <AlertDialogDescription className="text-red-700 font-bold uppercase text-[9px] mt-2 tracking-widest">Authorized Deletion Handshake Required</AlertDialogDescription>
                                                                        </div>
                                                                    </AlertDialogHeader>
                                                                    <div className="p-10 space-y-6">
                                                                        <div className="grid grid-cols-2 gap-4 p-6 bg-slate-50 rounded-2xl border border-slate-200">
                                                                            <div className="space-y-1"><p className="text-[9px] font-black uppercase text-slate-400">Employee</p><p className="font-black text-slate-900">{a.employeeName}</p></div>
                                                                            <div className="space-y-1"><p className="text-[9px] font-black uppercase text-slate-400">Registry Amt</p><p className="font-bold text-blue-700">₹ {a.amount.toLocaleString()}</p></div>
                                                                        </div>
                                                                        <div className="p-5 bg-amber-50 rounded-2xl border border-amber-100 flex items-start gap-4 shadow-sm">
                                                                            <AlertTriangle className="h-6 w-6 text-amber-600 shrink-0 mt-0.5" />
                                                                            <p className="text-[10px] font-bold text-amber-800 leading-normal uppercase">Warning: This action is permanent and logged.</p>
                                                                        </div>
                                                                    </div>
                                                                    <AlertDialogFooter className="p-6 bg-slate-50 border-t flex-row justify-end gap-3">
                                                                        <AlertDialogCancel className="font-bold border-slate-200">Abort</AlertDialogCancel>
                                                                        <AlertDialogAction onClick={async () => await deleteDoc(doc(firestore!, "advanceSalary", a.id))} className="bg-red-600 text-white font-black uppercase text-[10px] px-10 border-none">Execute Purge</AlertDialogAction>
                                                                    </AlertDialogFooter>
                                                                </AlertDialogContent>
                                                            </AlertDialog>
                                                        </>
                                                    )}
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>

            <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
                <DialogContent className="max-w-md rounded-3xl border-none shadow-3xl p-0 overflow-hidden bg-white">
                    <DialogHeader className="bg-slate-900 p-6 text-white">
                        <DialogTitle className="text-xl font-black uppercase italic">New Advance Node</DialogTitle>
                        <DialogDescription className="text-blue-300 text-[10px] font-bold uppercase tracking-widest mt-1">Record and authorize salary prepayment</DialogDescription>
                    </DialogHeader>
                    <div className="p-8"><AdvanceForm employees={employees} onSuccess={() => setIsAddOpen(false)} /></div>
                </DialogContent>
            </Dialog>

            {payModal && (
                <AdvancePayModal isOpen={!!payModal} onClose={() => setPayModal(null)} record={payModal} onSave={handlePay} />
            )}
        </div>
    );
}

function AdvanceForm({ employees, onSuccess }: { employees: any[], onSuccess: () => void }) {
    const firestore = useFirestore();
    const { user } = useUser();
    const { toast } = useToast();
    
    const form = useForm({
        resolver: zodResolver(z.object({
            employeeId: z.string().min(1, 'Employee mandatory.'),
            amount: z.coerce.number().positive('Amount mandatory.'),
            reason: z.string().min(1, 'Reason mandatory.'),
            date: z.date({ required_error: 'Date mandatory.' })
        })),
        defaultValues: { employeeId: '', amount: 0, reason: '', date: new Date() }
    });

    const onSubmit = async (values: any) => {
        if (!firestore) return;
        try {
            const emp = employees.find(e => e.id === values.employeeId);
            if (!emp || emp.name === 'Unknown') {
                toast({ variant: 'destructive', title: 'Registry Error', description: 'Invalid employee node selected.' });
                return;
            }
            const isAdmin = user?.email === 'sikkaind.admin@sikka.com' || user?.email === 'sikkalmcg@gmail.com';
            const currentName = isAdmin ? 'AJAY SOMRA' : (user?.displayName || user?.email?.split('@')[0] || 'System');

            await addDoc(collection(firestore, "advanceSalary"), {
                ...values,
                employeeName: emp.name,
                balance: values.amount,
                paidAmount: 0,
                approvedBy: currentName,
                status: 'Pending',
                createdAt: serverTimestamp()
            });
            toast({ title: 'Success', description: 'Advance record committed.' });
            onSuccess();
        } catch (e: any) {
            toast({ variant: 'destructive', title: 'Error', description: e.message });
        }
    };

    return (
        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <FormField name="employeeId" control={form.control} render={({ field }) => (
                    <FormItem>
                        <FormLabel className="text-[10px] font-black uppercase text-slate-400">Employee Registry *</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl><SelectTrigger className="h-11 font-bold"><SelectValue placeholder="Select Employee" /></SelectTrigger></FormControl>
                            <SelectContent className="rounded-xl">
                                {employees.map(e => <SelectItem key={e.id} value={e.id} className="font-bold py-2.5 uppercase text-xs">{e.name}</SelectItem>)}
                            </SelectContent>
                        </Select>
                        <FormMessage />
                    </FormItem>
                )} />
                <FormField name="amount" control={form.control} render={({ field }) => (<FormItem><FormLabel className="text-[10px] font-black uppercase text-slate-400">Advance Amount (₹) *</FormLabel><FormControl><Input type="number" {...field} className="h-11 font-black text-lg" /></FormControl><FormMessage /></FormItem>)} />
                <FormField name="reason" control={form.control} render={({ field }) => (<FormItem><FormLabel className="text-[10px] font-black uppercase text-slate-400">Purpose / Reason *</FormLabel><FormControl><Input {...field} className="h-11 font-medium" /></FormControl><FormMessage /></FormItem>)} />
                <FormField name="date" control={form.control} render={({ field }) => (
                    <FormItem className="flex flex-col"><FormLabel className="text-[10px] font-black uppercase text-slate-400">Date *</FormLabel><FormControl><DatePicker date={field.value} setDate={(d) => field.onChange(d || new Date())} /></FormControl><FormMessage /></FormItem>
                )} />
                <div className="flex gap-3 justify-end pt-4 border-t">
                    <Button variant="ghost" type="button" onClick={onSuccess}>Discard</Button>
                    <Button type="submit" className="bg-blue-900 hover:bg-slate-900 px-8 h-11 font-black uppercase text-[10px] shadow-lg border-none">Commit Advance</Button>
                </div>
            </form>
        </Form>
    );
}

function AdvancePayModal({ isOpen, onClose, record, onSave }: { isOpen: boolean, onClose: () => void, record: any, onSave: (v: any) => void }) {
    const rem = (record.balance || 0);
    const form = useForm({ 
        resolver: zodResolver(z.object({
            amount: z.coerce.number().positive().max(rem + 0.01, "Payment exceeds outstanding balance."),
            date: z.date({ required_error: "Date required." })
        })),
        defaultValues: { amount: Number(rem.toFixed(2)), date: new Date() } 
    });
    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-md p-0 overflow-hidden rounded-3xl border-none shadow-3xl bg-white">
                <DialogHeader className="bg-emerald-600 p-6 text-white">
                    <DialogTitle className="text-xl font-black uppercase">Liquidate Advance</DialogTitle>
                    <DialogDescription className="text-emerald-100 font-bold uppercase text-[9px] mt-1">Recording partial or full advance return</DialogDescription>
                </DialogHeader>
                <div className="p-8">
                    <Form {...form}>
                        <form onSubmit={form.handleSubmit(onSave)} className="space-y-6">
                            <FormField name="amount" control={form.control} render={({ field }) => (
                                <FormItem>
                                    <FormLabel className="text-[10px] font-black uppercase">Paid Amount (₹) *</FormLabel>
                                    <FormControl><Input type="number" step="0.01" {...field} className="h-12 rounded-xl font-black text-xl text-blue-900 shadow-inner" /></FormControl>
                                    <FormMessage className="text-[10px] font-bold" />
                                </FormItem>
                            )} />
                            <FormField name="date" control={form.control} render={({ field }) => (
                                <FormItem className="flex flex-col">
                                    <FormLabel className="text-[10px] font-black uppercase">Payment Date *</FormLabel>
                                    <FormControl>
                                        <div className="h-12 border border-slate-200 rounded-xl px-4 flex items-center bg-white shadow-sm">
                                            <DatePicker date={field.value} setDate={field.onChange} className="w-full border-none shadow-none p-0 h-10" />
                                        </div>
                                    </FormControl>
                                </FormItem>
                            )} />
                            <DialogFooter className="pt-6 border-t flex-row justify-end gap-3">
                                <Button type="button" variant="ghost" onClick={onClose} className="font-bold text-slate-400">Cancel</Button>
                                <Button type="submit" className="bg-emerald-600 hover:bg-emerald-700 text-white font-black uppercase text-[10px] h-11 px-8 rounded-xl shadow-lg border-none">Confirm Payment</Button>
                            </DialogFooter>
                        </form>
                    </Form>
                </div>
            </DialogContent>
        </Dialog>
    );
}

function HistoryLedgerTab({ employees, isAdmin }: { employees: any[], isAdmin: boolean }) {
    const firestore = useFirestore();
    const [month, setMonth] = useState('');
    const [selectedEmpId, setSelectedEmpId] = useState('all');
    const [payrollHistory, setPayrollHistory] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        setMonth(format(subMonths(new Date(), 1), 'yyyy-MM'));
    }, []);

    useEffect(() => {
        if (!firestore || !month) return;
        setIsLoading(true);
        let q = query(collection(firestore, "payrollRecords"), where("month", "==", month));
        const unsub = onSnapshot(q, (snap) => {
            let data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            if (selectedEmpId !== 'all') data = data.filter(r => r.employeeId === selectedEmpId);
            setPayrollHistory(data);
            setIsLoading(false);
        });
        return () => unsub();
    }, [firestore, month, selectedEmpId]);

    const handleExport = () => {
        const ws = XLSX.utils.json_to_sheet(payrollHistory.map(r => ({
            'Employee ID': employees.find(e => e.id === r.employeeId)?.empId || '--',
            'Employee Entity': r.employeeName,
            'Working Date': r.month,
            'Total Attendance': r.totalAttendance,
            'Advance Leave': r.absentDays,
            'Net Gross Salary': r.grossSalary,
            'ESI': r.esiDeduction,
            'PF': r.pfDeduction,
            'Net Salary': r.netSalary,
            'Advance': r.advanceDeduction,
            'Paid Salary': r.paidAmount || 0,
            'Paid Date': r.paidDate ? format(new Date(r.paidDate), 'dd/MM/yyyy') : '--',
            'Balance Salary': Math.max(0, r.netSalary - (r.paidAmount || 0))
        })));
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "PayrollHistory");
        XLSX.writeFile(wb, `ZEMP_History_${month}.xlsx`);
    };

    return (
        <div className="space-y-8">
            <Card className="border-none shadow-xl rounded-3xl bg-white overflow-hidden">
                <CardHeader className="bg-slate-50 border-b p-8 flex wrap items-end gap-10">
                    <div className="flex items-center gap-3">
                        <History className="h-6 w-6 text-blue-900" />
                        <CardTitle className="text-lg font-black uppercase">Corporate Payroll Ledger</CardTitle>
                    </div>
                    <div className="flex gap-6 items-end">
                        <div className="grid gap-1.5">
                            <label className="text-[10px] font-black uppercase text-slate-400">Period Registry</label>
                            <Input type="month" value={month} onChange={e => setMonth(e.target.value)} className="h-10 w-40" />
                        </div>
                        <div className="grid gap-1.5">
                            <label className="text-[10px] font-black uppercase text-slate-400">Employee Entity</label>
                            <Select value={selectedEmpId} onValueChange={setSelectedEmpId}>
                                <SelectTrigger className="h-10 w-[240px] font-bold"><SelectValue placeholder="All Personnel" /></SelectTrigger>
                                <SelectContent className="rounded-xl">
                                    <SelectItem value="all">ALL ACTIVE STAFF</SelectItem>
                                    {employees?.map(e => <SelectItem key={e.id} value={e.id} className="uppercase text-[11px] font-black">{e.name}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                        <Button onClick={handleExport} variant="outline" className="h-10 px-6 font-black uppercase text-[10px] border-slate-200 text-blue-900 gap-2 rounded-xl">
                            <FileDown className="h-4 w-4" /> Export Excel
                        </Button>
                    </div>
                </CardHeader>
                <CardContent className="p-0">
                    <div className="overflow-x-auto">
                        <Table className="min-w-[1800px]">
                            <TableHeader>
                                <TableRow className="text-[9px] font-black uppercase border-b bg-slate-50/50 h-12">
                                    <TableHead className="px-8">Employee ID</TableHead>
                                    <TableHead>Employee Entity</TableHead>
                                    <TableHead className="text-center">Working Date</TableHead>
                                    <TableHead className="text-center">Total Attendance</TableHead>
                                    <TableHead className="text-center">Advance Leave</TableHead>
                                    <TableHead className="text-right">Net Gross Salary</TableHead>
                                    <TableHead className="text-right">ESI</TableHead>
                                    <TableHead className="text-right">PF</TableHead>
                                    <TableHead className="text-right font-black">Net Salary</TableHead>
                                    <TableHead className="text-right text-red-600">Advance</TableHead>
                                    <TableHead className="text-right text-emerald-600 font-black">Paid Salary</TableHead>
                                    <TableHead className="text-center">Paid Date</TableHead>
                                    <TableHead className="text-right px-8">Action</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {payrollHistory.map(r => {
                                    const emp = employees.find(e => e.id === r.employeeId);
                                    return (
                                        <TableRow key={r.id} className="h-14 hover:bg-slate-50 border-b text-[11px]">
                                            <TableCell className="px-8 font-black text-blue-700">{emp?.empId || '--'}</TableCell>
                                            <TableCell className="font-bold uppercase">{r.employeeName}</TableCell>
                                            <TableCell className="text-center">{r.month}</TableCell>
                                            <TableCell className="text-center font-black">{r.totalAttendance}</TableCell>
                                            <TableCell className="text-center font-black text-red-600">{r.absentDays}</TableCell>
                                            <TableCell className="text-right">{(r.grossSalary || 0).toLocaleString()}</TableCell>
                                            <TableCell className="text-right text-orange-600">{(r.esiDeduction || 0).toLocaleString()}</TableCell>
                                            <TableCell className="text-right text-orange-600">{(r.pfDeduction || 0).toLocaleString()}</TableCell>
                                            <TableCell className="text-right font-black text-blue-900">{(r.netSalary || 0).toLocaleString()}</TableCell>
                                            <TableCell className="text-right text-red-600 font-black">{(r.advance_total || r.advanceDeduction || 0).toLocaleString()}</TableCell>
                                            <TableCell className="text-right text-emerald-600 font-black">{(r.paidAmount || 0).toLocaleString()}</TableCell>
                                            <TableCell className="text-center text-slate-400">{r.paidDate ? format(new Date(r.paidDate), 'dd/MM/yy') : '--'}</TableCell>
                                            <TableCell className="px-8 text-right">
                                                {isAdmin && (
                                                    <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                        <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-blue-600"><Edit2 className="h-4 w-4" /></Button>
                                                        <Button variant="ghost" size="icon" className="h-8 w-8 text-red-600 hover:bg-red-50" onClick={() => deleteDoc(doc(firestore!, "payrollRecords", r.id))}><Trash2 className="h-4 w-4" /></Button>
                                                    </div>
                                                )}
                                            </TableCell>
                                        </TableRow>
                                    );
                                })}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}