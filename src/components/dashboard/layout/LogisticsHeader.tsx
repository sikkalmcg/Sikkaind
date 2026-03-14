'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { 
  Search, 
  LayoutGrid, 
  LogOut, 
  User, 
  Settings,
  Menu,
  ChevronRight,
  UserCircle,
  Loader2
} from 'lucide-react';
import { useUser, useAuth, useFirestore } from '@/firebase';
import { NotificationBell } from '@/components/dashboard/notification-bell';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useToast } from '@/hooks/use-toast';
import UserProfileModal from "@/components/dashboard/user-profile/UserProfileModal";
import { doc, getDoc, query, collection, where, limit, getDocs } from 'firebase/firestore';
import type { SubUser, WithId } from '@/types';

interface LogisticsHeaderProps {
  onToggleSidebar: () => void;
}

export default function LogisticsHeader({ onToggleSidebar }: LogisticsHeaderProps) {
  const { user, isUserLoading } = useUser();
  const auth = useAuth();
  const firestore = useFirestore();
  const { toast } = useToast();
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [profile, setProfile] = useState<WithId<SubUser> | null>(null);
  const [searchValue, setSearchValue] = useState(searchParams.get('search') || '');

  useEffect(() => {
    if (!firestore || !user) return;

    const fetchProfile = async () => {
        try {
            const lastIdentity = localStorage.getItem('slmc_last_identity');
            const searchEmail = user.email || (lastIdentity?.includes('@') ? lastIdentity : `${lastIdentity}@sikka.com`);
            
            let userDocSnap = null;
            const q = query(collection(firestore, "users"), where("email", "==", searchEmail), limit(1));
            const qSnap = await getDocs(q);
            if (!qSnap.empty) {
                userDocSnap = qSnap.docs[0];
            } else {
                const uidSnap = await getDoc(doc(firestore, "users", user.uid));
                if (uidSnap.exists()) userDocSnap = uidSnap;
            }

            if (userDocSnap) {
                setProfile({ id: userDocSnap.id, ...userDocSnap.data() } as WithId<SubUser>);
            }
        } catch (e) {
            console.error("Header Auth Sync Error:", e);
        }
    };
    fetchProfile();
  }, [firestore, user]);

  const isAdminSession = user?.email === 'sikkaind.admin@sikka.com' || user?.email === 'sikkalmcg@gmail.com' || profile?.username === 'sikkaind';
  const displayName = isAdminSession ? 'AJAY SOMRA' : (profile?.fullName || user?.email?.split('@')[0] || 'Operator');

  const handleSearch = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      const term = e.currentTarget.value.trim();
      const params = new URLSearchParams(searchParams.toString());
      if (term) {
        params.set('search', term);
      } else {
        params.delete('search');
      }
      router.push(`${pathname}?${params.toString()}`);
    }
  };

  const getPagePlaceholder = useMemo(() => {
    if (pathname.includes('vehicle-entry')) return "Search Gate Registry (Vehicle, Pilot)...";
    if (pathname.includes('shipment-plan')) return "Search Order Manifest (ID, Consignor)...";
    if (pathname.includes('vehicle-assign')) return "Search Open Orders (Party, Dest)...";
    if (pathname.includes('trip-board')) return "Search Mission Board (Trip ID, Vehicle)...";
    if (pathname.includes('freight-management')) return "Search Settlement Ledger (Voucher, UTR)...";
    if (pathname.includes('fuel-management')) return "Search Fuel Registry (Slip, Vehicle)...";
    return "Global Registry Search (Vehicle, LR, Trip, Party)...";
  }, [pathname]);

  const breadcrumbs = pathname.split('/').filter(Boolean).map(segment => 
    segment.charAt(0).toUpperCase() + segment.slice(1).replace(/-/g, ' ')
  );

  const displayAvatarUrl = avatarUrl || profile?.photoURL || user?.photoURL;

  return (
    <>
      <header className="sticky top-0 z-40 flex h-16 w-full items-center justify-between border-b bg-white px-4 md:px-8 shadow-sm">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={onToggleSidebar} className="lg:hidden text-primary">
            <Menu className="h-5 w-5" />
          </Button>
          <div className="hidden lg:flex items-center gap-2 text-xs font-bold text-muted-foreground uppercase tracking-widest">
            <Link href="/dashboard" className="hover:text-primary transition-colors">Home</Link>
            {breadcrumbs.map((crumb, i) => (
              <div key={i} className="flex items-center gap-2">
                <ChevronRight className="h-3 w-3 opacity-30" />
                <span className={i === breadcrumbs.length - 1 ? "text-primary font-black" : ""}>{crumb}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="flex flex-1 items-center justify-center px-2 md:px-12">
          <div className="relative w-full max-w-lg">
            <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input 
              placeholder={getPagePlaceholder}
              value={searchValue}
              onChange={(e) => setSearchValue(e.target.value)}
              className="h-10 w-full rounded-xl border-slate-200 bg-slate-50 pl-11 focus-visible:ring-primary text-sm font-medium shadow-inner"
              onKeyDown={handleSearch}
            />
          </div>
        </div>

        <div className="flex items-center gap-2 md:gap-4">
          <NotificationBell />
          
          <Link href="/modules" className="hidden sm:block">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" className="text-slate-500 hover:text-primary transition-colors">
                    <LayoutGrid className="h-5 w-5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Module Switching</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </Link>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="relative h-9 rounded-full px-1 pl-3 transition-all hover:bg-slate-100 flex items-center gap-3">
                <div className="flex flex-col items-end hidden md:flex">
                  <span className="text-[10px] font-black uppercase text-primary leading-none">{displayName}</span>
                  <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-tighter mt-0.5">{isAdminSession ? 'Master Admin' : 'Registry Op'}</span>
                </div>
                <Avatar className="h-8 w-8 ring-2 ring-primary/10">
                  <AvatarImage src={displayAvatarUrl || undefined} alt={displayName} className="object-cover" />
                  <AvatarFallback className="bg-primary text-primary-foreground font-black text-xs">{displayName[0]}</AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56 p-2 border-slate-200 shadow-2xl">
              <DropdownMenuLabel className="p-2">
                <div className="flex items-center gap-3">
                    <UserCircle className="h-4 w-4 text-slate-400" />
                    <span className="text-xs font-black uppercase tracking-tight text-slate-900">User Context</span>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => setIsProfileModalOpen(true)} className="cursor-pointer font-bold rounded-lg py-2">
                <User className="mr-2 h-4 w-4 text-blue-600" /> Profile Details
              </DropdownMenuItem>
              <DropdownMenuItem className="cursor-pointer font-bold rounded-lg py-2">
                <Settings className="mr-2 h-4 w-4 text-slate-600" /> System Preferences
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="cursor-pointer text-red-600 focus:text-red-600 font-black uppercase text-[10px] tracking-widest py-2.5 rounded-lg" onClick={() => auth?.signOut()}>
                <LogOut className="mr-2 h-4 w-4" /> Log out Registry
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      <UserProfileModal 
        isOpen={isProfileModalOpen}
        onClose={() => setIsProfileModalOpen(false)}
        onPhotoUpdate={(url) => setAvatarUrl(url)}
        currentAvatar={displayAvatarUrl}
      />
    </>
  );
}
