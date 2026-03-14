
'use client';

import { useEffect, useMemo } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { format } from 'date-fns';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import { Loader2, Truck, Briefcase, LayoutGrid, ShieldCheck, Factory, Save, Settings2, AlertCircle, Sparkles } from 'lucide-react';
import type { SubUser, WithId, Plant, JobRole } from '@/types';
import { JobRoles, UserStatuses, SikkaLogisticsPagePermissions, AdminPagePermissionsList, SikkaAccountsPagePermissions, rolePermissions } from '@/lib/constants';
import { useUser } from '@/firebase';
import { cn } from '@/lib/utils';
import { Label } from '@/components/ui/label';

const EMPTY_ARRAY: string[] = [];

const passwordRules = z.string()
  .min(8, "Minimum 8 characters required.")
  .max(18, "Maximum 18 characters allowed.")
  .regex(/[a-zA-Z]/, "Must contain letters.")
  .regex(/(?:.*\d){3,}/, "Must contain at least 3 numeric digits.")
  .regex(/[@#$%&*!]/, "Must contain at least 1 special character (@#$%&*!).");

const formSchema = z.object({
  fullName: z.string().min(1, 'Full Name is required'),
  jobRole: z.enum(JobRoles, { required_error: 'Job Role is required' }),
  countryCode: z.string().min(1, 'Country Code is required'),
  mobile: z.string().regex(/^\d{10}$/, 'Mobile number must be 10 digits.'),
  username: z.string().min(3, 'Username must be at least 3 characters').transform(v => v.trim()),
  status: z.enum(UserStatuses, { required_error: 'Status is required' }),
  password: z.string().optional().or(z.literal('')),
  access_logistics: z.boolean().default(false),
  access_accounts: z.boolean().default(false),
  permissions: z.array(z.string()).default([]),
  plantIds: z.array(z.string()).default([]),
  accounts_plant_ids: z.array(z.string()).default([]),
  defaultModule: z.enum(['Logistics', 'Accounts', 'Administration']).optional(),
}).superRefine((data, ctx) => {
  if (data.password && data.password.length > 0) {
    const result = passwordRules.safeParse(data.password);
    if (!result.success) {
      result.error.issues.forEach(issue => {
        ctx.addIssue({ ...issue, path: ['password'] });
      });
    }
  }
  if (data.access_logistics && data.plantIds.length === 0) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Selection of at least one Lifting Node is mandatory.',
      path: ['plantIds']
    });
  }
  if (data.access_accounts && data.accounts_plant_ids.length === 0) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Selection of at least one Billing Node is mandatory.',
      path: ['accounts_plant_ids']
    });
  }
});

type FormValues = z.infer<typeof formSchema>;

interface EditUserModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: WithId<SubUser>;
  onUserUpdated: (userId: string, data: Partial<SubUser>) => void;
  logisticsPlants: Plant[];
  accountsPlants: Plant[];
}

export default function EditUserModal({ isOpen, onClose, user, onUserUpdated, logisticsPlants, accountsPlants }: EditUserModalProps) {
  const { user: firebaseUser } = useUser();
  
  const isEditingSikkaind = user.username?.toLowerCase() === 'sikkaind';
  const isAdminSession = firebaseUser?.email === 'sikkaind.admin@sikka.com' || firebaseUser?.email === 'sikkalmcg@gmail.com';

  const selectableRoles = useMemo(() => JobRoles.filter(role => role !== 'Manager' && role !== 'Admin'), []);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      fullName: user.fullName,
      jobRole: user.jobRole,
      countryCode: user.countryCode || '+91',
      mobile: user.mobile,
      username: user.username,
      status: user.status,
      password: user.password || '',
      access_logistics: user.access_logistics,
      access_accounts: user.access_accounts,
      permissions: user.permissions || [],
      plantIds: user.plantIds || [],
      accounts_plant_ids: user.accounts_plant_ids || [],
      defaultModule: user.defaultModule || 'Logistics',
    },
  });

  const { watch, setValue, handleSubmit, control, reset, formState: { errors, isSubmitting } } = form;
  const accessLogistics = useWatch({ control, name: 'access_logistics' });
  const accessAccounts = useWatch({ control, name: 'access_accounts' });
  const permissions = useWatch({ control, name: 'permissions' }) || EMPTY_ARRAY;
  const authorizedPlantIds = useWatch({ control, name: 'plantIds' }) || EMPTY_ARRAY;
  const authorizedAccountPlantIds = useWatch({ control, name: 'accounts_plant_ids' }) || EMPTY_ARRAY;

  useEffect(() => {
    if (isOpen && user?.id) {
        reset({
            fullName: user.fullName,
            jobRole: user.jobRole,
            countryCode: user.countryCode || '+91',
            mobile: user.mobile,
            username: user.username,
            status: user.status,
            password: user.password || '',
            access_logistics: !!user.access_logistics,
            access_accounts: !!user.access_accounts,
            permissions: user.permissions || [],
            plantIds: user.plantIds || [],
            accounts_plant_ids: user.accounts_plant_ids || [],
            defaultModule: user.defaultModule || 'Logistics',
        });
    }
  }, [user.id, isOpen, reset]);

  const handleRoleChange = (val: JobRole) => {
    setValue('jobRole', val, { shouldDirty: true, shouldValidate: true });
    
    const perms = rolePermissions[val] || EMPTY_ARRAY;
    setValue('permissions', perms, { shouldDirty: true, shouldValidate: true });
    
    const logisticsRoles: JobRole[] = ['Shipment Planner', 'Vehicle Planner', 'Gate Security', 'Office Executive', 'Sub-User'];
    const accountsRoles: JobRole[] = ['Accountant'];
    
    if (logisticsRoles.includes(val)) setValue('access_logistics', true, { shouldDirty: true });
    else if (!isEditingSikkaind) setValue('access_logistics', false, { shouldDirty: true });

    if (accountsRoles.includes(val)) setValue('access_accounts', true, { shouldDirty: true });
    else if (!isEditingSikkaind) setValue('access_accounts', false, { shouldDirty: true });
  };

  const togglePermission = (permId: string) => {
    const next = permissions.includes(permId) 
        ? permissions.filter(id => id !== permId) 
        : [...permissions, permId];
    setValue('permissions', next, { shouldDirty: true, shouldValidate: true });
  };

  const togglePlant = (plantId: string, field: 'plantIds' | 'accounts_plant_ids') => {
    const current = watch(field) || [];
    const next = current.includes(plantId) ? current.filter(id => id !== plantId) : [...current, plantId];
    setValue(field, next, { shouldDirty: true, shouldValidate: true });
  };

  const onSubmit = (values: FormValues) => {
    onUserUpdated(user.id, values);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-5xl h-[90vh] flex flex-col p-0 border-none shadow-2xl overflow-hidden bg-[#f8fafc]">
             <DialogHeader className="p-6 bg-slate-900 text-white shrink-0">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-blue-600 rounded-lg"><ShieldCheck className="h-6 w-6" /></div>
                    <div>
                        <DialogTitle className="text-xl font-black uppercase tracking-tight italic">Security Profile: {user.fullName}</DialogTitle>
                        <DialogDescription className="text-blue-300 font-bold uppercase text-[9px] tracking-widest mt-1">
                            Identity Registry Modification Node
                        </DialogDescription>
                    </div>
                </div>
            </DialogHeader>

            <div className="flex-1 overflow-y-auto p-8 space-y-10">
                <Form {...form}>
                    <form className="space-y-10">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 bg-white p-8 rounded-3xl border border-slate-200 shadow-sm">
                            <FormField name="fullName" control={form.control} render={({ field }) => (<FormItem><FormLabel className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Full Name</FormLabel><FormControl><Input {...field} className="h-11 font-bold" /></FormControl><FormMessage /></FormItem>)} />
                            <FormField name="jobRole" control={form.control} render={({ field }) => (
                                <FormItem>
                                    <FormLabel className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Job Role</FormLabel>
                                    <Select onValueChange={handleRoleChange} value={field.value}>
                                        <FormControl><SelectTrigger className="h-11 font-bold"><SelectValue /></SelectTrigger></FormControl>
                                        <SelectContent className="rounded-xl">
                                            {isEditingSikkaind ? (
                                                <>
                                                    <SelectItem value="Manager" className="font-bold py-2.5">Manager</SelectItem>
                                                    <SelectItem value="Admin" className="font-bold py-2.5">Admin</SelectItem>
                                                </>
                                            ) : (
                                                selectableRoles.map(s => <SelectItem key={s} value={s} className="font-bold py-2.5">{s}</SelectItem>)
                                            )}
                                        </SelectContent>
                                    </Select>
                                    <FormMessage />
                                </FormItem>
                            )} />
                            
                            <div className="flex gap-2 items-end">
                                <FormField
                                    control={form.control}
                                    name="countryCode"
                                    render={({ field }) => (
                                        <FormItem className="w-24 shrink-0">
                                            <FormLabel className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Code</FormLabel>
                                            <Select onValueChange={field.onChange} value={field.value}>
                                                <FormControl>
                                                    <SelectTrigger className="h-11 font-bold">
                                                        <SelectValue placeholder="+91" />
                                                    </SelectTrigger>
                                                </FormControl>
                                                <SelectContent>
                                                    <SelectItem value="+91">+91 (IN)</SelectItem>
                                                    <SelectItem value="+33">+33 (FR)</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    name="mobile"
                                    control={form.control}
                                    render={({ field }) => (
                                        <FormItem className="flex-1">
                                            <FormLabel className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Mobile Number *</FormLabel>
                                            <FormControl><Input type="tel" {...field} className="h-11 rounded-xl font-bold" /></FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            </div>

                            <FormField name="username" control={form.control} render={({ field }) => (<FormItem><FormLabel className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Username</FormLabel><FormControl><Input {...field} readOnly className="h-11 bg-slate-50 font-black text-blue-900" /></FormControl></FormItem>)} />
                            <FormField name="password" control={form.control} render={({ field }) => (
                                <FormItem>
                                    <FormLabel className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Secure Password</FormLabel>
                                    <FormControl><Input type={isAdminSession ? "text" : "password"} {...field} className="h-11 font-mono" disabled={!isAdminSession} /></FormControl>
                                    <FormMessage className="text-[9px] font-bold" />
                                </FormItem>
                            )} />
                            <FormField name="status" control={form.control} render={({ field }) => (
                                <FormItem>
                                    <FormLabel className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Account Status</FormLabel>
                                    <Select onValueChange={field.onChange} value={field.value} disabled={isEditingSikkaind}>
                                        <FormControl><SelectTrigger className="h-11 font-bold"><SelectValue /></SelectTrigger></FormControl>
                                        <SelectContent className="rounded-xl">
                                            {UserStatuses.filter(s => s !== 'Blocked').map(s => <SelectItem key={s} value={s} className="font-bold py-2.5">{s}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                    <FormMessage />
                                </FormItem>
                            )} />

                            <FormField name="defaultModule" control={form.control} render={({ field }) => (
                                <FormItem>
                                <FormLabel className="text-[10px] font-black uppercase text-blue-600 tracking-widest flex items-center gap-2">
                                    <Sparkles className="h-3 w-3" /> Default Module
                                </FormLabel>
                                <Select onValueChange={field.onChange} value={field.value}>
                                    <FormControl><SelectTrigger className="h-11 rounded-xl font-bold border-blue-200 bg-blue-50/10"><SelectValue /></SelectTrigger></FormControl>
                                    <SelectContent className="rounded-xl">
                                        <SelectItem value="Logistics" className="font-bold py-2.5">Logistics Hub</SelectItem>
                                        <SelectItem value="Accounts" className="font-bold py-2.5">Accounts ERP</SelectItem>
                                        {(watch('jobRole') === 'Admin' || watch('jobRole') === 'Manager') && (
                                            <SelectItem value="Administration" className="font-bold py-2.5">Security Node</SelectItem>
                                        )}
                                    </SelectContent>
                                </Select>
                                </FormItem>
                            )} />
                        </div>

                        <Separator className="opacity-50" />
                        
                        <div className="space-y-8">
                            <h3 className="text-xl font-black text-slate-800 uppercase tracking-tight flex items-center gap-3 italic">
                                <LayoutGrid className="h-6 w-6 text-primary" /> Multi-Partition Authorization
                            </h3>
                            
                            <div className="p-8 border rounded-[2.5rem] space-y-12 bg-slate-100/50 shadow-inner">
                                
                                {/* LOGISTICS HUB PARTITION */}
                                <div className="space-y-8">
                                    <FormField control={form.control} name="access_logistics" render={({ field }) => (
                                        <FormItem className="flex items-center space-x-4 space-y-0 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm w-fit">
                                            <FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} className="h-5 w-5 data-[state=checked]:bg-blue-900 data-[state=checked]:border-blue-900" /></FormControl>
                                            <Label htmlFor="access_logistics_edit" className="!mt-0 font-black text-blue-900 uppercase tracking-widest text-sm flex items-center gap-3 cursor-pointer"><Truck className="h-5 w-5" /> Logistics Hub Access</Label>
                                        </FormItem>
                                    )} />
                                    {(accessLogistics || isEditingSikkaind) && (
                                        <div className="space-y-10 animate-in fade-in slide-in-from-left-4 duration-500 pl-10 border-l-4 border-blue-900/20">
                                            
                                            {/* OPERATIONAL MODULES */}
                                            <div className="space-y-4">
                                                <FormLabel className="text-[10px] font-black uppercase text-slate-400 tracking-[0.2em] flex items-center gap-2">
                                                    <LayoutGrid className="h-3.5 w-3.5" /> Operational Module Authorization
                                                </FormLabel>
                                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 p-6 bg-white rounded-[2rem] border border-slate-200 shadow-sm">
                                                    {SikkaLogisticsPagePermissions.map(perm => (
                                                        <div key={perm.id} className="flex items-center space-x-3 p-2 hover:bg-slate-50 rounded-lg transition-colors group">
                                                            <Checkbox 
                                                                id={`edit-perm-${perm.id}`}
                                                                checked={permissions.includes(perm.id)} 
                                                                onCheckedChange={() => togglePermission(perm.id)}
                                                                className="data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600"
                                                            />
                                                            <Label htmlFor={`edit-perm-${perm.id}`} className={cn(
                                                                "text-[11px] font-bold uppercase transition-colors cursor-pointer",
                                                                permissions.includes(perm.id) ? "text-blue-900" : "text-slate-500 group-hover:text-slate-900"
                                                            )}>{perm.label}</Label>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>

                                            {/* ADMINISTRATIVE TOOLS */}
                                            <div className="space-y-4">
                                                <FormLabel className="text-[10px] font-black uppercase text-slate-400 tracking-[0.2em] flex items-center gap-2">
                                                    <Settings2 className="h-3.5 w-3.5" /> Administrative Control Tools Authorization
                                                </FormLabel>
                                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 p-6 bg-white rounded-[2rem] border border-slate-200 shadow-sm">
                                                    {AdminPagePermissionsList.map(perm => (
                                                        <div key={perm.id} className="flex items-center space-x-3 p-2 hover:bg-slate-50 rounded-lg transition-colors group">
                                                            <Checkbox 
                                                                id={`edit-admin-${perm.id}`}
                                                                checked={permissions.includes(perm.id)} 
                                                                onCheckedChange={() => togglePermission(perm.id)}
                                                                className="data-[state=checked]:bg-slate-900 data-[state=checked]:border-slate-900"
                                                            />
                                                            <Label htmlFor={`edit-admin-${perm.id}`} className={cn(
                                                                "text-[11px] font-bold uppercase transition-colors cursor-pointer",
                                                                permissions.includes(perm.id) ? "text-slate-900" : "text-slate-500 group-hover:text-slate-900"
                                                            )}>{perm.label}</Label>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>

                                            {/* LIFTING NODES */}
                                            <div className="space-y-4">
                                                <div className="flex flex-col gap-1">
                                                    <FormLabel className="text-[10px] font-black uppercase text-slate-400 tracking-[0.2em] flex items-center gap-2">
                                                        <Factory className="h-3.5 w-3.5" /> Authorized Lifting Nodes (Plant Registry) *
                                                    </FormLabel>
                                                </div>
                                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 p-6 bg-white rounded-[2rem] border border-slate-200 shadow-sm">
                                                    {logisticsPlants.map(plant => (
                                                        <div key={plant.id} className="flex items-center space-x-3 p-2 hover:bg-slate-50 rounded-lg transition-colors group">
                                                            <Checkbox 
                                                                id={`edit-plant-${plant.id}`}
                                                                checked={authorizedPlantIds.includes(plant.id)} 
                                                                onCheckedChange={() => togglePlant(plant.id, 'plantIds')}
                                                                className="data-[state=checked]:bg-blue-900 data-[state=checked]:border-blue-900"
                                                            />
                                                            <Label htmlFor={`edit-plant-${plant.id}`} className={cn(
                                                                "text-xs font-black uppercase transition-colors cursor-pointer",
                                                                authorizedPlantIds.includes(plant.id) ? "text-blue-900" : "text-slate-600 group-hover:text-blue-900"
                                                            )}>{plant.name}</Label>
                                                        </div>
                                                    ))}
                                                </div>
                                                {errors.plantIds && <div className="flex items-center gap-2 text-destructive text-[10px] font-bold uppercase mt-1 animate-in fade-in zoom-in-95"><AlertCircle className="h-3 w-3" /> {errors.plantIds.message}</div>}
                                            </div>
                                        </div>
                                    )}
                                </div>

                                <Separator className="opacity-50" />

                                {/* ACCOUNTS PARTITION */}
                                <div className="space-y-8">
                                    <FormField control={form.control} name="access_accounts" render={({ field }) => (
                                        <FormItem className="flex items-center space-x-4 space-y-0 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm w-fit">
                                            <FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} className="h-5 w-5 data-[state=checked]:bg-emerald-700 data-[state=checked]:border-emerald-700" /></FormControl>
                                            <Label htmlFor="access_accounts_edit" className="!mt-0 font-black text-emerald-900 uppercase tracking-widest text-sm flex items-center gap-3 cursor-pointer"><Briefcase className="h-5 w-5" /> Accounts ERP Access</Label>
                                        </FormItem>
                                    )} />
                                    {(accessAccounts || isEditingSikkaind) && (
                                        <div className="space-y-10 animate-in fade-in slide-in-from-left-4 duration-500 pl-10 border-l-4 border-emerald-700/20">
                                            
                                            {/* OPERATIONAL MODULES (ACCOUNTS) */}
                                            <div className="space-y-4">
                                                <FormLabel className="text-[10px] font-black uppercase text-slate-400 tracking-[0.2em] flex items-center gap-2">
                                                    <LayoutGrid className="h-3.5 w-3.5" /> Accounts Module Authorization
                                                </FormLabel>
                                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 p-6 bg-white rounded-[2rem] border border-slate-200 shadow-sm">
                                                    {SikkaAccountsPagePermissions.map(perm => (
                                                        <div key={perm.id} className="flex items-center space-x-3 p-2 hover:bg-slate-50 rounded-lg transition-colors group">
                                                            <Checkbox 
                                                                id={`edit-perm-acc-${perm.id}`}
                                                                checked={permissions.includes(perm.id)} 
                                                                onCheckedChange={() => togglePermission(perm.id)}
                                                                className="data-[state=checked]:bg-emerald-600 data-[state=checked]:border-emerald-600"
                                                            />
                                                            <Label htmlFor={`edit-perm-acc-${perm.id}`} className={cn(
                                                                "text-[11px] font-bold uppercase transition-colors cursor-pointer",
                                                                permissions.includes(perm.id) ? "text-emerald-900" : "text-slate-500 group-hover:text-slate-900"
                                                            )}>{perm.label}</Label>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>

                                            {/* BILLING NODES */}
                                            <div className="space-y-4">
                                                <div className="flex flex-col gap-1">
                                                    <FormLabel className="text-[10px] font-black uppercase text-slate-400 tracking-[0.2em] flex items-center gap-2">
                                                        <Factory className="h-3.5 w-3.5" /> Authorized Billing Nodes (Accounts Plants) *
                                                    </FormLabel>
                                                </div>
                                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 p-6 bg-white rounded-[2rem] border border-slate-200 shadow-sm">
                                                    {accountsPlants.map(plant => (
                                                        <div key={plant.id} className="flex items-center space-x-3 p-2 hover:bg-slate-50 rounded-lg transition-colors group">
                                                            <Checkbox 
                                                                id={`edit-acc-plant-${plant.id}`}
                                                                checked={authorizedAccountPlantIds.includes(plant.id)} 
                                                                onCheckedChange={() => togglePlant(plant.id, 'accounts_plant_ids')}
                                                                className="data-[state=checked]:bg-emerald-700 data-[state=checked]:border-emerald-700"
                                                            />
                                                            <Label htmlFor={`edit-acc-plant-${plant.id}`} className={cn(
                                                                "text-xs font-black uppercase transition-colors cursor-pointer",
                                                                authorizedAccountPlantIds.includes(plant.id) ? "text-emerald-900" : "text-slate-600 group-hover:text-emerald-900"
                                                            )}>{plant.name}</Label>
                                                        </div>
                                                    ))}
                                                </div>
                                                {errors.accounts_plant_ids && <div className="flex items-center gap-2 text-destructive text-[10px] font-bold uppercase mt-1 animate-in fade-in zoom-in-95"><AlertCircle className="h-3 w-3" /> {errors.accounts_plant_ids.message}</div>}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </form>
                </Form>
            </div>
            
            <DialogFooter className="bg-slate-50 border-t p-6 shrink-0 flex-row justify-end gap-3">
                <Button type="button" variant="outline" onClick={onClose} className="font-bold border-slate-300 rounded-xl h-11 px-8">Discard</Button>
                <Button onClick={form.handleSubmit(onSubmit)} disabled={isSubmitting} className="bg-blue-900 hover:bg-slate-900 text-white px-12 h-11 rounded-xl gap-2 font-black uppercase text-[11px] tracking-widest shadow-lg shadow-blue-100 border-none transition-all active:scale-95">
                    {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />} Update Registry Identity
                </Button>
            </DialogFooter>
        </DialogContent>
    </Dialog>
  );
}
