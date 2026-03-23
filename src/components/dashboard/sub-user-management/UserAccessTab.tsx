'use client';

import { useMemo, useCallback } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import { Loader2, Truck, Briefcase, LayoutGrid, ShieldCheck, Factory, Settings2, AlertCircle, Save, Sparkles } from 'lucide-react';
import type { SubUser, Plant, JobRole } from '@/types';
import { JobRoles, UserStatuses, SikkaLogisticsPagePermissions, AdminPagePermissionsList, SikkaAccountsPagePermissions, rolePermissions } from '@/lib/constants';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { Label } from '@/components/ui/label';
import { format } from 'date-fns';

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
  mobile: z.string().regex(/^\d{10}$/, 'Mobile number must be 10 digits'),
  username: z.string().min(3, 'Username must be at least 3 characters').transform(v => v.trim()),
  password: passwordRules,
  status: z.enum(UserStatuses, { required_error: 'Status is required' }),
  access_logistics: z.boolean().default(false),
  access_accounts: z.boolean().default(false),
  permissions: z.array(z.string()).default([]),
  plantIds: z.array(z.string()).default([]),
  accounts_plant_ids: z.array(z.string()).default([]),
  defaultModule: z.enum(['Logistics', 'Accounts', 'Administration']).optional(),
}).superRefine((data, ctx) => {
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

interface UserAccessTabProps {
  onUserCreated: (data: Omit<SubUser, 'id'>) => Promise<void>;
  existingUsernames: string[];
  logisticsPlants: Plant[];
  accountsPlants: Plant[];
  isAdmin: boolean;
}

export default function UserAccessTab({ onUserCreated, existingUsernames, logisticsPlants, accountsPlants, isAdmin }: UserAccessTabProps) {
  const { toast } = useToast();
  
  const selectableRoles = useMemo(() => {
    if (isAdmin) return JobRoles;
    return JobRoles.filter(role => role !== 'Manager' && role !== 'Admin');
  }, [isAdmin]);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      fullName: '',
      jobRole: undefined,
      countryCode: '+91',
      mobile: '',
      username: '',
      password: '',
      status: 'Active',
      access_logistics: false,
      access_accounts: false,
      permissions: [],
      plantIds: [],
      accounts_plant_ids: [],
      defaultModule: 'Logistics',
    },
  });

  const { setValue, handleSubmit, control, watch, formState: { errors, isSubmitting } } = form;
  
  const accessLogistics = useWatch({ control, name: 'access_logistics' });
  const accessAccounts = useWatch({ control, name: 'access_accounts' });
  const permissions = useWatch({ control, name: 'permissions' }) || EMPTY_ARRAY;
  const authorizedPlantIds = useWatch({ control, name: 'plantIds' }) || EMPTY_ARRAY;
  const authorizedAccountPlantIds = useWatch({ control, name: 'accounts_plant_ids' }) || EMPTY_ARRAY;

  const handleRoleChange = (val: JobRole) => {
    setValue('jobRole', val, { shouldDirty: true, shouldValidate: true });
    
    const perms = rolePermissions[val] || EMPTY_ARRAY;
    setValue('permissions', perms, { shouldDirty: true, shouldValidate: true });
    
    const logisticsRoles: JobRole[] = ['Shipment Planner', 'Vehicle Planner', 'Gate Security', 'Office Executive', 'Sub-User', 'Admin', 'Manager'];
    const accountsRoles: JobRole[] = ['Accountant', 'Admin', 'Manager'];
    
    setValue('access_logistics', logisticsRoles.includes(val), { shouldDirty: true });
    setValue('access_accounts', accountsRoles.includes(val), { shouldDirty: true });

    if (val === 'Accountant') setValue('defaultModule', 'Accounts');
    else if (val === 'Gate Security' || val === 'Shipment Planner') setValue('defaultModule', 'Logistics');
    else if (val === 'Admin' || val === 'Manager') setValue('defaultModule', 'Logistics');
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

  const onSubmit = async (values: FormValues) => {
    const sanitizedUsername = values.username.trim();
    if (existingUsernames.some(u => u.toLowerCase() === sanitizedUsername.toLowerCase())) {
        toast({ variant: 'destructive', title: 'Duplicate Entry', description: 'Username already exists in the registry.' });
        return;
    }
    await onUserCreated({ ...values, username: sanitizedUsername, loginAttempts: 0 });
    form.reset();
  };

  return (
    <Card className="border-none shadow-md bg-white overflow-hidden">
      <CardHeader className="bg-slate-50/50 border-b p-8">
        <div className="flex items-center gap-3">
            <div className="p-2 bg-primary text-white rounded-lg shadow-lg rotate-3"><ShieldCheck className="h-5 w-5" /></div>
            <div>
                <CardTitle className="text-2xl font-black uppercase tracking-tight italic">Provision User Identity</CardTitle>
                <CardDescription className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mt-1">Independent Lifting & Billing node authorization Registry</CardDescription>
            </div>
        </div>
      </CardHeader>
      <CardContent className="p-8">
        <Form {...form}>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-10">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <FormField name="fullName" control={form.control} render={({ field }) => (<FormItem><FormLabel className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Full Name *</FormLabel><FormControl><Input {...field} className="h-11 rounded-xl font-bold" /></FormControl><FormMessage /></FormItem>)} />
              <FormField name="jobRole" control={form.control} render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Job Role *</FormLabel>
                  <Select onValueChange={handleRoleChange} value={field.value}>
                    <FormControl><SelectTrigger className="h-11 rounded-xl font-bold"><SelectValue placeholder="Select role" /></SelectTrigger></FormControl>
                    <SelectContent className="rounded-xl">{selectableRoles.map(r => <SelectItem key={r} value={r} className="font-bold py-2.5">{r}</SelectItem>)}</SelectContent>
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

              <FormField name="username" control={form.control} render={({ field }) => (<FormItem><FormLabel className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Username *</FormLabel><FormControl><Input {...field} className="h-11 rounded-xl font-black text-blue-900" /></FormControl><FormMessage /></FormItem>)} />
              <FormField name="password" control={form.control} render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Secure Password *</FormLabel>
                  <FormControl><Input type="password" {...field} className="h-11 rounded-xl font-mono" /></FormControl>
                  <FormMessage className="text-[9px] font-bold" />
                </FormItem>
              )} />
              <FormField name="status" control={form.control} render={({ field }) => (<FormItem><FormLabel className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Account Status</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger className="h-11 rounded-xl font-bold"><SelectValue placeholder="Select status" /></SelectTrigger></FormControl><SelectContent className="rounded-xl">{UserStatuses.filter(s => s !== 'Blocked').map(s => <SelectItem key={s} value={s} className="font-bold py-2.5">{s}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>)} />
              
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
                  <p className="text-[9px] font-bold text-slate-400 uppercase mt-1">System auto-opens this module after login.</p>
                </FormItem>
              )} />
            </div>

            <Separator className="opacity-50" />
            
            <div className="space-y-8">
              <h3 className="text-xl font-black text-slate-800 uppercase tracking-tight italic flex items-center gap-3">
                <LayoutGrid className="h-6 w-6 text-primary" /> Authorization Registry Matrix
              </h3>
                <div className="p-8 border rounded-[2.5rem] space-y-12 bg-slate-50/50 shadow-inner">
                    
                    {/* LOGISTICS HUB PARTITION */}
                    <div className="space-y-8">
                        <FormField control={form.control} name="access_logistics" render={({ field }) => (
                            <FormItem className="flex items-center space-x-4 space-y-0 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm w-fit">
                                <FormControl><Checkbox id="access_logistics" checked={field.value} onCheckedChange={field.onChange} className="h-5 w-5 data-[state=checked]:bg-blue-900 data-[state=checked]:border-blue-900" /></FormControl>
                                <Label htmlFor="access_logistics" className="!mt-0 font-black text-blue-900 uppercase tracking-widest text-sm flex items-center gap-3 cursor-pointer">
                                    <Truck className="h-5 w-5" /> Logistics Hub Authorization
                                </Label>
                            </FormItem>
                        )} />
                        
                        {accessLogistics && (
                            <div className="space-y-10 animate-in fade-in slide-in-from-left-4 duration-500 pl-10 border-l-4 border-blue-900/20">
                                
                                {/* OPERATIONAL MODULES */}
                                <div className="space-y-4">
                                    <FormLabel className="text-[10px] font-black uppercase text-slate-400 tracking-[0.2em] flex items-center gap-2">
                                        <LayoutGrid className="h-3.5 w-3.5" /> Operational Module Permissions
                                    </FormLabel>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 p-6 bg-white rounded-[2rem] border border-slate-200 shadow-sm">
                                        {SikkaLogisticsPagePermissions.map(perm => (
                                            <div key={perm.id} className="flex items-center space-x-3 p-2 hover:bg-slate-50 rounded-lg transition-colors group">
                                                <Checkbox 
                                                    id={`perm-${perm.id}`}
                                                    checked={permissions.includes(perm.id)} 
                                                    onCheckedChange={() => togglePermission(perm.id)}
                                                    className="data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600"
                                                />
                                                <Label htmlFor={`perm-${perm.id}`} className={cn(
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
                                        <Settings2 className="h-3.5 w-3.5" /> Administrative Control Tools
                                    </FormLabel>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 p-6 bg-white rounded-[2rem] border border-slate-200 shadow-sm">
                                        {AdminPagePermissionsList.map(perm => (
                                            <div key={perm.id} className="flex items-center space-x-3 p-2 hover:bg-slate-50 rounded-lg transition-colors group">
                                                <Checkbox 
                                                    id={`admin-${perm.id}`}
                                                    checked={permissions.includes(perm.id)} 
                                                    onCheckedChange={() => togglePermission(perm.id)}
                                                    className="data-[state=checked]:bg-slate-900 data-[state=checked]:border-slate-900"
                                                />
                                                <Label htmlFor={`admin-${perm.id}`} className={cn(
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
                                        <p className="text-[9px] font-bold text-blue-600 uppercase tracking-tight ml-5.5">Required: Selection of at least one node is mandatory.</p>
                                    </div>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 p-6 bg-white rounded-[2rem] border border-slate-200 shadow-sm">
                                        {logisticsPlants.map(plant => (
                                            <div key={plant.id} className="flex items-center space-x-3 p-2 hover:bg-slate-50 rounded-lg transition-colors group">
                                                <Checkbox 
                                                    id={`plant-${plant.id}`}
                                                    checked={authorizedPlantIds.includes(plant.id)} 
                                                    onCheckedChange={() => togglePlant(plant.id, 'plantIds')}
                                                    className="data-[state=checked]:bg-blue-900 data-[state=checked]:border-blue-900"
                                                />
                                                <Label htmlFor={`plant-${plant.id}`} className={cn(
                                                    "text-xs font-black uppercase transition-colors cursor-pointer",
                                                    authorizedPlantIds.includes(plant.id) ? "text-blue-900" : "text-slate-600 group-hover:text-blue-900"
                                                )}>{plant.name}</Label>
                                            </div>
                                        ))}
                                    </div>
                                    {errors.plantIds && <p className="text-[10px] font-bold text-destructive px-1">{errors.plantIds.message}</p>}
                                </div>
                            </div>
                        )}
                    </div>

                    <Separator className="opacity-50" />

                    {/* ACCOUNTS ERP PARTITION */}
                    <div className="space-y-8">
                        <FormField control={form.control} name="access_accounts" render={({ field }) => (
                            <FormItem className="flex items-center space-x-4 space-y-0 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm w-fit">
                                <FormControl><Checkbox id="access_accounts" checked={field.value} onCheckedChange={field.onChange} className="h-5 w-5 data-[state=checked]:bg-emerald-700 data-[state=checked]:border-emerald-700" /></FormControl>
                                <Label htmlFor="access_accounts" className="!mt-0 font-black text-emerald-900 uppercase tracking-widest text-sm flex items-center gap-3 cursor-pointer">
                                    <Briefcase className="h-5 w-5" /> Accounts ERP Authorization
                                </Label>
                            </FormItem>
                        )} />
                        {accessAccounts && (
                            <div className="space-y-10 animate-in fade-in slide-in-from-left-4 duration-500 pl-10 border-l-4 border-emerald-700/20">
                                
                                {/* OPERATIONAL MODULES (ACCOUNTS) */}
                                <div className="space-y-4">
                                    <FormLabel className="text-[10px] font-black uppercase text-slate-400 tracking-[0.2em] flex items-center gap-2">
                                        <LayoutGrid className="h-3.5 w-3.5" /> Accounts Module Permissions
                                    </FormLabel>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 p-6 bg-white rounded-[2rem] border border-slate-200 shadow-sm">
                                        {SikkaAccountsPagePermissions.map(perm => (
                                            <div key={perm.id} className="flex items-center space-x-3 p-2 hover:bg-slate-50 rounded-lg transition-colors group">
                                                <Checkbox 
                                                    id={`perm-acc-${perm.id}`}
                                                    checked={permissions.includes(perm.id)} 
                                                    onCheckedChange={() => togglePermission(perm.id)}
                                                    className="data-[state=checked]:bg-emerald-600 data-[state=checked]:border-emerald-600"
                                                />
                                                <Label htmlFor={`perm-acc-${perm.id}`} className={cn(
                                                    "text-[11px] font-bold uppercase transition-colors cursor-pointer",
                                                    permissions.includes(perm.id) ? "text-emerald-900" : "text-slate-500 group-hover:text-slate-900"
                                                )}>{perm.label}</Label>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                <div className="space-y-4">
                                    <div className="flex flex-col gap-1">
                                        <FormLabel className="text-[10px] font-black uppercase text-slate-400 tracking-[0.2em] flex items-center gap-2">
                                            <Factory className="h-3.5 w-3.5" /> Authorized Billing Nodes (Accounts Registry) *
                                        </FormLabel>
                                        <p className="text-[9px] font-bold text-emerald-600 uppercase tracking-tight ml-5.5">Required: Selection of at least one billing node is mandatory.</p>
                                    </div>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 p-6 bg-white rounded-[2rem] border border-slate-200 shadow-sm">
                                        {accountsPlants.map(plant => (
                                            <div key={plant.id} className="flex items-center space-x-3 p-2 hover:bg-slate-50 rounded-lg transition-colors group">
                                                <Checkbox 
                                                    id={`acc-plant-${plant.id}`}
                                                    checked={authorizedAccountPlantIds.includes(plant.id)} 
                                                    onCheckedChange={() => togglePlant(plant.id, 'accounts_plant_ids')}
                                                    className="data-[state=checked]:bg-emerald-700 data-[state=checked]:border-emerald-700"
                                                />
                                                <Label htmlFor={`acc-plant-${plant.id}`} className={cn(
                                                    "text-xs font-black uppercase transition-colors cursor-pointer",
                                                    authorizedAccountPlantIds.includes(plant.id) ? "text-emerald-900" : "text-slate-600 group-hover:text-emerald-900"
                                                )}>{plant.name}</Label>
                                            </div>
                                        ))}
                                    </div>
                                    {errors.accounts_plant_ids && <p className="text-[10px] font-bold text-destructive px-1">{errors.accounts_plant_ids.message}</p>}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
            
            <div className="flex gap-4 justify-end pt-10 border-t border-slate-100">
              <Button type="button" variant="ghost" onClick={() => form.reset()} className="px-10 h-14 font-black uppercase text-[11px] tracking-widest text-slate-400 hover:text-slate-900 transition-all rounded-2xl">Discard Entry</Button>
              <Button type="submit" disabled={isSubmitting} className="bg-blue-900 hover:bg-slate-900 text-white px-20 h-14 rounded-2xl font-black uppercase text-[11px] tracking-[0.2em] shadow-xl shadow-blue-100 border-none transition-all active:scale-95 border-none">
                {isSubmitting ? <Loader2 className="mr-3 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                Provision User Registry
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
