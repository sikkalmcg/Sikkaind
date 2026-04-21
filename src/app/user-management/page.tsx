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
import { doc, onSnapshot, query, collection, orderBy, getDoc, serverTimestamp, setDoc, updateDoc, deleteDoc, where, getDocs, limit, addDoc } from 'firebase/firestore';
import { useLoading } from '@/context/LoadingContext';
import { sanitizeRegistryNode, handleFirestoreError, OperationType } from '@/lib/utils';

/**
 * @fileOverview Security Management Terminal.
 * Handles identity provisioning and access manifest synchronization.
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
    const [accountsPlants, setAccountsPlants] = useState<WithId<Plant>[]>([]);

    const isAdminSession = useMemo(() => {
        return user?.email === 'sikkaind.admin@sikka.com' || user?.email === 'sikkalmcg@gmail.com';
    }, [user?.email]);

    useEffect(() => {
        if (isUserLoading) return;
        if (!user) { router.replace('/login'); return; }

        const checkAuth = async () => {
            if (!firestore) return;
            try {
                let snap = await getDoc(doc(firestore, "users", user.uid));
                const isRoot = isAdminSession;
                
                if (!snap.exists()) {
                    const lastIdentity = localStorage.getItem('slmc_last_identity');
                    const searchEmail = user.email || (lastIdentity?.includes('@') ? lastIdentity : `${lastIdentity}@sikka.com`);
                    
                    const q = query(collection(firestore, "users"), where("email", "==", searchEmail), limit(1));
                    const qSnap = await getDocs(q);
                    if (!qSnap.empty) snap = qSnap.docs[0];
                }

                if (snap.exists() || isRoot) {
                    const data = snap.exists() ? snap.data() as SubUser : null;
                    if (isRoot || (data && (data.jobRole === 'Manager' || data.jobRole === 'Admin'))) {
                        setIsAuthorized(true);
                    } else {
                        router.replace('/modules');
                    }
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
        });

        const unsubAccounts = onSnapshot(collection(firestore, "accounts_plants"), (snap) => {
            setAccountsPlants(snap.docs.map(d => ({ id: d.id, ...d.data() } as WithId<Plant>)));
            setIsLoadingData(false);
        });

        return () => { 
            unsubUsers(); 
            unsubLogistics(); 
            unsubAccounts(); 
        };
    }, [firestore, isAuthorized]);

    const handleUserCreated = async (data: Omit<SubUser, 'id'>) => {
        if (!firestore || !user) return;
        showLoader();
        try {
            const ts = serverTimestamp();
            const cleanUsername = data.username.toLowerCase().replace(/\s+/g, '');
            const systemEmail = cleanUsername === 'sikkaind' ? 'sikkaind.admin@sikka.com' : `${cleanUsername}@sikka.com`;

            const authResponse = await fetch('/api/auth/manage-user', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'createUser',
                    email: systemEmail,
                    password: data.password
                })
            });

            const authResult = await authResponse.json();

            if (!authResponse.ok) {
                throw new Error(authResult.error || "Auth provisioning node failed.");
            }

            const { uid } = authResult;

            await setDoc(doc(firestore, "users", systemEmail), {
                ...data,
                id: systemEmail,
                uid: uid,
                username: cleanUsername,
                email: systemEmail,
                createdAt: ts,
                status: 'Active'
            });

            toast({ title: 'Identity Provisioned', description: `User ${cleanUsername} successfully established.` });
            setActiveTab('user-management');
        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Provisioning Error', description: error.message });
        } finally {
            hideLoader();
        }
    };

    const handleUserUpdated = async (userId: string, data: Partial<SubUser>) => {
        if (!firestore) return;
        showLoader();
        try {
            if (data.password) {
                const userSnap = await getDoc(doc(firestore, "users", userId));
                if (userSnap.exists()) {
                    const userData = userSnap.data() as SubUser;
                    const email = userData.email || (userData.username === 'sikkaind' ? 'sikkaind.admin@sikka.com' : `${userData.username}@sikka.com`);

                    const authResponse = await fetch('/api/auth/manage-user', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            action: 'updatePassword',
                            email: email,
                            password: data.password
                        })
                    });

                    const authResult = await authResponse.json();
                    if (!authResponse.ok) {
                        throw new Error(authResult.error || "Auth registry sync failed.");
                    }
                }
            }

            await updateDoc(doc(firestore, "users", userId), { ...data, lastUpdated: serverTimestamp() });
            toast({ title: 'Registry Updated', description: 'Identity node modified.' });
            setEditingUser(null);
        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Update Failed', description: error.message });
        } finally {
            hideLoader();
        }
    };

    const handleUserDeleted = async (userId: string) => {
        if (!firestore || !user) return;
        showLoader();
        try {
            const userRef = doc(firestore, "users", userId);
            const userSnap = await getDoc(userRef);
            
            if (userSnap.exists()) {
                const userData = userSnap.data();
                await addDoc(collection(firestore, "recycle_bin"), {
                    pageName: "User Management",
                    userName: user.email?.split('@')[0] || "Admin",
                    deletedAt: serverTimestamp(),
                    data: sanitizeRegistryNode({ ...userData, id: userId, type: 'User' })
                });
                await deleteDoc(userRef);
                toast({ title: 'Identity Revoked', description: `User removed from active registry.` });
            }
        } catch (error: any) {
            handleFirestoreError(error, OperationType.DELETE, `users/${userId}`);
        } finally {
            hideLoader();
        }
    };

    return (
        <main className="flex flex-1 flex-col h-full bg-[#f8fafc] animate-in fade-in duration-500">
            <div className="sticky top-0 z-30 bg-white border-b px-4 md:px-8 py-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                    <div className="p-2 bg-primary text-white rounded-lg shadow-lg rotate-3">
                        <Users className="h-6 w-6" />
                    </div>
                    <div>
                        <h1 className="text-2xl md:text-3xl font-black text-primary tracking-tight uppercase">Security Management</h1>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Authorized User Registry</p>
                    </div>
                </div>
            </div>

            <div className="flex-1 p-4 md:p-8 overflow-y-auto space-y-8">
                <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                    <TabsList className="bg-transparent border-b h-12 rounded-none gap-10 p-0 mb-8">
                        <TabsTrigger value="user-access" className="data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:bg-transparent rounded-none px-0 text-sm font-black uppercase tracking-widest text-slate-400 data-[state=active]:text-primary transition-all">Provision User</TabsTrigger>
                        {isAuthorized && <TabsTrigger value="user-management" className="data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:bg-transparent rounded-none px-0 text-sm font-black uppercase tracking-widest text-slate-400 data-[state=active]:text-primary transition-all">Identity Registry ({users.length})</TabsTrigger>}
                    </TabsList>

                    <div className="focus-visible:ring-0">
                        {isLoadingData ? (
                            <div className="flex h-64 flex-col items-center justify-center gap-4">
                                <Loader2 className="h-10 w-10 animate-spin text-primary" />
                                <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 animate-pulse">Syncing Cloud Security Plant...</p>
                            </div>
                        ) : (
                            <>
                                <TabsContent value="user-access" className="m-0 outline-none">
                                    <UserAccessTab 
                                        onUserCreated={handleUserCreated} 
                                        existingUsernames={users.map(u => u.username)} 
                                        logisticsPlants={logisticsPlants}
                                        accountsPlants={accountsPlants}
                                        isAdmin={isAdminSession}
                                    />
                                </TabsContent>
                                {isAuthorized && (
                                    <TabsContent value="user-management" className="m-0 outline-none">
                                        <UserManagementTab 
                                            users={users} 
                                            plants={logisticsPlants} 
                                            onUserUpdated={handleUserUpdated} 
                                            onUserDeleted={handleUserDeleted} 
                                            onUserEdit={setEditingUser} 
                                        />
                                    </TabsContent>
                                )}
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
                    accountsPlants={accountsPlants}
                />
            )}
        </main>
    );
}

