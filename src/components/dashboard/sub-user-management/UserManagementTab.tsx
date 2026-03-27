'use client';

import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Search, Edit2, Trash2, ShieldCheck, Mail, Smartphone, History, Briefcase } from 'lucide-react';
import type { WithId, SubUser, Plant } from '@/types';
import { cn } from '@/lib/utils';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";

interface UserManagementTabProps {
  users: WithId<SubUser>[];
  plants: Plant[];
  onUserUpdated: (userId: string, data: Partial<SubUser>) => Promise<void>;
  onUserDeleted: (userId: string) => Promise<void>;
  onUserEdit: (user: WithId<SubUser>) => void;
}

export default function UserManagementTab({ users, plants, onUserDeleted, onUserEdit }: UserManagementTabProps) {
  const [searchTerm, setSearchTerm] = useState('');

  const filteredUsers = useMemo(() => {
    const s = searchTerm.toLowerCase();
    return users.filter(u => 
      u.fullName.toLowerCase().includes(s) ||
      u.username.toLowerCase().includes(s) ||
      u.email.toLowerCase().includes(s) ||
      u.jobRole.toLowerCase().includes(s)
    );
  }, [users, searchTerm]);

  return (
    <Card className="border-none shadow-xl rounded-[2.5rem] bg-white overflow-hidden animate-in fade-in duration-500">
      <CardHeader className="bg-slate-50 border-b p-8 flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-white rounded-lg border shadow-sm"><History className="h-5 w-5 text-blue-900" /></div>
          <div>
            <CardTitle className="text-lg font-black uppercase tracking-tight text-blue-900 italic">Identity History Registry</CardTitle>
            <CardDescription className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Authorized personnel lifecycle audit node</CardDescription>
          </div>
        </div>
        <div className="relative group">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 group-focus-within:text-blue-900 transition-colors" />
          <Input 
            placeholder="Search by name, node, role..." 
            value={searchTerm} 
            onChange={(e) => setSearchTerm(e.target.value)} 
            className="pl-10 w-[320px] h-11 rounded-2xl bg-white border-slate-200 shadow-sm focus-visible:ring-blue-900 font-bold" 
          />
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-slate-50/50">
              <TableRow className="h-14 hover:bg-transparent border-b border-slate-100">
                <TableHead className="text-[10px] font-black uppercase px-8 text-slate-400">Staff Entity</TableHead>
                <TableHead className="text-[10px] font-black uppercase px-4 text-slate-400">System Role</TableHead>
                <TableHead className="text-[10px] font-black uppercase px-4 text-slate-400">Contact Node</TableHead>
                <TableHead className="text-[10px] font-black uppercase px-4 text-slate-400">Node Scope</TableHead>
                <TableHead className="text-[10px] font-black uppercase px-4 text-center text-slate-400">Status</TableHead>
                <TableHead className="text-[10px] font-black uppercase px-8 text-right text-slate-400">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredUsers.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="h-64 text-center text-slate-400 italic font-medium uppercase tracking-[0.2em] opacity-40">No identity nodes matching criteria.</TableCell></TableRow>
              ) : (
                filteredUsers.map((user) => (
                  <TableRow key={user.id} className="h-20 hover:bg-blue-50/20 transition-all border-b border-slate-50 last:border-0 group">
                    <TableCell className="px-8">
                      <div className="flex flex-col gap-0.5">
                        <span className="font-black text-slate-900 uppercase text-sm leading-tight">{user.fullName}</span>
                        <span className="text-[9px] font-black text-blue-600 uppercase tracking-widest">@{user.username}</span>
                      </div>
                    </TableCell>
                    <TableCell className="px-4">
                      <div className="flex items-center gap-2">
                        <div className="p-1.5 bg-blue-50 rounded-lg"><Briefcase className="h-3 w-3 text-blue-600" /></div>
                        <span className="text-xs font-bold text-slate-700 uppercase">{user.jobRole || 'Standard Operator'}</span>
                      </div>
                    </TableCell>
                    <TableCell className="px-4">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 text-[10px] text-slate-500 font-bold uppercase"><Mail className="h-3 w-3" /> {user.email}</div>
                        <div className="flex items-center gap-2 text-[10px] text-slate-500 font-mono"><Smartphone className="h-3 w-3" /> +91 {user.mobile}</div>
                      </div>
                    </TableCell>
                    <TableCell className="px-4">
                      <div className="flex flex-wrap gap-1.5 max-w-[200px]">
                        {(user.plantIds || []).map(pid => (
                          <Badge key={pid} variant="outline" className="bg-slate-50 text-slate-500 border-slate-200 text-[8px] font-black px-2 h-5">{pid}</Badge>
                        ))}
                        {user.access_accounts && <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[8px] font-black px-2 h-5 uppercase">ACCOUNTS HUB</Badge>}
                      </div>
                    </TableCell>
                    <TableCell className="px-4 text-center">
                      <Badge className={cn(
                        "font-black uppercase text-[9px] px-3 h-6 border-none shadow-sm",
                        user.status === 'Active' ? "bg-emerald-600 text-white" : "bg-red-600 text-white"
                      )}>
                        {user.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="px-8 text-right">
                      <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-all duration-300">
                        <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl text-blue-600 hover:bg-blue-50" onClick={() => onUserEdit(user)}>
                          <Edit2 className="h-4 w-4" />
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl text-red-600 hover:bg-red-50">
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent className="border-none shadow-3xl p-0 overflow-hidden bg-white rounded-3xl">
                            <div className="p-8 bg-red-50 border-b border-red-100 flex items-center gap-5">
                              <div className="p-3 bg-red-600 text-white rounded-2xl shadow-xl"><ShieldCheck className="h-6 w-6" /></div>
                              <div>
                                <AlertDialogTitle className="text-xl font-black uppercase text-red-900 tracking-tight">Revoke Staff Identity?</AlertDialogTitle>
                                <AlertDialogDescription className="text-red-700 font-bold text-[9px] uppercase tracking-widest mt-1">Authorized Registry Disposal</AlertDialogDescription>
                              </div>
                            </div>
                            <div className="p-10 space-y-6">
                              <p className="text-sm font-medium text-slate-600 leading-relaxed italic">"You are about to permanently erase the identity manifest for **{user.fullName}** from the mission database. This will restrict all future system handshake attempts."</p>
                            </div>
                            <AlertDialogFooter className="bg-slate-50 p-6 flex-row justify-end gap-3 border-t">
                              <AlertDialogCancel className="font-bold border-slate-200 px-8 h-11 rounded-xl m-0">Abort</AlertDialogCancel>
                              <AlertDialogAction onClick={() => onUserDeleted(user.id)} className="bg-red-600 hover:bg-red-700 text-white font-black uppercase text-[10px] tracking-widest px-10 h-11 rounded-xl shadow-lg border-none">Confirm Purge</AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
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
  );
}