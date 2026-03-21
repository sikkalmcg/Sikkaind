
'use client';
import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
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
} from "@/components/ui/alert-dialog"
import type { WithId, SubUser, UserStatus, Plant } from '@/types';
import UnblockUserModal from './UnblockUserModal';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { SikkaLogisticsPagePermissions, AdminPagePermissionsList, SikkaAccountsPagePermissions } from '@/lib/constants';
import { useUser } from '@/firebase';

interface UserManagementTabProps {
  users: WithId<SubUser>[];
  plants: WithId<Plant>[];
  onUserUpdated: (userId: string, data: Partial<SubUser>) => void;
  onUserDeleted: (userId: string) => void;
  onUserEdit: (user: WithId<SubUser>) => void;
}

const getStatusColor = (status: UserStatus) => {
    switch (status) {
        case 'Active': return 'bg-green-500/80';
        case 'Inactive': return 'bg-yellow-500/80 text-black';
        case 'Blocked': return 'bg-red-500/80';
        default: return 'bg-gray-500/80';
    }
}

export default function UserManagementTab({ users, plants, onUserUpdated, onUserDeleted, onUserEdit }: UserManagementTabProps) {
  const { user: firebaseUser } = useUser();
  const [searchTerm, setSearchTerm] = useState('');
  const [userToUnblock, setUserToUnblock] = useState<WithId<SubUser> | null>(null);
  
  const currentUserDoc = useMemo(() => users.find(u => u.id === firebaseUser?.uid), [users, firebaseUser]);
  
  // Sikkaind is the absolute root admin
  const isSikkaind = currentUserDoc?.username?.toLowerCase() === 'sikkaind' || firebaseUser?.email === 'sikkaind.admin@sikka.com';

  const allPermissionsMap = useMemo(() => new Map(
    [...SikkaLogisticsPagePermissions, ...SikkaAccountsPagePermissions, ...AdminPagePermissionsList].map(p => [p.id, p.label])
  ), []);
  
  const filteredUsers = useMemo(() => {
    return users.filter(u => 
      u.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.mobile.includes(searchTerm) ||
      u.jobRole.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [users, searchTerm]);
  
  const handleBlockToggle = (user: WithId<SubUser>) => {
    if (user.status === 'Blocked') {
        setUserToUnblock(user);
    } else {
        const newStatus = user.status === 'Active' ? 'Inactive' : 'Active';
        onUserUpdated(user.id, { status: newStatus });
    }
  }

  const handleUnblockSave = (userId: string, newPassword?: string) => {
    onUserUpdated(userId, { status: 'Active', loginAttempts: 0, password: newPassword });
    setUserToUnblock(null);
  }

  return (
    <>
    <Card>
      <CardHeader>
        <CardTitle>Manage Users</CardTitle>
        <CardDescription>Comprehensive administration panel for all system users.</CardDescription>
      </CardHeader>
      <CardContent>
        <Input
            placeholder="Search by name, username, mobile, or role..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="mb-4 max-w-sm"
        />
        <div className="rounded-md border">
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Full Name</TableHead>
                        <TableHead>Username</TableHead>
                        {isSikkaind && <TableHead>Password</TableHead>}
                        <TableHead>Job Role</TableHead>
                        <TableHead>Mobile Number</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Action</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {filteredUsers.length === 0 ? (
                        <TableRow><TableCell colSpan={isSikkaind ? 7 : 6} className="text-center h-24">No users found.</TableCell></TableRow>
                    ) : (
                        filteredUsers.map(user => {
                            const isTargetSikkaind = user.username?.toLowerCase() === 'sikkaind';
                            const canEdit = isSikkaind;

                            return (
                            <TableRow key={user.id}>
                                <TableCell className="font-medium">{user.fullName}</TableCell>
                                <TableCell>{user.username}</TableCell>
                                {isSikkaind && <TableCell className="font-mono text-xs">{user.password || '********'}</TableCell>}
                                <TableCell>
                                    <Badge variant="outline" className="bg-primary/5 text-primary border-primary-foreground/20">
                                        {user.jobRole}
                                    </Badge>
                                </TableCell>
                                <TableCell>{user.countryCode || '+91'} {user.mobile}</TableCell>
                                <TableCell>
                                    <Badge className={getStatusColor(user.status)}>{user.status}</Badge>
                                </TableCell>
                                <TableCell className="text-right space-x-2">
                                    <Button variant="outline" size="sm" onClick={() => onUserEdit(user)} disabled={!canEdit}>Edit</Button>
                                    
                                    {!isTargetSikkaind && (
                                        <>
                                            <AlertDialog>
                                                <AlertDialogTrigger asChild>
                                                    <Button variant={user.status === 'Blocked' ? 'secondary' : 'outline'} size="sm" disabled={!canEdit}>
                                                        {user.status === 'Blocked' ? 'Unblock' : user.status === 'Active' ? 'Deactivate' : 'Activate'}
                                                    </Button>
                                                </AlertDialogTrigger>
                                                <AlertDialogContent>
                                                    <AlertDialogHeader>
                                                        <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                                                        <AlertDialogDescription>
                                                            {user.status === 'Blocked' 
                                                                ? 'This will open the password reset modal to unblock the user.'
                                                                : `This will change the user's status to ${user.status === 'Active' ? 'Inactive' : 'Active'}.`
                                                            }
                                                        </AlertDialogDescription>
                                                    </AlertDialogHeader>
                                                    <AlertDialogFooter>
                                                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                                                        <AlertDialogAction onClick={() => handleBlockToggle(user)}>Confirm</AlertDialogAction>
                                                    </AlertDialogFooter>
                                                </AlertDialogContent>
                                            </AlertDialog>
                                            <AlertDialog>
                                                <AlertDialogTrigger asChild>
                                                    <Button variant="destructive" size="sm" disabled={!canEdit}>Remove</Button>
                                                </AlertDialogTrigger>
                                                <AlertDialogContent>
                                                    <AlertDialogHeader><AlertDialogTitle>Are you sure?</AlertDialogTitle><AlertDialogDescription>This will permanently delete the user.</AlertDialogDescription></AlertDialogHeader>
                                                    <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={() => onUserDeleted(user.id)}>Confirm</AlertDialogAction></AlertDialogFooter>
                                                </AlertDialogContent>
                                            </AlertDialog>
                                        </>
                                    )}
                                </TableCell>
                            </TableRow>
                        )})
                    )}
                </TableBody>
            </Table>
        </div>
      </CardContent>
    </Card>
    {userToUnblock && (
        <UnblockUserModal 
            user={userToUnblock}
            isOpen={!!userToUnblock}
            onClose={() => setUserToUnblock(null)}
            onSave={handleUnblockSave}
        />
    )}
    </>
  );
}
