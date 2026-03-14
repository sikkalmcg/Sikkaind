'use client';

import { useState, useRef } from 'react';
import { useReactToPrint } from 'react-to-print';
import { Dialog, DialogContent, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import PrintableLR, { type EnrichedLR } from '@/components/dashboard/vehicle-assign/PrintableLR';
import { Printer, FileDown, ZoomIn, ZoomOut, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface LRPrintPreviewModalProps {
    isOpen: boolean;
    onClose: () => void;
    lr: EnrichedLR;
}

export default function LRPrintPreviewModal({ isOpen, onClose, lr }: LRPrintPreviewModalProps) {
    const { toast } = useToast();
    const [zoom, setZoom] = useState(100);
    const [isPreparing, setIsPreparing] = useState(false);
    const contentRef = useRef<HTMLDivElement>(null);

    // Optimized Print Logic
    const handlePrint = useReactToPrint({
        contentRef,
        documentTitle: `LR_${lr.lrNumber || lr.id}`,
        onBeforeGetContent: async () => {
            setIsPreparing(true);
            return new Promise((resolve) => {
                setTimeout(() => {
                    resolve();
                }, 400); // 400ms delay to ensure styles are injected
            });
        },
        onAfterPrint: () => {
            setIsPreparing(false);
            toast({ title: 'Success', description: 'LR Sent to spooler' });
        },
        onPrintError: () => {
            setIsPreparing(false);
            toast({ variant: 'destructive', title: 'Error', description: 'Failed to trigger print' });
        }
    });

    const handleZoomIn = () => setZoom(prev => Math.min(prev + 10, 150));
    const handleZoomOut = () => setZoom(prev => Math.max(prev - 10, 50));

    const copies = [
        { type: 'Consignee Copy' },
        { type: 'Driver Copy' },
        { type: 'Consignor Copy' }
    ];

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-[95vw] md:max-w-6xl h-[95vh] flex flex-col p-0 overflow-hidden border-none shadow-2xl bg-slate-50 print:bg-white print:p-0">
                
                {/* 1. TOOLBAR (Hidden on Print) */}
                <div className="flex items-center justify-between p-4 border-b bg-white print:hidden shrink-0 pr-12">
                    <div className="flex flex-col">
                        <DialogTitle className="text-xl font-black text-blue-900 uppercase italic">
                            LR Registry Preview: {lr.lrNumber}
                        </DialogTitle>
                        <DialogDescription className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                            Mission Node: {lr.tripId}
                        </DialogDescription>
                    </div>

                    <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2 bg-slate-50 px-3 py-1 rounded-full border border-slate-200">
                            <Button variant="ghost" size="icon" className="h-7 w-7 rounded-full" onClick={handleZoomOut} disabled={zoom <= 50}>
                                <ZoomOut className="h-3.5 w-3.5" />
                            </Button>
                            <span className="text-[11px] font-black w-10 text-center text-slate-600">{zoom}%</span>
                            <Button variant="ghost" size="icon" className="h-7 w-7 rounded-full" onClick={handleZoomIn} disabled={zoom >= 150}>
                                <ZoomIn className="h-3.5 w-3.5" />
                            </Button>
                        </div>
                        {isPreparing && (
                            <div className="flex items-center gap-2 text-blue-600 animate-pulse">
                                <Loader2 className="h-4 w-4 animate-spin" />
                                <span className="text-[10px] font-black uppercase tracking-widest">Syncing Registry...</span>
                            </div>
                        )}
                    </div>
                </div>

                {/* 2. PRINTABLE VIEWPORT */}
                <div className="flex-1 bg-slate-200/50 overflow-y-auto p-8 print:p-0 print:bg-white print:overflow-visible">
                    <div className="flex flex-col items-center pb-20 print:pb-0 print:block">
                        <div 
                            ref={contentRef}
                            id="printable-area"
                            className="block print:block flex flex-col gap-12 transition-transform duration-200 ease-out print:!transform-none print:!gap-0 print:!p-0 print:w-full"
                            style={{ 
                                transform: `scale(${zoom / 100})`, 
                                transformOrigin: 'top center',
                                width: 'fit-content'
                            }}
                        >
                            {copies.map((copy, index) => (
                                <div 
                                    key={copy.type} 
                                    className="bg-white shadow-xl print:shadow-none w-full max-w-[210mm] page-break-after-always last:page-break-after-auto print:m-0"
                                >
                                    <PrintableLR 
                                        lr={lr} 
                                        copyType={copy.type} 
                                        pageNumber={index + 1} 
                                        totalInSeries={copies.length} 
                                    />
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* 3. ACTION FOOTER */}
                <DialogFooter className="p-6 border-t bg-white print:hidden flex-row justify-end items-center gap-4 shrink-0 shadow-[0_-10px_30px_rgba(0,0,0,0.05)]">
                    <Button variant="ghost" onClick={onClose} className="font-black text-slate-400 uppercase text-[11px] tracking-widest px-8">
                        Close
                    </Button>
                    <div className="flex gap-3">
                        <Button 
                            onClick={() => handlePrint()} 
                            disabled={isPreparing}
                            className="bg-blue-600 hover:bg-blue-700 text-white font-black uppercase text-[11px] tracking-widest px-10 h-12 rounded-xl gap-2 shadow-lg transition-all active:scale-95"
                        >
                            {isPreparing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Printer className="h-4 w-4" />}
                            Print Now
                        </Button>
                        <Button 
                            onClick={() => handlePrint()} 
                            disabled={isPreparing}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white font-black uppercase text-[11px] tracking-widest px-10 h-12 rounded-xl gap-2 shadow-lg transition-all active:scale-95"
                        >
                            <FileDown className="h-4 w-4" />
                            Download PDF
                        </Button>
                    </div>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}