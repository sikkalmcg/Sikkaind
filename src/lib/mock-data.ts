
import type { WithId, Plant, VehicleEntryExit, Trip, Shipment, Notification, Vehicle, VehicleType, Freight, Charge, Payment, ChargeType, PaymentMode, PaymentMethod, Carrier, LR, LRItem, FuelPump, FuelEntry, FuelPayment, RecycledItem, ShipmentStatusMaster, SubUser, OwnVehicle, ContractVehicle, MarketVehicle, Customer, MasterDataItem, Invoice, MasterInvoiceType, MasterChargeType, MasterUnitType, Activity, RejectionShortage, StatusUpdate, FreightMaster, FreightMasterLog } from '@/types';

export let mockPlants: WithId<Plant>[] = [];

export let mockVehicles: WithId<Vehicle>[] = [];

export let mockShipments: WithId<Shipment>[] = [];

export let mockTrips: WithId<Trip>[] = [];

export let mockCarriers: WithId<Carrier>[] = [];

export let mockFuelPumps: WithId<FuelPump>[] = [];

export let mockSubUsers: WithId<SubUser>[] = [
    { 
        id: 'sub1', 
        fullName: 'Ajay Somra', 
        jobRole: 'System Administrator', 
        countryCode: '+91',
        mobile: '8860091900', 
        username: 'sikkaind', 
        password: 'Sikka@lmc2105',
        status: 'Active', 
        permissions: [
            'live-dashboard', 'vehicle-entry', 'shipment-plan', 'vehicle-assign', 'trip-board', 'supervisor-task', 'freight-process', 'shipment-tracking', 'status-management', 'shipment-summary', 'freight-management', 'fuel-management', 'fuel-payment', 'report-analysis',
            'sikka-accounts-dashboard', 'sikka-accounts-add-items', 'sikka-accounts-display-items', 'sikka-accounts-customer-master', 'sikka-accounts-invoice-create', 'sikka-accounts-invoice-edit', 'sikka-accounts-invoice-print', 'sikka-accounts-payment-receipt', 'sikka-accounts-invoice-report',
            'vehicle-management', 'carrier-management', 'plant-management', 'fuel-pump', 'recycle-bin', 'user-activity-log', 'user-management'
        ], 
        loginAttempts: 0, 
        access_logistics: true, 
        access_accounts: true, 
        plantIds: [],
        accounts_plant_ids: [],
        defaultModule: 'Administration'
    }
];

export let mockStatusMasters: WithId<ShipmentStatusMaster>[] = [];

export let mockMasterQtyTypes: any[] = [];

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

// Fallback Registry Nodes for Build Stability and Component Handshaking
export let mockLrs: WithId<LR>[] = [];
export let mockMasterInvoiceTypes: WithId<MasterInvoiceType>[] = [];
export let mockMasterChargeTypes: WithId<MasterChargeType>[] = [];
export let mockMasterUnitTypes: WithId<MasterUnitType>[] = [];
export let mockActivityLog: WithId<Activity>[] = [];
export let mockRejectionShortageItems: WithId<RejectionShortage>[] = [];
export let mockAccountPlants: WithId<Plant>[] = [];
export let mockFreights: WithId<Freight>[] = [];
export let mockNotifications: WithId<Notification>[] = [];
export let mockVehicleInHistory: WithId<VehicleEntryExit>[] = [];
export let mockVehicleOutHistory: WithId<VehicleEntryExit>[] = [];
export let mockFuelPayments: WithId<FuelPayment>[] = [];
export let mockInvoices: WithId<Invoice>[] = [];
export let mockMasterDataItems: WithId<MasterDataItem>[] = [];
export let mockFreightMasters: WithId<FreightMaster>[] = [];
export let mockCustomers: WithId<Customer>[] = [];

// Exported Logic Nodes for Registry Maintenance
export const deleteMockFreightMaster = (id: string) => {};
export const updateMockFreightMaster = (id: string, data: any) => {};
export const addMockFreightMaster = (data: any) => {};
export const getFreightMasterLogs = (id: string) => [];
export const deleteMockMasterDataItem = (id: string) => {};
export const updateMockMasterDataItem = (id: string, data: any) => {};
export const logBulkUpload = (data: any) => {};

// Additional exports for cross-module functionality
export function addMockShipment(data: any) {}
export function deleteMockShipment(id: string) {}
export function addMockVehicle(data: any, plantId: string) {}
export function addMockTrip(shipment: any, vehicle: any, assignQty: number, vehicleType: string, tripDetails: any) {}
export function unassignMockTrip(trip: any) {}
export function updateMockTrip(tripToUpdate: any, shipment: any, newVehicle: any, newAssignQty: number, newVehicleType: string, newTripDetails: any) {}
export function updateMockTripStatus(tripId: string, newStatus: string, location?: string, remarks?: string) {}
export function completeMockTrip(tripId: string, unloadQty: number) {}
export function addChargeToFreight(freightId: string, amount: number, type: string, remark?: string) {}
export function makeFreightPayment(freightId: string, amount: number, mode: string, referenceNo?: string) {}
export function updateTripPaymentDetailsAndCharges(tripId: string, details: any) {}
export function addMockCarrier(data: any) {}
export function deleteMockCarrier(id: string) {}
export function updateMockCarrier(id: string, data: any) {}
export function addMockLr(data: any) {}
export function addMockFuelPump(data: any) {}
export function deleteMockFuelPump(id: string) {}
export function addMockFuelEntry(data: any) {}
export function addMockFuelPayment(data: any) {}
export function deleteMockFuelPayment(id: string) {}
export function restoreMockItem(id: string) {}
export function permanentlyDeleteMockItem(id: string) {}
export function addMockPlant(name: string) {}
export function deleteMockPlant(id: string) {}
export function addMockStatus(name: string) {}
export function deleteMockStatus(id: string) {}
export function addMockSubUser(data: any) {}
export function updateMockSubUser(id: string, data: any) {}
export function deleteMockSubUser(id: string) {}
export function addMockOwnVehicle(data: any) {}
export function deleteMockOwnVehicle(id: string) {}
export function addMockContractVehicle(data: any) {}
export function deleteMockContractVehicle(id: string) {}
export function addMockMarketVehicle(data: any) {}
export function deleteMockMarketVehicle(id: string) {}
export function updateMockOwnVehicle(id: string, data: any) {}
export function updateMockContractVehicle(id: string, data: any) {}
export function updateMockMarketVehicle(id: string, data: any) {}
export function addMockCustomer(data: any) {}
export function updateMockCustomer(id: string, data: any) {}
export function deleteMockCustomer(id: string) {}
export function addMockMasterDataItem(data: any) {}
export function addMockInvoice(data: any) {}
export function updateMockInvoice(id: string, data: any) {}
