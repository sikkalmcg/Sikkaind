
'use client';

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ArrowUp, ArrowDown, RotateCcw, Save, Settings2, X, Eye, EyeOff } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { type ColumnDef } from './ResultGrid';

interface ColumnSelectionModalProps {
    isOpen: boolean;
    onClose: () => void;
    columns: ColumnDef[];
    onSave: (newColumns: ColumnDef[]) => void;
    defaultColumns: ColumnDef[];
}

export default function ColumnSelectionModal({ isOpen, onClose, columns, onSave, defaultColumns }: ColumnSelectionModalProps) {
    const [localCols, setLocalCols] = useState<ColumnDef[]>([...columns]);

    useEffect(() => {
        if (isOpen) {
            setLocalCols([...columns]);
        }
    }, [isOpen, columns]);

    const handleMove = (index: number, direction: 'up' | 'down') => {
        const newCols = [...localCols];
        const targetIndex = direction === 'up' ? index - 1 : index + 1;
        
        if (targetIndex < 0 || targetIndex >= newCols.length) return;

        [newCols[index], newCols[targetIndex]] = [newCols[targetIndex], newCols[index]];
        setLocalCols(newCols);
    };

    const handleToggle = (index: number) => {
        const newCols = [...localCols];
        newCols[index].visible = !newCols[index].visible;
        setLocalCols(newCols);
    };

    const handleSave = () => {
        onSave(localCols);
        onClose();
    };

    const handleReset = () => {
        setLocalCols([...defaultColumns]);
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-2xl p-0 border-none shadow-2xl overflow-hidden bg-white">
                <DialogHeader className="p-6 bg-slate-900 text-white flex flex-row items-center gap-4 space-y-0">
                    <div className="p-2 bg-blue-600 rounded-lg"><Settings2 className="h-5 w-5" /></div>
                    <div>
                        <DialogTitle className="text-xl font-black uppercase tracking-tight italic">Change Layout Registry</DialogTitle>
                        <DialogDescription className="text-blue-300 font-bold uppercase text-[9px] tracking-widest mt-1">Configure extraction node visibility & order</DialogDescription>
                    </div>
                </DialogHeader>

                <div className="p-8">
                    <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-4 px-1">Field Position & Visibility</p>
                    <div className="border border-slate-200 rounded-2xl overflow-hidden bg-white shadow-inner">
                        <ScrollArea className="h-[50vh]">
                            <div className="divide-y divide-slate-100">
                                {localCols.map((col, index) => (
                                    <div 
                                        key={col.key} 
                                        className={cn(
                                            "flex items-center justify-between p-3 transition-all duration-200",
                                            col.visible ? "bg-white" : "bg-slate-50 opacity-60"
                                        )}
                                    >
                                        <div className="flex items-center gap-4">
                                            <Checkbox 
                                                id={`check-${col.key}`} 
                                                checked={col.visible} 
                                                onCheckedChange={() => handleToggle(index)}
                                                className="data-[state=checked]:bg-blue-900"
                                            />
                                            <div className="flex flex-col">
                                                <Label htmlFor={`check-${col.key}`} className="text-xs font-black uppercase text-slate-700 cursor-pointer">{col.label}</Label>
                                                <span className="text-[9px] font-mono text-slate-400">{col.key}</span>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-1">
                                            <Button 
                                                variant="ghost" 
                                                size="icon" 
                                                className="h-8 w-8 text-slate-400 hover:text-blue-600 hover:bg-blue-50"
                                                onClick={() => handleMove(index, 'up')}
                                                disabled={index === 0}
                                            >
                                                <ArrowUp className="h-4 w-4" />
                                            </Button>
                                            <Button 
                                                variant="ghost" 
                                                size="icon" 
                                                className="h-8 w-8 text-slate-400 hover:text-blue-600 hover:bg-blue-50"
                                                onClick={() => handleMove(index, 'down')}
                                                disabled={index === localCols.length - 1}
                                            >
                                                <ArrowDown className="h-4 w-4" />
                                            </Button>
                                            <div className="w-8 flex justify-center">
                                                {col.visible ? <Eye className="h-3.5 w-3.5 text-emerald-500" /> : <EyeOff className="h-3.5 w-3.5 text-slate-300" />}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </ScrollArea>
                    </div>
                </div>

                <DialogFooter className="p-6 bg-slate-50 border-t flex-row justify-between sm:justify-between items-center">
                    <Button variant="ghost" onClick={handleReset} className="text-orange-600 hover:text-orange-700 hover:bg-orange-50 gap-2 font-black uppercase text-[10px] tracking-widest">
                        <RotateCcw className="h-3.5 w-3.5" /> Reset Standard
                    </Button>
                    <div className="flex gap-3">
                        <Button variant="ghost" onClick={onClose} className="font-bold text-slate-400">Cancel</Button>
                        <Button onClick={handleSave} className="bg-blue-900 hover:bg-slate-900 text-white px-10 h-11 rounded-xl font-black uppercase text-[10px] tracking-widest shadow-lg shadow-blue-100 border-none gap-2">
                            <Save className="h-4 w-4" /> Save Layout
                        </Button>
                    </div>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
