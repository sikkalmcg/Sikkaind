'use client';

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Printer, FileDown, ShieldCheck, Landmark, CheckCircle2, History, X } from 'lucide-react';
import type { EnrichedFreight } from '@/app/dashboard/freight-management/page';
import PrintablePaymentSlip from './PrintablePaymentSlip';
import { useToast } from '@/hooks/use-toast';

interface PrintPaymentSlipModalProps {
  isOpen: boolean;
  onClose: () => void;
  freight: EnrichedFreight;
  payment: any;
}

export default function PrintPaymentSlipModal({ isOpen, onClose, freight, payment }: PrintPaymentSlipModalProps) {
    const { toast } = useToast();

    const handlePrint = () => {
        if (typeof window === 'undefined') return;
        const originalTitle = document.title;
        document.title = `Payment_Slip_${payment.slipNumber || payment.id}`;
        window.print();
        setTimeout(() => {
            document.title = originalTitle;
        }, 1000);
        toast({ title: "Print Node Triggered", description: "Payment voucher extraction successful." });
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-5xl h-[95vh] flex flex-col p-0 border-none shadow-3xl bg-slate-100 overflow-hidden">
                <DialogHeader className="p-6 bg-slate-900 text-white shrink-0 pr-12 print:hidden">
                    <div className="flex justify-between items-center">
                        <div className="flex items-center gap-4">
                            <div className="p-3 bg-emerald-600 rounded-2xl shadow-xl">
                                <Landmark className="h-7 w-7 text-white" />
                            </div>
                            <div>
                                <DialogTitle className="text-xl font-black uppercase tracking-tight italic">Mission Payment Registry Preview</DialogTitle>
                                <DialogDescription className="text-emerald-200 font-bold uppercase text-[9px] tracking-widest mt-1">
                                    Voucher Extraction Node: {payment.slipNumber || 'PENDING'}
                                </DialogDescription>
                            </div>
                        </div>
                        <div className="flex gap-3">
                            <Button variant="outline" className="h-10 bg-white/10 border-white/20 text-white font-black text-[10px] uppercase tracking-widest px-6 hover:bg-white/20" onClick={handlePrint}>
                                <FileDown className="h-4 w-4 mr-2" /> Download PDF
                            </Button>
                            <Button className="h-10 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-[10px] uppercase tracking-widest px-8 border-none shadow-lg transition-all active:scale-95" onClick={handlePrint}>
                                <Printer className="h-4 w-4 mr-2" /> Print Slip
                            </Button>
                        </div>
                    </div>
                </DialogHeader>

                <div className="flex-1 overflow-y-auto p-12 flex flex-col items-center print:p-0 print:m-0 print:bg-white">
                    <div className="bg-white p-12 shadow-2xl rounded-[2.5rem] border border-slate-200 min-h-[297mm] w-full max-w-[210mm] print:shadow-none print:border-none print:p-0 print:m-0">
                        <PrintablePaymentSlip freight={freight} payment={payment} />
                    </div>
                </div>

                <DialogFooter className="p-6 bg-white border-t shrink-0 print:hidden flex-row justify-end items-center gap-4">
                    <span className="text-[9px] font-black uppercase text-slate-400 tracking-widest mr-auto flex items-center gap-2">
                        <ShieldCheck className="h-3.5 w-3.5" /> Verified Registry Document Node
                    </span>
                    <Button variant="ghost" onClick={onClose} className="font-black text-slate-500 uppercase text-[10px] tracking-widest px-8">Discard Preview</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
