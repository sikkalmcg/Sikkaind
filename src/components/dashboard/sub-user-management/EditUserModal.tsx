'use client';

import { useEffect, useMemo } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { 
  Loader2, 
  ShieldCheck, 
  KeyRound, 
  Smartphone, 
  Factory, 
  CheckCircle2, 
  Save, 
  X, 
  Activity, 
  Truck,
  Radar,
  Eye,
  LayoutGrid,
  Briefcase
} from 'lucide-react';
import type { SubUser, Plant, WithId } from '@/types';
import { SikkaLogisticsPagePermissions, AdminPagePermissionsList, SikkaAccountsPagePermissions } from '@/lib/constants';
import { cn, normalizePlantId } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';

const formSchema = z.object({
  fullName: z.string().min(2, 'Full name required.'),
  mobile: z.string().regex(/^\d{10}$/, '10 digit mobile required.'),
  password: z.string().optional().or(z.literal('')),
  jobRole: z.string().min(1, 'Role required.'),
  status: z.enum(['Active', 'Inactive']),
  defaultModule: z.enum(['Logistics', 'Accounts', 'Administration', 'Trip Board']).default('Logistics'),
  access_logistics: z.boolean().default(true),
  access_accounts: z.boolean().default(false),
  access_client: z.boolean().default(false),
  plantIds: z.array(z.string()).default([]),
  accounts_plant_ids: z.array(z.string()).default([]),
  permissions: z.array(z.string()).default([]),
});

type FormValues = z.infer<typeof formSchema>;

interface EditUserModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: WithId<SubUser>;
  onUserUpdated: (userId: string, data: Partial<SubUser>) => Promise<void>;
  logisticsPlants: Plant[];
  accountsPlants: Plant[];
}

export default function EditUserModal({ isOpen, onClose, user, onUserUpdated, logisticsPlants, accountsPlants }: EditUserModalProps) {
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      fullName: '',
      mobile: '',
      password: '',
      jobRole: 'Operator',
      status: 'Active',
      defaultModule: 'Logistics',
      access_logistics: true,
      access_accounts: false,
      access_client: false,
      plantIds: [],
      accounts_plant_ids: [],
      permissions: [],
    },
  });

  const { setValue, control, handleSubmit, reset } = form;
  const watchedAccessLogistics = useWatch({ control, name: 'access_logistics' });
  const watchedAccessAccounts = useWatch({ control, name: 'access_accounts' });
  const watchedAccessClient = useWatch({ control, name: 'access_client' });
  const watchedPermissions = useWatch({ control, name: 'permissions' }) || [];
  const watchedLogisticsPlants = useWatch({ control, name: 'plantIds' }) || [];
  const watchedAccountsPlants = useWatch({ control, name: 'accounts_plant_ids' }) || [];

  useEffect(() => {
    if (isOpen && user) {
      reset({
        fullName: user.fullName || '',
        mobile: user.mobile || '',
        password: '', 
        jobRole: user.jobRole || 'Operator',
        status: user.status || 'Active',
        defaultModule: (user.defaultModule as any) || 'Logistics',
        access_logistics: user.access_logistics ?? true,
        access_accounts: user.access_accounts ?? false,
        access_client: user.jobRole === 'Client',
        plantIds: user.plantIds || [],
        accounts_plant_ids: user.accounts_plant_ids || [],
        permissions: user.permissions || [],
      });
    }
  }, [isOpen, user, reset]);

  useEffect(() => {
    if (watchedAccessClient) {
        setValue('jobRole', 'Client');
        setValue('access_logistics', false);
        setValue('access_accounts', false);
        setValue('defaultModule', 'Trip Board');
    }
  }, [watchedAccessClient, setValue]);

  const togglePermission = (id: string) => {
    const next = watchedPermissions.includes(id) 
        ? watchedPermissions.filter(p => p !== id) 
        : [...watchedPermissions, id];
    setValue('permissions', next, { shouldValidate: true });
  };

  const togglePlant = (id: string, type: 'logistics' | 'accounts' | 'client') => {
    const field = type === 'accounts' ? 'accounts_plant_ids' : 'plantIds';
    const current = (type === 'accounts' ? watchedAccountsPlants : watchedLogisticsPlants) || [];
    const next = current.includes(id) ? current.filter(p => p !== id) : [...current, id];
    setValue(field as any, next, { shouldValidate: true });
  };

  const onSubmit = async (values: FormValues) => {
    const updateData: any = { ...values };
    if (!values.password) delete updateData.password;
    await onUserUpdated(user.id, updateData);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-[90vw] w-[1400px] h-[95vh] flex flex-col p-0 border-none shadow-3xl overflow-hidden bg-[#f8fafc] rounded-[3rem]">
        <DialogHeader className="p-8 bg-slate-900 text-white shrink-0 pr-12">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-5">
                <div className="p-3 bg-blue-600 rounded-3xl shadow-xl">
                    <Activity className="h-8 w-8 text-white" />
                </div>
                <div>
                    <DialogTitle className="text-2xl font-black uppercase tracking-tight italic leading-none">Security Node Modification</DialogTitle>
                    <DialogDescription className="text-blue-300 font-bold uppercase text-[10px] tracking-widest mt-2">Updating Access Manifest for @{user.username}</DialogDescription>
                </div>
            </div>
            <div className="flex items-center gap-4">
                <Badge variant="outline" className="bg-white/5 border-white/10 text-emerald-400 font-black uppercase text-[10px] px-6 h-10 border-none">Authorized Admin Control</Badge>
                <Button variant="ghost" size="icon" onClick={onClose} className="h-10 w-10 text-white/40 hover:text-white hover:bg-white/10 rounded-xl"><X className="h-6 w-6" /></Button>
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto p-10 space-y-12">
            <Form {...form}>
                <form onSubmit={handleSubmit(onSubmit)} className="space-y-12">
                    <section className="space-y-6">
                        <h3 className="text-xs font-black uppercase tracking-[0.2em] text-slate-400 flex items-center gap-2 px-1 italic">
                            <ShieldCheck className="h-4 w-4 text-blue-600" /> 1. Operational identity particulars
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 p-10 bg-white rounded-[2.5rem] border-2 border-slate-100 shadow-xl">
                            <FormField name="fullName" control={form.control} render={({ field }) => (
                                <FormItem>
                                    <FormLabel className="text-[10px] font-black uppercase text-slate-500">Staff Full Name *</FormLabel>
                                    <FormControl><Input {...field} className="h-12 rounded-xl font-bold bg-slate-50/50 shadow-inner" /></FormControl>
                                    <FormMessage />
                                </FormItem>
                            )} />
                            <FormField name="jobRole" control={form.control} render={({ field }) => (
                                <FormItem>
                                    <FormLabel className="text-[10px] font-black uppercase text-slate-500">System Role Node *</FormLabel>
                                    <FormControl><Input {...field} readOnly={watchedAccessClient} className={cn("h-12 rounded-xl font-bold bg-slate-50/50 shadow-inner", watchedAccessClient && "bg-slate-100 text-blue-900 font-black")} /></FormControl>
                                    <FormMessage />
                                </FormItem>
                            )} />
                            <FormField name="mobile" control={form.control} render={({ field }) => (
                                <FormItem>
                                    <FormLabel className="text-[10px] font-black uppercase text-slate-500">Mobile Node *</FormLabel>
                                    <FormControl><Input {...field} maxLength={10} className="h-12 rounded-xl font-mono font-bold bg-slate-50/50 shadow-inner" /></FormControl>
                                    <FormMessage />
                                </FormItem>
                            )} />
                            <FormField name="status" control={form.control} render={({ field }) => (
                                <FormItem>
                                    <FormLabel className="text-[10px] font-black uppercase text-slate-500">Registry Status</FormLabel>
                                    <Select onValueChange={field.onChange} value={field.value}>
                                        <FormControl><SelectTrigger className="h-12 rounded-xl font-black text-blue-900 shadow-sm"><SelectValue /></SelectTrigger></FormControl>
                                        <SelectContent className="rounded-xl">
                                            <SelectItem value="Active" className="font-bold text-emerald-600">ACTIVE NODE</SelectItem>
                                            <SelectItem value="Inactive" className="font-bold text-red-600">INACTIVE / LOCKED</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </FormItem>
                            )} />
                            <FormField name="password" control={form.control} render={({ field }) => (
                                <FormItem>
                                    <FormLabel className="text-[10px] font-black uppercase text-blue-600 flex items-center justify-between">
                                        Override Password 
                                        <KeyRound className="h-3 w-3 opacity-40" />
                                    </FormLabel>
                                    <FormControl><Input type="password" placeholder="Leave blank to maintain current" {...field} className="h-12 rounded-xl font-bold border-blue-100" /></FormControl>
                                    <FormDescription className="text-[8px] font-bold uppercase text-slate-400">Security Note: Overwrite resets Auth manifest.</FormDescription>
                                </FormItem>
                            )} />
                            <FormField name="defaultModule" control={form.control} render={({ field }) => (
                                <FormItem>
                                    <FormLabel className="text-[10px] font-black uppercase text-slate-500">Default Terminal Node</FormLabel>
                                    <Select onValueChange={field.onChange} value={field.value}>
                                        <FormControl><SelectTrigger className="h-12 rounded-xl font-bold"><SelectValue /></SelectTrigger></FormControl>
                                        <SelectContent className="rounded-xl">
                                            {!watchedAccessClient && (
                                                <>
                                                    <SelectItem value="Logistics" className="font-bold py-2.5">Logistics Hub</SelectItem>
                                                    <SelectItem value="Accounts" className="font-bold py-2.5">Accounts Hub</SelectItem>
                                                    <SelectItem value="Administration" className="font-bold py-2.5">Administration</SelectItem>
                                                </>
                                            )}
                                            <SelectItem value="Trip Board" className="font-bold py-2.5 text-blue-600">Trip Board (Client)</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </FormItem>
                            )} />
                        </div>
                    </section>

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                        <Card className={cn("border-2 transition-all rounded-[3rem] overflow-hidden flex flex-col", watchedAccessLogistics ? "border-blue-200 bg-white shadow-2xl" : "border-slate-100 opacity-40 grayscale")}>
                            <CardHeader className="p-6 border-b bg-slate-50/50 flex flex-row items-center justify-between shrink-0">
                                <div className="flex items-center gap-4">
                                    <div className={cn("p-3 rounded-2xl shadow-lg", watchedAccessLogistics ? "bg-blue-900 text-white" : "bg-slate-200 text-slate-400")}><Truck className="h-6 w-6" /></div>
                                    <CardTitle className="text-md font-black uppercase italic tracking-tight">Logistics Hub</CardTitle>
                                </div>
                                <FormField name="access_logistics" control={form.control} render={({ field }) => (
                                    <Checkbox disabled={watchedAccessClient} checked={field.value} onCheckedChange={field.onChange} className="h-5 w-5 rounded-md data-[state=checked]:bg-blue-900 shadow-sm" />
                                )} />
                            </CardHeader>
                            <CardContent className="p-8 space-y-10 flex-1 flex flex-col overflow-hidden">
                                <div className="space-y-4 shrink-0">
                                    <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest flex items-center gap-2 px-1"><Factory className="h-3 w-3" /> Lifting Node Authorization</p>
                                    <div className="flex flex-wrap gap-2.5">
                                        {logisticsPlants.map(p => (
                                            <Badge key={p.id} onClick={() => watchedAccessLogistics && togglePlant(p.id, 'logistics')}
                                                variant={watchedLogisticsPlants.includes(p.id) ? 'default' : 'outline'}
                                                className={cn("cursor-pointer font-black uppercase text-[9px] px-4 py-1.5 rounded-xl transition-all border-2",
                                                    watchedLogisticsPlants.includes(p.id) ? "bg-blue-900 border-blue-900 shadow-lg" : "hover:bg-blue-50 border-slate-100"
                                                )}>{p.id}</Badge>
                                        ))}
                                    </div>
                                </div>
                                <div className="space-y-4 flex-1 flex flex-col overflow-hidden">
                                    <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest flex items-center gap-2 px-1 shrink-0">Permissions Manifest</p>
                                    <ScrollArea className="flex-1 pr-4">
                                        <div className="grid grid-cols-1 gap-2 pb-2">
                                            {SikkaLogisticsPagePermissions.map(p => (
                                                <div key={p.id} onClick={() => watchedAccessLogistics && togglePermission(p.id)} className={cn("flex items-center gap-3 p-3 rounded-xl border transition-all cursor-pointer group",
                                                    watchedPermissions.includes(p.id) ? "bg-white border-blue-900 shadow-md" : "border-slate-50 hover:border-slate-200"
                                                )}>
                                                    <div className={cn("h-4 w-4 rounded-md border flex items-center justify-center transition-all", watchedPermissions.includes(p.id) ? "bg-blue-900 border-blue-900" : "bg-white border-slate-200")}>
                                                        {watchedPermissions.includes(p.id) && <CheckCircle2 className="h-2.5 w-2.5 text-white" />}
                                                    </div>
                                                    <span className={cn("text-[10px] font-black uppercase tracking-tight", watchedPermissions.includes(p.id) ? "text-blue-900" : "text-slate-400 group-hover:text-slate-600")}>{p.name}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </ScrollArea>
                                </div>
                            </CardContent>
                        </Card>

                        <Card className={cn("border-2 transition-all rounded-[3rem] overflow-hidden flex flex-col", watchedAccessClient ? "border-blue-600 bg-white shadow-2xl" : "border-slate-100 opacity-40")}>
                            <CardHeader className="p-6 border-b bg-blue-900 text-white flex flex-row items-center justify-between shrink-0">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-white/10 rounded-xl border border-white/20 shadow-inner"><Radar className="h-5 w-5 text-blue-400" /></div>
                                    <div>
                                        <CardTitle className="text-md font-black uppercase italic">Client Portal Node</CardTitle>
                                        <p className="text-[8px] font-bold uppercase text-blue-300">Read-Only Registry Access</p>
                                    </div>
                                </div>
                                <FormField name="access_client" control={form.control} render={({ field }) => (
                                    <Checkbox checked={field.value} onCheckedChange={field.onChange} className="h-6 w-6 rounded-lg data-[state=checked]:bg-blue-500 border-white/20 shadow-xl" />
                                )} />
                            </CardHeader>
                            <CardContent className="p-8 space-y-8 flex-1">
                                <div className="space-y-4">
                                    <p className="text-[9px] font-black uppercase text-slate-400 tracking-widest flex items-center gap-2 px-1"><Factory className="h-3 w-3 text-blue-600" /> Authorized Lifting Nodes</p>
                                    <div className="flex flex-wrap gap-2">
                                        {logisticsPlants.map(p => (
                                            <Badge 
                                                key={p.id} 
                                                onClick={() => watchedAccessClient && togglePlant(p.id, 'client')}
                                                variant={watchedLogisticsPlants.includes(p.id) ? 'default' : 'outline'}
                                                className={cn(
                                                    "cursor-pointer font-black uppercase text-[9px] px-4 py-1.5 rounded-xl transition-all border-2",
                                                    watchedLogisticsPlants.includes(p.id) ? "bg-blue-900 border-blue-900 shadow-md" : "hover:bg-blue-50 border-slate-100"
                                                )}
                                            >
                                                {p.name}
                                            </Badge>
                                        ))}
                                    </div>
                                </div>
                                
                                <div className="p-5 bg-blue-50 rounded-2xl border-2 border-blue-100 space-y-3">
                                    <div className="flex items-center gap-2 text-blue-900">
                                        <Eye className="h-4 w-4" />
                                        <span className="text-[10px] font-black uppercase">Read-Only Enforced</span>
                                    </div>
                                    <p className="text-[9px] font-bold text-blue-700 uppercase leading-relaxed">
                                        Identity node is restricted to mission tracking. Modifying manifests is strictly blocked across all partitions.
                                    </p>
                                </div>
                            </CardContent>
                        </Card>

                        <Card className={cn("border-2 transition-all rounded-[3rem] overflow-hidden flex flex-col", (watchedAccessAccounts || isAdminSession) ? "border-emerald-200 bg-white shadow-2xl" : "border-slate-100 opacity-40 grayscale")}>
                            <CardHeader className="p-6 border-b bg-slate-50/50 flex flex-row items-center justify-between shrink-0">
                                <div className="flex items-center gap-3">
                                    <div className={cn("p-3 rounded-2xl shadow-lg", (watchedAccessAccounts || isAdminSession) ? "bg-emerald-600 text-white" : "bg-slate-200 text-slate-400")}><Briefcase className="h-6 w-6" /></div>
                                    <CardTitle className="text-md font-black uppercase italic text-slate-800">Accounts & Admin</CardTitle>
                                </div>
                                <FormField name="access_accounts" control={form.control} render={({ field }) => (
                                    <Checkbox disabled={watchedAccessClient} checked={field.value} onCheckedChange={field.onChange} className="h-5 w-5 rounded-md data-[state=checked]:bg-emerald-600 shadow-sm" />
                                )} />
                            </CardHeader>
                            <CardContent className="p-8 space-y-8 flex-1 flex flex-col overflow-hidden">
                                <div className="space-y-4 shrink-0">
                                    <p className="text-[9px] font-black uppercase text-slate-400 tracking-widest flex items-center gap-2 px-1">Lifting Node Authorization</p>
                                    <div className="flex flex-wrap gap-2.5">
                                        {accountsPlants.map(p => (
                                            <Badge key={p.id} onClick={() => watchedAccessAccounts && togglePlant(p.id, 'accounts')}
                                                variant={watchedAccountsPlants.includes(p.id) ? 'default' : 'outline'}
                                                className={cn("cursor-pointer font-black uppercase text-[9px] px-4 py-1.5 rounded-xl transition-all border-2",
                                                    watchedAccountsPlants.includes(p.id) ? "bg-emerald-600 border-emerald-600 shadow-lg" : "hover:bg-emerald-50 border-slate-100"
                                                )}>{p.id}</Badge>
                                        ))}
                                    </div>
                                </div>
                                <div className="space-y-4 flex-1 flex flex-col overflow-hidden">
                                    <p className="text-[9px] font-black uppercase text-slate-400 tracking-widest flex items-center gap-2 px-1 shrink-0">Admin Manifest</p>
                                    <ScrollArea className="flex-1 pr-4">
                                        {!watchedAccessClient && (
                                            <div className="grid grid-cols-1 gap-2 pb-2">
                                                {[...SikkaAccountsPagePermissions, ...AdminPagePermissionsList].map(p => (
                                                    <div key={p.id} onClick={() => (watchedAccessAccounts || isAdminSession) && togglePermission(p.id)} className={cn("flex items-center gap-3 p-3 rounded-xl border transition-all cursor-pointer group",
                                                        watchedPermissions.includes(p.id) ? "bg-white border-emerald-600 shadow-sm" : "border-slate-50 hover:border-slate-200"
                                                    )}>
                                                        <div className={cn("h-4 w-4 rounded-md border flex items-center justify-center transition-all", watchedPermissions.includes(p.id) ? "bg-emerald-600 border-emerald-600" : "bg-white border-slate-200")}>
                                                            {watchedPermissions.includes(p.id) && <CheckCircle2 className="h-3 w-3 text-white" />}
                                                        </div>
                                                        <span className={cn("text-[10px] font-black uppercase tracking-tight", watchedPermissions.includes(p.id) ? "text-emerald-700" : "text-slate-400 group-hover:text-slate-600")}>{p.name}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </ScrollArea>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </form>
            </Form>
        </div>

        <DialogFooter className="p-8 bg-white border-t shrink-0 flex-row items-center justify-between sm:justify-between shadow-[0_-10px_30px_rgba(0,0,0,0.05)]">
            <div className="flex items-center gap-4 px-6 py-2 bg-slate-50 rounded-2xl border border-slate-100 shadow-inner">
                <ShieldCheck className="h-5 w-5 text-blue-600" />
                <div className="flex flex-col">
                    <span className="text-[8px] font-black uppercase text-slate-400">Commit Status</span>
                    <span className="text-[10px] font-black text-blue-900 uppercase">Profile Ready for Sync</span>
                </div>
            </div>
            <div className="flex gap-4">
                <Button variant="ghost" onClick={onClose} className="font-black text-slate-400 uppercase text-[11px] tracking-widest px-10 h-12">Discard Changes</Button>
                <Button onClick={handleSubmit(onSubmit)} disabled={form.formState.isSubmitting} className="bg-blue-900 hover:bg-black text-white px-16 h-12 rounded-2xl font-black uppercase text-[11px] tracking-[0.2em] shadow-xl shadow-blue-900/30 transition-all active:scale-95 border-none">
                    {form.formState.isSubmitting ? <Loader2 className="mr-3 h-4 w-4 animate-spin" /> : <Save className="mr-3 h-4 w-4" />}
                    SYNC IDENTITY NODE
                </Button>
            </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

