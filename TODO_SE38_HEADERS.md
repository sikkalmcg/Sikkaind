# TODO: SE38 – Analysis Result Header Changes

## Planned changes
- Update `src/app/dashboard/se38/page.tsx`
  - Rename Vehicle Type → Fleet Type
  - Rename Item Description → Goods Desc
  - Add columns:
    - Sale Order
    - CN Date
    - Total Package
    - Carrier
    - Vendor Name/Firm
    - Arrange By
    - Arrived Date & Time
    - Unload Date & Time
    - Reject Date & Time
    - Detain Hours (HH:MM) (Arrived − Unload)
  - Remove columns:
    - POD Status
    - POD Time
  - Update both on-screen table headers/body and CSV export headers/rows
  - Implement Detain Hours calculation in HH:MM

## Progress
- [ ] Modify `src/app/dashboard/se38/page.tsx`

