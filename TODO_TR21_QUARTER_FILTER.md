# TR21 Quarterly Calendar - TODO

- [x] Add quarterly filter UI next to Plant dropdown (left side) in `src/app/dashboard/tr21/page.tsx`.
- [x] Implement quarter/year state (Q1-YYYY..Q4-YYYY + ALL).
- [x] Map each TR21 tab to correct date field for filtering:
  - [x] Open Orders -> orderDate
  - [x] Loading -> assignDate
  - [x] In-Transit -> outDate
  - [x] Arrived -> arrivedDate
  - [x] Reject -> rejectionDate
  - [x] POD Verify -> unloadDate
  - [x] Closed -> updatedAt
- [x] Apply filtering inside `filteredData` and reset pagination on change.
- [ ] Verify counts/table update across all tabs.
