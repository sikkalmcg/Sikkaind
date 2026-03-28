
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { 
  LayoutDashboard, 
  Truck, 
  PackagePlus, 
  ClipboardList, 
  MonitorPlay, 
  ArrowRightLeft, 
  Activity, 
  BarChart3,
  ShieldCheck,
  Building2, 
  Trash2,
  History,
  ChevronLeft,
  ChevronRight,
  Loader2,
  ListTree,
  ClipboardCheck,
  Radar,
  Smartphone,
  Settings2,
  Globe
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useUser, useFirestore } from '@/firebase';
import { useEffect, useState, useMemo } from 'react';
import { collection, query, where, getDocs, doc } from 'firebase/firestore';
import type { SubUser } from '@/types';

const navigationGroups = [
  { group: 'Operational Registry', items: [
    { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard, permission: 'live-dashboard' },
    { name: 'Gate Entry', href: '/dashboard/vehicle-entry', icon: Truck, permission: 'vehicle-entry' },
    { name: 'Order Plan', href: '/dashboard/shipment-plan', icon: PackagePlus, permission: 'shipment-plan' },
    { name: 'Open Order', href: '/dashboard/vehicle-assign', icon: ClipboardList, permission: 'vehicle-assign' },
    { name: 'Trip Board', href: '/dashboard/trip-board', icon: MonitorPlay, permission: 'trip-board' },
    { name: 'Supervisor Task', href: '/dashboard/supervisor-task', icon: ClipboardCheck, permission: 'supervisor-task' },
    { name: 'Freight Process', href: '/dashboard/freight-process', icon: ArrowRightLeft, permission: 'freight-process' },
  ]},
  { group: 'Tracking & GIS', items: [
    { name: 'Track Consignment', href: '/dashboard/tracking/consignment', icon: Radar, permission: 'shipment-tracking' },
    { name: 'Fleet Live Map', href: '/dashboard/tracking/fleet-map', icon: Globe, permission: 'shipment-tracking' },
  ]},
  { group: 'Monitoring & Audit', items: [
    { name: 'Status Control', href: '/dashboard/status-control', icon: Activity, permission: 'status-management' },
    { name: 'Trip Summary', href: '/dashboard/trip-summary', icon: ListTree, permission: 'shipment-summary' },
  ]},
  { group: 'Accounts Control', items: [
    { name: 'Freight Payment', href: '/dashboard/freight-management', icon: ArrowRightLeft, permission: 'freight-management' },
  ]},
  { group: 'Data Extraction', items: [
    { name: 'Reports', href: '/dashboard/report-analysis', icon: BarChart3, permission: 'report-analysis' },
  ]},
  { group: 'Administration', admin: true, items: [
    { name: 'Vehicles', href: '/dashboard/vehicle-management', icon: Truck, permission: 'vehicle-management' },
    { name: 'Carriers', href: '/dashboard/carrier-management', icon: ShieldCheck, permission: 'carrier-management' },
    { name: 'Plants', href: '/dashboard/plant-management', icon: Building2, permission: 'plant-management' },
    { name: 'GPS Registry', href: '/dashboard/tracking/registry', icon: Smartphone, permission: 'admin-only' },
    { name: 'GPS Setting', href: '/dashboard/tracking/settings', icon: Settings2, permission: 'admin-only' },
    { name: 'Recycle Bin', href: '/dashboard/recycle-bin', icon: Trash2, permission: 'recycle-bin' },
    { name: 'Activity Log', href: '/dashboard/user-activity-log', icon: History, permission: 'user-activity-log' },
    { name: 'User Management', href: '/user-management', icon: ShieldCheck, permission: 'user-management' },
  ]}
];

interface LogisticsSidebarProps {
  isOpen: boolean;
  onToggle: () => void;
}

export default function LogisticsSidebar({ isOpen, onToggle }: LogisticsSidebarProps) {
  const pathname = usePathname();
  const { user } = useUser();
  const firestore = useFirestore();
  const [profile, setProfile] = useState<SubUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!firestore || !user) return;
    
    const fetchProfile = async () => {
        setLoading(true);
        try {
            const searchEmail = user.email;
            if (!searchEmail) return;
            
            const userDocSnap = await getDocs(query(collection(firestore, "users"), where("email", "==", searchEmail)));
            if (!userDocSnap.empty) {
                setProfile(userDocSnap.docs[0].data() as SubUser);
            }
        } catch (e) {
            console.error("Sidebar Auth Registry Error:", e);
        } finally {
            setLoading(false);
        }
    };
    fetchProfile();
  }, [firestore, user]);

  const isRootAdmin = useMemo(() => {
    if (!user) return false;
    const isRootEmail = user.email === 'sikkaind.admin@sikka.com' || user.email === 'sikkalmcg@gmail.com';
    const isRootUsername = profile?.username?.toLowerCase() === 'sikkaind';
    return isRootEmail || isRootUsername;
  }, [user, profile]);

  const filteredNavigation = useMemo(() => {
    if (loading) return [];
    if (isRootAdmin) return navigationGroups;
    if (!profile) return []; 

    return navigationGroups.map(group => ({
        ...group,
        items: group.items.filter(item => {
            if (item.permission === 'admin-only') return false;
            return profile.permissions?.includes(item.permission);
        })
    })).filter(group => group.items.length > 0);
  }, [profile, isRootAdmin, loading]);

  return (
    <aside 
      className={cn(
        "fixed inset-y-0 left-0 z-50 flex flex-col bg-sidebar border-r border-sidebar-border transition-all duration-300 ease-in-out md:relative",
        isOpen ? "w-64 translate-x-0" : "w-20 translate-x-0 md:w-20"
      )}
    >
      <div className="flex h-16 items-center justify-between px-6 border-b border-sidebar-border shrink-0 bg-sidebar">
        <div className={cn("flex items-center gap-2 overflow-hidden whitespace-nowrap transition-all duration-300", !isOpen && "w-0 opacity-0")}>
          <div className="h-2 w-2 rounded-full bg-blue-400 animate-pulse shadow-[0_0_8px_rgba(96,165,250,0.4)]" />
          <span className="text-xs font-black uppercase tracking-[0.2em] text-white italic">Sikka LMC</span>
        </div>
        <Button 
          variant="ghost" 
          size="icon" 
          onClick={onToggle} 
          className="text-sidebar-foreground/50 hover:bg-white/10 hover:text-white"
        >
          {isOpen ? <ChevronLeft className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />}
        </Button>
      </div>

      <ScrollArea className="flex-1 px-3 py-6 bg-sidebar">
        {loading ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
                <Loader2 className="h-6 w-6 animate-spin text-blue-400" />
                {isOpen && <span className="text-[9px] font-black uppercase text-sidebar-foreground/40 tracking-widest">Syncing Registry...</span>}
            </div>
        ) : (
            <nav className="space-y-8">
            {filteredNavigation.map((group, idx) => (
                <div key={idx} className="space-y-3">
                <h4 className={cn(
                    "px-4 text-[10px] font-black uppercase tracking-[0.3em] text-sidebar-foreground/30 transition-opacity duration-300",
                    !isOpen ? "opacity-0 h-0" : "opacity-100"
                )}>
                    {group.group}
                </h4>
                <div className="space-y-1.5">
                    {group.items.map((item) => {
                    const isActive = pathname === item.href;
                    return (
                        <Link 
                        key={item.name} 
                        href={item.href}
                        className={cn(
                            "group flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-black transition-all duration-200 border border-transparent",
                            isActive 
                            ? "bg-sidebar-accent text-sidebar-accent-foreground shadow-lg" 
                            : "text-sidebar-foreground/60 hover:bg-white/5 hover:text-white"
                        )}
                        >
                        <item.icon className={cn(
                            "h-5 w-5 shrink-0 transition-colors",
                            isActive ? "text-white" : "text-sidebar-foreground/40 group-hover:text-blue-400"
                        )} />
                        <span className={cn(
                            "whitespace-nowrap transition-all duration-300 uppercase tracking-tight text-xs",
                            !isOpen ? "opacity-0 w-0 overflow-hidden" : "opacity-100 w-auto"
                        )}>
                            {item.name}
                        </span>
                        </Link>
                    );
                    })}
                </div>
                </div>
            ))}
            </nav>
        )}
      </ScrollArea>

      <div className={cn("p-4 border-t border-sidebar-border bg-sidebar transition-all duration-300", !isOpen && "items-center")}>
        <div className={cn(
          "flex items-center gap-3 p-3 rounded-2xl bg-white/5 border border-white/5",
          !isOpen && "justify-center p-2"
        )}>
          <div className="h-8 w-8 rounded-full bg-blue-600 flex items-center justify-center text-[10px] font-black text-white shadow-lg shrink-0">SIL</div>
          {isOpen && (
            <div className="flex flex-col overflow-hidden animate-in fade-in duration-500">
              <span className="text-[10px] font-black uppercase text-white truncate">Sikka Logistics</span>
              <span className="text-[9px] font-bold text-sidebar-foreground/40 uppercase tracking-tighter truncate">v2.5.0 Enterprise</span>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}
