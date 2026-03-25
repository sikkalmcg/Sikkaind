'use client';

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Printer, FileDown, ShieldCheck } from 'lucide-react';
import PrintableVoucher from './PrintableVoucher';
import { useToast } from '@/hooks/use-toast';
import { renderToStaticMarkup } from 'react-dom/server';
import PrintableVoucherWrapper from './PrintableVoucherWrapper';

interface PrintVoucherModalProps {
  isOpen: boolean;
  onClose: () => void;
  trip: any;
}

export default function PrintVoucherModal({ isOpen, onClose, trip }: PrintVoucherModalProps) {
    const { toast } = useToast();

    const handlePrint = () => {
        if (typeof window === 'undefined') return;

        const printWindow = window.open('', '', 'height=800,width=1200');
        if (printWindow) {
            const markup = renderToStaticMarkup(<PrintableVoucherWrapper trip={trip} />);
            printWindow.document.write(markup);
            printWindow.document.close();
            printWindow.focus();

            setTimeout(() => {
                printWindow.print();
                printWindow.close();
            }, 250); // Small delay to ensure content loads

            toast({ title: "Print Node Initialized", description: "Voucher extraction successful." });
        } else {
            toast({ variant: 'destructive', title: "Error", description: "Could not open print window. Please disable your pop-up blocker." });
        }
    };

    if (!trip) return null;

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-[95vw] md:max-w-6xl h-[95vh] flex flex-col p-0 border-none shadow-3xl bg-slate-100 overflow-hidden">
                <DialogHeader className="p-6 bg-slate-900 text-white shrink-0 pr-12 print:hidden">
                    <div className="flex justify-between items-center">
                        <div className="flex items-center gap-4">
                            <div className="p-3 bg-blue-600 rounded-2xl shadow-xl">
                                <Printer className="h-7 w-7 text-white" />
                            </div>
                            <div>
                                <DialogTitle className="text-xl font-black uppercase tracking-tight italic">Transporter Payment Voucher</DialogTitle>
                                <DialogDescription className="text-blue-300 font-bold uppercase text-[9px] tracking-widest mt-1">
                                    Registry Extraction Node: {trip.tripId}
                                </DialogDescription>
                            </div>
                        </div>
                        <div className="flex gap-3">
                            <Button variant="outline" className="h-10 bg-white/10 border-white/20 text-white font-black text-[10px] uppercase tracking-widest px-6 hover:bg-white/20" onClick={handlePrint}>
                                <FileDown className="h-4 w-4 mr-2" /> Download PDF
                            </Button>
                            <Button className="h-10 bg-blue-600 hover:bg-blue-700 text-white font-black text-[10px] uppercase tracking-widest px-8 border-none shadow-lg transition-all active:scale-95" onClick={handlePrint}>
                                <Printer className="h-4 w-4 mr-2" /> Print Now
                            </Button>
                        </div>
                    </div>
                </DialogHeader>

                <div className="flex-1 overflow-y-auto p-12 flex flex-col items-center">
                    <div className="print-container">
                        <PrintableVoucher trip={trip} />
                    </div>
                </div>

                <DialogFooter className="p-6 bg-white border-t shrink-0 print:hidden flex-row justify-end items-center gap-4">
                    <span className="text-[9px] font-black uppercase text-slate-400 tracking-widest mr-auto flex items-center gap-2">
                        <ShieldCheck className="h-3.5 w-3.5" /> Registry Verified Document Node
                    </span>
                    <Button variant="ghost" onClick={onClose} className="font-black text-slate-500 uppercase text-[10px] tracking-widest px-8">Discard Preview</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
