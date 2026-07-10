## Goal

tr24 mapping view me **route line show nahi ho rahi** aur map baar baar reload / recreate ho raha hai — performance issues fix.

## Plan (implementation checklist)

- [ ] TR24 page me GeoJSON dataset ke fetch URL me **API key** use ho rahi hai (direct embed). Replace hardcoded key with existing MapTiler token flow.
- [ ] Route drawing effect ko “controlled” banaana: `selectedTrip` change par run, `map fitBounds` aur route layer add/update same behavior.
- [ ] `useEffect` dependencies (especially `selectedTrip` / `mapRef` / `maplibreRef`) ko stable banana.
- [ ] Route fetch ke liye pins invalid (`'-'`) case skip.
- [ ] Route source/layer ko remove/update in-place (no duplicates).
- [ ] Ensure marker effect me map remove/recreate na ho.

## Done

- [ ] (to be updated)

