# GuardianNest — Implementation Roadmap & Owner Guide

> Portfolio-ready parental control app (Expo + FastAPI + MongoDB).
> Single app with three modes: **Parent**, **Child**, and a **hidden Admin Panel**.

---

## 1. Quick demo — how to show this in your portfolio

1. Open the preview URL (runs in browser).
2. On the Role screen tap **Child** → `demo@child.com` → enter Child mode. Observe the persistent green "Parental watch is ACTIVE" banner. Tap **Turn OFF monitoring** → a real alert is sent to the parent.
3. Log out, tap **Parent** → `demo@parent.com` → Parent dashboard with 7-day bar chart + daily trend across **YouTube / Instagram / Chrome**. Pair a child device, simulate activity, set a Parent PIN.
4. Go back to Role screen → **Admin Panel** → enter access code **`999000`** → view KPIs, signup trend, user-role breakdown, leads table with date/source filters, and the **Razorpay owner config** card (yellow).

---

## 2. Admin access

* **Access code (changeable):** set `ADMIN_ACCESS_CODE` in `backend/.env` (default `999000`).
* **Admin emails:** comma-separated `ADMIN_EMAILS` in `backend/.env` — any Google login with that email auto-becomes admin.
* The Admin tile is **visible to everyone** on the role-selection screen BUT the panel itself only unlocks with the code (or if already logged in as an admin email).

---

## 3. Razorpay payment gateway — where to link & enable

### 3.1 Where the admin config lives

Inside the app: **Admin Panel → yellow "Owner Config · Premium Gateway" card** at the top.
Code location: `frontend/app/admin.tsx` — look for `ownerBox` / `owner-premium-config` testID.

### 3.2 Where to paste your Razorpay keys

File: **`backend/.env`**

```env
PREMIUM_ENABLED=false                  # flip to true from Admin Panel toggle
RAZORPAY_KEY_ID=rzp_live_xxxxxxxxxxxx
RAZORPAY_KEY_SECRET=xxxxxxxxxxxxxxxxxxxx
RAZORPAY_WEBHOOK_SECRET=xxxxxxxxxxxx   # for /api/payments/webhook
```

Get them from: <https://dashboard.razorpay.com/app/keys>

### 3.3 Where Razorpay is wired in code

| Concern                | File                           | Section                                    |
|------------------------|--------------------------------|--------------------------------------------|
| Keys / flag loader     | `backend/server.py`            | `razorpay_keys()`, `premium_enabled()`     |
| Order creation         | `backend/server.py`            | `POST /api/payments/create-order`          |
| Signature verification | `backend/server.py`            | `POST /api/payments/verify`                |
| Webhook                | `backend/server.py`            | `POST /api/payments/webhook`               |
| Admin toggle           | `backend/server.py`            | `POST /api/admin/premium/toggle`           |
| UI toggle              | `frontend/app/admin.tsx`       | `Switch` with `testID="premium-toggle"`    |
| Upgrade CTA (parent)   | `frontend/app/parent.tsx`      | `testID="upgrade-btn"` (disabled when off) |
| Subscription status    | `backend/server.py`            | `GET /api/subscription/status`             |

### 3.4 Flow after you enable it

1. Paste keys in `backend/.env` → restart backend.
2. Log in as admin → flip the **PREMIUM_ENABLED** switch in the yellow card.
3. Parent dashboard's **Upgrade** button becomes active → calls `/api/payments/create-order` → opens Razorpay Checkout on the client → server verifies the signature on `/api/payments/verify` → subscription row flips to `tier: "premium"`.

---

## 4. Real-device app-usage tracking (YouTube / Instagram / Chrome)

Expo Go **cannot** access Android's `UsageStatsManager` (it requires the special `PACKAGE_USAGE_STATS` permission granted from device **Settings → Special access**). iOS simply does **not** allow third-party apps to read other apps' usage at all.

**Today (demo/portfolio):** the `/api/activity/log` endpoint is fed by
1. seeded realistic data (`POST /api/dev/seed`), and
2. a simulator ("Simulate activity" buttons on Parent dashboard, "Log session" buttons on Child).

**Production (Android APK):** you need an **Expo Dev Build** (not Expo Go). Then:

1. Add dependency:
   ```sh
   npx expo install react-native-usage-stats-manager
   ```
2. Grant permission in-app (the library opens the settings page).
3. In `/app/frontend/app/child.tsx`, replace the `useEffect` heartbeat block with a call to `UsageStatsManager.queryUsageStats(startTime, endTime)`, filter by the package names:
   * `com.google.android.youtube`
   * `com.instagram.android`
   * `com.android.chrome`
4. Post each bucket to `POST /api/activity/log` — the backend schema is already ready.

**iOS:** requires Apple's **Screen Time / Family Controls** entitlement (MDM-level; enterprise approval).

---

## 5. Building & distributing an **APK** (for your portfolio)

This container cannot run EAS builds. You run this on your own machine:

```sh
# one-time
npm install -g eas-cli
eas login

cd /app/frontend
eas build:configure
eas build -p android --profile preview     # generates a .apk
```

The command prints a download URL once the build finishes (typically 10–15 min).
Host the APK on Google Drive / GitHub Releases and link it from your portfolio.

For a dev build (required for real `UsageStatsManager`):

```sh
eas build -p android --profile development
```

---

## 6. Architecture

```
┌──────────────────────────── frontend/app ────────────────────────────┐
│  index.tsx       → bootstrap / auth check / role route               │
│  role.tsx        → Parent | Child | Admin (locked by access code)    │
│  login.tsx       → Google OAuth (web) + demo login                   │
│  auth-callback.tsx → handles session_id fragment after Google        │
│  parent.tsx      → dashboard, charts, pair child, PIN lock, premium  │
│  child.tsx       → persistent ACTIVE banner, heartbeat, log usage    │
│  admin.tsx       → KPIs, signup trend, leads table, Razorpay toggle  │
└──────────────────────────────────────────────────────────────────────┘
       │  fetch + Bearer token (AsyncStorage) + cookie fallback
       ▼
┌──────────────────────────── backend/server.py ───────────────────────┐
│  Auth  : /api/auth/session /me /logout /mock-login                   │
│  Child : /api/children(/pair), /api/activity/log, /summary/{id}      │
│  Monitor: /api/monitoring/heartbeat, /api/alerts                     │
│  Admin : /api/admin/stats, /leads, /premium/toggle, /premium/config  │
│  Payment (GATED): /api/payments/{create-order,verify,webhook}        │
│  Parent Lock: /api/parent/{set-pin, verify-pin, has-pin}             │
│  Seed   : /api/dev/seed   Public : /api/config/public                │
└──────────────────────────────────────────────────────────────────────┘
       │
       ▼
┌──────────────────────────── MongoDB collections ─────────────────────┐
│  users · sessions · children · activity · alerts · leads · orders    │
│  subscriptions · razorpay_events · config                            │
└──────────────────────────────────────────────────────────────────────┘
```

### Feature-flag design

* One source of truth: `PREMIUM_ENABLED` env var + `config` collection.
* Runtime toggle via `/api/admin/premium/toggle` — writes to both env and DB.
* On startup, `startup_event()` re-hydrates env from the DB so flag survives restarts.
* Every payment endpoint goes through `_razorpay_guard()` which returns **503** until keys exist AND flag is on.
* Frontend hides/greys the Upgrade CTA based on `/api/config/public` → `premium_enabled`.

---

## 7. Notifications

* **Child side** (`frontend/app/child.tsx`): on native, on mount, requests notification permission and schedules a **sticky local notification** titled *"GuardianNest is watching"*. On web preview the permission call is skipped.
* **Monitoring disabled alert**: when child toggles monitoring off, a POST to `/api/monitoring/heartbeat` inserts an `alerts` row with `type = MONITORING_DISABLED`. Parent dashboard shows it at the top in red and can be extended to send a push via Expo Push Service (token is stored on the child row).

---

## 8. Future premium features (schema already in place)

* Geo-fencing (collection `geofences`)
* Screen-time schedules (collection `schedules`)
* Content filters (collection `blocklists`)
* Advanced reports (aggregations on `activity`)

All gated by `PREMIUM_ENABLED` + active `subscriptions` row.

---

## 9. Credentials (demo)

| Role   | Email                        | Password | Admin code |
|--------|------------------------------|----------|------------|
| Parent | `demo.parent@guardiannest.app` | demo login (any) | — |
| Child  | `demo.child@guardiannest.app`  | demo login (any) | — |
| Admin  | any email + admin code         | demo login (any) | `999000`   |

Change `ADMIN_ACCESS_CODE` in `backend/.env` before shipping.
