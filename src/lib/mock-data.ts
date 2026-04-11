import type { WithId, Plant, VehicleEntryExit, Trip, Shipment, Notification, Vehicle, VehicleType, Freight, Charge, Payment, ChargeType, PaymentMode, PaymentMethod, Carrier, LR, FuelPump, FuelEntry, FuelPayment, RecycledItem, ShipmentStatusMaster, SubUser, OwnVehicle, ContractVehicle, MarketVehicle, Customer, MasterDataItem, Invoice, Activity } from '@/types';

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
  { id: 'veh1', vehicleNumber: 'UP14A1111', plantId: 'plantA', driverId: 'drv1', driverName: 'Amit Kumar', driverMobile: '9876543210', status: 'Available', lastOdometerReading: 120500, vehicleType: 'Own Vehicle' },
  { id: 'veh2', vehicleNumber: 'UP14B2222', plantId: 'plantA', driverId: 'drv2', driverName: 'Rajesh Singh', driverMobile: '9876543211', status: 'Available', lastOdometerReading: 85000, vehicleType: 'Own Vehicle' },
  { id: 'veh3', vehicleNumber: 'WB02C3333', plantId: 'plantB', driverId: 'drv3', driverName: 'Suman Das', driverMobile: '9876543212', status: 'Available', lastOdometerReading: 210000, vehicleType: 'Contract Vehicle' },
  { id: 'veh4', vehicleNumber: 'DL01AD4444', plantId: 'plantC', driverId: 'drv4', driverName: 'Priya Sharma', driverMobile: '9876543213', status: 'Assigned', lastOdometerReading: 55000, vehicleType: 'Market Vehicle' },
];

export let mockShipments: WithId<Shipment>[] = [
    {
      id: 'ship1',
      shipmentId: 'S0000001',
      originPlantId: 'plantA',
      destination: 'Delhi',
      consignor: 'Tata Salt',
      loadingPoint: 'Salt Plant',
      billToParty: 'Delhi Distributor',
      unloadingPoint: 'Delhi Warehouse',
      quantity: 25,
      assignedQty: 0,
      balanceQty: 25,
      materialTypeId: 'Metric Ton',
      currentStatusId: 'pending',
      creationDate: new Date(new Date().setDate(new Date().getDate() - 2)),
    },
    {
      id: 'ship2',
      shipmentId: 'S0000002',
      originPlantId: 'plantB',
      destination: 'Mumbai',
      consignor: 'Tata Tea',
      loadingPoint: 'Tea Plant',
      billToParty: 'Mumbai Retailer',
      unloadingPoint: 'Mumbai Hub',
      quantity: 10,
      assignedQty: 10,
      balanceQty: 0,
      materialTypeId: 'Metric Ton',
      currentStatusId: 'delivered',
      creationDate: new Date(new Date().setDate(new Date().getDate() - 1)),
    },
];

export let mockTrips: WithId<Trip>[] = [
    {
        id: 'trip1',
        tripId: 'T0000001',
        vehicleId: 'veh4',
        vehicleNumber: 'DL01AD4444',
        driverId: 'drv4',
        driverName: 'Priya Sharma',
        driverMobile: '9876543213',
        shipmentIds: ['ship2'],
        originPlantId: 'plantB',
        destination: 'Mumbai',
        startDate: new Date(new Date().setDate(new Date().getDate() - 2)),
        tripStatus: 'In Transit',
        podStatus: 'Missing',
        freightStatus: 'Unpaid',
        vehicleStatus: 'In Transit',
        currentStatusId: 'in-transit',
        assignedTripWeight: 10,
        assignedQtyInTrip: 10,
        carrierId: 'carrier1',
        unloadingPoint: 'Mumbai Hub',
        vehicleType: 'Market Vehicle',
        lastUpdated: new Date()
    }
];

export let mockActivityLog: Activity[] = [
    {
        id: 'act1',
        userId: 'admin',
        userName: 'Sikka Admin',
        action: 'Login',
        tcode: 'AUTH',
        pageName: 'Login Page',
        timestamp: new Date(),
        description: 'User logged into the system'
    }
];

export let mockSubUsers: WithId<SubUser>[] = [
    {
        id: 'admin',
        fullName: 'Sikka Admin',
        username: 'sikkaind',
        email: 'sikkaind.admin@sikka.com',
        mobile: '9999999999',
        jobRole: 'Admin',
        status: 'Active',
        plantIds: ['plantA', 'plantB', 'plantC'],
        permissions: ['live-dashboard', 'user-management']
    }
];

export let mockFuelPumps: WithId<FuelPump>[] = [
    { id: 'pump1', name: 'Indian Oil, Ghaziabad', ownerName: 'Ravi Kumar', mobile: '9876543210', address: 'Near Main Bus Stand, Ghaziabad' },
];

export let mockFuelEntries: WithId<FuelEntry>[] = [];
export let mockFuelPayments: WithId<FuelPayment>[] = [];
export let mockRecycledItems: WithId<RecycledItem>[] = [];
export let mockCarriers: WithId<Carrier>[] = [
    {
        id: 'carrier1',
        name: 'SafeTrans Logistics',
        address: '1st Floor, Logistics Park, Mumbai',
        gstin: '27AABCU9567L1Z5',
        pan: 'AABCU9567L',
        stateName: 'Maharashtra',
        stateCode: '27',
        email: 'contact@safetrans.com',
        mobile: '9876543210',
        terms: ['Goods are carried at owner\'s risk.'],
        plantId: 'plantA'
    }
];
export let mockLrs: WithId<LR>[] = [];
