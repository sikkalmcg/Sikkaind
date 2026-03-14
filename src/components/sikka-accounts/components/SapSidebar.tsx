'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Star, PlusCircle, Trash2 } from 'lucide-react';
import { TCODE_ROUTES } from '@/lib/sikka-accounts-constants';
import { mockUserFavorites, removeMockFavorites } from '@/lib/mock-data';
import AddFavoriteModal from '@/components/sikka-accounts/favorites/AddFavoriteModal';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { useSikkaAccountsPage } from '@/context/SikkaAccountsPageContext';


export default function SapSidebar() {
    const pathname = usePathname();
    const { toast } = useToast();
    const [favorites, setFavorites] = useState(mockUserFavorites);
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [isRemoveConfirmOpen, setIsRemoveConfirmOpen] = useState(false);
    const [selectionMode, setSelectionMode] = useState(false);
    const [selectedToRemove, setSelectedToRemove] = useState<string[]>([]);
    const { triggerSidebarRemoveMode, setTriggerSidebarRemoveMode } = useSikkaAccountsPage();
    
    // Function to refresh favorites from mock data
    const refreshFavorites = () => {
        setFavorites([...mockUserFavorites]);
    };
    
    useEffect(() => {
        refreshFavorites();
    }, []);

    useEffect(() => {
        setTriggerSidebarRemoveMode(() => () => setSelectionMode(true));
        return () => setTriggerSidebarRemoveMode(() => {});
    }, [setTriggerSidebarRemoveMode]);


    const handleToggleSelection = (tcode: string) => {
        setSelectedToRemove(prev => 
            prev.includes(tcode) 
                ? prev.filter(code => code !== tcode)
                : [...prev, tcode]
        );
    };

    const handleRemoveClick = () => {
        if (!selectionMode) {
            setSelectionMode(true);
        } else {
            if (selectedToRemove.length === 0) {
                // If nothing is selected, just exit selection mode
                setSelectionMode(false);
            } else {
                // If items are selected, open confirmation dialog
                setIsRemoveConfirmOpen(true);
            }
        }
    };
    
    const confirmRemove = () => {
        removeMockFavorites(selectedToRemove);
        refreshFavorites();
        toast({
            title: 'Favorites Removed',
            description: `${selectedToRemove.length} favorite(s) have been removed.`,
        });
        setIsRemoveConfirmOpen(false);
        setSelectionMode(false);
        setSelectedToRemove([]);
    };
    
    const cancelRemove = () => {
        setSelectionMode(false);
        setSelectedToRemove([]);
    };

    return (
        <>
            <aside className="w-1/4 bg-card border-r border-border p-2 flex flex-col shrink-0">
                <div className="flex items-center justify-between p-2 border-b border-border">
                    <div className="flex items-center gap-2 font-bold text-sm text-foreground">
                        <Star className="h-4 w-4 text-primary" />
                        Favorites
                    </div>
                    <div className="flex gap-1">
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setIsAddModalOpen(true)}>
                            <PlusCircle className="h-4 w-4" />
                        </Button>
                         <Button size="icon" variant={selectionMode ? 'destructive' : 'ghost'} className="h-7 w-7" onClick={handleRemoveClick}>
                            <Trash2 className="h-4 w-4" />
                        </Button>
                        {selectionMode && (
                             <Button size="sm" variant="ghost" onClick={cancelRemove}>
                                Cancel
                            </Button>
                        )}
                    </div>
                </div>
                <ul className="space-y-1 mt-2">
                    {favorites.map(item => {
                        const path = TCODE_ROUTES[item.tcode as keyof typeof TCODE_ROUTES];
                        if (!path) return null;
                        const isActive = pathname === path;
                        return (
                            <li key={item.tcode} className="flex items-center gap-2">
                                {selectionMode && (
                                    <Checkbox
                                        checked={selectedToRemove.includes(item.tcode)}
                                        onCheckedChange={() => handleToggleSelection(item.tcode)}
                                    />
                                )}
                                <Link 
                                    href={path} 
                                    className={cn(
                                        "block text-sm p-1 rounded-sm flex-1 text-foreground/90 hover:bg-accent hover:text-accent-foreground",
                                        isActive && "bg-accent text-accent-foreground font-semibold"
                                    )}
                                >
                                    {item.text}
                                </Link>
                            </li>
                        );
                    })}
                </ul>
            </aside>
            <AddFavoriteModal
                isOpen={isAddModalOpen}
                onClose={() => setIsAddModalOpen(false)}
                onFavoriteAdded={refreshFavorites}
            />
             <AlertDialog open={isRemoveConfirmOpen} onOpenChange={setIsRemoveConfirmOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This will permanently remove {selectedToRemove.length} favorite(s). This action cannot be undone.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel onClick={() => setIsRemoveConfirmOpen(false)}>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={confirmRemove}>Confirm</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    );
}
