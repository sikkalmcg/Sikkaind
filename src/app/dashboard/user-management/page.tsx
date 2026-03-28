'use client';

import { useState, useContext, useMemo, useEffect } from 'react';
import { AppContext } from '../../../firebase/app-provider';
import { Card, CardContent, CardHeader, CardTitle, CardFooter, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { Pencil, Trash2 } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { User, PageKey, Plant } from '@/types';
import { pagePermissions } from '@/lib/permissions';

const permissionKeys = pagePermissions ? Object.keys(pagePermissions) as PageKey[] : [];

export default function UserManagementPage() {
  const context = useContext(AppContext);
  const { toast } = useToast();

  const [activeTab, setActiveTab] = useState('user-list');
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [fullName, setFullName] = useState('');
  const [mobile, setMobile] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [email, setEmail] = useState('');
  const [jobRole, setJobRole] = useState('');
  const [status, setStatus] = useState<'Active' | 'Inactive'>('Active');
  const [plantIds, setPlantIds] = useState<string[]>([]);
  const [permissions, setPermissions] = useState<PageKey[]>([]);
  
  const users = useMemo(() => context?.users || [], [context?.users]);
  const plants: Plant[] = useMemo(() => context?.plants || [], [context?.plants]);

  useEffect(() => {
    if (editingUser) {
      setFullName(editingUser.fullName);
      setMobile(editingUser.mobile);
      setUsername(editingUser.username);
      setEmail(editingUser.email);
      setJobRole(editingUser.jobRole);
      setStatus(editingUser.status);
      setPermissions(editingUser.permissions || []);
      setPlantIds(editingUser.plantIds || []);
      setPassword(''); 
    } else {
      resetFormFields();
    }
  }, [editingUser]);

  const handleTabChange = (value: string) => {
    if (value === 'user-list') setEditingUser(null);
    setActiveTab(value);
  };

  const handlePermissionChange = (key: PageKey, checked: boolean | 'indeterminate') => {
    const isChecked = checked === true;
    setPermissions(prev => isChecked ? [...prev, key] : prev.filter(p => p !== key));
  };

  const handlePlantIdChange = (plantId: string, checked: boolean | 'indeterminate') => {
    const isChecked = checked === true;
    setPlantIds(prev => isChecked ? [...prev, plantId] : prev.filter(id => id !== plantId));
  }

  const resetFormFields = () => {
    setFullName(''); setMobile(''); setUsername(''); setPassword('');
    setEmail(''); setJobRole(''); setStatus('Active'); setPermissions([]); setPlantIds([]);
  };
  
  const resetForm = () => { resetFormFields(); setEditingUser(null); setActiveTab('user-list'); }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!context || !fullName || !mobile || !username || plantIds.length === 0 || (!editingUser && !password)) {
      toast({ variant: 'destructive', title: 'Error', description: 'Please fill all required fields.' });
      return;
    }
    const userData = { fullName, mobile, username, email, jobRole, status, plantIds, permissions, ...(password && { password }) };
    if (editingUser) {
      context.updateUser({ id: editingUser.id, ...userData });
      toast({ title: 'Success', description: 'User updated successfully.' });
    } else {
      context.addUser(userData);
      toast({ title: 'Success', description: 'User created successfully.' });
    }
    resetForm();
  };
  
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold tracking-tight">User Management</h1>
      <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-4">
        <TabsList><TabsTrigger value="user-list">User List</TabsTrigger><TabsTrigger value="create-user">{editingUser ? 'Edit User' : 'Create User'}</TabsTrigger></TabsList>
        <TabsContent value="user-list">
            <Card>
            <CardHeader><CardTitle>User List</CardTitle><CardDescription>List of all system users and their permissions.</CardDescription></CardHeader>
            <CardContent>
                <div className="max-h-[600px] overflow-auto">
                <Table>
                    <TableHeader><TableRow><TableHead>Staff Name</TableHead><TableHead>Contact</TableHead><TableHead>Role</TableHead><TableHead>Assigned Plants</TableHead><TableHead>Permissions</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
                    <TableBody>
                    {users.map(user => (
                        <TableRow key={user.id}>
                        <TableCell className="font-medium"><div className="flex flex-col"><span className="font-bold">{user.fullName}</span><span className="text-xs text-slate-500">@{user.username}</span></div></TableCell>
                        <TableCell><div className="flex flex-col"><span className="text-sm">{user.mobile}</span><span className="text-xs text-slate-500">{user.email}</span></div></TableCell>
                        <TableCell>{user.jobRole}</TableCell>
                        <TableCell><div className="flex flex-wrap gap-1 max-w-xs">{user.plantIds?.map(pid => (<Badge key={pid} variant="secondary" className="font-normal">{pid}</Badge>))}</div></TableCell>
                        <TableCell><div className="flex flex-wrap gap-1 max-w-xs">{user.permissions?.map(p => (<Badge key={p} variant="outline" className="font-normal">{pagePermissions[p]}</Badge>))}</div></TableCell>
                        <TableCell><Badge variant={user.status === 'Active' ? 'default' : 'destructive'}>{user.status}</Badge></TableCell>
                        <TableCell className="text-right"><div className="flex justify-end items-center"><Button variant="ghost" size="icon" onClick={() => { setEditingUser(user); setActiveTab('create-user'); }}><Pencil className="h-4 w-4" /></Button></div></TableCell>
                        </TableRow>
                    ))}
                    </TableBody>
                </Table>
                </div>
            </CardContent>
            </Card>
        </TabsContent>
        <TabsContent value="create-user">
            <Card>
                <CardHeader><CardTitle>{editingUser ? 'Edit User' : 'Create New User'}</CardTitle></CardHeader>
                <form onSubmit={handleSubmit}>
                    <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4"><div className="space-y-2"><Label>Full Name</Label><Input value={fullName} onChange={e => setFullName(e.target.value)} /></div><div className="space-y-2"><Label>Job Role</Label><Input value={jobRole} onChange={e => setJobRole(e.target.value)} /></div></div>
                    <div className="grid grid-cols-2 gap-4"><div className="space-y-2"><Label>Mobile</Label><Input value={mobile} onChange={e => setMobile(e.target.value)} /></div><div className="space-y-2"><Label>Email</Label><Input type="email" value={email} onChange={e => setEmail(e.target.value)} /></div></div>
                    <div className="grid grid-cols-2 gap-4"><div className="space-y-2"><Label>Username</Label><Input value={username} onChange={e => setUsername(e.target.value)} disabled={!!editingUser} /></div><div className="space-y-2"><Label>Password</Label><Input type="password" value={password} onChange={e => setPassword(e.target.value)} /></div></div>
                    </CardContent>
                    <CardFooter className="gap-2"><Button type="submit">{editingUser ? 'Update' : 'Create'}</Button><Button variant="outline" type="button" onClick={resetForm}>Cancel</Button></CardFooter>
                </form>
            </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
