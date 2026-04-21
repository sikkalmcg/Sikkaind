'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/components/ui/use-toast';
import { useLoading } from '@/context/LoadingContext';
import { Users, UserPlus, ShieldCheck, Loader2, Boxes } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';

const ALL_PERMISSIONS = [
  { id: 'dashboard', label: 'Main Dashboard' },
  { id: 'live-fleet', label: 'Live Fleet Map' },
  { id: 'shipment-plan', label: 'Shipment Planning' },
  { id: 'vehicle-assignment', label: 'Vehicle Assignment' },
  { id: 'lr-generation', label: 'LR Generation' },
  { id: 'in-transit-tracking', label: 'In-Transit Tracking' },
  { id: 'status-management', label: 'Status Management' },
  { id: 'freight-processing', label: 'Freight Processing' },
  { id: 'payment-registry', label: 'Payment Registry' },
  { id: 'fuel-management', label: 'Fuel Management' },
  { id: 'gate-security', label: 'Gate Security (In/Out)' },
  { id: 'hr-attendance', label: 'HR & Attendance' },
  { id: 'inventory', label: 'Inventory Control' },
  { id: 'customer-master', label: 'Customer Master' },
  { id: 'carrier-master', label: 'Carrier Master' },
  { id: 'vehicle-master', label: 'Vehicle Master' },
  { id: 'reports-analysis', label: 'Reports & Analysis' },
  { id: 'system-admin', label: 'System Administration' }
];

export default function UserManagementPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [jobRole, setJobRole] = useState('Operator');
  const [permissions, setPermissions] = useState<string[]>(['dashboard']);
  
  const { toast } = useToast();
  const { setIsLoading } = useLoading();

  const handleTogglePermission = (id: string) => {
    setPermissions(prev => 
      prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]
    );
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const response = await fetch('/api/auth/manage-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'createUser',
          email,
          password,
          userData: {
            fullName,
            jobRole,
            username: email.split('@')[0],
            status: 'Active',
            access_logistics: true,
            access_accounts: permissions.some(p => p.includes('payment') || p.includes('freight')),
            permissions: permissions
          }
        }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Provisioning node failed.');

      toast({
        title: "Identity Established",
        description: `User ${fullName} has been added to the central registry.`,
      });

      setEmail('');
      setPassword('');
      setFullName('');
      setJobRole('Operator');
      setPermissions(['dashboard']);
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Registry Failure",
        description: error.message,
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-8">
      <div className="flex items-center gap-4 mb-8">
        <div className="bg-blue-600 p-3 rounded-2xl shadow-lg">
          <Users className="h-8 w-8 text-white" />
        </div>
        <div>
          <h1 className="text-3xl font-black uppercase tracking-tighter italic text-slate-900 leading-none">
            User Management
          </h1>
          <p className="text-slate-500 font-bold uppercase text-[10px] tracking-widest mt-1">
            Identity Provisioning Terminal
          </p>
        </div>
      </div>

      <Card className="border-slate-200 shadow-xl rounded-[2rem] overflow-hidden">
        <CardHeader className="bg-slate-50 border-b border-slate-100 p-8">
          <CardTitle className="flex items-center gap-2 uppercase tracking-tight italic text-blue-900">
            <UserPlus className="h-5 w-5 text-blue-600" /> Establish New Identity
          </CardTitle>
          <CardDescription className="text-slate-500 font-medium">
            Register a new operator node with custom permission manifests.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-8">
          <form onSubmit={handleCreateUser} className="space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-6">
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase text-slate-500 tracking-wider">Full Name</Label>
                  <Input value={fullName} onChange={(e) => setFullName(e.target.value)} required placeholder="Ravi Kumar" className="h-12 border-slate-200 rounded-xl" />
                </div>
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase text-slate-500 tracking-wider">Operator Email</Label>
                  <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="ravi@sikka.com" className="h-12 border-slate-200 rounded-xl" />
                </div>
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase text-slate-500 tracking-wider">Access Token (Password)</Label>
                  <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required placeholder="••••••••" className="h-12 border-slate-200 rounded-xl" />
                </div>
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase text-slate-500 tracking-wider">Job Role</Label>
                  <Select onValueChange={setJobRole} value={jobRole}>
                    <SelectTrigger className="h-12 border-slate-200 rounded-xl">
                      <SelectValue placeholder="Select Role" />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl">
                      <SelectItem value="Admin">Mission Administrator</SelectItem>
                      <SelectItem value="Manager">Operations Manager</SelectItem>
                      <SelectItem value="Operator">Standard Operator</SelectItem>
                      <SelectItem value="Accountant">Financial Node</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-4">
                <Label className="text-[10px] font-black uppercase text-slate-500 tracking-wider flex items-center gap-2">
                  <Boxes className="h-3 w-3" /> Permission Manifest
                </Label>
                <div className="border border-slate-100 rounded-2xl p-4 bg-slate-50/50">
                  <ScrollArea className="h-[300px] pr-4">
                    <div className="grid grid-cols-1 gap-3">
                      {ALL_PERMISSIONS.map((perm) => (
                        <div key={perm.id} className="flex items-center space-x-3 bg-white p-3 rounded-xl border border-slate-100 shadow-sm">
                          <Checkbox 
                            id={perm.id} 
                            checked={permissions.includes(perm.id)}
                            onCheckedChange={() => handleTogglePermission(perm.id)}
                          />
                          <Label htmlFor={perm.id} className="text-xs font-bold text-slate-700 cursor-pointer flex-1">
                            {perm.label}
                          </Label>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-slate-100">
              <Button type="submit" className="w-full h-14 bg-blue-600 hover:bg-blue-700 text-white font-black uppercase text-sm tracking-[0.2em] rounded-2xl shadow-lg transition-all active:scale-[0.98]">
                Synchronize Identity Node
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <div className="bg-slate-900 p-6 rounded-[2rem] text-white flex items-center justify-between shadow-2xl border border-white/5">
        <div className="flex items-center gap-4">
          <ShieldCheck className="h-8 w-8 text-blue-400" />
          <div>
            <p className="text-xs font-black uppercase tracking-widest text-blue-400 leading-none">Security Registry Active</p>
            <p className="text-sm font-medium opacity-70 mt-1">All identity modifications are logged and audited in the system ledger.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
