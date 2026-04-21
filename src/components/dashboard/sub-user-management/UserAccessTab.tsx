'use client';

import { useState, useMemo, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { 
  Loader2, 
  ShieldCheck, 
  UserPlus, 
  KeyRound, 
  Smartphone, 
  Briefcase, 
  Factory, 
  LayoutGrid, 
  CheckCircle2, 
  Truck, 
  Save,
  ShieldAlert
} from 'lucide-react';
import type { SubUser, Plant } from '@/types';
import { SikkaLogisticsPagePermissions, AdminPagePermissionsList, SikkaAccountsPagePermissions } from '@/lib/constants';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';

const formSchema = z.object({
  fullName: z.string().min(2, 'Full name required.'),
  mobile: z.string().regex(/^\d{10}$/, '10 digit mobile required.'),
  username: z.string().min(3, 'Username required (min 3 chars).').toLowerCase().transform(v => v.replace(/\s+/g, '')),
  password: z.string().min(6, 'Password required (min 6 chars).'),
  jobRole: z.string().min(1, 'Role required.'),
  defaultModule: z.enum(['Logistics', 'Accounts', 'Administration']).default('Logistics'),
  access_logistics: z.boolean().default(true),
  access_accounts: z.boolean().default(false),
  plantIds: z.array(z.string()).default([]),
  accounts_plant_ids: z.array(z.string()).default([]),
  permissions: z.array(z.string()).default([]),
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
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      fullName: '',
      mobile: '',
      username: '',
      password: '',
      jobRole: 'Operator',
      defaultModule: 'Logistics',
      access_logistics: true,
      access_accounts: false,
      plantIds: [],
      accounts_plant_ids: [],
      permissions: [],
    },
  });

  const { watch, setValue, handleSubmit, formState: { isSubmitting } } = form;
  const accessLogistics = watch('access_logistics');
  const accessAccounts = watch('access_accounts');
  const selectedPermissions = watch('permissions') || [];
  const selectedLogisticsPlants = watch('plantIds') || [];
  const selectedAccountsPlants = watch('accounts_plant_ids') || [];

  const togglePermission = (id: string) => {
    const next = selectedPermissions.includes(id) ? selectedPermissions.filter(p => p !== id) : [...selectedPermissions, id];
    setValue('permissions', next, { shouldValidate: true });
  };

  const togglePlant = (id: string, type: 'logistics' | 'accounts') => {
    const field = type === 'accounts' ? 'accounts_plant_ids' : 'plantIds';
    const current = (type === 'accounts' ? selectedAccountsPlants : selectedLogisticsPlants) || [];
    const next = current.includes(id) ? current.filter(p => p !== id) : [...current, id];
    setValue(field as any, next, { shouldValidate: true });
  };

  return (
    <div className="space-y-10 animate-in fade-in duration-500">
      <Card className="border-none shadow-xl rounded-[2.5rem] bg-white overflow-hidden">
        <CardHeader className="bg-slate-50 border-b p-8">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-blue-900 text-white rounded-2xl shadow-xl rotate-3">
              <UserPlus className="h-7 w-7" />
            </div>
            <div>
              <CardTitle className="text-2xl font-black uppercase tracking-tight italic text-blue-900">Provision New Identity</CardTitle>
              <CardDescription className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mt-1">Initialize system operator node & access manifest</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-10">
          <Form {...form}>
            <form onSubmit={handleSubmit(onUserCreated)} className="space-y-12">
              <section className="space-y-6">
                <h3 className="text-xs font-black uppercase tracking-[0.2em] text-slate-400 flex items-center gap-2 px-1 italic">
                  <ShieldCheck className="h-4 w-4 text-blue-600" /> 1. Operational Identity Particulars
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 p-8 bg-slate-50/50 rounded-3xl border border-slate-100 shadow-inner">
                  <FormField name="fullName" control={form.control} render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-[10px] font-black uppercase text-slate-500">Full Name *</FormLabel>
                      <FormControl><Input placeholder="John Doe" {...field} className="h-12 rounded-xl font-bold bg-white" /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField name="username" control={form.control} render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-[10px] font-black uppercase text-blue-600">Username *</FormLabel>
                      <FormControl><Input placeholder="johndoe" {...field} className="h-12 rounded-xl font-black text-blue-900 shadow-inner" /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField name="password" control={form.control} render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-[10px] font-black uppercase text-slate-500">System Password *</FormLabel>
                      <FormControl><Input type="password" {...field} className="h-12 rounded-xl font-bold bg-white" /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField name="mobile" control={form.control} render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-[10px] font-black uppercase text-slate-500">Contact Node *</FormLabel>
                      <FormControl><Input placeholder="10 Digit Number" {...field} maxLength={10} className="h-12 rounded-xl font-mono font-bold bg-white border-slate-200" /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField name="jobRole" control={form.control} render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-[10px] font-black uppercase text-slate-500">System Role Node *</FormLabel>
                      <FormControl><Input placeholder="Operator, Manager, etc." {...field} className="h-12 rounded-xl font-bold bg-white" /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField name="defaultModule" control={form.control} render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-[10px] font-black uppercase text-slate-500">Default Terminal Node</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl><SelectTrigger className="h-12 rounded-xl font-bold bg-white"><SelectValue placeholder="Select Module" /></SelectTrigger></FormControl>
                        <SelectContent className="rounded-xl">
                            <SelectItem value="Logistics" className="font-bold py-2.5">Logistics Hub</SelectItem>
                            <SelectItem value="Accounts" className="font-bold py-2.5">Accounts Hub</SelectItem>
                            <SelectItem value="Administration" className="font-bold py-2.5">Administration</SelectItem>
                        </SelectContent>
                      </Select>
                    </FormItem>
                  )} />
                </div>
              </section>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <Card className={cn("border-2 transition-all rounded-[2.5rem] overflow-hidden", accessLogistics ? "border-blue-200 bg-blue-50/10 shadow-2xl" : "border-slate-100 opacity-40")}>
                  <CardHeader className="p-6 border-b bg-white/50 flex flex-row items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={cn("p-2 rounded-xl shadow-lg", accessLogistics ? "bg-blue-900 text-white" : "bg-slate-200 text-slate-400")}>
                        <Truck className="h-5 w-5" />
                      </div>
                      <CardTitle className="text-md font-black uppercase italic tracking-tight">Logistics Hub</CardTitle>
                    </div>
                    <FormField name="access_logistics" control={form.control} render={({ field }) => (
                      <Checkbox checked={field.value} onCheckedChange={field.onChange} className="h-5 w-5 rounded-md data-[state=checked]:bg-blue-900 shadow-sm" />
                    )} />
                  </CardHeader>
                  <CardContent className="p-6 space-y-8">
                    <div className="space-y-3">
                      <p className="text-[9px] font-black uppercase text-slate-400 tracking-widest flex items-center gap-2 px-1"><Factory className="h-3 w-3" /> Lifting Node Authorization</p>
                      <div className="flex flex-wrap gap-2">
                        {logisticsPlants.map(p => (
                          <Badge 
                            key={p.id} 
                            onClick={() => accessLogistics && togglePlant(p.id, 'logistics')}
                            variant={selectedLogisticsPlants.includes(p.id) ? 'default' : 'outline'}
                            className={cn(
                              "cursor-pointer font-black uppercase text-[8px] px-3 py-1 rounded-lg transition-all border-2",
                              selectedLogisticsPlants.includes(p.id) ? "bg-blue-900 border-blue-900 shadow-md" : "hover:bg-blue-50 border-slate-100"
                            )}
                          >
                            {p.id}
                          </Badge>
                        ))}
                      </div>
                    </div>
                    <div className="space-y-3">
                      <p className="text-[9px] font-black uppercase text-slate-400 tracking-widest flex items-center gap-2 px-1">
                        <LayoutGrid className="h-3 w-3" /> Module Permissions
                      </p>
                      <div className="grid grid-cols-1 gap-2">
                        {SikkaLogisticsPagePermissions.slice(0, 10).map(p => (
                          <div key={p.id} onClick={() => accessLogistics && togglePermission(p.id)} className={cn(
                            "flex items-center gap-2.5 p-2 rounded-xl border transition-all cursor-pointer group",
                            selectedPermissions.includes(p.id) ? "bg-white border-blue-900 shadow-sm" : "border-slate-50 hover:border-slate-200"
                          )}>
                            <div className={cn("h-3.5 w-3.5 rounded-sm border flex items-center justify-center transition-colors", selectedPermissions.includes(p.id) ? "bg-blue-900 border-blue-900" : "bg-white border-slate-200")}>
                              {selectedPermissions.includes(p.id) && <CheckCircle2 className="h-2.5 w-2.5 text-white" />}
                            </div>
                            <span className={cn("text-[10px] font-black uppercase tracking-tight", selectedPermissions.includes(p.id) ? "text-blue-900" : "text-slate-400")}>{p.name}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className={cn("border-2 transition-all rounded-[2.5rem] overflow-hidden", (accessAccounts || isAdmin) ? "border-emerald-200 bg-white shadow-2xl" : "border-slate-100 opacity-40")}>
                  <CardHeader className="p-6 border-b bg-slate-50/50 flex flex-row items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={cn("p-2 rounded-xl shadow-lg", (accessAccounts || isAdmin) ? "bg-emerald-600 text-white" : "bg-slate-200 text-slate-400")}>
                        <Briefcase className="h-5 w-5" />
                      </div>
                      <CardTitle className="text-md font-black uppercase italic text-slate-800">Accounts & Security</CardTitle>
                    </div>
                    <FormField name="access_accounts" control={form.control} render={({ field }) => (
                      <Checkbox checked={field.value} onCheckedChange={field.onChange} className="h-5 w-5 rounded-md data-[state=checked]:bg-emerald-600 shadow-sm" />
                    )} />
                  </CardHeader>
                  <CardContent className="p-6 space-y-8">
                    {isAdmin && (
                      <div className="space-y-4">
                        <p className="text-[9px] font-black uppercase text-slate-400 tracking-widest flex items-center gap-2 px-1">
                          <ShieldAlert className="h-3 w-3 text-red-600" /> Admin Security Node
                        </p>
                        <div className="grid grid-cols-1 gap-2">
                          {AdminPagePermissionsList.map(p => (
                            <div key={p.id} onClick={() => togglePermission(p.id)} className={cn(
                              "flex items-center gap-3 p-2.5 rounded-xl border transition-all cursor-pointer group",
                              selectedPermissions.includes(p.id) ? "bg-white border-emerald-600 shadow-sm" : "border-slate-50 hover:border-slate-200"
                            )}>
                              <div className={cn("h-3.5 w-3.5 rounded-sm border flex items-center justify-center transition-colors", selectedPermissions.includes(p.id) ? "bg-emerald-600 border-emerald-600 shadow-inner" : "bg-white border-slate-200")}>
                                {selectedPermissions.includes(p.id) && <CheckCircle2 className="h-2.5 w-2.5 text-white" />}
                              </div>
                              <span className={cn("text-[10px] font-black uppercase tracking-tight", selectedPermissions.includes(p.id) ? "text-emerald-700" : "text-slate-400")}>{p.name}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    
                    <div className="space-y-3">
                      <p className="text-[9px] font-black uppercase text-slate-400 tracking-widest flex items-center gap-2 px-1">
                        <LayoutGrid className="h-3 w-3" /> Financial Hub
                      </p>
                      <div className="grid grid-cols-1 gap-2">
                        {SikkaAccountsPagePermissions.map(p => (
                          <div key={p.id} onClick={() => accessAccounts && togglePermission(p.id)} className={cn(
                            "flex items-center gap-3 p-2.5 rounded-xl border transition-all cursor-pointer group",
                            selectedPermissions.includes(p.id) ? "bg-white border-emerald-600 shadow-sm" : "border-slate-50 hover:border-slate-200"
                          )}>
                            <div className={cn("h-3.5 w-3.5 rounded-sm border flex items-center justify-center transition-colors", selectedPermissions.includes(p.id) ? "bg-emerald-600 border-emerald-600 shadow-inner" : "bg-white border-slate-200")}>
                              {selectedPermissions.includes(p.id) && <CheckCircle2 className="h-2.5 w-2.5 text-white" />}
                            </div>
                            <span className={cn("text-[10px] font-black uppercase tracking-tight", selectedPermissions.includes(p.id) ? "text-emerald-700" : "text-slate-400")}>{p.name}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              <div className="flex justify-end pt-10 border-t border-slate-100">
                <Button type="button" variant="ghost" onClick={() => form.reset()} className="h-14 px-10 font-black uppercase text-[11px] tracking-widest text-slate-400 hover:text-slate-900 transition-all rounded-[1.5rem]">Discard Draft</Button>
                <Button type="submit" disabled={isSubmitting} className="bg-blue-900 hover:bg-black text-white px-20 h-14 rounded-[1.5rem] font-black uppercase text-[11px] tracking-[0.3em] shadow-2xl shadow-blue-900/30 transition-all active:scale-95 border-none">
                  {isSubmitting ? <Loader2 className="mr-3 h-4 w-4 animate-spin" /> : <Save className="mr-3 h-4 w-4" />}
                  Finalize Identity Node
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
