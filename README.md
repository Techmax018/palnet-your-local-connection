# PalNet: Your Local Connection

Build a complete, full-stack Local ISP & Hotspot Management Web Application named "PalNet" using React, Tailwind CSS, Shadcn UI, and Supabase.

### 1. PalNet Brand & Role Overview

- Application Name: PalNet (Local Wi-Fi, Home ISP & TV Billing Portal)

- System Roles:

  - Admin (PalNet Control Center): Manages routers, updates plan pricing, generates scratch cards/vouchers, tracks M-Pesa revenue, and controls active user sessions.

  - Customer (PalNet User Portal): Accesses hotspot captive portal, chooses Wi-Fi/Home/TV packages, pays via M-Pesa, or enters voucher codes.

---

### 2. Database Schema & Plan Seed Data (Supabase)

Create the following database tables with Row Level Security (RLS) enabled:

1. `profiles`: `id` (FK to auth.users), `full_name`, `phone_number`, `role` ('admin' | 'customer'), `created_at`.

2. `routers`: `id`, `name`, `ip_address`, `api_port`, `location`, `status` ('online' | 'offline'), `last_ping`, `created_at`.

3. `internet_plans`: `id`, `name`, `category` ('hotspot' | 'home' | 'tv'), `duration_type` ('minutes' | 'hours' | 'days'), `duration_value` (int), `download_limit_mb` (int, null for unlimited), `speed_limit_mbps` (int), `price_kes` (decimal), `is_active` (boolean).

4. `vouchers`: `id`, `code` (string, unique), `plan_id` (FK), `status` ('unused' | 'active' | 'expired'), `used_by` (FK to profiles, nullable), `activated_at` (timestamp), `expires_at` (timestamp).

5. `user_subscriptions`: `id`, `user_id` (FK), `plan_id` (FK), `router_id` (FK), `mac_address`, `ip_address`, `start_time`, `end_time`, `status` ('active' | 'expired' | 'suspended').

6. `transactions`: `id`, `user_id` (FK), `plan_id` (FK), `amount_kes`, `payment_method` ('mpesa' | 'cash' | 'voucher'), `transaction_reference`, `status` ('pending' | 'completed' | 'failed'), `created_at`.

#### Pre-populate `internet_plans` with these exact default packages:

- **Hotspot Quick Passes:**

  - 30-Minute Pass — KES 5 (30 Minutes)

  - 2-Hour Pass — KES 10 (2 Hours)

  - 4-Hour Pass — KES 15 (4 Hours)

  - 12-Hour Pass — KES 20 (12 Hours)

- **Home Internet Packages:**

  - Weekly Home Unlimited — KES 350 (7 Days)

  - Monthly Home Unlimited — KES 1,200 (30 Days)

- **TV & Streaming Packages:**

  - Weekly TV Stream Pass — KES 250 (7 Days)

  - Monthly TV Stream Pass — KES 850 (30 Days)

---

### 3. PalNet User Experience & Interfaces

#### A. Customer Interface (Mobile-First Captive Portal)

- Brand Header: "PalNet Wi-Fi" banner showing network connection state.

- Tabbed Package Selector:

  - Tab 1: **Hotspot Passes** (Cards for 5 KES / 30min, 10 KES / 2hr, 15 KES / 4hr, 20 KES / 12hr).

  - Tab 2: **Home Unlimited** (Cards for Weekly and Monthly Home Internet).

  - Tab 3: **TV & Streaming** (Cards for Weekly and Monthly High-Speed TV Access).

- Checkout Modal:

  - M-Pesa STK Push prompt (Input phone number e.g. 0712345678).

  - Scratch Card / Voucher Redemption field (Input 6-digit code).

- Active Session Timer:

  - Live countdown display of remaining time.

  - Current device MAC address, assigned IP, and connected router name.

  - Buttons: "Top Up / Extend Time" and "Disconnect".

#### B. Admin Control Center (Desktop & Mobile)

- Overview Stats: Today's Revenue (KES), Active Hotspot Users, Active Home/TV Subscribers, Router Health Status.

- Router Manager: Add/Edit MikroTik routers, test connection status, view dynamic IP assignments.

- Pricing & Plan Studio: Manage default prices (KES 5, 10, 15, 20, Weekly, Monthly) or create custom promo plans.

- Voucher Batch Generator: Create printable grids of unique scratch-card codes assigned to specific plans (e.g., generate 50 batch codes for KES 10 / 2hr).

- Active Connections & TV Leases Table: Search users by MAC address or phone number, with a instant "Terminate Session" button.

- M-Pesa Audit Logs: Live record of successful payments mapped to user accounts.

---

### 4. Router & Backend Integration

- Create a `routerService.ts` module with endpoints for:

  1. `authorizeMAC(macAddress, durationMinutes)`: Sends allow command to router firewall via REST API or RADIUS.

  2. `revokeMAC(macAddress)`: Removes access when subscription timer reaches zero.

  3. `processMpesaCallback(payload)`: Receives payment confirmation, creates subscription, and activates internet instantly.

### 5. Styling & Visual Theme

- Default Dark Mode layout styled with neon cyan (#00f3ff) and deep electric blue primary accents.

- Responsive, high-contrast UI tailored for mobile phones connecting to outdoor Wi-Fi.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/335f45ba-d9c3-4800-80a9-a4a0e1cef056).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
