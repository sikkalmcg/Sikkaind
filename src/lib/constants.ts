export const SikkaLogisticsPagePermissions = [
  { id: 'live-dashboard', name: 'Live Dashboard' },
  { id: 'vehicle-entry', name: 'Vehicle Entry' },
  { id: 'attendance-register', name: 'Attendance Register' },
  { id: 'shipment-plan', name: 'Shipment Plan' },
  { id: 'vehicle-assign', name: 'Vehicle Assign' },
  { id: 'trip-board', name: 'Trip Board' },
  { id: 'supervisor-task', name: 'Supervisor Task' },
  { id: 'freight-process', name: 'Freight Process' },
  { id: 'shipment-tracking', name: 'Shipment Tracking' },
  { id: 'fleet-live-map', name: 'Fleet Live Map' },
  { id: 'track-consignment', name: 'Track Consignment' },
  { id: 'status-management', name: 'Status Management' },
  { id: 'shipment-summary', name: 'Shipment Summary' },
  { id: 'freight-management', name: 'Freight Management' },
  { id: 'fuel-payment', name: 'Fuel Payment' },
  { id: 'fuel-management', name: 'Fuel Management' },
  { id: 'vendor-management', name: 'Vendor Management' },
  { id: 'employee-management', name: 'Employee Management' },
  { id: 'report-analysis', name: 'Report Analysis' },
];

export const AdminPagePermissionsList = [
  { id: 'user-management', name: 'User Management' },
  { id: 'vehicle-management', name: 'Vehicle Management' },
  { id: 'carrier-management', name: 'Carrier Management' },
  { id: 'plant-management', name: 'Plant Management' },
  { id: 'recycle-bin', name: 'Recycle Bin' },
  { id: 'user-activity-log', name: 'User Activity Log' },
];

export const SikkaAccountsPagePermissions = [
  { id: 'accounts-dashboard', name: 'Accounts Dashboard' },
];

export const Departments = [
  'Management',
  'Operations',
  'Accounts',
  'Security',
  'Driver',
  'Workshop',
  'Sales',
  'IT',
];

export const Designations = [
  'Admin',
  'Manager',
  'Supervisor',
  'Accountant',
  'Clerk',
  'Operator',
  'Security Guard',
  'Driver',
];

export const PaymentModes = ['Cash', 'Banking', 'UPI Payment', 'Cheque'] as const;
export const PaymentMethods = ['Cash', 'Banking', 'UPI Payment', 'QR Payment'] as const;
export const LiquidationRoles = ['Vehicle Driver', 'Transporter', 'Owner', 'Agent'] as const;
export const PaymentPurposes = ['Advance Freight', 'POD Amount', 'Balance Payment'] as const;
export const PaymentTerms = ['Paid', 'To Pay'] as const;
export const FuelTypes = ['Diesel', 'Petrol', 'CNG', 'Electric'] as const;
export const VehicleTypes = ['Own Vehicle', 'Contract Vehicle', 'Market Vehicle'] as const;
export const ChargeTypes = ['Detention', 'Labor', 'Toll', 'Others'] as const;
export const FuelPumpPaymentMethods = [
  'All Type',
  'Small Capacity (1 – 5 MT)',
  'Medium Capacity (6 – 10 MT)',
  'Upper Medium (11 – 20 MT)',
  'Heavy Vehicles (21 – 30 MT)',
  'Extra Heavy (31 – 45 MT)'
] as const;
export const FuelPaymentTransactionMethods = ['Cash', 'Banking', 'Cheque'] as const;
export const LRUnitTypes = ['Package', 'Packet', 'Carton', 'Bag', 'Metric Ton', 'Box', 'Drum', 'Pallet', 'Others'] as const;
export const PartyTypes = ['Consignor', 'Consignee & Ship to party'] as const;

export const DEFAULT_LMC_TERMS = [
    "AGENCY NOT RESPONSIBLE FOR RAIN OR CALAMITY.",
    "DISCREPANCIES MUST BE INTIMATED WITHIN 24 HOURS.",
    "VEHICLE OWNER RESPONSIBLE AFTER YARD DEPARTURE.",
    "ALL DISPUTES SUBJECT TO GHAZIABAD JURISDICTION."
];
