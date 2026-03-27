'use client';

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Settings2, ShieldCheck, LayoutGrid, Info } from 'lucide-react';

interface TripBoardLayoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeTab: string;
}

export default function TripBoardLayoutModal({ isOpen, onClose, activeTab }: TripBoardLayoutModalProps) {
  const columnGroups = [
    {
        title: 'Mission Core',
        cols: ['Plant Node', 'Trip ID', 'Vehicle No', 'Order ID', 'Mission Start']
    },
    {
        title: 'Manifest registry',
        cols: ['LR Number', 'LR Date', 'Invoice Registry', 'Weight (MT)', 'POD Status']
    },
    {
        title: 'Route Particulars',
        cols: ['FROM Node', 'Consignor', 'Ship To Party', 'Destination', 'Pilot Contact']
    },
    {
        title: 'Registry Actions',
        cols: ['GIS Track', 'POD Control', 'LR Generate', 'Edit Assignment']
    }
  ];

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl p-0 border-none shadow-3xl overflow-hidden bg-white rounded-3xl">
        <DialogHeader className="p-8 bg-slate-900 text-white shrink-0">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-blue-600 rounded-2xl shadow-xl">
                <Settings2 className="h-7 w-7 text-white" />
            </div>
            <div>
                <DialogTitle className="text-2xl font-black uppercase tracking-tight italic">Mission Board Layout</DialogTitle>
                <DialogDescription className="text-blue-300 font-bold uppercase text-[9px] tracking-widest mt-1">
                    Display Registry Node: {activeTab.toUpperCase()}
                </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="p-10 space-y-10">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                {columnGroups.map((group, i) => (
                    <div key={i} className="space-y-4">
                        <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-[0.2em] px-1 border-b border-slate-50 pb-2">{group.title}</h4>
                        <div className="space-y-3">
                            {group.cols.map((col) => (
                                <div key={col} className="flex items-center space-x-3 group cursor-pointer hover:bg-slate-50 p-2 rounded-xl transition-all">
                                    <Checkbox id={`col-${col}`} defaultChecked className="h-5 w-5 data-[state=checked]:bg-blue-900 data-[state=checked]:border-blue-900" />
                                    <Label htmlFor={`col-${col}`} className="text-xs font-bold text-slate-600 uppercase cursor-pointer group-hover:text-blue-900">{col}</Label>
                                </div>
                            ))}
                        </div>
                    </div>
                ))}
            </div>

            <div className="p-6 bg-blue-50 rounded-[2rem] border border-blue-100 flex items-start gap-4">
                <Info className="h-6 w-6 text-blue-600 shrink-0 mt-0.5" />
                <div className="space-y-1">
                    <p className="text-[10px] font-black text-blue-900 uppercase">Personalized Registry Node</p>
                    <p className="text-[10px] font-bold text-blue-700 leading-normal uppercase">
                        Visibility settings are cached in your current session. System default resets upon registry logout.
                    </p>
                </div>
            </div>
        </div>

        <DialogFooter className="p-6 bg-slate-50 border-t flex-row justify-end items-center gap-4 shrink-0">
            <span className="text-[9px] font-black uppercase text-slate-400 tracking-widest mr-auto flex items-center gap-2 italic">
                <ShieldCheck className="h-4 w-4 text-emerald-600" /> Verified Identity Handshake
            </span>
            <Button variant="ghost" onClick={onClose} className="font-black text-slate-500 uppercase text-[10px] tracking-widest px-8 h-11">Discard</Button>
            <Button onClick={onClose} className="bg-blue-900 hover:bg-black text-white px-10 h-11 rounded-xl font-black uppercase text-[10px] tracking-widest shadow-xl border-none transition-all active:scale-95">
                Apply Layout
            </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
