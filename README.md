# InvoicePro — Complete SaaS Invoice Platform

A full-stack invoicing SaaS for small businesses with admin control panel.

## Project Structure

```
invoicepro/
├── backend/          → Customer app API (port 3001)
├── frontend/         → Customer app UI (port 5173)
├── admin-backend/    → Admin panel API (port 3002)
└── admin-frontend/   → Admin panel UI (open admin.html in browser)
```

## Quick Start

### 1. Install all dependencies
```bash
# Backend
cd backend && npm install

# Frontend
cd frontend && npm install

# Admin backend
cd admin-backend && npm install
```

### 2. Create .env files
```bash
cp backend/.env.example backend/.env        # fill in your values
cp frontend/.env.example frontend/.env      # fill in your values
cp admin-backend/.env.admin.example admin-backend/.env.admin
```

### 3. Run the SQL schemas in Supabase SQL Editor
- `backend/src/db/schema.sql` — run first
- `backend/src/db/admin-schema.sql` — run second
- `backend/src/db/features-schema.sql` — run third

### 4. Create your admin account
```bash
cd admin-backend
node create-admin.js your@email.com YourPassword "Your Name"
```

### 5. Start all 3 services (3 separate terminals)
```bash
# Terminal 1
cd backend && npm run dev

# Terminal 2
cd frontend && npm run dev

# Terminal 3
cd admin-backend && npm run dev
```

### 6. Open in browser
- **Customer app**: http://localhost:5173
- **Admin panel**: http://localhost:3002

## Features

### Customer app
- Invoices with PDF export, email sending, Stripe payment links
- Quotes / estimates — send to client, accept online, convert to invoice
- Time tracking — log hours, convert to invoice
- Client management with portal links
- Expense tracking with categories
- Recurring invoices (auto-generated)
- Multi-currency (30+ world currencies)
- VAT / tax calculations
- Payment reminders (automated)
- Reports & P&L

### Enterprise features
- Team members with role-based access
- API keys for integrations
- White label (your own branding)
- Tax reports with HMRC VAT breakdown
- Xero / QuickBooks CSV export
- Late payment fee calculator

### Admin panel (you control everything)
- All users and their plans
- Subscription plan management
- Currency management
- Branding & app settings
- Support tickets
- All invoices across all users
- Audit log

## Deployment
- Backend → Railway or Render
- Frontend → Vercel
- Admin backend → Railway (separate service)
- Admin frontend → served at http://yourbackend.com/admin (or open admin.html locally)
