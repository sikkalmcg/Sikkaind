
'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useUser, useAuth, useFirestore } from '@/firebase';
import { doc, query, collection, where, limit, getDocs } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  Briefcase, 
  Loader2, 
  LogOut, 
  Truck, 
  Users, 
  User as UserIcon 
} from 'lucide-react';
import type { SubUser, WithId } from '@/types';
import sikkalogolarge from '@/assets/logo.png';
import backmoduleimg from '@/assets/hero-freight.jpg';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import UserProfileModal from "@/components/dashboard/user-profile/UserProfileModal";
import { PlaceHolderImages } from '@/lib/placeholder-images';

export default function ModulesPage() {
  const { user, isUserLoading } = useUser();
  const auth = useAuth();
  const router = useRouter();
  const firestore = useFirestore();
  const [profile, setProfile] = useState<WithId<SubUser> | null>(null);
  const [isProfileModalOpen, setProfileModalOpen] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [isLoadingProfile, setIsLoadingProfile] = useState(true);

  useEffect(() => {
    if (isUserLoading) return;
    if (!user) {
      router.replace('/login');
      return;
    }

    const fetchAndSetUser = async () => {
      if (!firestore) return;
      setIsLoadingProfile(true);
      try {
        const lastIdentity = localStorage.getItem('slmc_last_identity');
        const searchEmail = user.email || (lastIdentity?.includes('@') ? lastIdentity : `${lastIdentity}@sikka.com`);
        
        const q = query(collection(firestore, "users"), where("email", "==", searchEmail), limit(1));
        const qSnap = await getDocs(q);
        
        if (!qSnap.empty) {
            const userDocSnap = qSnap.docs[0];
            const userData = { id: userDocSnap.id, ...userDocSnap.data() } as WithId<SubUser>;
            setProfile(userData);
        } else {
            // Default Profile for unmapped accounts (Fallback Node)
            setProfile({
                id: user.uid,
                fullName: 'System Operator',
                username: lastIdentity || 'guest',
                jobRole: 'Sub-User',
                mobile: '0000000000',
                status: 'Active',
                access_logistics: false,
                access_accounts: false,
                permissions: [],
                loginAttempts: 0
            } as WithId<SubUser>);
        }
      } catch (error) {
          console.error("Module Profile Sync Error:", error);
      } finally {
          setIsLoadingProfile(false);
      }
    };

    fetchAndSetUser();
  }, [user, isUserLoading, router, firestore]);

  const handleLogout = () => {
    if (auth) {
      auth.signOut();
    }
  };

  const isSikkaind = useMemo(() => profile?.username?.toLowerCase() === 'sikkaind' || user?.email === 'sikkaind.admin@sikka.com' || user?.email === 'sikkalmcg@gmail.com', [profile, user]);
  const isAdmin = useMemo(() => isSikkaind || profile?.jobRole === 'Admin', [isSikkaind, profile]);
  const isManager = useMemo(() => profile?.jobRole === 'Manager', [profile]);
  
  // ACCESS CONTROL LOGIC NODE
  const canAccessLogistics = useMemo(() => 
    (isAdmin || isManager || profile?.access_logistics) && (profile?.permissions?.includes('live-dashboard') || isAdmin), 
  [isAdmin, isManager, profile]);

  const canAccessAccounts = useMemo(() => 
    (isAdmin || isManager || profile?.access_accounts) && (profile?.permissions?.includes('sikka-accounts-dashboard') || isAdmin), 
  [isAdmin, isManager, profile]);

  const canAccessSecurity = useMemo(() => 
    isAdmin || isManager, 
  [isAdmin, isManager]);

  if (isUserLoading || isLoadingProfile || !profile) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-slate-900">
        <div className="flex flex-col items-center gap-4">
            <Loader2 className="h-12 w-12 animate-spin text-blue-400" />
            <p className="text-[10px] font-black uppercase text-slate-500 tracking-[0.4em]">Resolving Identity Node...</p>
        </div>
      </div>
    );
  }

  const displayName = profile.fullName;
  const username = profile.username;
  const finalAvatarUrl = avatarUrl || profile?.photoURL || user?.photoURL;

  const logoSrc = sikkalogolarge;
  const bgUrl = backmoduleimg;

  return (
    <>
      <div className="relative min-h-screen w-full">
        <div className="absolute inset-0 z-0">
            <Image
                src={backmoduleimg}
                alt="Logistics Background"
                fill
                className="object-cover"
                priority
            />
            <div className="absolute inset-0 bg-slate-900/80" />
        </div>

        <header className="absolute top-0 left-0 right-0 z-20 flex h-16 items-center justify-end px-6">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="rounded-full bg-white/10 hover:bg-white/20 border border-white/20 transition-all overflow-hidden p-0 h-10 w-10">
                <Avatar className="h-10 w-10">
                  <AvatarImage src={finalAvatarUrl || undefined} alt="User avatar" className="object-cover" />
                  <AvatarFallback className="bg-primary text-primary-foreground font-black">{displayName[0]?.toUpperCase() || 'U'}</AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56 p-2 shadow-2xl">
              <DropdownMenuLabel className="p-2">
                <div className="flex flex-col space-y-1">
                  <p className="text-sm font-bold leading-none">{displayName}</p>
                  <p className="text-[10px] font-black uppercase text-muted-foreground">@{username}</p>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => setProfileModalOpen(true)} className="cursor-pointer font-bold">
                <UserIcon className="mr-2 h-4 w-4" />
                <span>Profile</span>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleLogout} className="cursor-pointer text-red-600 focus:text-red-600 font-black uppercase text-[10px] tracking-widest">
                <LogOut className="mr-2 h-4 w-4" />
                <span>Log out Registry</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </header>

        <div className="relative z-10 flex min-h-screen flex-col items-center justify-center p-4">
          <div className="text-center">
            <div className="relative w-[500px] h-[200px] md:w-[700px] md:h-[300px] mx-auto mb-10 p-4 transition-all duration-500 filter brightness-[1.75] contrast-[1.1] drop-shadow-[0_0_30px_rgba(37,99,235,0.4)] hover:brightness-[2] hover:scale-105 overflow-hidden">
              <Image
                src={sikkalogolarge}
                alt="Sikka LMC Logo"
                fill
                className="object-contain"
                priority
              />
            </div>
          </div>

          <div className="grid w-full max-w-6xl grid-cols-1 gap-8 md:grid-cols-3">
            {canAccessLogistics && (
              <Link href="/dashboard">
                <Card className="group flex h-full transform cursor-pointer flex-col border-white/30 bg-white/80 text-gray-800 transition-all duration-300 hover:scale-105 hover:border-blue-400 hover:shadow-2xl">
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-2xl font-black text-slate-800 uppercase italic">Logistics Hub</CardTitle>
                    <Truck className="h-8 w-8 text-blue-600 transition-transform group-hover:translate-x-1" />
                  </CardHeader>
                  <CardContent className="flex-grow">
                    <p className="text-gray-700 font-medium text-xs font-black uppercase tracking-wider">Access Authorized Logistics Management Registry</p>
                  </CardContent>
                </Card>
              </Link>
            )}
            
            {canAccessAccounts && (
              <Link href="/sikka-accounts/dashboard">
                <Card className="group flex h-full transform cursor-pointer flex-col border-white/30 bg-white/80 text-gray-800 transition-all duration-300 hover:scale-105 hover:border-blue-400 hover:shadow-2xl">
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-2xl font-black text-slate-800 uppercase italic">Accounts ERP</CardTitle>
                    <Briefcase className="h-8 w-8 text-blue-600 transition-transform group-hover:translate-x-1" />
                  </CardHeader>
                  <CardContent className="flex-grow">
                    <p className="text-gray-700 font-medium text-xs font-black uppercase tracking-wider">Financial Control & Invoicing Registry Module</p>
                  </CardContent>
                </Card>
              </Link>
            )}
            
            {canAccessSecurity && (
              <Link href="/user-management">
                <Card className="group flex h-full transform cursor-pointer flex-col border-white/30 bg-white/80 text-gray-800 transition-all duration-300 hover:scale-105 hover:border-blue-400 hover:shadow-2xl">
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-2xl font-black text-slate-800 uppercase italic">Security Node</CardTitle>
                    <Users className="h-8 w-8 text-blue-600 transition-transform group-hover:translate-x-1" />
                  </CardHeader>
                  <CardContent className="flex-grow">
                    <p className="text-gray-700 font-medium text-xs font-black uppercase tracking-wider">Identity Control & Authorization Registry</p>
                  </CardContent>
                </Card>
              </Link>
            )}
          </div>

          <div className="absolute bottom-4 right-4 text-xs text-white/50 font-black uppercase tracking-widest">
            <p>Copyright © 2025 Sikka Industries & Logistics. All Rights Reserved.</p>
          </div>
        </div>
      </div>

      <UserProfileModal 
        isOpen={isProfileModalOpen} 
        onClose={() => setProfileModalOpen(false)}
        onPhotoUpdate={(url) => setAvatarUrl(url)}
        currentAvatar={finalAvatarUrl}
      />
    </>
  );
}
