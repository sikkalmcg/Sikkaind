# TODO - VA01 placeholders + Excel + Direct Loading + CN Entry

- [ ] Update VA01 (`src/app/dashboard/va/page.tsx`)
  - [ ] Add/repair CSS issues (alignment/spacing only)
  - [ ] Add placeholders/inputs for: Invoice No, E-waybill, Vehicle No
  - [ ] Update VA01 CSV template headers to include: Invoice No, E-waybill, Vehicle No
  - [ ] Update CSV parsing + save to `sales_orders` as optional fields

- [ ] Update TR21 CN entry + Direct loading (`src/app/dashboard/tr21/page.tsx`)
  - [ ] When assigning/Direct Loading, prefill vehicle number from VA01 (`selectedOrder.vehicleNo`)
  - [ ] When opening CN portal and `trip.invoices` empty, prefill invoice row using sale order optional fields


- [ ] Sanity check print templates
  - [ ] Ensure `trip.invoices.invNo` and `trip.invoices.ewaybillNo` are displayed correctly

- [ ] Run lint/build
  - [ ] `npm run lint` (or equivalent)
  - [ ] `npm run build`


