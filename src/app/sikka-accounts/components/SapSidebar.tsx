'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Star, PlusCircle, Trash2, Home, Folder, ChevronRight, Briefcase, ChevronDown, ChevronUp } from 'lucide-react';
import { TCODE_ROUTES } from '@/lib/sikka-accounts-constants';
import { mockUserFavorites, removeMockFavorites } from '@/lib/mock-data';
import AddFavoriteModal from '@/components/sikka-accounts/favorites/AddFavoriteModal';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { useSikkaAccountsPage } from "@/context/SikkaAccountsPageContext";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const ERP_MENU_TREE = [
    {
        label: 'Financial Accounting',
        icon: Briefcase,
        items: [
            { label: 'General Ledger', items: [
                { label: 'Material Master', tcode: 'MM01' },
                { label: 'Display Master', tcode: 'MM03' },
            ]},
            { label: 'Accounts Payable', tcode: 'MIRO' },
            { label: 'Accounts Receivable', items: [
                { label: 'Create Billing', tcode: 'VF01' },
                { label: 'Payment Receipt', tcode: 'MIGO' },
            ]},
        ]
    },
    {
        label: 'Information Systems',
        icon: Folder,
        items: [
            { label: 'Invoice Registry', tcode: 'ZINV' },
            { label: 'Financial Dashboard', tcode: 'MB52' },
            { label: 'T-Code Registry', tcode: 'ZCODE' },
        ]
    }
];

export default function SapSidebar() {
    const pathname = usePathname();
    const { toast } = useToast();
    const { isSidebarOpen, toggleSidebar } = useSikkaAccountsPage();
    
    const isHome = pathname === '/sikka-accounts/dashboard' || pathname === '/dashboard';
    
    const [favorites, setFavorites] = useState(mockUserFavorites);
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [isRemoveConfirmOpen, setIsRemoveConfirmOpen] = useState(false);
    const [selectionMode, setSelectionMode] = useState(false);
    const [selectedToRemove, setSelectedToRemove] = useState<string[]>([]);
    
    const refreshFavorites = () => setFavorites([...mockUserFavorites]);
    
    useEffect(() => {
        refreshFavorites();
    }, []);

    const handleToggleSelection = (tcode: string) => {
        setSelectedToRemove(prev => prev.includes(tcode) ? prev.filter(code => code !== tcode) : [...prev, tcode]);
    };

    const confirmRemove = () => {
        removeMockFavorites(selectedToRemove);
        refreshFavorites();
        toast({ title: 'Favorites Removed', description: `${selectedToRemove.length} favorite(s) removed.` });
        setIsRemoveConfirmOpen(false);
        setSelectionMode(false);
        setSelectedToRemove([]);
    };

    if (!isHome) return null;
    if (!isSidebarOpen) return null;

    return (
        <>
            <aside className="w-[280px] bg-card border-r border-slate-200 flex flex-col shrink-0 shadow-inner select-none h-full overflow-hidden animate-in slide-in-from-left duration-300 transition-all">
                <div className="p-4 space-y-4 shrink-0">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                        <div className="flex items-center gap-2 font-black text-[10px] text-blue-900 uppercase tracking-widest">
                            <Star className="h-3.5 w-3.5 fill-blue-900" /> Favorites
                        </div>
                        <div className="flex gap-1">
                            <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => setIsAddModalOpen(true)}><PlusCircle className="h-3 w-3" /></Button>
                            <Button size="icon" variant={selectionMode ? 'destructive' : 'ghost'} className="h-6 w-6" onClick={() => setSelectionMode(!selectionMode)}><Trash2 className="h-3 w-3" /></Button>
                        </div>
                    </div>
                    <ul className="space-y-1">
                        {favorites.map(item => {
                            const path = TCODE_ROUTES[item.tcode as keyof typeof TCODE_ROUTES];
                            if (!path) return null;
                            const isActive = pathname === path;
                            return (
                                <li key={item.tcode} className={cn("flex items-center gap-2", isActive && "bg-blue-50/50 rounded-lg")}>
                                    {selectionMode && (
                                        <Checkbox checked={selectedToRemove.includes(item.tcode)} onCheckedChange={() => handleToggleSelection(item.tcode)} />
                                    )}
                                    <Link 
                                        href={path} 
                                        className={cn(
                                            "flex items-center gap-2 text-[11px] py-1.5 px-2 rounded-lg flex-1 transition-all",
                                            isActive ? "text-blue-900 font-black" : "text-slate-600 hover:bg-slate-50 hover:text-blue-900 font-bold"
                                        )}
                                    >
                                        {item.text}
                                    </Link>
                                </li>
                            );
                        })}
                    </ul>
                </div>

                <div className="h-px bg-slate-100 mx-4 my-2" />

                <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin scrollbar-thumb-slate-200">
                    <div className="flex items-center justify-between font-black text-[11px] text-blue-900 uppercase tracking-widest border-b border-slate-100 pb-2">
                        <div className="flex items-center gap-2">
                            <Home className="h-3.5 w-3.5" /> SLMC EASY ACCESS
                        </div>
                        <TooltipProvider>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Button 
                                        variant="ghost" 
                                        size="icon" 
                                        className="h-5 w-5 text-blue-900 hover:bg-blue-50" 
                                        onClick={toggleSidebar}
                                    >
                                        <ChevronDown className="h-3.5 w-3.5" />
                                    </Button>
                                </TooltipTrigger>
                                <TooltipContent>Hide Menu</TooltipContent>
                            </Tooltip>
                        </TooltipProvider>
                    </div>
                    <div className="space-y-4">
                        {ERP_MENU_TREE.map((folder, i) => (
                            <div key={i} className="space-y-2">
                                <div className="flex items-center gap-2 text-[11px] font-black text-slate-800 uppercase tracking-tighter cursor-default">
                                    <folder.icon className="h-3.5 w-3.5 text-blue-600" /> {folder.label}
                                </div>
                                <div className="pl-4 space-y-1.5 border-l-2 border-slate-50">
                                    {folder.items.map((item: any, j: number) => (
                                        <div key={j}>
                                            {item.items ? (
                                                <div className="space-y-1.5">
                                                    <div className="text-[10px] font-black text-slate-400 flex items-center gap-1 uppercase">
                                                        <ChevronRight className="h-2.5 w-2.5" /> {item.label}
                                                    </div>
                                                    <div className="pl-3 space-y-1">
                                                        {item.items.map((sub: any, k: number) => {
                                                            const path = TCODE_ROUTES[sub.tcode] || '#';
                                                            const isActive = pathname === path;
                                                            return (
                                                                <Link key={k} href={path} className={cn(
                                                                    "block text-[11px] py-0.5 transition-colors",
                                                                    isActive ? "text-blue-900 font-black underline" : "text-slate-500 hover:text-blue-900 font-bold hover:underline"
                                                                )}>
                                                                    {sub.label}
                                                                </Link>
                                                            );
                                                        })}
                                                    </div>
                                                </div>
                                            ) : (
                                                <Link href={TCODE_ROUTES[item.tcode] || '#'} className={cn(
                                                    "block text-[11px] font-bold transition-colors",
                                                    pathname === TCODE_ROUTES[item.tcode] ? "text-blue-900 font-black underline" : "text-slate-500 hover:text-blue-900",
                                                    item.disabled && "opacity-30 pointer-events-none"
                                                )}>
                                                    {item.label} {item.tcode && `(${item.tcode})`}
                                                </Link>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </aside>

            <AddFavoriteModal isOpen={isAddModalOpen} onClose={() => setIsAddModalOpen(false)} onFavoriteAdded={refreshFavorites} />
            <AlertDialog open={isRemoveConfirmOpen} onOpenChange={setIsRemoveConfirmOpen}>
                <AlertDialogContent className="border-none shadow-2xl">
                    <AlertDialogHeader>
                        <AlertDialogTitle className="font-black uppercase tracking-tight text-red-900">Revoke Favorites?</AlertDialogTitle>
                        <AlertDialogDescription className="text-sm font-medium">This will permanently remove {selectedToRemove.length} transaction(s) from your personalized access list.</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter className="bg-slate-50 -m-6 p-6 mt-4 rounded-b-lg flex-row justify-end gap-3">
                        <AlertDialogCancel className="font-bold">Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={confirmRemove} className="bg-red-600 hover:bg-red-700 font-black uppercase text-[11px] tracking-widest px-8 border-none">Remove</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    );
}
