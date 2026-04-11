
# Sikka Logistics Platform (v2.5 Enterprise)

Enterprise-grade logistics and supply chain management system built with Next.js, Firebase, and ShadCN UI.

## 🚀 GitHub Deployment Guide

Aapka code locally commit ho chuka hai. Ab isse GitHub par bhejne ke liye niche diye gaye steps follow karein:

1. **Connect to GitHub** (Sirf ek baar karna hai)
   ```bash
   git remote add origin https://github.com/sikkalmcg/Sikkaind.git
   ```

2. **Push to Cloud** (Force push isliye taaki local aur remote sync ho jayein)
   ```bash
   git push -u origin main --force
   ```

3. **Verify**
   GitHub par apna repository refresh karein, saare commits wahan mil jayenge.

## Core Modules
- **Logistics Hub**: Live Dashboard, Gate Control, Shipment Planning, GIS Tracking.
- **Security Node**: Identity Management, Role-Based Access Control, Activity Logs.
- **Financial Node**: Freight Process, Fuel Settlement, Employee Payroll.

## Tech Stack
- **Framework**: Next.js 14 (App Router)
- **Database/Auth**: Firebase 9.23.0 (Firestore & Authentication)
- **Styling**: Tailwind CSS & ShadCN UI
- **GIS**: Google Maps API & Wheelseye Integration

## Security Policy
- Automated 60-day password rotation registry.
- 21-day retention policy for user activity logs.
- Git LFS enabled for manifest document storage.
