
export const TCODE_ROUTES: Record<string, string> = {
  ZVEH01: '/dashboard/vehicle-entry',
  MM01: '/sikka-accounts/master-data/add-items',
  MM03: '/sikka-accounts/master-data/display-items',
  XD01: '/sikka-accounts/master-data/customer-master',
  VF01: '/sikka-accounts/invoice/create',
  VF02: '/sikka-accounts/invoice/edit',
  VF03: '/sikka-accounts/invoice/print',
  VF11: '/sikka-accounts/invoice/cancel',
  MIRO: '/sikka-accounts/invoice/incoming',
  MIGO: '/sikka-accounts/payment/receipt',
  F110: '/sikka-accounts/payment/vendor-run',
  ZINV: '/sikka-accounts/reports/invoice',
  ZCODE: '/sikka-accounts/t-code-list',
  MB52: '/sikka-accounts/db03-dashboard',
  MB5B: '/sikka-accounts/reports/movement',
  ZEMP: '/sikka-accounts/reports/employee-ledger',
};

export const TCODE_DESCRIPTIONS: Record<string, string> = {
  ZVEH01: 'Vehicle Yard Entry',
  MM01: 'Create/Change Material Master',
  MM03: 'Display Material Master',
  XD01: 'Create Customer',
  VF01: 'Create Billing Document',
  VF02: 'Change Billing Document',
  VF03: 'Display Billing Document',
  VF11: 'Cancel Billing Document',
  MIRO: 'Enter Incoming Invoice',
  MIGO: 'Payment Receipt',
  F110: 'Vendor Payment Run',
  ZINV: 'Invoice Report',
  ZCODE: 'T-Code List',
  MB52: 'Financial Dashboard',
  MB5B: 'Plant Movement Report',
  ZEMP: 'Employee Ledger Report',
};

export const SAP_DEFAULTS = {
  companyCode: 'SIL',
  plant: 'ID23',
  fiscalYear: '2024-25',
  postingPeriod: '11',
  currency: 'INR'
};
