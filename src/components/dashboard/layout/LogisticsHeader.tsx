'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth, useUser } from '@/firebase';
import { signOut } from 'firebase/auth';
import { Loader2, User as UserIcon, LogOut, Bell, Menu } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import UserProfileModal from '@/components/dashboard/user-profile/UserProfileModal'; 
import { NotificationBell } from '@/components/dashboard/notification-bell';
import { useToast } from '@/hooks/use-toast';
import type { SubUser, WithId } from '@/types';
import Cookies from 'js-cookie';

interface LogisticsHeaderProps {
  onToggleSidebar: () => void;
}

export default function LogisticsHeader({ onToggleSidebar }: LogisticsHeaderProps) {
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const { toast } = useToast();
  const auth = useAuth();
  const { user, isUserLoading } = useUser();
  const router = useRouter();

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await signOut(auth);
      
      // PERSISTENT SESSION PURGE
      // Remove all session-tracking cookies upon manual logout
      Cookies.remove('slmc_session_active');
      Cookies.remove('slmc_user_role');
      localStorage.removeItem('slmc_last_identity');

      toast({ title: 'Logged Out', description: 'Your session has been terminated successfully.' });
      router.replace('/login');
    } catch (error) {
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to log out. Please try again.' });
    } finally {
      setIsLoggingOut(false);
    }
  };

  if (isUserLoading) {
    return <div className="flex items-center justify-between h-16 px-4 border-b bg-gray-50"><Loader2 className="h-6 w-6 animate-spin text-blue-900" /></div>;
  }

  return (
    <header className="flex items-center justify-between h-16 px-4 border-b bg-gray-50">
       <Button variant="ghost" size="icon" onClick={onToggleSidebar} className="md:hidden">
        <Menu className="h-6 w-6" />
      </Button>
      <div className="flex items-center gap-4">
        <NotificationBell />
        {user ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="relative w-8 h-8 rounded-full border border-slate-200 p-0 overflow-hidden shadow-sm">
                <Avatar className="w-8 h-8">
                  <AvatarImage src={user.photoURL || undefined} alt="User" />
                  <AvatarFallback className="bg-blue-900 text-white font-black">{user.email?.charAt(0).toUpperCase()}</AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-64 p-2 shadow-2xl rounded-xl" align="end" forceMount>
              <DropdownMenuLabel className="font-normal p-3">
                <div className="flex flex-col space-y-1.5">
                  <p className="text-sm font-black leading-none text-slate-900 uppercase">{user.displayName || 'Operator'}</p>
                  <p className="text-[10px] font-bold leading-none text-slate-400 uppercase tracking-widest">
                    {user.email}
                  </p>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => setIsProfileModalOpen(true)} className="cursor-pointer font-bold py-2.5 rounded-lg">
                <UserIcon className="w-4 h-4 mr-3 text-blue-600" />
                <span>My Profile</span>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleLogout} className="cursor-pointer text-red-600 focus:text-red-600 font-black uppercase text-[10px] tracking-[0.2em] py-3 rounded-lg hover:bg-red-50">
                {isLoggingOut ? <Loader2 className="w-4 h-4 mr-3 animate-spin" /> : <LogOut className="w-4 h-4 mr-3" />}
                {isLoggingOut ? 'Terminating Registry...' : 'Terminate Session'}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          <Button variant="outline" className="h-9 px-6 font-black uppercase text-[10px]" onClick={() => router.push('/login')}>Login Registry</Button>
        )}
      </div>
      {isProfileModalOpen && user && (
        <UserProfileModal
          isOpen={isProfileModalOpen}
          onClose={() => setIsProfileModalOpen(false)}
          userProfile={user as WithId<SubUser>}
        />
      )}
    </header>
  );
}
