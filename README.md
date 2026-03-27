
# Sikka Logistics Platform (v2.5 Enterprise)

Enterprise-grade logistics and supply chain management system built with Next.js, Firebase, and ShadCN UI.

## 🚀 GitHub Deployment Guide

To deploy this project to your GitHub repository, follow these steps in your terminal:

1. **Initialize Git Repository** (Skip if already done)
   ```bash
   git init
   ```

2. **Setup Git LFS (For heavy assets)**
   ```bash
   git lfs install
   git lfs track "*.jpg" "*.png" "*.pdf" "*.jpeg"
   ```

3. **Stage and Commit**
   ```bash
   git add .
   git commit -m "Finalizing registry: Sync dependencies and Git LFS"
   ```

4. **Connect to GitHub** (Replace URL with your repo link)
   ```bash
   git remote add origin https://github.com/sikkalmcg/Sikkaind.git
   git branch -M main
   ```

5. **Push to Cloud (Force Push to resolve conflicts)**
   ```bash
   git push -u origin main --force
   ```

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
