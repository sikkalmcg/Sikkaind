export const QtyTypes = ['MT', 'BAG', 'BOX', 'DRUM', 'PCS', 'PALLET', 'Others', 'FTL'] as const;
export const VehicleTypes = ['Own Vehicle', 'Contract Vehicle', 'Market Vehicle'] as const;
export const ChargeTypes = ['Detention', 'Labor', 'Other'] as const;
export const PaymentModes = ['Cash', 'Banking', 'UPI', 'Cheque'] as const;
export const PaymentMethods = ['Banking', 'UPI Payment', 'QR Payment'] as const;
export const UnitTypes = ['Bag', 'Box', 'Drum', 'Pallet', 'Carton', 'Others'] as const;
export const WeightTypes = ['Kilograms', 'Metric Ton', 'Litre'] as const;
export const PaymentTerms = ['Paid', 'To Pay'] as const;
export const FuelTypes = ['Diesel', 'Petrol', 'CNG'] as const;
export const FuelPumpPaymentMethods = ['Banking', 'UPI Payment', 'Multiple', 'Cash', 'Cheque'] as const;
export const VendorPaymentModes = ['Banking', 'UPI', 'Cheque'] as const;
export const FuelPaymentTransactionMethods = ['Cash', 'Banking', 'Cheque'] as const;
export const PartyTypes = ['Consignor', 'Consignee & Ship to'] as const;

export const LiquidationRoles = ['Vehicle Driver', 'Transporter', 'Vehicle Owner'] as const;
export const PaymentPurposes = ['Advance Freight', 'POD Amount'] as const;

export const Departments = ['Logistics', 'Accounts', 'Administration', 'HR', 'IT', 'Operations', 'Security'] as const;
export const Designations = ['Manager', 'Supervisor', 'Officer', 'Assistant', 'Clerk', 'Operator', 'Driver', 'Guard'] as const;

// SIKKA LMC STANDARDIZED OPERATIONAL STATUSES
export const VehicleStatusList = ['Available', 'Under Process', 'Under-Maintenance', 'Breakdown'] as const;
export const TripStatusList = ['Pending', 'Assigned', 'Loaded', 'In-Transit', 'Arrived', 'Delivered', 'Trip Closed', 'Under-Maintenance', 'Breakdown'] as const;
export const PODStatusList = ['Missing', 'Receipt Soft Copy', 'Receipt Hard Copy'] as const;
export const PaymentStatusList = ['Unpaid', 'Paid', 'Partially Paid'] as const;

export const LRUnitTypes = [
  'Bag',
  'Box',
  'Pieces',
  'Drum',
  'Tin',
  'Carton',
  'Pallet',
  'Roll',
  'Bundle',
  'Case',
  'Others'
] as const;

export const JobRoles = [
  'System Administrator',
  'Manager',
  'Supervisor',
  'Order Planner',
  'Vehicle Planner',
  'Accountant',
  'Gate Security',
  'Sub-User'
] as const;

export const UserStatuses = ['Active', 'Inactive', 'Blocked'] as const;

export const SikkaLogisticsPagePermissions = [
    { id: 'live-dashboard', label: 'Live Dashboard' },
    { id: 'vehicle-entry', label: 'Vehicle Entry' },
    { id: 'attendance-register', label: 'Attendance' },
    { id: 'shipment-plan', label: 'Create Order' },
    { id: 'vehicle-assign', label: 'Open Orders' },
    { id: 'trip-board', label: 'Trip Board' },
    { id: 'supervisor-task', label: 'Supervisor Task' },
    { id: 'freight-process', label: 'Freight Process' },
    { id: 'shipment-tracking', label: 'Shipment Tracking' },
    { id: 'status-management', label: 'Status Management' },
    { id: 'employee-management', label: 'Employee Registry' },
    { id: 'freight-management', label: 'Freight Payment' },
    { id: 'fuel-management', label: 'Fuel Management' },
    { id: 'fuel-payment', label: 'Fuel Payment' },
    { id: 'report-analysis', label: 'Report & Analysis' },
];

export const SikkaAccountsPagePermissions = [
    { id: 'sikka-accounts-dashboard', label: 'Dashboard (DB03)' },
    { id: 'sikka-accounts-add-items', label: 'Create/Change Material Master (MM01)' },
    { id: 'sikka-accounts-display-items', label: 'Display Material Master (MM03)' },
    { id: 'sikka-accounts-customer-master', label: 'Create Customer (XD01)' },
    { id: 'sikka-accounts-invoice-create', label: 'Create Invoice (VF01)' },
    { id: 'sikka-accounts-invoice-edit', label: 'Edit Invoice (VF02)' },
    { id: 'sikka-accounts-invoice-print', label: 'Print Invoice (VF03)' },
    { id: 'sikka-accounts-payment-receipt', label: 'Payment Receipt (MIGO)' },
    { id: 'sikka-accounts-invoice-report', label: 'Invoice Report (ZINV)' },
];

export const AdminPagePermissionsList = [
    { id: 'vehicle-management', label: 'Vehicle Management' },
    { id: 'carrier-management', label: 'Carrier Management' },
    { id: 'plant-management', label: 'Plant Management' },
    { id: 'fuel-pump', label: 'Fuel Pump' },
    { id: 'recycle-bin', label: 'Recycle Bin' },
    { id: 'user-activity-log', label: 'User Activity Log' },
    { id: 'user-management', label: 'User Management' },
];

const allPerms = [
    ...SikkaLogisticsPagePermissions,
    ...SikkaAccountsPagePermissions,
    ...AdminPagePermissionsList
].map(p => p.id);

export const rolePermissions: Record<typeof JobRoles[number], string[]> = {
    'System Administrator': allPerms,
    'Manager': allPerms,
    'Supervisor': ['live-dashboard', 'supervisor-task', 'status-management', 'shipment-tracking'],
    'Order Planner': ['live-dashboard', 'shipment-plan'],
    'Vehicle Planner': ['live-dashboard', 'vehicle-assign', 'vehicle-entry', 'trip-board'],
    'Accountant': ['live-dashboard', 'freight-management', 'fuel-payment', 'report-analysis', 'sikka-accounts-dashboard', 'sikka-accounts-payment-receipt', 'sikka-accounts-invoice-report', 'sikka-accounts-invoice-create', 'employee-management'],
    'Gate Security': ['vehicle-entry'],
    'Sub-User': ['live-dashboard']
};