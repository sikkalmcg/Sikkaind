'use client';

import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import { useRouter, usePathname } from "next/navigation";
import { TCODE_ROUTES, TCODE_DESCRIPTIONS, SAP_DEFAULTS } from '@/lib/sikka-accounts-constants';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useSikkaAccountsPage } from "@/context/SikkaAccountsPageContext";
import { 
    Search, Save, X, ArrowLeft, Printer, 
    Monitor, LogOut, User, Globe, ZoomIn, ZoomOut, 
    RotateCcw, MonitorPlay, Undo2, AlertTriangle, CheckCircle2,
    HelpCircle, Palette, Menu, ChevronDown, ChevronUp
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import ThemeSelector from "@/components/sikka-accounts/theme/ThemeSelector";
import TextSettingsModal from "@/components/sikka-accounts/theme/TextSettingsModal";
import { useUser, useAuth } from "@/firebase";
import { cn } from "@/lib/utils";

export default function SapHeader() {
  const router = useRouter();
  const pathname = usePathname();
  const { user } = useUser();
  const auth = useAuth();
  const commandInputRef = useRef<HTMLInputElement>(null);
  
  const { 
    setStatusBar, saveAction, cancelAction, executeAction, searchHelpAction,
    sessions, activeSessionId, createSession, closeSession, switchSession,
    fontSize, setFontSize, isDirty, setIsDirty,
    isSelectionMode, setIsSelectionMode,
    isSidebarOpen, toggleSidebar
  } = useSikkaAccountsPage();
  
  const [command, setCommand] = useState("");
  const [isThemeModalOpen, setIsThemeModalOpen] = useState(false);
  const [isTextModalOpen, setIsTextModalOpen] = useState(false);
  
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [confirmAction, setConfirmAction] = useState<(() => void) | null>(null);

  const activeTcode = useMemo(() => 
    Object.keys(TCODE_ROUTES).find(key => TCODE_ROUTES[key] === pathname) || '',
    [pathname]
  );

  const description = useMemo(() => 
    TCODE_DESCRIPTIONS[activeTcode] || 'SLMC EASY ACCESS',
    [activeTcode]
  );

  const handleExecuteCommand = useCallback(() => {
    if (!command) return;
    const cmd = command.trim().toUpperCase();

    if (cmd === '/N') {
        router.push('/sikka-accounts/dashboard');
        setCommand("");
        return;
    }

    if (cmd.startsWith('/N')) {
        const target = cmd.substring(2).trim();
        const route = TCODE_ROUTES[target];
        if (route) {
            router.push(route);
            setCommand("");
        } else {
            setStatusBar({ message: `Transaction ${target} unknown.`, type: 'error' });
        }
        return;
    }

    const route = TCODE_ROUTES[cmd];
    if (route) {
        router.push(route);
        setCommand("");
    } else {
        setStatusBar({ message: `Transaction ${cmd} unknown.`, type: 'error' });
    }
  }, [command, router, setStatusBar]);

  // F-Key Registry Node
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'F8') {
            e.preventDefault();
            if (executeAction) executeAction();
        }
        if (e.key === 'F4') {
            e.preventDefault();
            if (searchHelpAction) searchHelpAction();
        }
        if (e.ctrlKey && e.key.toLowerCase() === 's') {
            e.preventDefault();
            if (saveAction) saveAction();
        }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [executeAction, searchHelpAction, saveAction]);

  return (
    <div className="flex flex-col border-b shadow-md bg-card sticky top-0 z-50 select-none print:hidden transition-colors">
      <div className="h-8 bg-slate-100 border-b flex items-center px-4 justify-between text-[11px] font-bold text-slate-600 uppercase tracking-wider">
        <div className="flex gap-4 items-center h-full">
          <DropdownMenu>
            <DropdownMenuTrigger className="px-3 hover:bg-slate-200 h-full outline-none transition-colors font-black uppercase">System</DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-56 font-bold text-xs uppercase">
              <DropdownMenuItem onClick={() => createSession()} className="gap-2"><Monitor className="h-3.5 w-3.5" /> Create Session</DropdownMenuItem>
              <DropdownMenuItem onClick={() => closeSession(activeSessionId)} className="gap-2"><X className="h-3.5 w-3.5" /> End Session</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => setIsThemeModalOpen(true)} className="gap-2 text-primary font-black"><Palette className="h-3.5 w-3.5" /> Change Theme</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setIsTextModalOpen(true)} className="gap-2"><User className="h-3.5 w-3.5" /> User Profile</DropdownMenuItem>
              <DropdownMenuItem onClick={() => window.print()} className="gap-2"><Printer className="h-3.5 w-3.5" /> Print</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => auth?.signOut()} className="text-red-600 gap-2 font-black"><LogOut className="h-3.5 w-3.5" /> Log Off</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <div className="px-3">Edit</div>
          <div className="px-3">Goto</div>
          <div className="px-3">Settings</div>
        </div>
        <div className="flex gap-6 items-center px-4">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="h-6 w-6 text-red-600 hover:bg-red-50 rounded-full"
                  onClick={() => auth?.signOut()}
                >
                  <LogOut className="h-3.5 w-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Log Off System</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>

      <div className="h-12 flex items-center px-4 gap-4 justify-between bg-card border-b transition-colors">
        <div className="flex items-center gap-2">
          <div className="relative group flex items-center gap-2 mr-4">
            <Input
              ref={commandInputRef}
              value={command}
              onChange={(e) => setCommand(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleExecuteCommand()}
              className="w-44 h-8 bg-white border-2 border-slate-300 font-mono text-[13px] font-black focus-visible:ring-blue-900 shadow-inner rounded-none"
              placeholder="Enter T-Code"
            />
            <Button size="icon" variant="outline" className="h-8 w-8 border-2 rounded-none bg-slate-50" onClick={handleExecuteCommand}>
                <Search className="h-4 w-4" />
            </Button>
          </div>
          <div className="h-6 w-px bg-slate-200 mr-2" />
          <TooltipProvider>
            <div className="flex items-center gap-1">
              <Tooltip><TooltipTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => saveAction?.()} disabled={!saveAction}><Save className={cn("h-4 w-4", saveAction ? "text-blue-600" : "text-slate-300")} /></Button></TooltipTrigger><TooltipContent>Save (Ctrl+S)</TooltipContent></Tooltip>
              <Tooltip><TooltipTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => cancelAction?.()} disabled={!cancelAction}><X className={cn("h-4 w-4", cancelAction ? "text-red-600" : "text-slate-300")} /></Button></TooltipTrigger><TooltipContent>Cancel (F12)</TooltipContent></Tooltip>
              <Tooltip><TooltipTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8 text-slate-600" onClick={() => executeAction?.()} disabled={!executeAction}><MonitorPlay className={cn("h-4 w-4", executeAction ? "text-blue-900" : "text-slate-300")} /></Button></TooltipTrigger><TooltipContent>Execute Report (F8)</TooltipContent></Tooltip>
              <Tooltip><TooltipTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8 text-slate-600" onClick={() => setFontSize(Math.min(fontSize + 1, 16))}><ZoomIn className="h-4 w-4" /></Button></TooltipTrigger><TooltipContent>Zoom In</TooltipContent></Tooltip>
              <Tooltip><TooltipTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8 text-slate-600" onClick={() => setFontSize(Math.max(fontSize - 1, 10))}><ZoomOut className="h-4 w-4" /></Button></TooltipTrigger><TooltipContent>Zoom Out</TooltipContent></Tooltip>
            </div>
          </TooltipProvider>
        </div>

        <div className="flex items-center gap-4 pr-2">
          <h1 className="text-xs font-black text-slate-800 uppercase tracking-tight">
            {description}
            {activeTcode && <Badge variant="secondary" className="ml-2 bg-blue-50/50 text-blue-700 border-blue-100 text-[9px] font-black">{activeTcode}</Badge>}
          </h1>
          <div className="flex gap-1">
            {sessions.map((s, idx) => (
                <div key={s.id} onClick={() => switchSession(s.id)} className={cn("h-8 px-4 flex items-center gap-2 border-2 text-[10px] font-black uppercase tracking-tighter cursor-pointer transition-all", activeSessionId === s.id ? "bg-blue-900 text-white border-blue-900 shadow-md scale-105 z-10" : "bg-slate-50 text-slate-400 border-slate-200 hover:bg-white")}>
                  <span className="opacity-50">[{idx + 1}]</span> {s.tcode === 'START' ? '' : s.tcode}
                </div>
            ))}
          </div>
        </div>
      </div>

      <ThemeSelector isOpen={isThemeModalOpen} onClose={() => setIsThemeModalOpen(false)} />
      <TextSettingsModal isOpen={isTextModalOpen} onClose={() => setIsTextModalOpen(false)} />
    </div>
  );
}
