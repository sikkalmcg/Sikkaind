'use client';

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Landmark, ArrowRightLeft, Wallet, MinusCircle, ShieldCheck, Lock, Edit2, ChevronRight, Calculator } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface EditSelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  trip: any;
  onSelect: (type: 'banking' | 'freight' | 'charges' | 'debit', trip: any) => void;
}

/**
 * @fileOverview Edit Selection Modal.
 * Implements the ERP requirement to choose a specific module for editing.
 * Enforces the Payment Lock Rule for Banking and Freight Request.
 */
export default function EditSelectionModal({ isOpen, onClose, trip, onSelect }: EditSelectionModalProps) {
  if (!trip) return null;

  // PAYMENT LOCK RULE Node: Banking and Freight Request locked if payment initiated
  const isPaymentInitiated = trip.freightStatus === 'Under Process' || trip.freightStatus === 'Paid';

  const sections = [
    {
        id: 'banking',
        title: 'Banking Details',
        icon: Landmark,
        desc: 'Modify account and beneficiary registry',
        color: 'text-blue-600',
        bg: 'bg-blue-50',
        locked: isPaymentInitiated,
        count: trip.bankingAccounts?.length || 0,
        unit: 'Accounts'
    },
    {
        id: 'freight',
        title: 'Freight Request',
        icon: ArrowRightLeft,
        desc: 'Correct advance or POD amount logic',
        color: 'text-emerald-600',
        bg: 'bg-emerald-50',
        locked: isPaymentInitiated,
        count: trip.freightData?.advanceAmount || 0,
        unit: '₹',
        isCurrency: true
    },
    {
        id: 'charges',
        title: 'Additional Charges',
        icon: Wallet,
        desc: 'Edit detention or labor cost nodes',
        color: 'text-amber-600',
        bg: 'bg-amber-50',
        locked: false,
        count: trip.otherCharges?.length || 0,
        unit: 'Charges'
    },
    {
        id: 'debit',
        title: 'Financial Deductions',
        icon: MinusCircle,
        desc: 'Adjust shortage or damage entries',
        color: 'text-red-600',
        bg: 'bg-red-50',
        locked: false,
        count: trip.freightData?.charges?.filter((c: any) => c.type === 'Debit').length || 0,
        unit: 'Deductions'
    }
  ];

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl border-none shadow-3xl p-0 overflow-hidden bg-white rounded-3xl">
        <DialogHeader className="p-8 bg-slate-900 text-white shrink-0">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-blue-600 rounded-2xl shadow-xl">
                <Edit2 className="h-7 w-7 text-white" />
            </div>
            <div>
                <DialogTitle className="text-2xl font-black uppercase tracking-tight italic">Edit Module Registry</DialogTitle>
                <DialogDescription className="text-blue-300 font-bold uppercase text-[9px] tracking-widest mt-1">
                    Select functional node to enable editing
                </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="p-8 space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {sections.map((section) => (
                    <button
                        key={section.id}
                        disabled={section.locked}
                        onClick={() => onSelect(section.id as any, trip)}
                        className={cn(
                            "flex flex-col text-left p-6 rounded-[2rem] border-2 transition-all duration-300 group relative overflow-hidden",
                            section.locked 
                                ? "bg-slate-50 border-slate-100 opacity-60 cursor-not-allowed" 
                                : cn("bg-white border-slate-100 hover:border-blue-600 shadow-md hover:shadow-xl", `hover:${section.bg}`)
                        )}
                    >
                        <div className="flex justify-between items-start mb-4">
                            <div className={cn("p-3 rounded-2xl transition-transform group-hover:scale-110", section.bg, section.color)}>
                                <section.icon className="h-6 w-6" />
                            </div>
                            {section.locked ? (
                                <Badge variant="destructive" className="font-black text-[8px] uppercase px-2 h-5 rounded-full border-none">
                                    <Lock className="h-2 w-2 mr-1" /> Locked
                                </Badge>
                            ) : (
                                <ChevronRight className="h-5 w-5 text-slate-300 group-hover:text-blue-600 transition-colors" />
                            )}
                        </div>

                        <div className="space-y-1">
                            <h4 className="font-black uppercase text-sm tracking-tight text-slate-900">{section.title}</h4>
                            <p className="text-[10px] font-medium text-slate-400 leading-tight">{section.desc}</p>
                        </div>

                        <div className="mt-6 flex items-center justify-between">
                            <span className="text-[9px] font-black uppercase text-slate-300 tracking-widest">Active Entries</span>
                            <span className="font-black text-slate-900 text-sm">
                                {section.isCurrency ? `₹ ${section.count.toLocaleString()}` : `${section.count} ${section.unit}`}
                            </span>
                        </div>

                        {section.locked && (
                            <div className="absolute inset-0 bg-white/40 backdrop-blur-[1px] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                <div className="bg-slate-900 text-white px-4 py-2 rounded-xl shadow-2xl flex items-center gap-2">
                                    <Lock className="h-3 w-3 text-red-400" />
                                    <span className="text-[9px] font-black uppercase tracking-widest">Payment Initiated</span>
                                </div>
                            </div>
                        )}
                    </button>
                ))}
            </div>

            <div className="p-6 bg-blue-50 rounded-[2rem] border border-blue-100 flex items-start gap-4">
                <Calculator className="h-6 w-6 text-blue-600 shrink-0 mt-0.5" />
                <div className="space-y-1">
                    <p className="text-[10px] font-black text-blue-900 uppercase">Registry Enforcement Policy</p>
                    <p className="text-[10px] font-bold text-blue-700 leading-normal uppercase">
                        Modifications are restricted for processed payments to ensure zero variance in the mission ledger. Deductions and charges remain open until final audit.
                    </p>
                </div>
            </div>
        </div>

        <DialogFooter className="p-6 bg-slate-50 border-t flex-row justify-end items-center gap-4">
            <span className="text-[9px] font-black uppercase text-slate-400 tracking-widest mr-auto flex items-center gap-2 italic">
                <ShieldCheck className="h-4 w-4 text-emerald-600" /> Authorized Identity Node Handshake
            </span>
            <Button variant="ghost" onClick={onClose} className="font-black text-slate-500 uppercase text-[11px] tracking-widest px-8">Discard</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
