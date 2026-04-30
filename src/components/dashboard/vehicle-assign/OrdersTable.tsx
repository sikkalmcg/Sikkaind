
'use client';

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { doc, getDoc, getDocs, collection, query, where, writeBatch } from 'firebase/firestore';
import { db } from '@/firebase/client/config';
import { DataTable } from '@/components/dashboard/vehicle-assign/data-table';
import { getColumns } from '@/components/dashboard/vehicle-assign/columns';
import { useToast } from '@/components/ui/use-toast';
import { VehicleAssignContext } from '@/lib/hooks/use-vehicle-assign';
import { LRPrintContext } from '@/lib/hooks/use-print-lr';
import { useReactToPrint } from 'react-to-print';
import { EnrichedLR } from './PrintableLR';
import { LRPrintLayout } from './LRPrintLayout';

const CARRIERS = {
    'default': { id: 'default', name: 'Sikka Regget', gstin: '09AYQPS6936B1ZV', pan: 'AYQPS6936B' },
    '1426': { id: '1426', name: 'Sikka LMC', gstin: '09AYQPS6936B1ZV', pan: 'AYQPS6936B', address: 'B-11, Bulandshahr Road, Industrial Area, Ghaziabad, 201009', email: 'sil@sikkaenterprises.com', mobile: '9136688004', website: 'www.sikkaind.com'},
    '1214': { id: '1214', name: 'Sikka LMC', gstin: '09AYQPS6936B1ZV', pan: 'AYQPS6936B', address: 'B-11, Bulandshahr Road, Industrial Area, Ghaziabad, 201009', email: 'sil@sikkaenterprises.com', mobile: '9136688004', website: 'www.sikkaind.com' },
    'ID20': { id: 'ID20', name: 'Sikka LMC', gstin: '09AYQPS6936B1ZV', pan: 'AYQPS6936B', address: 'B-11, Bulandshahr Road, Industrial Area, Ghaziabad, 201009', email: 'sil@sikkaenterprises.com', mobile: '9136688004', website: 'www.sikkaind.com' },
    'ID23': { id: 'ID23', name: 'Sikka LMC', gstin: '09AYQPS6936B1ZV', pan: 'AYQPS6936B', address: 'B-11, Bulandshahr Road, Industrial Area, Ghaziabad, 201009', email: 'sil@sikkaenterprises.com', mobile: '9136688004', website: 'www.sikkaind.com' },
};

async function fetchPaginatedOrders(plantId, lastVisible) {
    // ... (rest of the function is unchanged)
}

export default function OrdersTable({ initialOrders, plantId, vehicles, drivers }) {
    const [orders, setOrders] = useState(initialOrders);
    const [selectedRows, setSelectedRows] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);
    const [printLRData, setPrintLRData] = useState<EnrichedLR | null>(null);

    const printLROrderRef = React.useRef<HTMLDivElement>(null);

    const { toast } = useToast();

    const handlePrint = useReactToPrint({
        content: () => printLROrderRef.current,
    });

    useEffect(() => {
        if (printLRData) {
            handlePrint();
        }
    }, [printLRData, handlePrint]);

    const getCarrier = (plantId) => {
        return CARRIERS[plantId] || CARRIERS['default'];
    };


    const onAssign = async ({ vehicle, driver, assignedQtyInTrip, isOwnVehicle, orderIds, anp }) => {
        const batch = writeBatch(db);
        const newTripRef = doc(collection(db, 'trips'));

        const associatedOrders = orderIds.map(orderId => orders.find(o => o.id === orderId)).filter(Boolean);
        if (associatedOrders.length !== orderIds.length) {
            throw new Error("Some selected orders were not found.");
        }

        const firstOrder = associatedOrders[0];
        const from = firstOrder.from;
        const to = firstOrder.to;
        const totalWeight = associatedOrders.reduce((acc, order) => acc + (parseFloat(order.quantity) || 0), 0);
        const totalUnits = associatedOrders.reduce((acc, order) => acc + (parseFloat(order.totalUnits) || 0), 0);

        const newTripData = {
            // ... (trip data fields)
            from,
            to,
            vehicleNumber: vehicle.id,
            driverName: driver.name,
            driverMobile: driver.mobile,
            totalWeight: totalWeight,
            totalUnits: totalUnits,
            assignedQtyInTrip,
            isOwnVehicle,
            // ... (other trip fields)
            carrier: getCarrier(plantId),
            plant: { id: plantId, name: firstOrder.plantName },
            shipment: firstOrder.shipment
        };

        batch.set(newTripRef, newTripData);

        orderIds.forEach(orderId => {
            const orderRef = doc(db, 'orders', orderId);
            batch.update(orderRef, { tripId: newTripRef.id, status: 'assigned' });
        });

        await batch.commit();

        const newOrders = orders.filter(order => !orderIds.includes(order.id));
        setOrders(newOrders);

        return newTripRef.id;
    };

    const printLR = (order) => {
        const carrier = getCarrier(plantId);
        const enrichedLR: EnrichedLR = {
            ...(order.lr || {}),
            lrNumber: order.lr?.lrNumber || 'N/A',
            date: order.lr?.date || new Date(),
            from: order.from,
            to: order.to,
            consignorName: order.consignorName,
            consignorAddress: order.consignorAddress,
            consignorGtin: order.consignorGtin,
            shipToParty: order.shipToParty,
            deliveryAddress: order.deliveryAddress,
            shipToGtin: order.shipToGtin,
            buyerName: order.buyerName,
            buyerAddress: order.buyerAddress,
            buyerGtin: order.buyerGtin,
            items: order.items,
            trip: null,
            carrier: carrier,
            shipment: order.shipment,
            plant: { id: plantId, name: order.plantName },
            totalWeight: order.quantity,
            totalUnits: order.totalUnits
        };
        setPrintLRData(enrichedLR);
    };

    const columns = useMemo(() => getColumns(), []);

    return (
        <VehicleAssignContext.Provider value={{ onAssign, vehicles, drivers, selectedRows, setSelectedRows }}>
            <LRPrintContext.Provider value={{ print: printLR }}>
                <div style={{ display: 'none' }}>
                    <LRPrintLayout ref={printLROrderRef} lr={printLRData} />
                </div>
                <DataTable columns={columns} data={orders} />
            </LRPrintContext.Provider>
        </VehicleAssignContext.Provider>
    );
}
