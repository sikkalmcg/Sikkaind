
'use client';
import { useState, useEffect, useMemo } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import type { WithId, SubUser, Plant } from '@/types';
import UserAccessTab from '@/components/dashboard/sub-user-management/UserAccessTab';
import UserManagementTab from '@/components/dashboard/sub-user-management/UserManagementTab';
import EditUserModal from '@/components/dashboard/sub-user-management/EditUserModal';
import { useUser, useAuth, useFirestore } from '@/firebase';
import { useRouter } from 'next/navigation';
import { Loader2, Users, ShieldCheck, WifiOff } from 'lucide-react';
import { doc, onSnapshot, query, collection, orderBy, getDoc, where, getDocs, limit, updateDoc, serverTimestamp } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useLoading } from '@/context/LoadingContext';
import { normalizePlantId } from '@/lib/utils';

/**
 * @fileOverview Security Management Terminal.
 * Central node for authorized personnel identity provisioning.
 */
export default function UserManagementPage() {
    const { user, isUserLoading } = useUser();
    const firestore = useFirestore();
    const router = useRouter();
    const { toast } = useToast();
    const { showLoader, hideLoader } = useLoading();

    const [isAuthorized, setIsAuthorized] = useState(false);
    const [activeTab, setActiveTab] = useState('user-access');
    const [users, setUsers] = useState<WithId<SubUser>[]>([]);
    const [isLoadingData, setIsLoadingData] = useState(true);
    const [editingUser, setEditingUser] = useState<WithId<SubUser> | null>(null);
    const [logisticsPlants, setLogisticsPlants] = useState<WithId<Plant>[]>([]);

    const isAdminSession = useMemo(() => {
        return user?.email === 'sikkaind.admin@sikka.com' || user?.email === 'sikkalmcg@gmail.com';
    }, [user?.email]);

    useEffect(() => {
        if (isUserLoading) return;
        if (!user) { router.replace('/login'); return; }

        const checkAuth = async () => {
            if (!firestore) return;
            try {
                const searchEmail = user.email;
                if (!searchEmail) return;
                
                const q = query(collection(firestore, "users"), where("email", "==", searchEmail), limit(1));
                const qSnap = await getDocs(q);
                let snap = !qSnap.empty ? qSnap.docs[0] : null;

                if (snap?.exists() || isAdminSession) {
                    const data = snap?.exists() ? snap.data() as SubUser : null;
                    if (isAdminSession || (data && (data.jobRole === 'Admin' || data.jobRole === 'Manager'))) {
                        setIsAuthorized(true);
                    } else {
                        router.replace('/modules');
                    }
                } else {
                    router.replace('/modules');
                }
            } catch (e) {
                router.replace('/login');
            }
        };
        checkAuth();
    }, [user, isUserLoading, firestore, router, isAdminSession]);

    useEffect(() => {
        if (!firestore || !isAuthorized) return;
        setIsLoadingData(true);
        
        const qUsers = query(collection(firestore, "users"), orderBy("fullName"));
        const unsubUsers = onSnapshot(qUsers, (snap) => {
            setUsers(snap.docs.map(d => ({ id: d.id, ...d.data() } as WithId<SubUser>)));
        });

        const unsubLogistics = onSnapshot(collection(firestore, "logistics_plants"), (snap) => {
            setLogisticsPlants(snap.docs.map(d => ({ id: d.id, ...d.data() } as WithId<Plant>)));
            setIsLoadingData(false);
        });

        return () => { 
            unsubUsers(); 
            unsubLogistics(); 
        };
    }, [firestore, isAuthorized]);

    const handleUserCreated = async (data: Omit<SubUser, 'id'>) => {
        if (!firestore || !user) return;
        showLoader();
        try {
            const cleanUsername = data.username.toLowerCase().replace(/\s+/g, '');
            const systemEmail = `${cleanUsername}@sikka.com`;

            // Mission Node: Perform atomic handshake on the server
            const authResponse = await fetch('/api/auth/manage-user', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'createUser',
                    email: systemEmail,
                    password: data.password,
                    userData: {
                        ...data,
                        username: cleanUsername,
                        email: systemEmail,
                        status: 'Active'
                    }
                })
            });

            const authResult = await authResponse.json();

            if (!authResponse.ok) {
                throw new Error(authResult.error || "Registry sync failed.");
            }

            toast({ title: 'Identity Provisioned', description: `User ${cleanUsername} successfully established with plant access.` });
            setActiveTab('user-management');
        } catch (error: any) {
            console.error("Provisioning failure:", error);
            toast({ variant: 'destructive', title: 'Provisioning Error', description: error.message });
        } finally {
            hideLoader();
        }
    };

    const handleUserUpdated = async (userId: string, data: Partial<SubUser>) => {
        if (!firestore) return;
        showLoader();
        try {
            // Registry Correction node: updateDoc and serverTimestamp now properly imported
            await updateDoc(doc(firestore, "users", userId), { 
                ...data, 
                lastUpdated: serverTimestamp() 
            });
            toast({ title: 'Registry Updated', description: 'Identity node modified.' });
            setEditingUser(null);
        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Update Failed', description: error.message });
        } finally {
            hideLoader();
        }
    };

    const handleUserDeleted = async (userId: string) => {
        if (!firestore) return;
        showLoader();
        try {
            // Logical removal node for audit purposes
            await updateDoc(doc(firestore, "users", userId), { status: 'Inactive', isDeleted: true });
            toast({ title: 'Identity Revoked', description: `User node marked as Inactive.` });
        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Error', description: error.message });
        } finally {
            hideLoader();
        }
    };

    if (!isAuthorized && !isUserLoading) return null;

    return (
        <main className="flex flex-1 flex-col h-full bg-[#f8fafc] animate-in fade-in duration-500">
            <div className="sticky top-0 z-30 bg-white border-b px-8 py-6 flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <div className="p-3 bg-blue-900 text-white rounded-2xl shadow-xl rotate-3">
                        <Users className="h-7 w-7" />
                    </div>
                    <div>
                        <h1 className="text-3xl font-black text-blue-900 tracking-tight uppercase italic">Security Management</h1>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Authorized Operator Registry</p>
                    </div>
                </div>
            </div>

            <div className="flex-1 p-8 overflow-y-auto space-y-8">
                <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                    <TabsList className="bg-transparent border-b h-12 rounded-none gap-10 p-0 mb-10">
                        <TabsTrigger value="user-access" className="data-[state=active]:border-b-4 data-[state=active]:border-blue-900 data-[state=active]:bg-transparent rounded-none px-0 text-sm font-black uppercase tracking-widest text-slate-400 data-[state=active]:text-blue-900 transition-all">Provision User</TabsTrigger>
                        <TabsTrigger value="user-management" className="data-[state=active]:border-b-4 data-[state=active]:border-blue-900 data-[state=active]:bg-transparent rounded-none px-0 text-sm font-black uppercase tracking-widest text-slate-400 data-[state=active]:text-blue-900 transition-all">Identity Registry ({users.length})</TabsTrigger>
                    </TabsList>

                    <div className="focus-visible:ring-0">
                        {isLoadingData ? (
                            <div className="flex h-64 flex-col items-center justify-center gap-4">
                                <Loader2 className="h-10 w-10 animate-spin text-blue-900" />
                                <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 animate-pulse">Syncing Cloud Security Node...</p>
                            </div>
                        ) : (
                            <>
                                <TabsContent value="user-access" className="m-0 outline-none">
                                    <UserAccessTab 
                                        onUserCreated={handleUserCreated} 
                                        existingUsernames={users.map(u => u.username)} 
                                        logisticsPlants={logisticsPlants}
                                        isAdmin={isAdminSession}
                                    />
                                </TabsContent>
                                <TabsContent value="user-management" className="m-0 outline-none">
                                    <UserManagementTab 
                                        users={users} 
                                        plants={logisticsPlants} 
                                        onUserUpdated={handleUserUpdated} 
                                        onUserDeleted={handleUserDeleted} 
                                        onUserEdit={setEditingUser} 
                                    />
                                </TabsContent>
                            </>
                        )}
                    </div>
                </Tabs>
            </div>

            {editingUser && (
                <EditUserModal 
                    isOpen={!!editingUser} 
                    onClose={() => setEditingUser(null)} 
                    user={editingUser} 
                    onUserUpdated={handleUserUpdated}
                    logisticsPlants={logisticsPlants}
                    accountsPlants={[]}
                />
            )}
        </main>
    );
}
