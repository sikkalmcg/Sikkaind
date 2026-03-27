'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useUser, useAuth, useFirestore } from '@/firebase';
import { doc, getDoc, query, collection, where, limit, getDocs } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  Loader2, 
  LogOut, 
  Truck, 
  Users, 
  User as UserIcon,
  AlertCircle,
  ShieldCheck
} from 'lucide-react';
import type { SubUser, WithId } from '@/types';
import sikkalogolarge from '@/assets/logo.png';
import backmoduleimg from '@/assets/hero-freight.png';
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

export default function ModulesPage() {
  const { user, isUserLoading } = useUser();
  const auth = useAuth();
  const router = useRouter();
  const firestore = useFirestore();
  const [profile, setProfile] = useState<WithId<SubUser> | null>(null);
  const [isProfileModalOpen, setProfileModalOpen] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [isLoadingProfile, setIsLoadingProfile] = useState(true);
  const [profileError, setProfileError] = useState<string | null>(null);

  useEffect(() => {
    if (isUserLoading) return;
    if (!user) {
      router.replace('/login');
      return;
    }

    const fetchAndSetUser = async () => {
      if (!firestore || !auth) return;
      setIsLoadingProfile(true);
      try {
        const lastIdentity = localStorage.getItem('slmc_last_identity');
        const searchEmail = user.email || (lastIdentity?.includes('@') ? lastIdentity : `${lastIdentity}@sikka.com`);
        
        if (!searchEmail) {
            throw new Error("User email not available.");
        }

        const userDocSnap = await getDoc(doc(firestore, "users", searchEmail));
        
        if (userDocSnap.exists()) {
            const userData = { id: userDocSnap.id, ...userDocSnap.data() } as WithId<SubUser>;
            setProfile(userData);
        } else {
            if (user.email === 'sikkaind.admin@sikka.com') {
                const tempAdminProfile = {
                    id: user.email,
                    email: user.email,
                    username: 'sikkaind',
                    fullName: 'Sikka Admin (Emergency Mode)',
                    jobRole: 'Admin',
                    status: 'Active',
                    plantId: '1426',
                } as WithId<SubUser>;
                setProfile(tempAdminProfile);
                setProfileError(null); 
            } else {
                setProfileError("User profile not found in database. Please contact an administrator. Logging out...");
                setTimeout(() => {
                    auth.signOut().then(() => {
                        router.replace('/login');
                    });
                }, 3000);
            }
        }
      } catch (error) {
          console.error("Module Profile Sync Error:", error);
          if (user.email === 'sikkaind.admin@sikka.com') {
              const tempAdminProfile = {
                  id: user.email,
                  email: user.email,
                  username: 'sikkaind',
                  fullName: 'Sikka Admin (Emergency Mode)',
                  jobRole: 'Admin',
                  status: 'Active',
                  plantId: '1426',
              } as WithId<SubUser>;
              setProfile(tempAdminProfile);
              setProfileError(null);
          } else {
              setProfileError("Error syncing profile. Logging out...");
              setTimeout(() => {
                if(auth) {
                    auth.signOut().then(() => {
                        router.replace('/login');
                    });
                }
              }, 3000);
          }
      } finally {
          setIsLoadingProfile(false);
      }
    };

    fetchAndSetUser();
  }, [user, isUserLoading, router, firestore, auth]);

  const handleLogout = () => {
    if (auth) {
      auth.signOut();
    }
  };

  const isSikkaind = useMemo(() => profile?.username?.toLowerCase() === 'sikkaind' || user?.email === 'sikkaind.admin@sikka.com' || user?.email === 'sikkalmcg@gmail.com', [profile, user]);
  const isAdmin = useMemo(() => isSikkaind || profile?.jobRole === 'Admin', [isSikkaind, profile]);
  
  const canAccessLogistics = useMemo(() => !!profile, [profile]);
  const canAccessUserManagement = useMemo(() => isAdmin, [isAdmin]);

  if (isUserLoading || isLoadingProfile || !profile) {
    if (profileError) {
        return (
            <div className="flex h-screen w-screen items-center justify-center bg-slate-900">
                <div className="flex flex-col items-center gap-4 text-center">
                    <AlertCircle className="h-12 w-12 text-red-400" />
                    <p className="text-md font-bold text-red-400">{profileError}</p>
                    <p className="text-[10px] font-black uppercase text-slate-500 tracking-[0.4em]">Redirecting to Login...</p>
                </div>
            </div>
        );
    }
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

        <div className="relative z-10 flex min-h-.screen flex-col items-center justify-center p-4">
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

          <div className="grid w-full max-w-4xl grid-cols-1 gap-8 md:grid-cols-2">
            {canAccessLogistics && (
              <Link href="/dashboard">
                <Card className="group flex h-full flex-col justify-between overflow-hidden rounded-xl border-2 border-transparent bg-slate-800/50 shadow-lg transition-all duration-300 hover:border-blue-500/50 hover:bg-slate-800 hover:shadow-blue-500/20">
                  <CardHeader>
                    <CardTitle className='flex items-center gap-3 text-blue-400'>
                      <Truck />
                      <span className='text-2xl font-bold'>Logistics Hub</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className='text-slate-400'>Manage and track all logistics operations.</p>
                  </CardContent>
                </Card>
              </Link>
            )}
            {canAccessUserManagement && (
              <Link href="/user-management">
                <Card className="group flex h-full flex-col justify-between overflow-hidden rounded-xl border-2 border-transparent bg-slate-800/50 shadow-lg transition-all duration-300 hover:border-purple-500/50 hover:bg-slate-800 hover:shadow-purple-500/20">
                  <CardHeader>
                    <CardTitle className='flex items-center gap-3 text-purple-400'>
                      <Users />
                      <span className='text-2xl font-bold'>User Management</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className='text-slate-400'>Administer user accounts and permissions.</p>
                  </CardContent>
                </Card>
              </Link>
            )}
          </div>
        </div>
      </div>
      <UserProfileModal 
        isOpen={isProfileModalOpen} 
        onClose={() => setProfileModalOpen(false)} 
        userProfile={profile} 
        setUserProfile={setProfile} 
      />
    </>
  );
}