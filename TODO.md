# TODO - 404 for VK11/VK12/VK13/VT04

- [ ] Fix route mapping in `src/app/dashboard/layout.tsx` so VK11/VK12/VK13 do not fallback to `/dashboard/vk`.
- [ ] Handle VT04: either map VT04 to an existing route or create missing `src/app/dashboard/vt04/page.tsx` (verify desired folder name).
- [ ] Re-test navigation URLs (`/dashboard/vk11?tcode=VK11`, `/dashboard/vt04?tcode=VT04`, etc.) and confirm no 404.

