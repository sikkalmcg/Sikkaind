'use client';
import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { Palette, CheckCircle2 } from 'lucide-react';

interface ThemeSelectorProps {
  isOpen: boolean;
  onClose: () => void;
}

const themes = [
    { name: 'Blue Crystal', id: 'blue-crystal', colors: ['#4F86F7', '#EBF5FF'], desc: 'Professional Corporate Look' },
    { name: 'Golden Premium', id: 'golden', colors: ['#E69B00', '#FFFBF0'], desc: 'High-Class Executive Feel' },
    { name: 'Green Forest', id: 'green', colors: ['#4B830D', '#F7FAF5'], desc: 'Calm and Productivity Focus' },
    { name: 'Pink Blossom', id: 'pink', colors: ['#DE3163', '#FFF0F5'], desc: 'Modern and Vibrant' },
    { name: 'Purple Royal', id: 'purple', colors: ['#8A2BE2', '#F8F0FF'], desc: 'Elegant and Sophisticated' },
    { name: 'Signature Standard', id: 'signature', colors: ['#4F86F7', '#F8F9FA'], desc: 'Original SLMC Interface' },
    { name: 'Horizon Dark', id: 'horizon-dark', colors: ['#4789F5', '#1D2D3E'], desc: 'Night Mode Operation' },
    { name: 'High Contrast', id: 'high-contrast-black', colors: ['#FFFF00', '#000000'], desc: 'Maximum Readability' },
];

export default function ThemeSelector({ isOpen, onClose }: ThemeSelectorProps) {
    const { toast } = useToast();
    const [selectedTheme, setSelectedTheme] = useState('signature');

    useEffect(() => {
        if (isOpen) {
            const currentTheme = document.documentElement.getAttribute('data-theme') || 'signature';
            setSelectedTheme(currentTheme);
        }
    }, [isOpen]);

    const handleApply = () => {
        document.documentElement.setAttribute('data-theme', selectedTheme);
        toast({ title: 'System Theme Updated', description: `The ${themes.find(t => t.id === selectedTheme)?.name} has been applied globally.` });
        onClose();
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-3xl p-0 overflow-hidden border-none shadow-2xl">
                <DialogHeader className="p-6 bg-slate-50 border-b">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-blue-900 text-white rounded-lg"><Palette className="h-5 w-5" /></div>
                        <div>
                            <DialogTitle className="text-xl font-black text-blue-900 uppercase">Personalize System Workspace</DialogTitle>
                            <DialogDescription className="text-xs font-bold uppercase tracking-widest text-slate-400">Apply custom themes to SLMC Console</DialogDescription>
                        </div>
                    </div>
                </DialogHeader>
                
                <div className="p-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 max-h-[60vh] overflow-y-auto">
                    {themes.map(theme => (
                        <div key={theme.id} 
                            onClick={() => setSelectedTheme(theme.id)}
                            className={cn(
                                "group cursor-pointer rounded-2xl border-2 p-4 transition-all duration-300 hover:shadow-lg relative",
                                selectedTheme === theme.id ? "border-blue-600 bg-blue-50/30 ring-4 ring-blue-50" : "border-slate-100 bg-white hover:border-slate-200"
                            )}
                        >
                            <div className="flex flex-col gap-4">
                                <div className="flex items-center justify-center h-24 rounded-xl shadow-inner overflow-hidden border border-slate-100" style={{ backgroundColor: theme.colors[1] }}>
                                    <div className="h-10 w-10 rounded-full shadow-lg" style={{ backgroundColor: theme.colors[0] }} />
                                </div>
                                <div>
                                    <p className="text-xs font-black uppercase text-slate-800 truncate">{theme.name}</p>
                                    <p className="text-[10px] font-medium text-slate-400 mt-1">{theme.desc}</p>
                                </div>
                            </div>
                            {selectedTheme === theme.id && (
                                <div className="absolute -top-2 -right-2 bg-blue-600 text-white rounded-full p-1 shadow-lg animate-in zoom-in duration-200">
                                    <CheckCircle2 className="h-4 w-4" />
                                </div>
                            )}
                        </div>
                    ))}
                </div>

                <DialogFooter className="p-6 bg-slate-50 border-t flex-row sm:justify-end gap-3">
                    <Button variant="ghost" onClick={onClose} className="font-bold text-slate-500">Cancel</Button>
                    <Button onClick={handleApply} className="bg-blue-900 hover:bg-slate-900 text-white font-black uppercase tracking-widest px-10 h-11 border-none shadow-xl shadow-blue-100">
                        Apply Global Theme
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}