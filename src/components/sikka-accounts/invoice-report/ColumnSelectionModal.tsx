'use client';
import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';

interface ColumnSelectionModalProps {
    isOpen: boolean;
    onClose: () => void;
    allColumns: { key: string, label: string }[];
    visibleColumns: string[];
    onSave: (newVisibleColumns: string[]) => void;
}

export default function ColumnSelectionModal({ isOpen, onClose, allColumns, visibleColumns, onSave }: ColumnSelectionModalProps) {
    const [hidden, setHidden] = useState<string[]>(allColumns.filter(c => !visibleColumns.includes(c.key)).map(c => c.key));
    const [visible, setVisible] = useState<string[]>(visibleColumns);
    const [selectedHidden, setSelectedHidden] = useState<string[]>([]);
    const [selectedVisible, setSelectedVisible] = useState<string[]>([]);
    
    const handleMoveToVisible = () => {
        setVisible(prev => [...prev, ...selectedHidden]);
        setHidden(prev => prev.filter(c => !selectedHidden.includes(c)));
        setSelectedHidden([]);
    };

    const handleMoveToHidden = () => {
        setHidden(prev => [...prev, ...selectedVisible]);
        setVisible(prev => prev.filter(c => !selectedVisible.includes(c)));
        setSelectedVisible([]);
    };

    const handleSave = () => {
        onSave(visible);
        onClose();
    };

    const toggleSelection = (list: 'hidden' | 'visible', key: string) => {
        const setFn = list === 'hidden' ? setSelectedHidden : setSelectedVisible;
        setFn(prev => prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]);
    };

    const ColumnList = ({ keys, selected, onToggle }: { keys: string[], selected: string[], onToggle: (key: string) => void }) => (
        <div className="border rounded-md p-2 h-80 overflow-y-auto space-y-1">
            {keys.map(key => {
                const column = allColumns.find(c => c.key === key);
                return (
                    <div key={key} className="flex items-center space-x-2 p-1 rounded-md hover:bg-gray-100">
                         <Checkbox id={key} checked={selected.includes(key)} onCheckedChange={() => onToggle(key)} />
                         <Label htmlFor={key} className="w-full cursor-pointer">{column?.label}</Label>
                    </div>
                )
            })}
        </div>
    );


    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-3xl">
                <DialogHeader><DialogTitle>Change Layout</DialogTitle></DialogHeader>
                <div className="flex items-center justify-center gap-4">
                    <div className="w-64"><p className="font-semibold text-center mb-2">Displayed Columns</p><ColumnList keys={visible} selected={selectedVisible} onToggle={(k) => toggleSelection('visible', k)} /></div>
                    <div className="flex flex-col gap-2"><Button size="icon" onClick={handleMoveToHidden}><ArrowRight /></Button><Button size="icon" onClick={handleMoveToVisible}><ArrowLeft /></Button></div>
                    <div className="w-64"><p className="font-semibold text-center mb-2">Hidden Columns</p><ColumnList keys={hidden} selected={selectedHidden} onToggle={(k) => toggleSelection('hidden', k)} /></div>
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={onClose}>Cancel</Button>
                    <Button onClick={handleSave}>Confirm</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}