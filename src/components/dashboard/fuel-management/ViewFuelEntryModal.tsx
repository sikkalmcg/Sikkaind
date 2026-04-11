'use client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import type { FuelEntry, WithId } from '@/types';
import { format, isValid } from 'date-fns';
import Image from 'next/image';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

interface ViewFuelEntryModalProps {
  isOpen: boolean;
  onClose: () => void;
  entry: WithId<FuelEntry>;
}

export default function ViewFuelEntryModal({ isOpen, onClose, entry }: ViewFuelEntryModalProps) {
  
  const commonDetails = [
    { label: "Fuel Slip No.", value: entry.slipNo },
    { label: "Date", value: isValid(new Date(entry.date)) ? format(new Date(entry.date), 'PP') : 'N/A' },
    { label: "Fuel Type", value: entry.fuelType },
    { label: "Pump", value: entry.pumpName || entry.pumpId },
    { label: "Vehicle Type", value: entry.vehicleType },
  ];
  
  const ownVehicleDetails = [
    { label: "Vehicle Number", value: entry.vehicleNumber },
    { label: "Driver Name", value: entry.driverName },
    { label: "Previous Reading", value: entry.previousReading?.toLocaleString() },
    { label: "Current Reading", value: entry.currentReading?.toLocaleString() },
    { label: "Distance (KM)", value: entry.distance?.toLocaleString() },
    { label: "Vehicle Average", value: entry.average?.toFixed(2) },
  ];
  
  const contractMarketDetails = [
    { label: "Vehicle Number", value: entry.vehicleNumber },
    { label: "Driver Name", value: entry.driverName || 'N/A' },
    { label: "Owner Name", value: entry.ownerName },
    { label: "Trip Details", value: entry.tripDetails },
  ];

  const fuelDetails = [
      { label: "Fuel (Liters)", value: entry.fuelLiters },
      { label: "Fuel Rate", value: entry.fuelRate?.toLocaleString('en-IN', { style: 'currency', currency: 'INR' }) },
      { label: "Fuel Amount", value: entry.fuelAmount?.toLocaleString('en-IN', { style: 'currency', currency: 'INR' }) },
  ];

  const paymentSummary = [
    { label: "Paid Amount", value: entry.paidAmount?.toLocaleString('en-IN', { style: 'currency', currency: 'INR' })},
    { label: "Balance Amount", value: entry.balanceAmount?.toLocaleString('en-IN', { style: 'currency', currency: 'INR' })},
    { label: "Payment Status", value: entry.paymentStatus },
  ]

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Fuel Entry Details</DialogTitle>
          <DialogDescription>Viewing details for Fuel Slip #{entry.slipNo}</DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 max-h-[70vh] overflow-y-auto p-1">
            <div className="grid grid-cols-3 gap-4 text-sm p-4 border rounded-md">
              {commonDetails.map(d => (
                <div key={d.label}>
                  <p className="font-medium text-muted-foreground">{d.label}</p>
                  <p className="font-semibold">{d.value || 'N/A'}</p>
                </div>
              ))}
            </div>

            <Separator />
            
            {entry.vehicleType === 'Own Vehicle' && (
                <div className="grid grid-cols-3 gap-4 text-sm p-4 border rounded-md">
                    {ownVehicleDetails.map(d => (
                        <div key={d.label}>
                        <p className="font-medium text-muted-foreground">{d.label}</p>
                        <p className="font-semibold">{d.value || 'N/A'}</p>
                        </div>
                    ))}
                </div>
            )}

            {(entry.vehicleType === 'Contract Vehicle' || entry.vehicleType === 'Market Vehicle') && (
                 <div className="grid grid-cols-3 gap-4 text-sm p-4 border rounded-md">
                    {contractMarketDetails.map(d => (
                        <div key={d.label}>
                        <p className="font-medium text-muted-foreground">{d.label}</p>
                        <p className="font-semibold">{d.value || 'N/A'}</p>
                        </div>
                    ))}
                </div>
            )}

            <Separator />

             <div className="grid grid-cols-3 gap-4 text-sm p-4 border rounded-md">
                {fuelDetails.map(d => (
                    <div key={d.label}>
                    <p className="font-medium text-muted-foreground">{d.label}</p>
                    <p className="font-semibold">{String(d.value) || 'N/A'}</p>
                    </div>
                ))}
            </div>

            <Separator />

             <div className="grid grid-cols-3 gap-4 text-sm p-4 border rounded-md">
                {paymentSummary.map(d => (
                    <div key={d.label}>
                    <p className="font-medium text-muted-foreground">{d.label}</p>
                    <p className="font-semibold">{d.value || 'N/A'}</p>
                    </div>
                ))}
            </div>

             {entry.payments && entry.payments.length > 0 && (
              <div>
                <h3 className="text-md font-semibold mb-2">Payment History</h3>
                <div className="rounded-md border">
                  <Table>
                    <TableHeader><TableRow><TableHead>Amount</TableHead><TableHead>Method</TableHead><TableHead>Date</TableHead><TableHead>Ref</TableHead></TableRow></TableHeader>
                    <TableBody>
                        {entry.payments.map((p, i) => (
                            <TableRow key={i}>
                                <TableCell>{p.amount.toLocaleString('en-IN')}</TableCell>
                                <TableCell>{p.method}</TableCell>
                                <TableCell>{isValid(new Date(p.date)) ? format(new Date(p.date), 'PP') : 'N/A'}</TableCell>
                                <TableCell>{p.ref || 'N/A'}</TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}


            {entry.fuelSlipImageUrl && (
                <div>
                    <h3 className="text-md font-semibold mb-2">Fuel Slip Image</h3>
                    <div className="relative w-full h-[400px] rounded-md border overflow-hidden bg-muted">
                        <Image 
                            src={entry.fuelSlipImageUrl} 
                            alt="Fuel Slip" 
                            fill 
                            className="object-contain" 
                            unoptimized={true}
                        />
                    </div>
                </div>
            )}
        </div>


        <DialogFooter>
          <Button onClick={onClose}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
