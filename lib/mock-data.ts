

import type { WithId, Plant, VehicleEntryExit, Trip, Shipment, Notification, Vehicle, VehicleType, Freight, Charge, Payment, ChargeType, PaymentMode, PaymentMethod, Carrier, LR, LRProduct, FuelPump, FuelEntry, FuelPayment, RecycledItem, ShipmentStatusMaster, SubUser, OwnVehicle, ContractVehicle, MarketVehicle, Customer, MasterDataItem, Invoice } from '@/types';

export let mockPlants: WithId<Plant>[] = [
    {
      id: 'plantA',
      name: 'Salt Plant',
      address: '123 Industrial Rd',
      city: 'Ghaziabad',
      state: 'Uttar Pradesh',
      postalCode: '201001',
      country: 'India',
    },
    {
      id: 'plantB',
      name: 'Tea Plant',
      address: '456 Logistics Ave',
      city: 'Kolkata',
      state: 'West Bengal',
      postalCode: '700001',
      country: 'India',
    },
    {
      id: 'plantC',
      name: 'Dasna Plant',
      address: '789 Supply Chain Blvd',
      city: 'Dasna',
      state: 'Uttar Pradesh',
      postalCode: '201015',
      country: 'India',
    },
];

export let mockVehicles: WithId<Vehicle>[] = [
  { id: 'veh1', vehicleNumber: 'UP14A1111', plantId: 'plantA', driverId: 'drv1', driverName: 'Amit Kumar', driverMobile: '9876543210', status: 'available', lastOdometerReading: 120500 },
  { id: 'veh2', vehicleNumber: 'UP14B2222', plantId: 'plantA', driverId: 'drv2', driverName: 'Rajesh Singh', driverMobile: '9876543211', status: 'available', lastOdometerReading: 85000 },
  { id: 'veh3', vehicleNumber: 'WB02C3333', plantId: 'plantB', driverId: 'drv3', driverName: 'Suman Das', driverMobile: '9876543212', status: 'available', lastOdometerReading: 210000 },
  { id: 'veh4', vehicleNumber: 'DL01AD4444', plantId: 'plantC', driverId: 'drv4', driverName: 'Priya Sharma', driverMobile: '9876543213', status: 'assigned', lastOdometerReading: 55000 },
];


export let mockShipments: WithId<Shipment>[] = [
    {
      id: 'ship1',
      shipmentId: 'S0000001',
      originPlantId: 'plantA',
      destination: 'Delhi',
      material: 'Salt',
      quantity: 25,
      assignedQty: 0,
      balanceQty: 25,
      materialTypeId: 'Metric Ton',
      weight: 25000,
      shipmentDate: new Date(new Date().setDate(new Date().getDate() - 1)),
      currentStatusId: 'pending',
      creationDate: new Date(new Date().setDate(new Date().getDate() - 2)),
      shipToParty: 'Delhi Distributor',
      shipToGstin: '07ABCDE1234F1Z5',
      unloadingPoint: 'Delhi Warehouse',
      loadingPoint: 'Salt Plant',
      consignor: 'Tata Salt',
      consignorGstin: '24ABCDE1234F1Z5',
      billToParty: 'Delhi Distributor',
      billToGstin: '07ABCDE1234F1Z5',
      invoiceNumber: 'INV001',
      ewaybillNumber: 'EWB001',
    },
    {
      id: 'ship2',
      shipmentId: 'S0000002',
      originPlantId: 'plantB',
      destination: 'Mumbai',
      material: 'Tea',
      quantity: 10,
      assignedQty: 10,
      balanceQty: 0,
      materialTypeId: 'Metric Ton',
      weight: 10000,
      shipmentDate: new Date(),
      currentStatusId: 'delivered',
      creationDate: new Date(new Date().setDate(new Date().getDate() - 1)),
      shipToParty: 'Mumbai Retailer',
      shipToGstin: '27FGHIJ5678K1Z9',
      unloadingPoint: 'Mumbai Hub',
      loadingPoint: 'Tea Plant',
      consignor: 'Tata Tea',
      consignorGstin: '19FGHIJ5678K1Z9',
      billToParty: 'Mumbai Retailer',
      billToGstin: '27FGHIJ5678K1Z9',
      invoiceNumber: 'INV002',
      ewaybillNumber: 'EWB002',
    },
     {
      id: 'ship3',
      shipmentId: 'S0000003',
      originPlantId: 'plantC',
      destination: 'Chennai',
      material: 'Chemicals',
      quantity: 15,
      assignedQty: 15,
      balanceQty: 0,
      materialTypeId: 'Metric Ton',
      weight: 15000,
      shipmentDate: new Date(),
      currentStatusId: 'arrival-for-delivery',
      creationDate: new Date(),
      shipToParty: 'Chennai Wholesaler',
      shipToGstin: '33LMNOP1234Q1Z3',
      unloadingPoint: 'Chennai Depot',
      loadingPoint: 'Dasna Plant',
      consignor: 'Tata Chemicals',
      consignorGstin: '24LMNOP1234Q1Z3',
      billToParty: 'Chennai Wholesaler',
      billToGstin: '33LMNOP1234Q1Z3',
      invoiceNumber: 'INV003',
      ewaybillNumber: 'EWB003',
    },
    {
      id: 'ship4',
      shipmentId: 'S0000004',
      originPlantId: 'plantA',
      destination: 'Pune',
      material: 'Salt',
      quantity: 30,
      assignedQty: 10,
      balanceQty: 20,
      materialTypeId: 'Metric Ton',
      weight: 30000,
      shipmentDate: new Date(),
      currentStatusId: 'in-transit',
      creationDate: new Date(),
      shipToParty: 'Pune Trader',
      shipToGstin: '27RSTUV5678W1Z1',
      unloadingPoint: 'Pune Market',
      loadingPoint: 'Ghaziabad',
      consignor: 'Sikka Salt',
      consignorGstin: '09RSTUV5678W1Z1',
      billToParty: 'Pune Trader',
      billToGstin: '27RSTUV5678W1Z1',
      invoiceNumber: 'INV004',
    }
];

export let mockTrips: WithId<Trip>[] = [
    {
        id: 'trip1',
        tripId: 'T0000001',
        vehicleId: 'veh4',
        driverId: 'drv4',
        driverName: 'Priya Sharma',
        shipmentIds: ['ship3'],
        originPlantId: 'plantC',
        destination: 'Chennai',
        startDate: new Date(new Date().setDate(new Date().getDate() - 2)), // Assigned
        outDate: new Date(new Date().setDate(new Date().getDate() - 1)), // Out
        arrivalDate: new Date(), // Arrived
        currentStatusId: 'arrival-for-delivery',
        lrGenerated: true,
        lrNumber: 'LR001',
        lrDate: new Date(new Date().setDate(new Date().getDate() - 2)),
        carrierId: 'carrier1',
        podReceived: false,
        userName: 'AJAY SOMRA',
        vehicleNumber: 'DL01AD4444',
        driverMobile: '9876543213',
        shipToParty: 'Chennai Wholesaler',
        unloadingPoint: 'Chennai Depot',
        vehicleType: 'Own Vehicle',
        assignedQtyInTrip: 15,
        distance: 2180,
        freightId: 'fr1',
    },
    {
        id: 'trip2',
        tripId: 'T0000002',
        vehicleId: 'veh1',
        driverId: 'drv1',
        driverName: 'Amit Kumar',
        shipmentIds: ['ship4'],
        originPlantId: 'plantA',
        destination: 'Pune',
        startDate: new Date(new Date().setDate(new Date().getDate() - 1)), // Assigned
        outDate: new Date(), // Out
        currentStatusId: 'in-transit',
        lrGenerated: false,
        podReceived: true,
        userName: 'Priya Sharma',
        vehicleNumber: 'UP14A1111',
        driverMobile: '9876543210',
        shipToParty: 'Pune Trader',
        unloadingPoint: 'Pune Market',
        vehicleType: 'Own Vehicle',
        assignedQtyInTrip: 10,
        distance: 1450,
        freightId: 'fr2',
    },
    {
        id: 'trip3',
        tripId: 'T0000003',
        vehicleId: 'veh2',
        driverId: 'drv2',
        driverName: 'Rajesh Singh',
        shipmentIds: ['ship2'],
        originPlantId: 'plantB',
        destination: 'Mumbai',
        startDate: new Date(new Date().setDate(new Date().getDate() - 4)),
        outDate: new Date(new Date().setDate(new Date().getDate() - 3)),
        arrivalDate: new Date(new Date().setDate(new Date().getDate() - 2)),
        actualCompletionDate: new Date(new Date().setDate(new Date().getDate() - 1)), // Delivered 1 day ago
        currentStatusId: 'delivered',
        lrGenerated: true,
        lrNumber: 'LR002',
        lrDate: new Date(new Date().setDate(new Date().getDate() - 4)),
        carrierId: 'carrier2',
        podReceived: true,
        userName: 'AJAY SOMRA',
        vehicleNumber: 'UP14B2222',
        driverMobile: '9876543211',
        shipToParty: 'Mumbai Retailer',
        unloadingPoint: 'Mumbai Hub',
        vehicleType: 'Contract Vehicle',
        assignedQtyInTrip: 10,
        distance: 1400,
        freightId: 'fr3',
    },
    {
        id: 'trip4-old',
        tripId: 'T0000004',
        vehicleId: 'veh1', // Same as trip2
        driverId: 'drv1',
        driverName: 'Amit Kumar',
        shipmentIds: ['ship1'], // Use another shipment
        originPlantId: 'plantA',
        destination: 'Delhi',
        startDate: new Date(new Date().setDate(new Date().getDate() - 7)),
        outDate: new Date(new Date().setDate(new Date().getDate() - 6)),
        arrivalDate: new Date(new Date().setDate(new Date().getDate() - 5)),
        actualCompletionDate: new Date(new Date().setDate(new Date().getDate() - 4)), // Delivered 4 days ago (>72 hours)
        currentStatusId: 'delivered',
        lrGenerated: true,
        lrNumber: 'LR003',
        lrDate: new Date(new Date().setDate(new Date().getDate() - 7)),
        carrierId: 'carrier1',
        podReceived: true,
        userName: 'Priya Sharma',
        vehicleNumber: 'UP14A1111', // Same as trip2
        driverMobile: '9876543210',
        shipToParty: 'Delhi Distributor',
        unloadingPoint: 'Delhi Warehouse',
        vehicleType: 'Own Vehicle',
        assignedQtyInTrip: 25,
        distance: 50,
        freightId: 'fr4',
    }
];

export let mockFreights: WithId<Freight>[] = [
    {
        id: 'fr1',
        tripId: 'trip1',
        baseFreightAmount: 30000,
        charges: [],
        payments: [{ id: 'p1', amount: 10000, mode: 'UPI', paymentDate: new Date(), referenceNo: 'UPI123' }],
        totalFreightAmount: 30000,
        paidAmount: 10000,
        balanceAmount: 20000,
        deductions: 0,
        paymentStatus: 'Partial',
    },
    {
        id: 'fr2',
        tripId: 'trip2',
        baseFreightAmount: 22000,
        charges: [],
        payments: [],
        totalFreightAmount: 22000,
        paidAmount: 0,
        balanceAmount: 22000,
        deductions: 0,
        paymentStatus: 'Pending',
    },
    {
        id: 'fr3',
        tripId: 'trip3',
        baseFreightAmount: 18000,
        charges: [],
        payments: [
            { id: 'p2', amount: 10000, mode: 'Banking', paymentDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), referenceNo: 'NEFT456' },
            { id: 'p3', amount: 8000, mode: 'Cash', paymentDate: new Date() }
        ],
        totalFreightAmount: 18000,
        paidAmount: 18000,
        balanceAmount: 0,
        deductions: 0,
        paymentStatus: 'Paid',
    },
    {
        id: 'fr4',
        tripId: 'trip4-old',
        baseFreightAmount: 5000,
        charges: [],
        payments: [{ id: 'p4', amount: 5000, mode: 'Cash', paymentDate: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000) }],
        totalFreightAmount: 5000,
        paidAmount: 5000,
        balanceAmount: 0,
        deductions: 0,
        paymentStatus: 'Paid',
    }
];


export let mockNotifications: WithId<Notification>[] = [
    {
        id: 'notif1',
        userId: 'user1',
        userName: 'AJAY SOMRA',
        actionType: 'Added',
        module: 'Vehicle Entry',
        message: 'Vehicle TN05EF5678 marked as IN.',
        entityId: '1',
        plantId: 'plantA',
        timestamp: new Date(Date.now() - 5 * 60 * 1000), // 5 minutes ago
        isRead: false,
        details: {
          vehicleNumber: 'TN05EF5678'
        }
    },
    {
        id: 'notif2',
        userId: 'user2',
        userName: 'Suresh Patel',
        actionType: 'Updated',
        module: 'Shipment Plan',
        message: 'Shipment #S0000001 updated.',
        entityId: 'ship1',
        plantId: 'plantB',
        timestamp: new Date(Date.now() - 15 * 60 * 1000), // 15 minutes ago
        isRead: false,
         details: {
            partyName: 'Delhi Distributor',
            unloadingPoint: 'Delhi Warehouse',
            qty: '25 Metric Ton'
        }
    },
    {
        id: 'notif3',
        userId: 'user1',
        userName: 'AJAY SOMRA',
        actionType: 'Cancelled',
        module: 'Trip',
        message: 'Trip TRIP002 has been cancelled.',
        entityId: 'trip2',
        plantId: 'plantB',
        timestamp: new Date(Date.now() - 60 * 60 * 1000), // 1 hour ago
        isRead: true,
        details: {
            vehicleNumber: 'KA01AB1234',
            partyName: 'Bangalore Corp',
            unloadingPoint: 'Bangalore Hub',
            qty: '12 Metric Ton'
        }
    }
];

export let mockCarriers: WithId<Carrier>[] = [
    {
        id: 'carrier1',
        logoUrl: '/placeholder.svg',
        name: 'SafeTrans Logistics',
        address: '1st Floor, Logistics Park, Mumbai, Maharashtra 400001',
        gstin: '27AABCU9567L1Z5',
        pan: 'AABCU9567L',
        stateName: 'Maharashtra',
        stateCode: '27',
        email: 'contact@safetrans.com',
        mobile: '9876543210',
        website: 'https://safetrans.com',
        terms: ['Goods are carried at owner\'s risk.', 'Payment to be made within 30 days of delivery.']
    },
    {
        id: 'carrier2',
        logoUrl: '/placeholder.svg',
        name: 'Express Connect',
        address: 'Plot 42, Transport Nagar, Delhi 110042',
        gstin: '07AABCD1234E1Z3',
        pan: 'AABCD1234E',
        stateName: 'Delhi',
        stateCode: '07',
        email: 'support@expressconnect.in',
        mobile: '9988776655',
        website: 'https://expressconnect.in',
        terms: ['POD must be provided for payment processing.']
    }
];

export let mockLrs: WithId<LR>[] = [];

let nextVehicleInId = 3;
export let mockVehicleInHistory: WithId<VehicleEntryExit>[] = [
    {
        id: '1',
        vehicleId: 'veh10',
        driverId: 'drv10',
        plantId: 'plantA',
        entryTimestamp: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
        status: 'IN',
        vehicleNumber: 'TN05EF5678',
        driverName: 'Ramesh Kumar',
        driverMobile: '7654321098',
        purpose: 'Loading',
    },
    {
        id: '2',
        vehicleId: 'veh11',
        driverId: 'drv11',
        plantId: 'plantB',
        entryTimestamp: new Date(Date.now() - 5 * 60 * 60 * 1000), // 5 hours ago
        status: 'IN',
        vehicleNumber: 'MH02GH9012',
        driverName: 'Suresh Patel',
        driverMobile: '6543210987',
        purpose: 'Unloading',
        documentNo: 'DOC987',
        billedQty: 20,
        qtyType: 'Metric Ton',
    }
];

export let mockVehicleOutHistory: WithId<VehicleEntryExit>[] = [
    {
        id: '3',
        vehicleId: 'veh20',
        driverId: 'drv20',
        plantId: 'plantA',
        entryTimestamp: new Date(Date.now() - 24 * 60 * 60 * 1000),
        exitTimestamp: new Date(Date.now() - 12 * 60 * 60 * 1000),
        status: 'OUT',
        vehicleNumber: 'TN07KL3456',
        driverName: 'Anil Singh',
        outType: 'Loaded',
        shipToParty: 'Delhi Distributor',
        unloadingPoint: 'Delhi Warehouse',
        assignedQty: '25 Ton',
    },
     {
        id: '4',
        vehicleId: 'veh21',
        driverId: 'drv21',
        plantId: 'plantB',
        entryTimestamp: new Date(Date.now() - 36 * 60 * 60 * 1000),
        exitTimestamp: new Date(Date.now() - 24 * 60 * 60 * 1000),
        status: 'OUT',
        vehicleNumber: 'MH04MN7890',
        driverName: 'Vijay Sharma',
        outType: 'Unloaded',
        billedQty: 15,
        unloadedQty: 14.8,
        shortage: 0.2,
        qtyType: 'Metric Ton',
    }
];

export let mockStatusUpdates: WithId<StatusUpdate>[] = [];

export let mockFuelPumps: WithId<FuelPump>[] = [
    { id: 'pump1', name: 'Indian Oil, Ghaziabad', ownerName: 'Ravi Kumar', mobile: '9876543210', pan: 'ABCDE1234F', address: 'Near Main Bus Stand, Ghaziabad', paymentMethod: 'Banking', receiverName: 'Ravi Kumar', bankName: 'SBI', accountNumber: '12345678901', ifsc: 'SBIN0001234' },
    { id: 'pump2', name: 'HP Petrol Pump, Dasna', ownerName: 'Sunita Singh', mobile: '9876543211', pan: 'FGHIJ5678K', address: 'NH-24, Dasna', paymentMethod: 'UPI Payment', receiverName: 'Sunita Singh', upiId: 'sunita@okhdfcbank' },
];

export let mockFuelEntries: WithId<FuelEntry>[] = [];
export let mockFuelPayments: WithId<FuelPayment>[] = [];
export let mockRecycledItems: WithId<RecycledItem>[] = [];

export let mockSubUsers: WithId<SubUser>[] = [
    { id: 'sub1', fullName: 'Ravi Kumar', jobRole: 'Gate Security', mobile: '8887776665', username: 'ravi_sec', status: 'Active', permissions: ['vehicle-entry'], loginAttempts: 0 },
    { id: 'sub2', fullName: 'Sunita Sharma', jobRole: 'Shipment Planner', mobile: '8887776664', username: 'sunita_plan', status: 'Inactive', permissions: ['shipment-plan', 'live-dashboard'], loginAttempts: 0 },
    { id: 'sub3', fullName: 'Anil Mehta', jobRole: 'Accountant', mobile: '8887776663', username: 'anil_acct', status: 'Blocked', permissions: ['freight-management', 'fuel-payment', 'report-analysis'], loginAttempts: 5 },
];


export const addMockNotification = (notification: Omit<Notification, 'id' | 'timestamp'>) => {
    const newNotification: WithId<Notification> = {
        ...notification,
        id: `notif-${Date.now()}`,
        timestamp: new Date(),
    };
    mockNotifications.unshift(newNotification);
    if (mockNotifications.length > 15) {
        mockNotifications.pop();
    }
    return newNotification;
}

export function addMockVehicleIn(
    entry: Omit<VehicleEntryExit, 'id' | 'status' | 'entryTimestamp' | 'vehicleId' | 'driverId'>,
    tripData?: WithId<Trip> | null
): WithId<VehicleEntryExit> {
    const newEntry: WithId<VehicleEntryExit> = {
        ...entry,
        id: `vin-${nextVehicleInId++}`,
        vehicleId: tripData?.vehicleId ?? `veh-${nextVehicleInId}`,
        driverId: tripData?.driverId ?? `drv-${nextVehicleInId}`,
        status: 'IN',
        entryTimestamp: new Date(),
        tripId: tripData?.id,
        lrNumber: tripData?.lrNumber,
        qty: tripData ? `${tripData.assignedQtyInTrip} ${mockShipments.find(s => s.id === tripData.shipmentIds[0])?.materialTypeId}` : (entry.billedQty ? `${entry.billedQty} ${entry.qtyType}` : undefined),
    };
    mockVehicleInHistory.unshift(newEntry);

    const details: Notification['details'] = {
        vehicleNumber: newEntry.vehicleNumber,
    };

    if (tripData) {
        details.partyName = tripData.shipToParty;
        details.unloadingPoint = tripData.unloadingPoint;
        const shipment = mockShipments.find(s => s.id === tripData.shipmentIds[0]);
        if (shipment) {
            details.qty = `${tripData.assignedQtyInTrip} ${shipment.materialTypeId}`;
        }
    } else if (newEntry.purpose === 'Unloading') {
        details.qty = newEntry.billedQty ? `${newEntry.billedQty} ${entry.qtyType}` : undefined;
    }
    
    addMockNotification({
        userId: 'currentUser', // placeholder
        userName: entry.driverName || 'System',
        actionType: 'Added',
        module: 'Vehicle Entry',
        message: `Vehicle ${newEntry.vehicleNumber} marked as IN.`,
        entityId: newEntry.id,
        plantId: newEntry.plantId,
        isRead: false,
        details: details,
    });
    
    // Also change trip status from 'Assigned' to 'in-transit'
    if (tripData) {
        const tripIndex = mockTrips.findIndex(t => t.id === tripData.id);
        if (tripIndex !== -1) {
            mockTrips[tripIndex].currentStatusId = 'in-transit';
            mockTrips[tripIndex].outDate = new Date();
            
            // Also update shipment status if it was fully assigned
            const shipment = mockShipments.find(s => s.id === mockTrips[tripIndex].shipmentIds[0]);
            if (shipment) {
                shipment.currentStatusId = 'in-transit';
            }
        }
    }

    return newEntry;
}


export const addMockVehicleOut = (vehicle: WithId<VehicleEntryExit>, outData: Partial<VehicleEntryExit>): WithId<VehicleEntryExit> => {
    const newOutEntry: WithId<VehicleEntryExit> = {
        ...vehicle,
        ...outData,
        status: 'OUT',
        exitTimestamp: new Date(),
    };

    mockVehicleOutHistory.unshift(newOutEntry);
    if (mockVehicleOutHistory.length > 15) {
        mockVehicleOutHistory.pop();
    }

    const details: Notification['details'] = {
        vehicleNumber: newOutEntry.vehicleNumber,
        partyName: newOutEntry.shipToParty,
        unloadingPoint: newOutEntry.unloadingPoint,
        qty: newOutEntry.unloadedQty ? `${newOutEntry.unloadedQty} ${newOutEntry.qtyType}` : newOutEntry.assignedQty,
    };

    addMockNotification({
        userId: 'currentUser',
        userName: vehicle.driverName,
        actionType: 'Updated',
        module: 'Vehicle Entry',
        message: `Vehicle ${newOutEntry.vehicleNumber} marked as OUT.`,
        entityId: newOutEntry.id,
        plantId: newOutEntry.plantId,
        isRead: false,
        details: details,
    });
    
    return newOutEntry;
}

let nextShipmentIdCounter = 5;
const pad = (num: number, size: number) => {
  let s = num + "";
  while (s.length < size) s = "0" + s;
  return s;
}

type NewShipmentData = Omit<Shipment, 'id' | 'shipmentId' | 'currentStatusId' | 'creationDate' | 'weight' | 'destination' | 'shipmentDate' | 'material' | 'assignedQty' | 'balanceQty'>;

export function addMockShipment(shipmentData: NewShipmentData): WithId<Shipment> {
    const newIdSuffix = nextShipmentIdCounter++;
    const newShipment: WithId<Shipment> = {
        ...shipmentData,
        id: `ship-${newIdSuffix}`,
        shipmentId: `S${pad(newIdSuffix, 7)}`,
        currentStatusId: 'pending',
        creationDate: new Date(),
        shipmentDate: new Date(),
        destination: shipmentData.unloadingPoint || 'N/A',
        material: 'Assorted Goods',
        weight: (shipmentData.quantity || 0) * 1000,
        assignedQty: 0,
        balanceQty: shipmentData.quantity,
    };
    mockShipments.unshift(newShipment);
    return newShipment;
}

export function deleteMockShipment(shipmentId: string): void {
    const shipmentIndex = mockShipments.findIndex(s => s.id === shipmentId);
    if (shipmentIndex === -1) return;

    const shipment = mockShipments[shipmentIndex];
    mockShipments.splice(shipmentIndex, 1);

    addMockNotification({
        userId: 'currentUser',
        userName: 'System', // Or current user's name
        actionType: 'Cancelled', // Using 'Cancelled' as a stand-in for 'Deleted'
        module: 'Shipment Plan',
        message: `Shipment ${shipment.shipmentId} was deleted.`,
        entityId: shipment.id,
        plantId: shipment.originPlantId,
        isRead: false,
        details: {
            partyName: shipment.shipToParty,
            unloadingPoint: shipment.unloadingPoint,
            qty: `${shipment.quantity} ${shipment.materialTypeId}`
        }
    });
}


let nextTripIdCounter = 5;
let nextFreightIdCounter = 5;
let nextVehicleIdCounter = 5;

export function addMockVehicle(
    vehicleData: { vehicleNumber: string; driverName: string; driverMobile: string },
    plantId: string
): WithId<Vehicle> {
    const newId = `veh${nextVehicleIdCounter++}`;
    const newVehicle: WithId<Vehicle> = {
        id: newId,
        driverId: `drv${newId}`,
        status: 'available',
        plantId: plantId,
        ...vehicleData,
    };
    mockVehicles.push(newVehicle);
    return newVehicle;
}

export function addMockTrip(
    shipment: WithId<Shipment>, 
    vehicle: WithId<Vehicle>,
    assignQty: number,
    vehicleType: VehicleType,
    tripDetails: Partial<Trip>
): WithId<Trip> {

    const newFreightId = `fr${nextFreightIdCounter++}`;
    const newFreight: WithId<Freight> = {
        id: newFreightId,
        tripId: '', // will be set below
        baseFreightAmount: tripDetails.freightAmount || 0,
        charges: [],
        payments: [],
        totalFreightAmount: tripDetails.freightAmount || 0,
        paidAmount: 0,
        balanceAmount: tripDetails.freightAmount || 0,
        deductions: 0,
        paymentStatus: 'Pending'
    };


    const newTrip: WithId<Trip> = {
        id: `trip-${Date.now()}`,
        tripId: `T${pad(nextTripIdCounter++, 7)}`,
        vehicleId: vehicle.id,
        driverId: vehicle.driverId,
        driverName: vehicle.driverName,
        shipmentIds: [shipment.id],
        originPlantId: shipment.originPlantId,
        destination: shipment.destination,
        startDate: new Date(),
        currentStatusId: 'Assigned',
        lrGenerated: false,
        podReceived: false,
        userName: 'AJAY SOMRA', // Mock current user
        vehicleNumber: vehicle.vehicleNumber,
        driverMobile: vehicle.driverMobile,
        shipToParty: shipment.shipToParty,
        unloadingPoint: shipment.unloadingPoint,
        vehicleType: vehicleType,
        assignedQtyInTrip: assignQty,
        distance: Math.floor(Math.random() * (2500 - 300 + 1) + 300),
        freightId: newFreightId,
        ...tripDetails,
    };
    
    newFreight.tripId = newTrip.id;
    mockFreights.push(newFreight);
    mockTrips.unshift(newTrip);

    // Update vehicle status
    const vehicleIndex = mockVehicles.findIndex(v => v.id === vehicle.id);
    if(vehicleIndex !== -1) {
        mockVehicles[vehicleIndex].status = 'assigned';
    }

    // Update shipment status
    const shipmentIndex = mockShipments.findIndex(s => s.id === shipment.id);
    if (shipmentIndex !== -1) {
        const oldShipment = mockShipments[shipmentIndex];
        oldShipment.assignedQty += assignQty;
        oldShipment.balanceQty = oldShipment.quantity - oldShipment.assignedQty;
        oldShipment.currentStatusId = oldShipment.balanceQty > 0 ? 'Partly Vehicle Assigned' : 'Assigned';
        oldShipment.lastUpdateDate = new Date();
    }

    addMockNotification({
        userId: 'currentUser',
        userName: 'System',
        actionType: 'Added',
        module: 'Vehicle Assignment',
        message: `Trip ${newTrip.tripId} created for Shipment ${shipment.shipmentId}.`,
        entityId: newTrip.id,
        plantId: newTrip.originPlantId,
        isRead: false,
        details: {
            vehicleNumber: newTrip.vehicleNumber,
            partyName: newTrip.shipToParty,
            unloadingPoint: newTrip.unloadingPoint,
            qty: `${newTrip.assignedQtyInTrip} ${shipment.materialTypeId}`
        }
    });


    return newTrip;
}


export function unassignMockTrip(trip: WithId<Trip>) {
    const shipment = mockShipments.find(s => s.id === trip.shipmentIds[0]);
    const vehicleIdToUpdate = trip.vehicleId;

    // Find and update the associated shipment
    trip.shipmentIds.forEach(shipmentId => {
        const shipmentIndex = mockShipments.findIndex(s => s.id === shipmentId);
        if (shipmentIndex !== -1) {
            const shipment = mockShipments[shipmentIndex];
            shipment.assignedQty -= trip.assignedQtyInTrip;
            shipment.balanceQty = shipment.quantity - shipment.assignedQty;

            if (shipment.assignedQty === 0) {
                shipment.currentStatusId = 'pending';
            } else {
                shipment.currentStatusId = 'Partly Vehicle Assigned';
            }
        }
    });

    // Remove the trip and its associated freight
    mockTrips = mockTrips.filter(t => t.id !== trip.id);
    if (trip.freightId) {
        mockFreights = mockFreights.filter(f => f.id !== trip.freightId);
    }


    // Check if the vehicle is still assigned to any other trips
    const isVehicleStillAssigned = mockTrips.some(t => t.vehicleId === vehicleIdToUpdate);

    // Only set vehicle status to 'available' if it's not on any other trip
    if (!isVehicleStillAssigned) {
        const vehicleIndex = mockVehicles.findIndex(v => v.id === vehicleIdToUpdate);
        if (vehicleIndex !== -1) {
            mockVehicles[vehicleIndex].status = 'available';
        }
    }
    
    addMockNotification({
        userId: 'currentUser',
        userName: 'System',
        actionType: 'Cancelled',
        module: 'Vehicle Assignment',
        message: `Trip ${trip.tripId} was unassigned.`,
        entityId: trip.id,
        plantId: trip.originPlantId,
        isRead: false,
        details: {
            vehicleNumber: trip.vehicleNumber,
            partyName: trip.shipToParty,
            unloadingPoint: trip.unloadingPoint,
            qty: `${trip.assignedQtyInTrip} ${shipment?.materialTypeId}`
        }
    });
}

export function updateMockTrip(
    tripToUpdate: WithId<Trip>,
    shipment: WithId<Shipment>,
    newVehicle: WithId<Vehicle>,
    newAssignQty: number,
    newVehicleType: VehicleType,
    newTripDetails: Partial<Trip>
) {
    const tripIndex = mockTrips.findIndex(t => t.id === tripToUpdate.id);
    if (tripIndex === -1) return;

    // 1. Revert quantities on the shipment
    const shipmentIndex = mockShipments.findIndex(s => s.id === shipment.id);
    if (shipmentIndex !== -1) {
        mockShipments[shipmentIndex].assignedQty -= tripToUpdate.assignedQtyInTrip;
        mockShipments[shipmentIndex].balanceQty += tripToUpdate.assignedQtyInTrip;
    }
    
    // 2. Make the old vehicle available again if it's different from the new one and not used elsewhere
    if (tripToUpdate.vehicleId !== newVehicle.id) {
        const isOldVehicleStillAssigned = mockTrips.some(t => t.id !== tripToUpdate.id && t.vehicleId === tripToUpdate.vehicleId);
        if (!isOldVehicleStillAssigned) {
             const oldVehicleIndex = mockVehicles.findIndex(v => v.id === tripToUpdate.vehicleId);
            if (oldVehicleIndex !== -1) {
                mockVehicles[oldVehicleIndex].status = 'available';
            }
        }
    }
    
    // 3. Update the trip object
    const updatedTrip: WithId<Trip> = {
        ...tripToUpdate,
        vehicleId: newVehicle.id,
        driverId: newVehicle.driverId,
        driverName: newVehicle.driverName,
        vehicleNumber: newVehicle.vehicleNumber,
        driverMobile: newVehicle.driverMobile,
        vehicleType: newVehicleType,
        assignedQtyInTrip: newAssignQty,
        ...newTripDetails,
        lastUpdated: new Date(),
    };
    mockTrips[tripIndex] = updatedTrip;

    // Update associated freight amount if it exists
    if (updatedTrip.freightId && newTripDetails.freightAmount !== undefined) {
        const freightIndex = mockFreights.findIndex(f => f.id === updatedTrip.freightId);
        if (freightIndex !== -1) {
            mockFreights[freightIndex].baseFreightAmount = newTripDetails.freightAmount;
            recalculateFreight(mockFreights[freightIndex]);
        }
    }


    // 4. Update the vehicle status for the new vehicle
    const newVehicleIndex = mockVehicles.findIndex(v => v.id === newVehicle.id);
    if (newVehicleIndex !== -1) {
        mockVehicles[newVehicleIndex].status = 'assigned';
    }
    
    // 5. Re-apply new quantities to the shipment
    if (shipmentIndex !== -1) {
        mockShipments[shipmentIndex].assignedQty += newAssignQty;
        mockShipments[shipmentIndex].balanceQty = mockShipments[shipmentIndex].quantity - mockShipments[shipmentIndex].assignedQty;
        
        if (mockShipments[shipmentIndex].balanceQty > 0) {
            mockShipments[shipmentIndex].currentStatusId = 'Partly Vehicle Assigned';
        } else {
            mockShipments[shipmentIndex].currentStatusId = 'Assigned';
        }
        mockShipments[shipmentIndex].lastUpdateDate = new Date();
    }
    
    addMockNotification({
        userId: 'currentUser',
        userName: 'System',
        actionType: 'Updated',
        module: 'Vehicle Assignment',
        message: `Trip ${updatedTrip.tripId} for Shipment ${shipment.shipmentId} was updated.`,
        entityId: updatedTrip.id,
        plantId: updatedTrip.originPlantId,
        isRead: false,
        details: {
            vehicleNumber: updatedTrip.vehicleNumber,
            partyName: updatedTrip.shipToParty,
            unloadingPoint: updatedTrip.unloadingPoint,
            qty: `${updatedTrip.assignedQtyInTrip} ${shipment.materialTypeId}`
        }
    });
    
    return updatedTrip;
}

export function updateMockTripStatus(tripId: string, newStatus: string, location?: string, remarks?: string) {
  const tripIndex = mockTrips.findIndex(t => t.id === tripId);
  if (tripIndex === -1) return;
  
  const trip = mockTrips[tripIndex];
  const previousStatus = trip.currentStatusId;
  const previousStatusTimestamp = trip.lastUpdated;

  // Add to history
  mockStatusUpdates.unshift({
      id: `su-${Date.now()}`,
      tripId: trip.tripId,
      vehicleNumber: trip.vehicleNumber!,
      timestamp: new Date(),
      previousStatus: previousStatus,
      previousStatusTimestamp: previousStatusTimestamp,
      newStatus: newStatus,
      updatedBy: 'System',
      location,
      remarks,
  });

  // Update trip itself
  trip.currentStatusId = newStatus;
  trip.lastUpdated = new Date();

  // If status is arrival, set the date
  if (newStatus === 'arrival-for-delivery') {
      trip.arrivalDate = new Date();
  }
}

export function completeMockTrip(tripId: string, unloadQty: number) {
    const tripIndex = mockTrips.findIndex(t => t.id === tripId);
    if (tripIndex === -1) return;

    const trip = mockTrips[tripIndex];
    const previousStatus = trip.currentStatusId;
    const previousStatusTimestamp = trip.lastUpdated;

    // Add to history
    mockStatusUpdates.unshift({
        id: `su-${Date.now()}`,
        tripId: trip.tripId,
        vehicleNumber: trip.vehicleNumber!,
        timestamp: new Date(),
        previousStatus: previousStatus,
        previousStatusTimestamp: previousStatusTimestamp,
        newStatus: 'delivered',
        updatedBy: 'System',
    });

    // Update trip with delivered details
    trip.currentStatusId = 'delivered';
    trip.actualCompletionDate = new Date();
    trip.lastUpdated = new Date();
    trip.unloadQty = unloadQty;
    trip.podUrl = '/mock/pod.pdf'; // Mock file path
    trip.podReceived = true;

    // Update associated shipment status
    trip.shipmentIds.forEach(shipmentId => {
        const shipmentIndex = mockShipments.findIndex(s => s.id === shipmentId);
        if (shipmentIndex !== -1) {
            // This is a simplification. A real app would check if all parts of the shipment are delivered.
            mockShipments[shipmentIndex].currentStatusId = 'delivered';
        }
    });

    // Make vehicle available again
    const isVehicleStillAssigned = mockTrips.some(t => t.id !== trip.id && t.vehicleId === trip.vehicleId);
     if (!isVehicleStillAssigned) {
        const vehicleIndex = mockVehicles.findIndex(v => v.id === trip.vehicleId);
        if (vehicleIndex !== -1) {
            mockVehicles[vehicleIndex].status = 'available';
        }
    }
}

// Freight Management Mock Data Functions

function recalculateFreight(freight: Freight) {
    freight.totalFreightAmount = freight.baseFreightAmount + freight.charges.reduce((sum, charge) => sum + charge.amount, 0);
    freight.paidAmount = freight.payments.reduce((sum, payment) => sum + payment.amount, 0);
    freight.balanceAmount = freight.totalFreightAmount - freight.paidAmount;

    if (freight.balanceAmount <= 0) {
        freight.paymentStatus = 'Paid';
    } else if (freight.paidAmount > 0) {
        freight.paymentStatus = 'Partial';
    } else {
        freight.paymentStatus = 'Pending';
    }
}

export function addChargeToFreight(freightId: string, amount: number, type: ChargeType, remark?: string) {
    const freightIndex = mockFreights.findIndex(f => f.id === freightId);
    if (freightIndex === -1) return;

    const newCharge: WithId<Charge> = {
        id: `chg-${Date.now()}`,
        amount,
        type,
        remark,
        createdAt: new Date(),
    };
    mockFreights[freightIndex].charges.push(newCharge);
    recalculateFreight(mockFreights[freightIndex]);
}

export function makeFreightPayment(freightId: string, amount: number, mode: PaymentMode, referenceNo?: string) {
    const freightIndex = mockFreights.findIndex(f => f.id === freightId);
    if (freightIndex === -1) throw new Error('Freight record not found.');
    
    const freight = mockFreights[freightIndex];
    const trip = mockTrips.find(t => t.id === freight.tripId);
    if (!trip) throw new Error('Associated trip not found.');

    if (amount > freight.balanceAmount) {
        throw new Error('Payment cannot exceed the balance amount.');
    }

    const MIN_BALANCE = 500;
    if (!trip.podReceived && (freight.balanceAmount - amount) < MIN_BALANCE) {
        if (freight.balanceAmount - amount > 0) {
             throw new Error(`A minimum balance of ${MIN_BALANCE} is required until POD is received.`);
        } else if (amount === freight.balanceAmount) {
             throw new Error(`Required POD for make full payment. A minimum balance of ${MIN_BALANCE} is required.`);
        }
    }

    const newPayment: WithId<Payment> = {
        id: `pay-${Date.now()}`,
        amount,
        mode,
        referenceNo,
        paymentDate: new Date(),
    };
    mockFreights[freightIndex].payments.push(newPayment);
    recalculateFreight(mockFreights[freightIndex]);
}


export function updateTripPaymentDetailsAndCharges(
    tripId: string, 
    details: {
        receiverName?: string;
        accountNumber?: string;
        ifsc?: string;
        bankName?: string;
        upiId?: string;
        paymentMethod?: PaymentMethod;
        qrCodeUrl?: string;
        chargeAmount?: number;
        chargeType?: ChargeType;
        chargeRemark?: string;
    }
) {
    const tripIndex = mockTrips.findIndex(t => t.id === tripId);
    if (tripIndex === -1) return;

    const trip = mockTrips[tripIndex];

    // Update trip details
    trip.freightReceiverName = details.receiverName ?? trip.freightReceiverName;
    trip.paymentMethod = details.paymentMethod ?? trip.paymentMethod;
    trip.bankName = details.bankName ?? trip.bankName;
    trip.accountNumber = details.accountNumber ?? trip.accountNumber;
    trip.ifsc = details.ifsc ?? trip.ifsc;
    trip.upiId = details.upiId ?? trip.upiId;
    trip.qrCodeUrl = details.qrCodeUrl ?? trip.qrCodeUrl;
    
    // Add charge to associated freight
    if (trip.freightId && details.chargeAmount && details.chargeType) {
        addChargeToFreight(trip.freightId, details.chargeAmount, details.chargeType, details.chargeRemark);
    }

    addMockNotification({
        userId: 'currentUser',
        userName: 'System', // This should be the current user's name
        actionType: 'Updated',
        module: 'Vehicle Assignment',
        message: `Payment details for Trip ${trip.tripId} were updated.`,
        entityId: trip.id,
        plantId: trip.originPlantId,
        isRead: false,
    });
}

export function addMockCarrier(carrierData: Omit<Carrier, 'id'>) {
    const newCarrier: WithId<Carrier> = {
        ...carrierData,
        id: `carrier-${Date.now()}`
    };
    mockCarriers.unshift(newCarrier);
    return newCarrier;
}

export function deleteMockCarrier(carrierId: string) {
    mockCarriers = mockCarriers.filter(c => c.id !== carrierId);
}

export function updateMockCarrier(carrierId: string, data: Partial<Carrier>) {
    const carrierIndex = mockCarriers.findIndex(c => c.id === carrierId);
    if (carrierIndex !== -1) {
        mockCarriers[carrierIndex] = { ...mockCarriers[carrierIndex], ...data };
    }
}

export function addMockLr(lrData: Omit<LR, 'id'>): WithId<LR> {
    const newLr: WithId<LR> = {
        ...lrData,
        id: `lr-${Date.now()}`
    };
    mockLrs.unshift(newLr);
    return newLr;
}

export function addMockFuelPump(data: Omit<FuelPump, 'id'>): WithId<FuelPump> {
    const newPump: WithId<FuelPump> = {
        ...data,
        id: `pump-${Date.now()}`,
    };
    mockFuelPumps.unshift(newPump);
    return newPump;
}

export function deleteMockFuelPump(pumpId: string) {
    const index = mockFuelPumps.findIndex(p => p.id === pumpId);
    if (index === -1) return;
    
    const [deletedPump] = mockFuelPumps.splice(index, 1);
    
    mockRecycledItems.unshift({
        id: `recycle-${Date.now()}`,
        pageName: 'Fuel Pump',
        userName: 'System Admin',
        deletedAt: new Date(),
        data: { ...deletedPump, type: 'FuelPump' }
    });
}

export function addMockFuelEntry(data: Omit<FuelEntry, 'id' | 'paidAmount' | 'balanceAmount' | 'paymentStatus' | 'payments'>) {
    const newEntry: WithId<FuelEntry> = { 
        ...data, 
        userName: 'AJAY SOMRA', // mock user
        id: `fuel-${Date.now()}`,
        paidAmount: 0,
        balanceAmount: data.fuelAmount,
        paymentStatus: 'Unpaid',
        payments: [],
    };

    if (data.vehicleType === 'Own Vehicle' && data.vehicleId && data.currentReading) {
        const vehicleIndex = mockVehicles.findIndex(v => v.id === data.vehicleId);
        if (vehicleIndex !== -1) {
            mockVehicles[vehicleIndex].lastOdometerReading = data.currentReading;
        }
    }
    mockFuelEntries.unshift(newEntry);
    return newEntry;
}

function applyPaymentToSlips(payment: WithId<FuelPayment>) {
    let remainingPayment = payment.paidAmount;

    const to = new Date(payment.toDate);
    to.setHours(23, 59, 59, 999);

    const relevantSlips = mockFuelEntries
        .filter(slip => 
            slip.pumpId === payment.pumpId &&
            new Date(slip.date) >= payment.fromDate &&
            new Date(slip.date) <= to &&
            slip.balanceAmount > 0
        )
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    for (const slip of relevantSlips) {
        if (remainingPayment <= 0) break;

        const amountToApply = Math.min(slip.balanceAmount, remainingPayment);
        
        slip.paidAmount += amountToApply;
        slip.balanceAmount -= amountToApply;
        slip.paymentStatus = slip.balanceAmount === 0 ? 'Paid' : 'Partial';
        slip.payments.push({
            paymentId: payment.id,
            amount: amountToApply,
            date: payment.paymentDate,
            method: payment.paymentMethod,
            ref: payment.bankingRef,
        });

        remainingPayment -= amountToApply;
    }
}

export function addMockFuelPayment(data: Omit<FuelPayment, 'id'>) {
    const newPayment: WithId<FuelPayment> = {
        ...data,
        id: `fuelpay-${Date.now()}`
    };
    mockFuelPayments.unshift(newPayment);

    // Apply the payment to the relevant fuel slips
    applyPaymentToSlips(newPayment);

    return newPayment;
}


export function deleteMockFuelPayment(paymentId: string) {
    const index = mockFuelPayments.findIndex(p => p.id === paymentId);
    if (index === -1) return;

    const [deletedPayment] = mockFuelPayments.splice(index, 1);
    const pump = mockFuelPumps.find(p => p.id === deletedPayment.pumpId);

    // TODO: Revert payment application from fuel slips
    // This is complex and might be out of scope for mock data.
    // For now, we just move the payment to recycle bin.

    mockRecycledItems.unshift({
        id: `recycle-${Date.now()}`,
        pageName: 'Fuel Payment',
        userName: 'System Admin',
        deletedAt: new Date(),
        data: { ...deletedPayment, type: 'FuelPayment', pumpName: pump?.name }
    });
}

export function restoreMockItem(itemId: string) {
    const index = mockRecycledItems.findIndex(i => i.id === itemId);
    if (index === -1) return;

    const [item] = mockRecycledItems.splice(index, 1);

    if (item.data.type === 'FuelPump') {
        const { type, ...pumpData } = item.data;
        mockFuelPumps.unshift(pumpData);
    } else if (item.data.type === 'FuelPayment') {
        const { type, pumpName, ...paymentData } = item.data;
        mockFuelPayments.unshift(paymentData);
        // TODO: Re-apply the restored payment to slips.
        // Complex logic, may skip for mock.
    }
}

export function permanentlyDeleteMockItem(itemId: string) {
    // If the deleted item is a payment, we should ideally permanently revert the amounts on the slips.
    // This is complex for mock data.
    mockRecycledItems = mockRecycledItems.filter(i => i.id !== itemId);
}

// New functions for plant management
export function addMockPlant(name: string): WithId<Plant> {
    const newPlant: WithId<Plant> = {
        id: `plant-${Date.now()}`,
        name: name,
        address: 'N/A',
        city: 'N/A',
        state: 'N/A',
        postalCode: 'N/A',
        country: 'India',
    };
    mockPlants.unshift(newPlant);
    return newPlant;
}

export function deleteMockPlant(plantId: string) {
    mockPlants = mockPlants.filter(p => p.id !== plantId);
}

// New data and functions for status management
export let mockStatusMasters: WithId<ShipmentStatusMaster>[] = [
    { id: 'status1', name: 'In-Transit Shipment', description: '' },
    { id: 'status2', name: 'Arrival for Delivery', description: '' },
    { id: 'status3', name: 'Delivered', description: '' },
    { id: 'status4', name: 'Break-down', description: '' },
    { id: 'status5', name: 'Under Maintenance', description: '' },
    { id: 'status6', name: 'Pilot Not Available', description: '' },
];

export function addMockStatus(name: string): WithId<ShipmentStatusMaster> {
    const newStatus: WithId<ShipmentStatusMaster> = {
        id: `status-${Date.now()}`,
        name: name,
        description: `Custom status: ${name}`
    };
    mockStatusMasters.unshift(newStatus);
    return newStatus;
}

export function deleteMockStatus(statusId: string) {
    mockStatusMasters = mockStatusMasters.filter(s => s.id !== statusId);
}

// New functions for sub-user management
export function addMockSubUser(data: Omit<SubUser, 'id'>) {
    const newUser: WithId<SubUser> = {
        ...data,
        id: `subuser-${Date.now()}`
    };
    mockSubUsers.unshift(newUser);
    return newUser;
}

export function updateMockSubUser(userId: string, data: Partial<SubUser>) {
    const userIndex = mockSubUsers.findIndex(u => u.id === userId);
    if (userIndex !== -1) {
        mockSubUsers[userIndex] = { ...mockSubUsers[userIndex], ...data };
    }
}

export function deleteMockSubUser(userId: string) {
    mockSubUsers = mockSubUsers.filter(u => u.id !== userId);
}


// VEHICLE MANAGEMENT MOCK DATA

export let mockOwnVehicles: WithId<OwnVehicle>[] = [
    {
        id: 'own-1',
        vehicleNumber: 'UP14A1111',
        driverName: 'Amit Kumar',
        driverMobile: '9876543210',
        licenseNumber: 'DL1234567890123',
        pollutionCertValidity: new Date(new Date().setMonth(new Date().getMonth() + 6)),
        fitnessCertValidity: new Date(new Date().setFullYear(new Date().getFullYear() + 1)),
        permitCertValidity: new Date(new Date().setFullYear(new Date().getFullYear() + 5)),
    },
    {
        id: 'own-2',
        vehicleNumber: 'UP14B2222',
        driverName: 'Rajesh Singh',
        driverMobile: '9876543211',
        licenseNumber: 'DL1234567890124',
        pollutionCertValidity: new Date(new Date().setDate(new Date().getDate() + 10)),
    }
];

export let mockContractVehicles: WithId<ContractVehicle>[] = [
    {
        id: 'contract-1',
        vehicleNumber: 'WB02C3333',
        driverName: 'Suman Das',
        driverMobile: '9876543212',
        licenseNumber: 'WB1234567890125',
        ownerName: 'Das Transport',
        ownerMobile: '8887776665',
        pan: 'GHIJK9876L',
        contractFrom: new Date(new Date().setFullYear(new Date().getFullYear() - 1)),
        validUpto: new Date(new Date().setFullYear(new Date().getFullYear() + 1)),
    }
];

export let mockMarketVehicles: WithId<MarketVehicle>[] = [
     {
        id: 'market-1',
        vehicleNumber: 'DL01AD4444',
        driverName: 'Priya Sharma',
        driverMobile: '9876543213',
        licenseNumber: 'DL1234567890126',
        transporterName: 'Delhi Express Cargo',
        transporterMobile: '7776665554',
        pan: 'MNOQP1234Z',
    }
];

export function addMockOwnVehicle(data: Omit<OwnVehicle, 'id'>): WithId<OwnVehicle> {
    if (mockOwnVehicles.some(v => v.vehicleNumber === data.vehicleNumber)) {
        throw new Error('Vehicle number must be unique.');
    }
    const newVehicle: WithId<OwnVehicle> = { ...data, id: `own-${Date.now()}` };
    mockOwnVehicles.unshift(newVehicle);
    return newVehicle;
}

export function deleteMockOwnVehicle(id: string) {
    mockOwnVehicles = mockOwnVehicles.filter(v => v.id !== id);
}

export function addMockContractVehicle(data: Omit<ContractVehicle, 'id'>): WithId<ContractVehicle> {
    if (mockContractVehicles.some(v => v.vehicleNumber === data.vehicleNumber)) {
        throw new Error('Vehicle number must be unique.');
    }
    const newVehicle: WithId<ContractVehicle> = { ...data, id: `contract-${Date.now()}` };
    mockContractVehicles.unshift(newVehicle);
    return newVehicle;
}

export function deleteMockContractVehicle(id: string) {
    mockContractVehicles = mockContractVehicles.filter(v => v.id !== id);
}

export function addMockMarketVehicle(data: Omit<MarketVehicle, 'id'>): WithId<MarketVehicle> {
    if (mockMarketVehicles.some(v => v.vehicleNumber === data.vehicleNumber)) {
        throw new Error('Vehicle number must be unique.');
    }
    const newVehicle: WithId<MarketVehicle> = { ...data, id: `market-${Date.now()}` };
    mockMarketVehicles.unshift(newVehicle);
    return newVehicle;
}

export function deleteMockMarketVehicle(id: string) {
    mockMarketVehicles = mockMarketVehicles.filter(v => v.id !== id);
}

export function updateMockOwnVehicle(id: string, data: Partial<Omit<OwnVehicle, 'id'>>): WithId<OwnVehicle> {
    const vehicleIndex = mockOwnVehicles.findIndex(v => v.id === id);
    if (vehicleIndex === -1) {
        throw new Error('Vehicle not found.');
    }
    const existingVehicle = mockOwnVehicles[vehicleIndex];
    if (data.vehicleNumber && data.vehicleNumber !== existingVehicle.vehicleNumber && mockOwnVehicles.some(v => v.vehicleNumber === data.vehicleNumber)) {
        throw new Error('Vehicle number must be unique.');
    }
    const updatedVehicle = { ...existingVehicle, ...data };
    mockOwnVehicles[vehicleIndex] = updatedVehicle;
    return updatedVehicle;
}

export function updateMockContractVehicle(id: string, data: Partial<Omit<ContractVehicle, 'id'>>): WithId<ContractVehicle> {
    const vehicleIndex = mockContractVehicles.findIndex(v => v.id === id);
    if (vehicleIndex === -1) {
        throw new Error('Vehicle not found.');
    }
    const existingVehicle = mockContractVehicles[vehicleIndex];
    if (data.vehicleNumber && data.vehicleNumber !== existingVehicle.vehicleNumber && mockContractVehicles.some(v => v.vehicleNumber === data.vehicleNumber)) {
        throw new Error('Vehicle number must be unique.');
    }
    const updatedVehicle = { ...existingVehicle, ...data };
    mockContractVehicles[vehicleIndex] = updatedVehicle;
    return updatedVehicle;
}

export function updateMockMarketVehicle(id: string, data: Partial<Omit<MarketVehicle, 'id'>>): WithId<MarketVehicle> {
    const vehicleIndex = mockMarketVehicles.findIndex(v => v.id === id);
    if (vehicleIndex === -1) {
        throw new Error('Vehicle not found.');
    }
    const existingVehicle = mockMarketVehicles[vehicleIndex];
    if (data.vehicleNumber && data.vehicleNumber !== existingVehicle.vehicleNumber && mockMarketVehicles.some(v => v.vehicleNumber === data.vehicleNumber)) {
        throw new Error('Vehicle number must be unique.');
    }
    const updatedVehicle = { ...existingVehicle, ...data };
    mockMarketVehicles[vehicleIndex] = updatedVehicle;
    return updatedVehicle;
}

// Sikka Accounts Favorites
export let mockUserFavorites: {tcode: string, text: string}[] = [
    { tcode: 'VF01', text: 'Create Invoice' },
    { tcode: 'ZINV', text: 'Invoice Report' },
    { tcode: 'MIGO', text: 'Payment Receipt' },
];

export function addMockFavorite(tcode: string, text: string) {
    if (mockUserFavorites.some(fav => fav.tcode === tcode)) {
        throw new Error('This T-Code is already in your favorites.');
    }
    mockUserFavorites.push({ tcode, text });
}

export function removeMockFavorites(tcodes: string[]) {
    mockUserFavorites = mockUserFavorites.filter(fav => !tcodes.includes(fav.tcode));
}

// Customer Master Mock Data
export let mockCustomers: WithId<Customer>[] = [
    {
        id: 'cust-1',
        clientType: 'Consignor',
        code: 'CONS001',
        name: 'Tata Chemicals',
        address: 'Mumbai, Maharashtra',
        gstin: '27AABCU9567L1Z5',
        pan: 'AABCU9567L',
        state: 'Maharashtra',
        stateCode: '27',
        contactPerson: 'Rohan Sharma',
        mobile: '9876543210',
        email: 'rohan.sharma@tatachem.com',
        bankDetails: 'HDFC Bank, 1234567890'
    },
    {
        id: 'cust-2',
        clientType: 'Buyer',
        code: 'BUY001',
        name: 'BigMart Retail',
        address: 'Delhi',
        gstin: '07AABCD1234E1Z3',
        pan: 'AABCD1234E',
        state: 'Delhi',
        stateCode: '07',
    },
    {
        id: 'cust-3',
        clientType: 'Consignee (Ship to)',
        code: 'SHIP001',
        name: 'BigMart Warehouse',
        address: 'Gurgaon, Haryana',
        gstin: '06AABCD1234E1Z4',
        pan: 'AABCD1234E',
        state: 'Haryana',
        stateCode: '06',
    }
];

export function addMockCustomer(data: Omit<Customer, 'id'>) {
    if (mockCustomers.some(c => c.code === data.code && data.code)) {
        throw new Error(`Customer code ${data.code} already exists.`);
    }
    if (mockCustomers.some(c => c.name === data.name)) {
        throw new Error(`Customer name ${data.name} already exists.`);
    }
    const newCustomer: WithId<Customer> = { ...data, id: `cust-${Date.now()}` };
    mockCustomers.unshift(newCustomer);
    return newCustomer;
}

export function updateMockCustomer(id: string, data: Partial<Customer>) {
    const customerIndex = mockCustomers.findIndex(c => c.id === id);
    if (customerIndex === -1) {
        throw new Error('Customer not found');
    }
    mockCustomers[customerIndex] = { ...mockCustomers[customerIndex], ...data };
}

export function deleteMockCustomer(id: string) {
    mockCustomers = mockCustomers.filter(c => c.id !== id);
}

// Master Data (IT01) Mock Data
export let mockMasterDataItems: WithId<MasterDataItem>[] = [
    {
        id: 'item1',
        plantId: 'plantA',
        invoiceType: 'Tax Invoice',
        chargeType: 'Service Charge',
        itemDescription: 'Standard Freight',
        hsnSac: '996511',
        unitType: 'MT',
        rate: 1500,
        isGstApplicable: true,
        gstRate: 5,
        validFrom: new Date('2023-01-01'),
        validTo: new Date('2024-12-31'),
    },
    {
        id: 'item2',
        plantId: 'plantB',
        invoiceType: 'Tax Invoice',
        chargeType: 'Other Charge',
        itemDescription: 'Detention Charges',
        hsnSac: '996719',
        unitType: 'KG',
        rate: 50,
        isGstApplicable: true,
        gstRate: 18,
        validFrom: new Date('2023-01-01'),
        validTo: new Date('2024-12-31'),
    }
];

export function addMockMasterDataItem(data: Omit<MasterDataItem, 'id'>): WithId<MasterDataItem> {
    const newItem: WithId<MasterDataItem> = { ...data, id: `item-${Date.now()}` };
    mockMasterDataItems.unshift(newItem);
    return newItem;
}

export function updateMockMasterDataItem(id: string, data: Partial<MasterDataItem>) {
    const itemIndex = mockMasterDataItems.findIndex(i => i.id === id);
    if (itemIndex !== -1) {
        mockMasterDataItems[itemIndex] = { ...mockMasterDataItems[itemIndex], ...data };
    }
}

export function deleteMockMasterDataItem(id: string) {
    mockMasterDataItems = mockMasterDataItems.filter(i => i.id !== id);
}

// Invoice Mock Data
export let mockInvoices: WithId<Invoice>[] = [
    {
        id: 'inv-1',
        invoiceNo: 'TAXINV001',
        invoiceType: 'Tax Invoice',
        isAutoInvoiceNo: false,
        invoiceDate: new Date(new Date().setDate(new Date().getDate() - 10)),
        billMonth: '06/2024',
        consignorId: 'cust-1',
        consigneeId: 'cust-3',
        plantId: 'plantA',
        chargeType: 'Service Charge',
        items: [
            { masterItemId: 'item1', description: 'Standard Freight', hsnSac: '996511', qty: 25, rate: 1500, amount: 37500, isGstApplicable: true, gstRate: 5 }
        ],
        totals: { taxableAmount: 37500, isInterState: true, igst: 1875, cgst: 0, sgst: 0, grandTotal: 39375, roundOff: 0, amountInWords: 'THIRTY-NINE THOUSAND THREE HUNDRED SEVENTY-FIVE ONLY' },
        isPosted: false,
        irn: undefined,
        irnGeneratedAt: undefined,
    },
    {
        id: 'inv-2',
        invoiceNo: 'TAXINV002',
        invoiceType: 'Tax Invoice',
        isAutoInvoiceNo: false,
        invoiceDate: new Date(new Date().setDate(new Date().getDate() - 5)),
        billMonth: '06/2024',
        consignorId: 'cust-1',
        consigneeId: 'cust-2',
        plantId: 'plantB',
        chargeType: 'Other Charge',
        items: [
             { masterItemId: 'item2', description: 'Detention Charges', hsnSac: '996719', qty: 2, rate: 500, amount: 1000, isGstApplicable: true, gstRate: 18 }
        ],
        totals: { taxableAmount: 1000, isInterState: true, igst: 180, cgst: 0, sgst: 0, grandTotal: 1180, roundOff: 0, amountInWords: 'ONE THOUSAND ONE HUNDRED EIGHTY ONLY' },
        isPosted: true, // This one is posted, so it should be uneditable
        irn: 'IRN1234567890',
        irnGeneratedAt: new Date(new Date().setDate(new Date().getDate() - 4)),
    },
    {
        id: 'inv-3',
        invoiceNo: 'DBN001',
        invoiceType: 'Debit Note',
        isAutoInvoiceNo: false,
        invoiceDate: new Date(new Date().setDate(new Date().getDate() - 2)),
        billMonth: '06/2024',
        consignorId: 'cust-1',
        consigneeId: 'cust-3',
        plantId: 'plantA',
        chargeType: 'Other Charge',
        items: [ { masterItemId: 'item2', description: 'Late Payment Fee', hsnSac: '996719', qty: 1, rate: 250, amount: 250, isGstApplicable: false, gstRate: 0 } ],
        totals: { taxableAmount: 250, isInterState: true, igst: 0, cgst: 0, sgst: 0, grandTotal: 250, roundOff: 0, amountInWords: 'TWO HUNDRED FIFTY ONLY' },
        isPosted: false,
        irn: 'IRN0987654321', // IRN generated
        irnGeneratedAt: new Date(new Date().setHours(new Date().getHours() - 10)), // within 24 hours
    },
    {
        id: 'inv-4',
        invoiceNo: 'CRN001',
        invoiceType: 'Credit Note',
        isAutoInvoiceNo: false,
        invoiceDate: new Date(new Date().setDate(new Date().getDate() - 3)),
        billMonth: '05/2024',
        consignorId: 'cust-1',
        consigneeId: 'cust-2',
        plantId: 'plantB',
        chargeType: 'Service Charge',
        items: [ { masterItemId: 'item1', description: 'Freight Rebate', hsnSac: '996511', qty: 1, rate: -500, amount: -500, isGstApplicable: true, gstRate: 5 } ],
        totals: { taxableAmount: -500, isInterState: true, igst: -25, cgst: 0, sgst: 0, grandTotal: -525, roundOff: 0, amountInWords: 'NEGATIVE FIVE HUNDRED TWENTY-FIVE ONLY' },
        isPosted: false,
        irn: 'IRN5432109876', // IRN generated
        irnGeneratedAt: new Date(new Date().setDate(new Date().getDate() - 2)), // older than 24 hours
    }
];

let nextInvoiceIdCounter = 5;

export function addMockInvoice(data: Omit<Invoice, 'id' | 'invoiceNo'> & { invoiceNo?: string }) {
    const newInvoice: WithId<Invoice> = {
        ...data,
        id: `inv-${nextInvoiceIdCounter++}`,
        invoiceNo: data.isAutoInvoiceNo ? `${data.invoiceType.substring(0,3).toUpperCase()}${Date.now().toString().slice(-6)}` : data.invoiceNo!,
    };
    mockInvoices.unshift(newInvoice);
    return newInvoice;
}

export function updateMockInvoice(id: string, data: Partial<Omit<Invoice, 'id'>>) {
    const index = mockInvoices.findIndex(inv => inv.id === id);
    if (index !== -1) {
        mockInvoices[index] = { ...mockInvoices[index], ...data };
    }
}
