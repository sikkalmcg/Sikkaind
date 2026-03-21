"use client";

import { useState, useEffect, useMemo } from 'react';
import { Bell, Loader2, Clock, User, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { Notification, WithId } from '@/types';
import { useFirestore, useUser } from '@/firebase';
import { collection, query, orderBy, limit, onSnapshot, Timestamp, writeBatch, doc, updateDoc } from 'firebase/firestore';
import { format, isValid } from 'date-fns';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError, type SecurityRuleContext } from '@/firebase/errors';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

function NotificationItem({ notification, onRead }: { notification: WithId<Notification>, onRead: (id: string) => void }) {
  // Robust Date Resolution Logic
  const dateValue = useMemo(() => {
    if (!notification.timestamp) return null;
    if (notification.timestamp instanceof Timestamp) return notification.timestamp.toDate();
    if (notification.timestamp instanceof Date) return notification.timestamp;
    const d = new Date(notification.timestamp);
    return isValid(d) ? d : null;
  }, [notification.timestamp]);

  const displayDate = dateValue ? format(dateValue, 'dd MMM yyyy p') : '--';

  return (
    <div 
        onClick={() => !notification.isRead && onRead(notification.id)}
        className={cn(
            "flex flex-col gap-1 border-b border-slate-50 p-4 last:border-b-0 transition-colors cursor-pointer",
            notification.isRead ? "opacity-60 bg-white" : "hover:bg-slate-50/50 bg-blue-50/10"
        )}
    >
      <div className="flex justify-between items-start">
        <div className="flex items-center gap-2">
            <div className={cn("h-6 w-6 rounded-full flex items-center justify-center", notification.isRead ? "bg-slate-100" : "bg-blue-100")}>
                <User className={cn("h-3 w-3", notification.isRead ? "text-slate-400" : "text-blue-600")} />
            </div>
            <p className="text-xs font-black text-slate-900 uppercase tracking-tight">{notification.userName}</p>
        </div>
        {!notification.isRead && (
          <div className="h-2 w-2 rounded-full bg-blue-600 animate-pulse mt-1" />
        )}
      </div>
      
      <p className="text-[11px] font-medium text-slate-600 leading-relaxed mt-1">{notification.message}</p>
      
      <div className="flex items-center gap-3 mt-3 text-[9px] font-bold text-slate-400 uppercase tracking-widest">
        <div className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            <span>{displayDate}</span>
        </div>
        <div className="h-3 w-px bg-slate-200" />
        <span className={cn("font-black", notification.isRead ? "text-slate-400" : "text-blue-600")}>{notification.module}</span>
      </div>
    </div>
  );
}

export function NotificationBell() {
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<WithId<Notification>[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isArchiving, setIsArchiving] = useState(false);
  const firestore = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();

  useEffect(() => {
    if (!firestore || !user) return;

    // Registry Listener: Keep only latest 25 as per Mission logic
    const colRef = collection(firestore, `users/${user.uid}/notifications`);
    const q = query(
        colRef,
        orderBy("timestamp", "desc"),
        limit(25)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
        const fetched = snapshot.docs.map(doc => {
            const data = doc.data();
            return {
                id: doc.id,
                ...data,
            } as WithId<Notification>;
        });
        setNotifications(fetched);
        setIsLoading(false);
    }, async (error) => {
        // Contextual Error Reporting for Registry Sync Failures
        errorEmitter.emit('permission-error', new FirestorePermissionError({
            path: colRef.path,
            operation: 'list',
        } satisfies SecurityRuleContext));
        setIsLoading(false);
    });

    return () => unsubscribe();
  }, [firestore, user]);

  const handleMarkAsRead = async (id: string) => {
    if (!firestore || !user) return;
    try {
        const ref = doc(firestore, `users/${user.uid}/notifications`, id);
        await updateDoc(ref, { isRead: true });
    } catch (e) {
        console.error("Registry update error:", e);
    }
  };

  const handleArchiveAll = async () => {
    if (!firestore || !user || notifications.length === 0) return;
    
    const unread = notifications.filter(n => !n.isRead);
    if (unread.length === 0) {
        toast({ title: 'Registry Clean', description: 'No unread alerts in the manifest.' });
        return;
    }

    setIsArchiving(true);
    try {
        const batch = writeBatch(firestore);
        unread.forEach(n => {
            const ref = doc(firestore, `users/${user.uid}/notifications`, n.id);
            batch.update(ref, { isRead: true });
        });
        await batch.commit();
        toast({ title: 'Notifications Archived', description: 'All unread alerts marked as read.' });
    } catch (error: any) {
        console.error("Archive failure:", error);
        toast({ variant: 'destructive', title: 'Action Failed', description: 'Could not synchronize archiving with cloud.' });
    } finally {
        setIsArchiving(false);
    }
  };

  const unreadCount = notifications.filter(n => !n.isRead).length;

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative group">
          <Bell className="h-5 w-5 text-slate-500 group-hover:text-blue-900 transition-colors" />
          {unreadCount > 0 && (
            <Badge
              className="absolute -top-1 -right-1 h-4 min-w-4 justify-center rounded-full p-0 bg-blue-600 text-[10px] font-black border-2 border-white shadow-sm"
            >
              {unreadCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-96 p-0 border-none shadow-2xl rounded-2xl overflow-hidden mt-2" align="end">
        <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
            <div className="flex items-center gap-2">
                <Bell className="h-4 w-4 text-blue-400" />
                <h4 className="font-black text-xs uppercase tracking-widest">Mission Registry Notifications</h4>
            </div>
            {unreadCount > 0 && <Badge variant="outline" className="text-[9px] font-black border-blue-400 text-blue-400 uppercase">{unreadCount} New</Badge>}
        </div>
        <ScrollArea className="h-[450px] bg-white">
          {isLoading ? (
            <div className="flex flex-col justify-center items-center h-full gap-3 opacity-40 py-20">
                <Loader2 className="h-8 w-8 animate-spin text-blue-900" />
                <p className="text-[10px] font-black uppercase tracking-widest">Syncing Registry...</p>
            </div>
          ) : notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center px-8 opacity-40">
              <Bell className="h-12 w-12 text-slate-300 mb-4" />
              <p className="text-xs font-bold uppercase tracking-widest text-slate-500">Registry is empty</p>
              <p className="text-[10px] font-medium text-slate-400 mt-1">No mission updates detected at this lifting node.</p>
            </div>
          ) : (
            <div className="flex flex-col">
                {notifications.map((notification) => (
                    <NotificationItem 
                        key={notification.id} 
                        notification={notification} 
                        onRead={handleMarkAsRead}
                    />
                ))}
            </div>
          )}
        </ScrollArea>
        <div className="p-3 bg-slate-50 border-t flex justify-center">
            <Button 
                variant="link" 
                onClick={handleArchiveAll}
                disabled={isArchiving || unreadCount === 0}
                className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 hover:text-blue-900 disabled:opacity-30 transition-all"
            >
                {isArchiving ? <Loader2 className="h-3 w-3 animate-spin mr-2" /> : null}
                Archive All Alerts
            </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
