'use client';

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import PrintableLR, { type EnrichedLR } from './PrintableLR';

interface LRPreviewModalProps {
    isOpen: boolean;
    onClose: () => void;
    lr: EnrichedLR;
}

export default function LRPreviewModal({ isOpen, onClose, lr }: LRPreviewModalProps) {
    const handlePrint = () => {
        const plantId = lr.originPlantId || lr.trip?.originPlantId || '';
        window.open(`/dashboard/lr-create/print/${lr.id}${plantId ? `?plantId=${plantId}` : ''}`, '_blank');
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-4xl">
                <DialogHeader>
                    <DialogTitle>LR Preview: {lr.lrNumber}</DialogTitle>
                    <DialogDescription>
                        Preview of the Lorry Receipt. You can print it from here.
                    </DialogDescription>
                </DialogHeader>
                <ScrollArea className="h-[70vh] border rounded-md">
                    <div className="scale-90 origin-top-left">
                        <PrintableLR lr={lr} />
                    </div>
                </ScrollArea>
                <DialogFooter>
                    <Button variant="outline" onClick={onClose}>Close</Button>
                    <Button onClick={handlePrint}>Print Full Page</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
