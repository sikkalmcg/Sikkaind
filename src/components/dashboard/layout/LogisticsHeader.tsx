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

interface LogisticsHeaderProps {
  onToggleSidebar: () => void;
}

export default function LogisticsHeader({ onToggleSidebar }: LogisticsHeaderProps) {
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const { toast } = useToast();
  const auth = useAuth();
  const { user, isUserLoading } = useUser();

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await signOut(auth);
      toast({ title: 'Success', description: 'You have been logged out.' });
    } catch (error) {
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to log out. Please try again.' });
    } finally {
      setIsLoggingOut(false);
    }
  };

  if (isUserLoading) {
    return <div className="flex items-center justify-between h-16 px-4 border-b"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  }

  return (
    <header className="flex items-center justify-between h-16 px-4 border-b bg-gray-50 lg:justify-end">
      <Button variant="ghost" size="icon" className="lg:hidden" onClick={onToggleSidebar}>
        <Menu className="w-6 h-6" />
      </Button>
      <div className="flex items-center gap-4">
        <NotificationBell />
        {user ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="relative w-8 h-8 rounded-full">
                <Avatar className="w-8 h-8">
                  <AvatarFallback>{user.email?.charAt(0).toUpperCase()}</AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56" align="end" forceMount>
              <DropdownMenuLabel className="font-normal">
                <div className="flex flex-col space-y-1">
                  <p className="text-sm font-medium leading-none">{user.displayName || 'User'}</p>
                  <p className="text-xs leading-none text-muted-foreground">
                    {user.email}
                  </p>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => setIsProfileModalOpen(true)}>
                <UserIcon className="w-4 h-4 mr-2" />
                Profile
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleLogout}>
                <LogOut className="w-4 h-4 mr-2" />
                {isLoggingOut ? 'Logging out...' : 'Log out'}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          <Button>Login</Button>
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
