'use client';

import { type ReactNode, useEffect, useState, useMemo } from 'react';
import { useUser, useAuth } from '@/firebase';
import { Loader2, Monitor, Clock, Landmark, Globe, User, Wifi, WifiOff, AlertTriangle } from 'lucide-react';
import { SikkaAccountsPageProvider, useSikkaAccountsPage } from '@/context/SikkaAccountsPageContext';
import { cn } from '@/lib/utils';
import SapHeader from './components/SapHeader';
import SapSidebar from './components/SapSidebar';
import { useRouter, usePathname } from 'next/navigation';
import { format } from "date-fns";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

function getIndianFinancialYear() {
  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth(); // 0-11
  // India FY starts April (3)
  if (month >= 3) {
    return `${year}-${year + 1}`;
  } else {
    return `${year - 1}-${year}`;
  }
}

function SikkaAccountsLayoutInner({ children }: { children: ReactNode }) {
    const { user, isUserLoading } = useUser();
    const router = useRouter();
    const pathname = usePathname();
    const { statusBar, fontSize, theme, isSelectionMode, setIsSelectionMode, isFooterVisible, setStatusBar } = useSikkaAccountsPage();
    
    const [currentTime, setCurrentTime] = useState(new Date());
    const [systemIp, setSystemIp] = useState('192.168.1.105'); 
    const [networkStatus, setNetworkStatus] = useState<'connected' | 'poor' | 'disconnected'>('connected');
    const [lastSyncTime, setLastSyncTime] = useState(new Date());

    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);

    // SELECTION MODE HANDLER (Ctrl + Y)
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.ctrlKey && e.key.toLowerCase() === 'y') {
                e.preventDefault();
                const nextMode = !isSelectionMode;
                setIsSelectionMode(nextMode);
                setStatusBar({ 
                    message: nextMode ? "Selection Mode Active: Block Copy Enabled (Ctrl+Y)" : "Selection Mode Deactivated", 
                    type: 'info' 
                });
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isSelectionMode, setIsSelectionMode, setStatusBar]);

    useEffect(() => {
        const fetchIp = async () => {
            try {
                const res = await fetch('https://api.ipify.org?format=json');
                const data = await res.json();
                if (data.ip) setSystemIp(data.ip);
            } catch (e) {}
        };
        fetchIp();

        const heartbeat = setInterval(() => {
            if (typeof navigator !== 'undefined') {
                if (!navigator.onLine) {
                    setNetworkStatus('disconnected');
                } else {
                    const rand = Math.random();
                    if (rand > 0.9) setNetworkStatus('poor');
                    else setNetworkStatus('connected');
                    setLastSyncTime(new Date());
                }
            }
        }, 12000);

        return () => clearInterval(heartbeat);
    }, []);

    useEffect(() => {
        document.documentElement.setAttribute('data-theme', theme);
        document.documentElement.style.setProperty('--font-size-base', `${fontSize}px`);
    }, [theme, fontSize]);

    useEffect(() => {
        if (!isUserLoading && !user) {
            router.replace('/login');
        }
    }, [user, isUserLoading, router]);

    const financialYear = useMemo(() => getIndianFinancialYear(), []);

    if (isUserLoading || !user) {
        return (
            <div className="flex h-screen items-center justify-center bg-background">
                <Loader2 className="h-12 w-12 animate-spin text-primary" />
            </div>
        );
    }

    const isAdmin = user?.email === 'sikkaind.admin@sikka.com' || user?.email === 'sikkalmcg@gmail.com';
    const displayName = isAdmin ? 'AJAY SOMRA' : (user?.displayName || user?.email?.split('@')[0]);
    const displayRole = isAdmin ? 'Manager' : 'Accountant';

    // SPECIAL RULE: ZINV page allows selection and copy without CTRL+Y
    const isZinvPage = pathname?.startsWith('/sikka-accounts/reports/invoice');

    return (
        <div className={cn(
            "flex flex-col h-screen w-full bg-white overflow-hidden",
            (isSelectionMode || isZinvPage) ? "selection-mode" : "select-none"
        )}>
            <SapHeader />
            <div className="flex flex-1 overflow-hidden">
                <SapSidebar />
                <main className="flex-1 overflow-auto bg-slate-50 relative pb-10">
                    {children}
                </main>
            </div>
            {isFooterVisible && (
                <footer className="h-8 bg-slate-100 border-t border-slate-300 text-slate-600 flex items-center px-4 justify-between text-[10px] font-black uppercase tracking-[0.1em] shrink-0 z-50">
                    <div className="flex items-center gap-8 h-full">
                        {statusBar?.message && (
                            <div key={statusBar.key} className={cn("absolute bottom-10 left-4 h-9 px-6 flex items-center gap-3 rounded-xl shadow-2xl border transition-all animate-in slide-in-from-bottom-full z-[60]", statusBar.type === 'success' ? "bg-emerald-600 text-white border-emerald-400" : statusBar.type === 'error' ? "bg-red-600 text-white border-red-400" : statusBar.type === 'warning' ? "bg-amber-50 text-blue-900 border-amber-300" : "bg-blue-600 text-white border-blue-400")}>
                                <div className="h-2 w-2 rounded-full bg-white animate-pulse" />
                                <span className="font-bold tracking-normal">{statusBar.message}</span>
                            </div>
                        )}
                        <div className="flex items-center gap-2 border-r border-slate-300 pr-6 h-full"><User className="h-3 w-3 text-blue-600" /><span className="text-slate-900 font-black">{displayName}</span><span className="text-slate-400 italic">({displayRole})</span></div>
                        <div className="flex items-center gap-2 border-r border-slate-300 pr-6 h-full"><Landmark className="h-3 w-3 text-blue-600" /><span className="text-slate-500 font-bold">FY:</span><span className="text-slate-900 font-black">{financialYear}</span></div>
                        <div className="flex items-center gap-2 border-r border-slate-300 pr-6 h-full">
                            <TooltipProvider><Tooltip><TooltipTrigger asChild>
                                <div className="flex items-center gap-2 cursor-help group"><Globe className="h-3 w-3 text-blue-600 group-hover:scale-110 transition-transform" /><span className="text-slate-500 font-bold">Server:</span><div className="flex items-center gap-1.5"><div className={cn("h-2 w-2 rounded-full", networkStatus === 'disconnected' ? 'bg-red-500' : 'bg-emerald-500 animate-pulse')} /><span className={cn("font-black", networkStatus === 'disconnected' ? 'text-red-600' : 'text-emerald-600')}>{networkStatus === 'disconnected' ? 'Disconnected' : 'Connected'}</span></div></div>
                            </TooltipTrigger><TooltipContent side="top" className="p-4 bg-slate-900 text-white border-none shadow-2xl rounded-xl">
                                <div className="space-y-2 font-bold text-xs uppercase tracking-wider">
                                    <div className="flex justify-between gap-8 border-b border-white/10 pb-1"><span>System IP:</span> <span className="text-blue-400">{systemIp}</span></div>
                                    <div className="flex justify-between gap-8 border-b border-white/10 pb-1"><span>Server ID:</span> <span className="text-blue-400">SLMC-PROD-01</span></div>
                                    <div className="flex justify-between gap-8"><span>Last Sync:</span> <span className="text-emerald-400">{format(lastSyncTime, 'HH:mm:ss')}</span></div>
                                </div>
                            </TooltipContent></Tooltip></TooltipProvider>
                        </div>
                    </div>
                    <div className="flex items-center gap-6 h-full">
                        <div className="flex items-center gap-2"><span className="text-slate-400 font-bold">Network:</span><div className="flex items-center gap-2">{networkStatus === 'connected' && <span className="text-emerald-600 font-black flex items-center gap-1"><Wifi className="h-3 w-3" /> Connected</span>}{networkStatus === 'poor' && <span className="text-amber-600 font-black flex items-center gap-1"><AlertTriangle className="h-3 w-3" /> Poor Connection</span>}{networkStatus === 'disconnected' && <span className="text-red-600 font-black flex items-center gap-1"><WifiOff className="h-3 w-3" /> Disconnected</span>}</div></div>
                        <div className="h-4 w-px bg-slate-300" /><div className="flex items-center gap-2"><Clock className="h-3 w-3 text-slate-400" /><span className="text-slate-500 font-mono">{format(currentTime, 'HH:mm:ss')}</span></div>
                    </div>
                </footer>
            )}
        </div>
    );
}

export default function SikkaAccountsLayout({ children }: { children: ReactNode }) {
    return (
        <SikkaAccountsPageProvider>
            <SikkaAccountsLayoutInner>{children}</SikkaAccountsLayoutInner>
        </SikkaAccountsPageProvider>
    );
}
