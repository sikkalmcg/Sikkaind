'use client';

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import type { RecycledItem, WithId } from '@/types';
import { format, isValid } from 'date-fns';
import { Timestamp } from 'firebase/firestore';

interface ViewRecycledItemModalProps {
  isOpen: boolean;
  onClose: () => void;
  item: WithId<RecycledItem>;
}

const parseDate = (date: any): Date | null => {
    if (!date) return null;
    try {
        if (date instanceof Timestamp) return date.toDate();
        if (date instanceof Date) return isValid(date) ? date : null;
        const d = new Date(date);
        return isValid(d) ? d : null;
    } catch (e) {
        return null;
    }
};

const formatSafe = (date: any, pattern: string): string => {
    const d = parseDate(date);
    if (!d) return 'N/A';
    return format(d, pattern);
};

const DetailRow = ({ label, value }: { label: string; value: React.ReactNode }) => (
    <div>
        <p className="font-medium text-muted-foreground text-xs uppercase">{label}</p>
        <div className="font-semibold text-sm">{value || 'N/A'}</div>
    </div>
);

export default function ViewRecycledItemModal({ isOpen, onClose, item }: ViewRecycledItemModalProps) {
    const { data } = item;

    const renderFuelPumpDetails = () => (
        <>
            <DetailRow label="Pump Name" value={data.name} />
            <DetailRow label="Owner Name" value={data.ownerName} />
            <DetailRow label="Mobile" value={data.mobile} />
            <DetailRow label="PAN" value={data.pan} />
            <DetailRow label="GSTIN" value={data.gstin} />
            <DetailRow label="Address" value={data.address} />
            <DetailRow label="Payment Method" value={data.paymentMethod} />
        </>
    );

    const renderFuelPaymentDetails = () => (
        <>
            <DetailRow label="Pump Name" value={data.pumpName} />
            <DetailRow label="Period From" value={formatSafe(data.fromDate, 'PP')} />
            <DetailRow label="Period To" value={formatSafe(data.toDate, 'PP')} />
            <DetailRow label="Total Amount" value={data.totalAmount?.toLocaleString('en-IN')} />
            <DetailRow label="Paid Amount" value={data.paidAmount?.toLocaleString('en-IN')} />
            <DetailRow label="Balance Amount" value={data.balanceAmount?.toLocaleString('en-IN')} />
            <DetailRow label="Payment Method" value={data.paymentMethod} />
            <DetailRow label="Banking Ref" value={data.bankingRef} />
            <DetailRow label="Payment Date" value={formatSafe(data.paymentDate, 'PPpp')} />
        </>
    );

    const renderFreightDetails = () => (
        <>
            <DetailRow label="Trip ID" value={data.tripId} />
            <DetailRow label="Vehicle No" value={data.vehicleNumber} />
            <DetailRow label="Transporter" value={data.transporterName} />
            <DetailRow label="Base Freight" value={data.baseFreightAmount?.toLocaleString('en-IN')} />
            <DetailRow label="Total Freight" value={data.totalFreightAmount?.toLocaleString('en-IN')} />
            <DetailRow label="Paid" value={data.paidAmount?.toLocaleString('en-IN')} />
            <DetailRow label="Balance" value={data.balanceAmount?.toLocaleString('en-IN')} />
            <DetailRow label="Payment Status" value={data.paymentStatus} />
        </>
    );

    const renderShipmentDetails = () => (
        <>
            <DetailRow label="Shipment ID" value={data.shipmentId} />
            <DetailRow label="Origin Plant" value={data.originPlantId} />
            <DetailRow label="Consignor" value={data.consignor} />
            <DetailRow label="Consignee" value={data.billToParty} />
            <DetailRow label="Ship To" value={data.shipToParty} />
            <DetailRow label="Unloading Point" value={data.unloadingPoint} />
            <DetailRow label="Quantity" value={`${data.quantity} ${data.materialTypeId}`} />
            <DetailRow label="Current Status" value={data.currentStatusId} />
            <DetailRow label="Created At" value={formatSafe(data.creationDate, 'PPpp')} />
        </>
    );

    const renderVehicleDetails = () => (
        <>
            <DetailRow label="Vehicle Number" value={data.vehicleNumber} />
            <DetailRow label="Driver Name" value={data.driverName} />
            <DetailRow label="Driver Mobile" value={data.driverMobile} />
            <DetailRow label="Vehicle Type" value={data.vehicleType} />
            <DetailRow label="Status" value={data.status} />
            {data.ownerName && <DetailRow label="Owner Name" value={data.ownerName} />}
            {data.transporterName && <DetailRow label="Transporter" value={data.transporterName} />}
        </>
    );

    const renderPartyDetails = () => (
        <>
            <DetailRow label="Party Name" value={data.name} />
            <DetailRow label="Party Type" value={data.type} />
            <DetailRow label="GSTIN" value={data.gstin} />
            <DetailRow label="PAN" value={data.pan} />
            <DetailRow label="Mobile" value={data.mobile} />
        </>
    );

    const renderVehicleEntryDetails = () => (
        <>
            <DetailRow label="Vehicle Number" value={data.vehicleNumber} />
            <DetailRow label="In Date/Time" value={formatSafe(data.entryTimestamp, 'PPpp')} />
            <DetailRow label="Purpose" value={data.purpose} />
            <DetailRow label="Driver Name" value={data.driverName} />
            <DetailRow label="Plant ID" value={data.plantId} />
        </>
    );

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-2xl">
                <DialogHeader>
                    <DialogTitle>Deleted Item Details</DialogTitle>
                    <DialogDescription>
                        Details for item deleted from the '{item.pageName}' page on {formatSafe(item.deletedAt, 'PPp')} by {item.userName}.
                    </DialogDescription>
                </DialogHeader>
                
                <div className="grid grid-cols-2 gap-x-4 gap-y-4 text-sm p-4 border rounded-md max-h-[60vh] overflow-y-auto bg-muted/10">
                   {data.type === 'FuelPump' && renderFuelPumpDetails()}
                   {data.type === 'FuelPayment' && renderFuelPaymentDetails()}
                   {(data.type === 'Trip' || data.type === 'Freight' || item.pageName.includes('Freight')) && renderFreightDetails()}
                   {data.type === 'Plant' && <DetailRow label="Plant Name" value={data.name} />}
                   {data.type === 'Carrier' && <DetailRow label="Carrier Name" value={data.name} />}
                   {data.type === 'Shipment' && renderShipmentDetails()}
                   {data.type === 'Vehicle' && renderVehicleDetails()}
                   {data.type === 'Party' && renderPartyDetails()}
                   {data.type === 'Status' && <DetailRow label="Status Name" value={data.name} />}
                   {data.type === 'QtyType' && <DetailRow label="Qty Type" value={data.name} />}
                   {data.type === 'VehicleEntry' && renderVehicleEntryDetails()}
                </div>

                <DialogFooter>
                    <Button onClick={onClose}>Close</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
