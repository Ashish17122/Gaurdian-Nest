# GuardianNest — Product Requirements (PRD)

## Overview
A single Expo + FastAPI + MongoDB app for parental control with three modes:
Parent, Child, and a hidden Admin Panel. Premium features + Razorpay
infrastructure are fully coded but disabled behind a `PREMIUM_ENABLED`
feature flag that the owner flips from the Admin Panel (or `backend/.env`).

## User roles
* **Parent** — monitors child devices, views app-usage charts, sets rules.
* **Child** — device is monitored; must enter Parent PIN to exit child mode;
  sees persistent "Parental watch is ACTIVE" banner and a sticky OS
  notification.
* **Admin (Owner)** — hidden tile on role-select, unlocked with access code.
  Sees KPIs, signup trend, leads table with filters, Razorpay config.

## Core features
1. Google social login (Emergent Auth, web) + demo login (native/web).
2. Parent dashboard — children selector, pair device (6-digit code), 7-day
   stat cards, bar chart (YouTube/Instagram/Chrome), daily-trend line chart,
   simulator buttons, premium upgrade CTA, Parent PIN.
3. Child dashboard — persistent active banner, heartbeat every 15s, log app
   sessions, disable-monitoring toggle (immediately alerts parent), sticky
   OS notification.
4. Admin — KPI grid, signup trend chart (7/14/30/60 days), role breakdown,
   filterable leads table (search/source/date range), Razorpay owner config
   with runtime toggle.
5. Razorpay — order creation, signature verification, webhook, subscription
   status — all gated by `PREMIUM_ENABLED`.

## Future (behind flag, schema ready)
Geo-fencing, content filters, screen-time schedules, advanced reports,
push-notifications, Twitter/Facebook OAuth.

## Tech
* Backend: FastAPI · Motor · MongoDB · Razorpay SDK · Emergent Auth proxy.
* Frontend: Expo SDK 54 · expo-router · react-native-chart-kit · react-native-svg · expo-notifications · AsyncStorage.
* Charts: bar + line from react-native-chart-kit.

## Deployment
* Preview: runs in the Emergent container (web + Expo Go).
* APK: user runs `eas build -p android --profile preview` on their machine.
  Full instructions in `/app/ROADMAP.md`.

## Key files
* `backend/server.py` — all endpoints & models.
* `frontend/app/{index,role,login,auth-callback,parent,child,admin}.tsx`.
* `frontend/src/{api.ts,theme.ts,ui.tsx}` — shared client + design tokens.
* `backend/.env` — owner config (flag + Razorpay keys + admin code).
* `/app/ROADMAP.md` — owner setup guide.
* `/app/memory/test_credentials.md` — demo accounts.
