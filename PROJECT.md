# Lawn Enforcer — Project Context

## Overview
A web app for tracking lawn mowing customers, jobs, specialty jobs, and expenses. Built for personal use with a future public-facing site in mind. The admin panel (`admin.html`) will serve as the backend for that public site. Primary mobile use is in the field via `index.html`.

## Tech Stack
- Plain HTML, CSS, vanilla JavaScript — no React, no Vite, no build step
- Supabase for database
- Hosted on Netlify (auto-deploys from GitHub)
- GitHub repo: https://github.com/cjglogowski/lawnenforcer

## File Structure
lawnenforcer/
├── index.html       ← Main page / customer list (mobile-first)
├── stats.html       ← Quick Stats page (mobile-friendly monthly snapshot)
├── yearly.html      ← Yearly overview
├── admin.html       ← Full admin panel (desktop-first, backend for future public site)
├── style.css        ← Shared styles for index, stats, yearly
├── app.js           ← Main page logic
├── stats.js         ← Stats page logic
├── yearly.js        ← Yearly overview logic
└── PROJECT.md

## Supabase Tables

### customers
- id, name, address, phone, email, price_per_cut, created_at

### jobs
- id, customer_id, mowed_at, paid, created_at

### specialty_jobs
- id, customer_id, description, amount, job_date, paid, created_at

### expenses
- id, category, description, amount, expense_date, created_at

All tables have RLS disabled — private tool only.

## Design System
- Accent: #4a9e6b (green)
- Background: #f9f9f7 (mobile pages), #f0f2f0 (admin)
- Admin sidebar: #141f1a (deep forest green-black)
- Cards: white, border-radius 12px, border 1px solid #ebebeb
- Font: system-ui
- Danger/outstanding: #c0392b (red)
- No Tailwind, no external UI libraries

---

## Pages

### index.html / app.js — Customer List (Mobile)
- 4 summary cards: total jobs, specialty jobs, total collected, total outstanding
- Customer list — each card shows name, address, last mowed date, price per cut, paid/unpaid badge, Mowed today button with date picker
- Mowed today logs a job with selected date and paid: false, then refreshes summary cards
- Click a customer to open detail view showing:
  - Edit customer info (name, address, phone, email)
  - Full mowing job history with date, paid/unpaid toggle, delete button
  - Specialty jobs for that customer with paid/unpaid toggle, edit and delete
  - Total paid and total cuts summary
- Add customer button — inline form with name, address, price per cut, phone, email
- Delete customer from detail view
- Footer links: Stats, Admin Panel
- Supports URL parameter ?customer=ID to auto open a customer detail view on load

### stats.html / stats.js — Quick Stats (Mobile)
- Redesigned as a mobile-friendly admin-style dashboard
- Sticky dark topbar (matches admin panel brand bar)
- Month/year picker in a "command strip" card
- Dark scoreboard panel showing: Collected, Expenses, Net Income for the month
- Mowing Jobs panel: stat row (jobs / collected / outstanding) + job list
- Specialty Jobs panel: stat row + job list
- Expenses panel: full list with edit/delete + Add Expense form
- Links: Yearly Overview, back to Customers

### yearly.html / yearly.js — Yearly Overview (Mobile)
- Year selector dropdown defaulting to current year
- Summary cards: total jobs, collected, outstanding, expenses, net income
- Customer breakdown sorted by most jobs
- Customer names link to index.html?customer=ID
- Expenses by category + full expense list
- Back button returns to stats.html

### admin.html — Admin Panel (Desktop-First)
- Fixed 220px dark sidebar with brand mark, grouped nav, footer links
- Sticky white topbar with active section title + "Private Beta" chip
- Hash-based routing (#dashboard, #customers, etc.) — no page reloads
- Pulls live data from Supabase on load

#### Sidebar sections:
**Overview**
- Dashboard (live)

**Operations**
- Customers (placeholder)
- Schedule (placeholder)

**Finance**
- Estimates (placeholder)
- Invoices (placeholder)
- Payments (placeholder)
- Expenses (placeholder — links to stats.html for now)

**Analytics**
- Reports (placeholder)

#### Dashboard (live):
- 4 KPI cards: total customers, jobs this month, collected this month, outstanding
- Recent jobs panel (last 6 jobs with name, date, paid status)
- Top customers panel (by monthly revenue)
- Revenue trend chart placeholder
- Expense breakdown chart placeholder

#### Placeholder sections (each has a hero description + 3 feature cards):
- **Customers** — sortable/searchable table, inline edit, bulk actions
- **Schedule** — weekly calendar, log from calendar, route ordering
- **Estimates** — line item builder, PDF export, convert to invoice
- **Invoices** — monthly billing, aging report, send and track
- **Payments** — Stripe Connect, autopay, payment links
- **Expenses** — receipt upload, CSV export, category totals
- **Reports** — revenue chart, seasonal trends, year-end PDF export

---

## Planned Features (Next Up)
- [ ] Edit customer phone and email from detail view (index.html)
- [ ] Admin: Customer management table (sortable, searchable, inline edit)
- [ ] Admin: Revenue trend chart on dashboard (6-month bar/line chart)
- [ ] Admin: Estimates builder
- [ ] Admin: Invoice generation + send
- [ ] Admin: Stripe payment integration
- [ ] Admin: Reports page with graphs and trends
- [ ] Expense receipt photo uploads
- [ ] Year-end PDF export

## Already Built
- [x] Customer list with mow logging, paid/unpaid toggle, detail view
- [x] Specialty jobs (add, edit, delete, paid toggle)
- [x] Monthly stats page (redesigned as dashboard-style Quick Stats)
- [x] Yearly overview with customer breakdown
- [x] Admin panel shell with sidebar nav, routing, live dashboard KPIs
- [x] Admin Panel link in index.html footer

## Claude Code Session Starter
"Read PROJECT.md and continue building the Lawn Enforcer project."

## Local Dev
Open index.html directly in browser — no build step needed.
Supabase credentials are stored directly in app.js, stats.js, yearly.js, and admin.html.

## Deployment
- GitHub: https://github.com/cjglogowski/lawnenforcer
- Netlify: auto-deploys on push to main
- Push to GitHub via terminal or GitHub Desktop
- Never create pull requests — push directly to main
