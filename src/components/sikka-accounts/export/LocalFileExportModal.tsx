'use client';
import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { useSikkaAccountsPage } from '@/context/SikkaAccountsPageContext';

interface LocalFileExportModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type ExportFormat = 'excel' | 'pdf' | 'html';

export default function LocalFileExportModal({ isOpen, onClose }: LocalFileExportModalProps) {
    const { exportAction } = useSikkaAccountsPage();
    const [format, setFormat] = useState<ExportFormat>('excel');

    const handleDownload = () => {
        if (exportAction) {
            exportAction(format);
        }
        onClose();
    };

    if (!exportAction) return null;

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-md">
                <DialogHeader>
                    <DialogTitle>Export Local File</DialogTitle>
                    <DialogDescription>Select the format for the file you want to download.</DialogDescription>
                </DialogHeader>
                <div className="py-4">
                    <RadioGroup defaultValue="excel" value={format} onValueChange={(value: ExportFormat) => setFormat(value)}>
                        <div className="flex items-center space-x-2">
                            <RadioGroupItem value="excel" id="excel" />
                            <Label htmlFor="excel">Spreadsheet (Excel)</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                            <RadioGroupItem value="pdf" id="pdf" />
                            <Label htmlFor="pdf">PDF</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                            <RadioGroupItem value="html" id="html" />
                            <Label htmlFor="html">HTML</Label>
                        </div>
                    </RadioGroup>
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={onClose}>Cancel</Button>
                    <Button onClick={handleDownload}>Download</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
