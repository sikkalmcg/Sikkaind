'use client';

import { useState, useEffect, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Search, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SearchHelpModalProps {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    data: any[];
    onSelect: (code: string) => void;
    multiple?: boolean;
    onMultiSelect?: (codes: string[]) => void;
    initialSelection?: string[];
}

const EMPTY_ARRAY: string[] = [];

export default function SearchHelpModal({ 
    isOpen, 
    onClose, 
    title, 
    data, 
    onSelect, 
    multiple = false, 
    onMultiSelect, 
    initialSelection = EMPTY_ARRAY 
}: SearchHelpModalProps) {
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedCode, setSelectedCode] = useState<string | null>(null);
    const [selectedCodes, setSelectedCodes] = useState<string[]>(initialSelection);
    
    useEffect(() => {
        if(isOpen) {
            setSearchTerm('');
            setSelectedCode(null);
            setSelectedCodes(initialSelection);
        }
    }, [isOpen, initialSelection]);

    const filteredData = useMemo(() => {
        const s = searchTerm.toLowerCase();
        return data.filter(item => 
            (item.id || '')?.toLowerCase().includes(s) || 
            (item.name || '')?.toLowerCase().includes(s)
        );
    }, [data, searchTerm]);

    const handleSelectAndClose = () => {
        if (multiple) {
            onMultiSelect?.(selectedCodes);
        } else {
            if (selectedCode) {
                onSelect(selectedCode);
            }
        }
        onClose();
    };
    
    const handleRowClick = (item: any) => {
        const identifier = item.id || item.name;
        if (multiple) {
            setSelectedCodes(prev => 
                prev.includes(identifier) 
                ? prev.filter(code => code !== identifier) 
                : [...prev, identifier]
            );
        } else {
            setSelectedCode(identifier);
        }
    }
    
    const handleRowDoubleClick = (item: any) => {
        if (!multiple) {
            onSelect(item.id || item.name);
            onClose();
        }
    }

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-xl p-0 border-none shadow-3xl overflow-hidden bg-white">
                <DialogHeader className="p-6 bg-slate-900 text-white">
                    <DialogTitle className="text-xl font-black uppercase tracking-tight italic flex items-center gap-3">
                        <Search className="h-5 w-5 text-blue-400" /> {title}
                    </DialogTitle>
                    <DialogDescription className="text-blue-300 font-bold uppercase text-[9px] tracking-widest mt-1">
                        Select an authorized entry from the master registry
                    </DialogDescription>
                </DialogHeader>

                <div className="p-6 space-y-4">
                    <div className="relative group">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 group-focus-within:text-blue-900 transition-colors" />
                        <Input 
                            placeholder="Filter registry..." 
                            value={searchTerm} 
                            onChange={(e) => setSearchTerm(e.target.value)} 
                            className="pl-10 h-11 rounded-xl bg-slate-50 border-slate-200 font-bold focus-visible:ring-blue-900"
                        />
                    </div>

                    <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-inner bg-white">
                        <ScrollArea className="h-[40vh]">
                            <Table className="border-collapse">
                                <TableHeader className="sticky top-0 bg-slate-50 z-10">
                                    <TableRow className="hover:bg-transparent border-b">
                                        {multiple && <TableHead className="w-[50px]"></TableHead>}
                                        <TableHead className="text-[10px] font-black uppercase tracking-widest h-10 px-4">Identifier</TableHead>
                                        <TableHead className="text-[10px] font-black uppercase tracking-widest h-10 px-4">Description</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {filteredData.length === 0 ? (
                                        <TableRow><TableCell colSpan={multiple ? 3 : 2} className="h-32 text-center text-slate-400 italic font-medium">No matching records found.</TableCell></TableRow>
                                    ) : (
                                        filteredData.map(item => {
                                            const identifier = item.id || item.name;
                                            const isSelected = multiple ? selectedCodes.includes(identifier) : selectedCode === identifier;
                                            return (
                                                <TableRow 
                                                    key={item.id} 
                                                    onClick={() => handleRowClick(item)} 
                                                    onDoubleClick={() => handleRowDoubleClick(item)}
                                                    className={cn(
                                                        "cursor-pointer h-12 transition-all group",
                                                        isSelected ? "bg-blue-50" : "hover:bg-slate-50"
                                                    )}
                                                >
                                                    {multiple && (
                                                        <TableCell className="px-4">
                                                            <Checkbox checked={isSelected} className="data-[state=checked]:bg-blue-900" />
                                                        </TableCell>
                                                    )}
                                                    <TableCell className="px-4 font-black text-blue-900 uppercase text-xs">
                                                        {item.id || '--'}
                                                    </TableCell>
                                                    <TableCell className="px-4 font-bold text-slate-700 text-xs">
                                                        <div className="flex items-center justify-between">
                                                            <span>{item.name}</span>
                                                            {isSelected && !multiple && (
                                                                <CheckCircle2 className="h-4 w-4 text-blue-600 animate-in zoom-in-50 duration-200" />
                                                            )}
                                                        </div>
                                                    </TableCell>
                                                </TableRow>
                                            );
                                        })
                                    )}
                                </TableBody>
                            </Table>
                        </ScrollArea>
                    </div>
                </div>

                <DialogFooter className="p-6 bg-slate-50 border-t flex-row justify-end gap-3">
                    <Button variant="ghost" onClick={onClose} className="font-bold text-slate-400">Cancel</Button>
                    <Button 
                        onClick={handleSelectAndClose} 
                        disabled={!multiple && !selectedCode}
                        className="bg-blue-900 hover:bg-slate-900 text-white px-10 h-11 rounded-xl font-black uppercase text-[10px] tracking-widest shadow-lg shadow-blue-100"
                    >
                        Confirm Selection
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}