'use client';

import { useState, useRef } from 'react';
import { useReactToPrint } from 'react-to-print';
import { Dialog, DialogContent, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import PrintableLR, { type EnrichedLR } from '@/components/dashboard/vehicle-assign/PrintableLR';
import { Printer, FileDown, ZoomIn, ZoomOut, Loader2, X } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface LRPrintPreviewModalProps {
    isOpen: boolean;
    onClose: () => void;
    lr: EnrichedLR;
}

/**
 * @fileOverview LR Print Preview Terminal.
 * Synchronized with react-to-print v2.15.1 standards.
 * Manages triple-copy manifest extraction.
 */
export default function LRPrintPreviewModal({ isOpen, onClose, lr }: LRPrintPreviewModalProps) {
    const { toast } = useToast();
    const [zoom, setZoom] = useState(100);
    const [isPreparing, setIsPreparing] = useState(false);
    const contentRef = useRef<HTMLDivElement>(null);

    // Registry Print Handshake Node (v2.x Compatible Syntax)
    const handlePrint = useReactToPrint({
        content: () => contentRef.current,
        documentTitle: `LR_${lr.lrNumber || lr.id}`,
        onBeforeGetContent: () => {
            setIsPreparing(true);
            return Promise.resolve();
        },
        onAfterPrint: () => {
            setIsPreparing(false);
            toast({ title: 'Mission Printed', description: 'Document sent to spooler registry.' });
        },
        onPrintError: () => {
            setIsPreparing(false);
            toast({ variant: 'destructive', title: 'Print Failed', description: 'Registry communication error.' });
        }
    });

    const handleZoomIn = () => setZoom(prev => Math.min(prev + 10, 150));
    const handleZoomOut = () => setZoom(prev => Math.max(prev - 10, 50));

    const copies = [
        { type: 'CONSIGNEE COPY' },
        { type: 'DRIVER COPY' },
        { type: 'CONSIGNOR COPY' }
    ];

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-[95vw] md:max-w-6xl h-[95vh] flex flex-col p-0 border-none shadow-3xl overflow-hidden bg-slate-100 rounded-[2.5rem] print:bg-white print:p-0 print:rounded-none">
                
                {/* TOOLBAR */}
                <div className="flex items-center justify-between p-6 border-b bg-slate-900 text-white print:hidden shrink-0 pr-12">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-blue-600 rounded-2xl shadow-xl">
                            <Printer className="h-6 w-6" />
                        </div>
                        <div>
                            <DialogTitle className="text-xl font-black uppercase tracking-tight italic">
                                Mission Manifest Preview
                            </DialogTitle>
                            <DialogDescription className="text-blue-300 font-bold uppercase text-[9px] tracking-widest mt-1">
                                LR NO: {lr.lrNumber} | Registry Node: {lr.originPlantId}
                            </DialogDescription>
                        </div>
                    </div>

                    <div className="flex items-center gap-6">
                        <div className="flex items-center gap-2 bg-white/5 px-4 py-2 rounded-xl border border-white/10 shadow-inner">
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-white" onClick={handleZoomOut} disabled={zoom <= 50}><ZoomOut className="h-4 w-4" /></Button>
                            <span className="text-[11px] font-black w-12 text-center text-blue-400">{zoom}%</span>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-white" onClick={handleZoomIn} disabled={zoom >= 150}><ZoomIn className="h-4 w-4" /></Button>
                        </div>
                        <Button variant="ghost" size="icon" onClick={onClose} className="h-10 w-10 bg-white p-0 text-red-600 hover:bg-red-50 rounded-xl shadow-lg flex items-center justify-center border-none">
                            <X className="h-6 w-6 stroke-[3]" />
                        </Button>
                    </div>
                </div>

                {/* VIEWPORT */}
                <div className="flex-1 bg-slate-200/50 overflow-y-auto p-12 print:p-0 print:bg-white print:overflow-visible custom-scrollbar">
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
                                    className="bg-white shadow-2xl print:shadow-none w-full max-w-[210mm] page-break-after-always last:page-break-after-auto print:m-0 border border-slate-200 print:border-none"
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

                {/* FOOTER */}
                <DialogFooter className="p-8 border-t bg-white print:hidden flex-row justify-end items-center gap-4 shrink-0 shadow-2xl">
                    <Button variant="ghost" onClick={onClose} className="font-black text-slate-400 uppercase text-[11px] tracking-widest px-10 h-12 rounded-xl">
                        Discard Preview
                    </Button>
                    <div className="flex gap-4">
                        <Button 
                            onClick={() => handlePrint()} 
                            disabled={isPreparing}
                            className="bg-blue-600 hover:bg-slate-900 text-white font-black uppercase text-[11px] tracking-[0.2em] px-12 h-12 rounded-xl gap-2 shadow-xl transition-all active:scale-95 border-none"
                        >
                            {isPreparing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Printer className="h-4 w-4" />}
                            PRINT COPIES (x3)
                        </Button>
                    </div>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
