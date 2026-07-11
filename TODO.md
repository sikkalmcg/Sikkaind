# TODO

## TR21 Bugfix
- [ ] Update `src/app/dashboard/tr21/page.tsx` to force UI refresh after REJECTION commit so item disappears from active tab immediately
- [ ] Implement hover/detail rendering based on table `item` (not `resentTrip`) so rejection reason + SRN details show on cursor hover after Resent/SRN
- [ ] Ensure Resent/SRN flows do not break hover detail state
- [ ] Manual test checklist:
  - [ ] Reject from Arrived -> verify immediate movement to Reject tab (and removal from Arrived)
  - [ ] Resent -> verify Loading tab updates correctly
  - [ ] SRN -> hover over button/row shows reason + all info

