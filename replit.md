# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Each package manages its own dependencies.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)
- **Mobile**: Expo SDK 54 + React Native 0.81 + Expo Router

## Structure

```text
artifacts-monorepo/
├── artifacts/              # Deployable applications
│   ├── api-server/         # Express API server
│   └── mobile/             # Expo mobile app (WaTracker Pro)
├── lib/                    # Shared libraries
│   ├── api-spec/           # OpenAPI spec + Orval codegen config
│   ├── api-client-react/   # Generated React Query hooks
│   ├── api-zod/            # Generated Zod schemas from OpenAPI
│   └── db/                 # Drizzle ORM schema + DB connection
├── scripts/                # Utility scripts (single workspace package)
├── pnpm-workspace.yaml     # pnpm workspace
├── tsconfig.base.json      # Shared TS options
├── tsconfig.json           # Root TS project references
└── package.json            # Root package with hoisted devDeps
```

## WaTracker Pro Mobile App

Full-featured WhatsApp activity monitoring & parental control app.

### Features (v2.0 — Fully Implemented)
- **Dashboard**: Live stats, online contacts, quick actions
- **Chat Tracker**: Privacy mode toggle, filter bottom sheet (All/Unread/Media/View-Once), swipe-left Archive, swipe-right Mute, skeleton loaders, pull-to-refresh
- **Chat Conversation**: WhatsApp-style bubbles, date separators, inline search with toggle, keyword highlights (from alert list), deleted/view-once message states
- **View Once Recovery**: 3-column media grid, filter chips (Photos/Videos/Voice), select mode with multi-select, full-screen viewer with prev/next, share
- **Notifications/Alerts**: SectionList grouped Today/Yesterday/This Week/Older, swipe-right to Mark-Read, confirm-clear dialog
- **Settings**: 8 complete sections — Security (biometric + auto-lock timer), Subscription, Notifications, DND (add/delete windows), Alerts (daily usage slider + spike), Theme, Data (export/import/delete account 3-step), More (links + dev easter egg at v7 taps)
- **Contact Detail**: Per-contact stats, hourly activity charts, session data; timer initializes from active session elapsed time (not always 0)
- **Family Dashboard**: Aggregated family monitoring overview
- **Reports**: Avatar contact picker, date range picker, 4 stat cards, daily bar chart, hourly heatmap with legend, sortable sessions table (click header to sort), working export CSV + share (uses expo-file-system + expo-sharing)
- **Subscription**: Monthly/Annual billing toggle with "Save 40%" badge, 3 plan cards with feature lists and per-plan pricing, feature comparison table, money-back guarantee badge
- **Keyword Alerts**: Add/manage keywords for content monitoring
- **Contact Groups**: Organize contacts into groups
- **Activity Timeline**: Full day timeline for all contacts
- **Contact Comparison**: Side-by-side contact activity comparison

### Hook Updates (v2.0)
- `useBiometricLock`: Added `autoLockSeconds`, `setAutoLockSeconds` properties
- `useReports`: Added `sessions`, `hourlyHeatmap` fields to `Report` type

### Tracker & WhatsApp Hooks (v3.0)
- `useTrackerSession` (`hooks/useTrackerSession.ts`): start session, request pairing code, poll verify, verify connection, disconnect — types imported from generated OpenAPI schemas
- `useTrackerJobs` + `useTrackerActivity` + `useTrackerStats` (`hooks/useTrackerJobs.ts`): start/stop tracking jobs, fetch activity logs, fetch 7-day stats — types from generated schemas
- `useWhatsAppConnection` (`hooks/useWhatsAppConnection.ts`): Baileys pairing code flow, countdown timer, auto-refresh, friendly errors — types imported from `@workspace/api-client-react`

### OpenAPI + Orval Codegen
- Full OpenAPI spec at `lib/api-spec/openapi.yaml` — 22 endpoints covering health, auth, tracker, and WhatsApp
- Orval generates React Query hooks into `lib/api-client-react/src/generated/api.ts` (12 hooks)
- Orval generates Zod schemas into `lib/api-zod/src/generated/`
- Mobile app imports generated types from `@workspace/api-client-react`
- `setBaseUrl` configured in `app/_layout.tsx` so generated hooks work in Expo

### Tech
- Expo Router (file-based routing)
- React Query for server state
- Inter font family (@expo-google-fonts/inter)
- WhatsApp-inspired dark green color palette
- `useColors()` hook for all theming (never hardcode hex values)
- Liquid glass tab bars on iOS 26+, BlurView fallback on older iOS/Android
- AsyncStorage for persistence (theme, onboarding, biometric lock, DND)
- Favorites synced from backend via `useFavoriteContacts()` hook — not local state
- Expo Haptics for feedback
- Expo Local Authentication for biometric lock
- Expo Notifications for push notifications
- Expo Secure Store for sensitive tokens
- react-native-gesture-handler for swipe actions
- react-native-toast-message for toasts
- date-fns for time formatting

### Design Tokens (constants/colors.ts)
- Primary: #25D366 (WhatsApp green)
- Dark: #128C7E / Darkest: #075E54
- Blue accent: #34B7F1, Purple: #7C4DFF
- Dark background: #0b141a, Dark surface: #111b21

## Backend API Server

Express 5 REST API running on port 8080.

### Workflows
- **Start Backend**: `cd artifacts/api-server && PORT=8080 pnpm run dev`
- **Start application**: `cd artifacts/mobile && pnpm run dev`

### Implemented API Routes (Section 2 - Complete)

**Auth:**
- POST /api/auth/register
- POST /api/auth/login (sets httpOnly JWT cookie)
- POST /api/auth/logout
- GET /api/auth/me

**Contacts:**
- GET /api/contacts
- POST /api/contacts
- PUT /api/contacts/:id
- DELETE /api/contacts/:id
- GET /api/contacts/favorites
- POST /api/contacts/:id/favorite (toggle)
- GET /api/contacts/groups
- POST /api/contacts/groups
- PUT /api/contacts/groups/:id
- DELETE /api/contacts/groups/:id

**Sessions & Stats:**
- GET /api/contacts/:id/sessions
- GET /api/contacts/:id/stats
- GET /api/contacts/:id/hourly
- POST /api/contacts/:id/status
- GET /api/contacts/:id/patterns

**Chat & Media:**
- GET /api/conversations
- GET /api/messages/:contactId
- GET /api/view-once

**Notifications:**
- GET /api/notifications
- POST /api/notifications/mark-read/:id
- POST /api/notifications/mark-all-read
- DELETE /api/notifications/clear

**Reports:**
- GET /api/reports/:contactId
- GET /api/reports/:contactId/export

**Subscription:**
- GET /api/subscription/plans
- GET /api/subscription/current
- POST /api/subscription/upgrade

**Settings:**
- GET /api/settings
- PUT /api/settings
- GET /api/settings/dnd
- POST /api/settings/dnd
- DELETE /api/settings/dnd/:id

**Activity (New):**
- GET /api/activity/family-summary
- GET /api/activity/comparisons
- GET /api/activity/timeline

**Alerts (New):**
- GET /api/alerts/keywords
- POST /api/alerts/keyword
- DELETE /api/alerts/keyword/:id

**Geofence (New):**
- GET /api/geofence/zones
- POST /api/geofence/zones

**WhatsApp / Baileys (Pairing Code Flow):**
- POST /api/whatsapp/request-pairing-code — generate pairing code (E.164 phone, libphonenumber validated)
- GET /api/whatsapp/connection-status — current connection state + masked phone + lastError
- GET /api/whatsapp/pairing-code-status — polling endpoint (waiting/accepted/expired/error)
- POST /api/whatsapp/disconnect
- POST /api/whatsapp/reconnect

**Tracker (Puppeteer-based):**
- POST /api/tracker/session/start — launch Chromium, restore or initiate QR session
- GET /api/tracker/session/status
- DELETE /api/tracker/session
- POST /api/tracker/session/pairing-code — Baileys pairing code unified under tracker namespace
- GET /api/tracker/session/verify — polling endpoint for pairing acceptance
- POST /api/tracker/session/verify — full connection status check
- POST /api/tracker/track — start tracking a phone number
- DELETE /api/tracker/untrack/:jobId
- GET /api/tracker/jobs — list jobs with live worker status
- GET /api/tracker/activity/:phoneNumber — raw logs (last 7d, paginated)
- GET /api/tracker/stats/:phoneNumber — aggregate: sessions, durations, daily breakdown
- GET /api/tracker/ws/info

### Auth Implementation
- JWT tokens in httpOnly cookies
- bcryptjs for password hashing
- requireAuth middleware in src/middlewares/auth.ts
- CORS configured with `credentials: true`
- cookie-parser middleware enabled

## Database Schema (PostgreSQL)

Tables created via `drizzle-kit push` (run from `lib/db`):
- users
- contacts
- contact_favorites
- contact_groups
- contact_group_members
- activity_sessions
- conversations
- messages
- view_once_media
- notifications
- subscription_plans
- user_subscriptions
- user_settings
- dnd_rules
- keyword_alerts
- geofence_zones
- whatsapp_sessions — stores Baileys connection state per user (creds + keys encrypted in DB); columns: id, userId, phoneNumber, status, lastSeen, lastError, reconnectAttempts, createdAt, updatedAt
- whatsapp_auth_keys — individual auth key entries for Baileys (key type + id + JSON value); FK to whatsapp_sessions
- tracker_sessions — stores Puppeteer/Baileys tracker connections per user; columns: id, userId, status, connectionType, qrCodeBase64, cookiesJson, localStorageJson, pairingCode, pairingExpiresAt, lastError, reconnectAttempts, connectedAt, lastActiveAt, createdAt, updatedAt
- tracker_jobs — active tracking jobs (phone, status, nextPollAt, jobId)
- tracker_logs — per-job online/offline event log

## Metro Bundler Configuration

The `artifacts/mobile/metro.config.js` sets `projectRoot = __dirname` and `watchFolders = [workspaceRoot]` with `nodeModulesPaths` pointing to both the mobile app's and the workspace root's `node_modules`, plus `unstable_enableSymlinks: true`.

**Critical**: Do NOT set `disableHierarchicalLookup: true` in the resolver config. pnpm stores transitive dependencies (like `expo-modules-core`) inside each package's own `node_modules` in the virtual store. With hierarchical lookup disabled, Metro cannot walk up the symlink chain to find those packages, causing "Unable to resolve" errors and a blank screen.

## TypeScript & Composite Projects

Every package extends `tsconfig.base.json` which sets `composite: true`.

## Root Scripts

- `pnpm run build` — typecheck + build all packages
- `pnpm run typecheck` — runs `tsc --build --emitDeclarationOnly`

## Packages

### `artifacts/mobile` (`@workspace/mobile`)

Expo mobile app. Entry: `app/_layout.tsx`.

**Provider wrapping order (outermost → innermost):**
GestureHandlerRootView → SafeAreaProvider → ErrorBoundary → QueryClientProvider → AuthProvider → ThemeProvider → NotificationProvider → AuthGate → Stack

**Auth Gate Logic (AuthGate component in _layout.tsx):**
- Not authenticated → redirect to `/auth`
- Authenticated but onboarding not done (StorageKeys.ONBOARDING_DONE is falsy) → redirect to `/onboarding`
- Biometric lock enabled + not passed → overlay BiometricGate over Stack
- Otherwise → render Stack normally
- StorageKey ONBOARDING_DONE is stored as boolean `true` via setItem; auth gate reads as boolean and uses `!!val`

**Section 6 Screen Implementations (complete per spec):**

*6.1 Onboarding (app/onboarding.tsx):*
- 5 slides: Shield/Track, Bell/Alerts, BarChart/Reports, People/Family, Lock/Privacy
- FlatList with pagingEnabled + scrollEnabled={false}
- Active dot: 24px wide, inactive: 8px
- On complete: saves ONBOARDING_DONE=true, navigates to `/(tabs)` 

*6.2 Auth (app/auth.tsx):*
- Layout: LinearGradient (35% height) + card form (65% height) overlapping 24px
- SegmentedControl for Sign In / Create Account modes
- Fields: username (register), email, password+toggle, confirmPassword (register)
- Inline field-level error messages with red border + icon
- Password rules: 8+ chars, letters and numbers (enforced in validate())
- Error banner for server errors (no Alert)
- On success: router.replace("/(tabs)")

*6.3 Dashboard (app/(tabs)/index.tsx):*
- Expandable search bar (icon in header → animated full-width input)
- Filter chips: All / Online / Offline / Favorites / Recent / High Activity / Never Seen
- FlatList for contacts (not ScrollView+map)
- FAB (56px circle, green) bottom-right → opens slide-up AddContact bottom sheet
- Quick Actions: horizontal pill scroll (Reports/Keywords/Groups/Compare/Timeline/Upgrade)
- EnhancedContactCard: sparkline bars, favorite star, long-press action sheet
- Stats strip: Tracked / Online Now / Alerts

*6.4 Contact Detail (app/contact/[id].tsx):*
- AnimatedRing (Reanimated pulse) around avatar when contact is online
- Live online timer: setInterval every 1s, displays HH:MM:SS
- Favorite toggle in nav bar header (star icon)
- 4 horizontal-scroll stat cards: Total Time / Sessions / Avg Session / Longest
- Range picker: Today / Week / Month chips
- Sessions timeline: grouped by date (Today/Yesterday/date string), each row with time + DurationChip
- "View in Timeline" button linking to /activity-timeline
- Weekly bar chart: pure RN Views, 3 segments per day (Day/Evening/Night)
- Peak hours heatmap: HeatmapGrid component (24×7)
- Predicted activity section: peak hour + streak from stats
- Notes textarea: 1s debounced auto-save + checkmark Animated badge

*6.8 Notifications (app/(tabs)/notifications.tsx):*
- Filter chips: All / Online / Late Night / Limit Exceeded / Keyword Match / System

*6.11 Settings (app/(tabs)/settings.tsx):*
- Biometric Lock toggle in Privacy & Security section (uses useBiometricLock hook)
- Data & Privacy row added

**Design System (Section 3):**
- All colors in `constants/colors.ts` via `useColors()` hook — never hardcode hex values
- `shadows` export in `constants/colors.ts` with spec values (opacity:0.08, radius:8, elevation:3)
- Typography scale in `constants/typography.ts` (H1 28px Inter_700Bold through Small 11px)
- Spacing scale in `constants/spacing.ts` (4, 8, 12, 16, 20, 24, 32, 40, 48)
- Border radius in `constants/spacing.ts` (radius.sm=8, .md=12, .chip=24, .avatar=40, .full=999)
- `PulsingDot`: Reanimated scale 1→1.4→1, 1200ms total, Easing.inOut, infinite repeat
- `SkeletonLoader`: LinearGradient shimmer (translateX -300→300) — NOT opacity pulse
- Password validation: min 8 chars + at least 1 number + at least 1 letter
- Tabs use Feather icons (spec requirement) with unread badge on Alerts tab
- `useRelativeTime` auto-updates every 60 seconds

### `artifacts/api-server` (`@workspace/api-server`)

Express 5 API server. Runs on PORT env var (set to 8080 in workflow). Routes in `src/routes/`. Auth middleware in `src/middlewares/auth.ts`. Build script externalizes drizzle-orm and pg (available in node_modules), bundles all else.

### `lib/db` (`@workspace/db`)

Database layer using Drizzle ORM with PostgreSQL. Schema in `src/schema/index.ts`. All 16 tables defined.

### `lib/api-spec` (`@workspace/api-spec`)

OpenAPI 3.1 spec (`openapi.yaml`) and Orval config.

Run codegen: `pnpm --filter @workspace/api-spec run codegen`

### `lib/api-zod` (`@workspace/api-zod`)

Generated Zod schemas.

### `lib/api-client-react` (`@workspace/api-client-react`)

Generated React Query hooks.

## Puppeteer-Based WhatsApp Web Tracker

A complete online/offline status tracking system using headless Chromium + WhatsApp Web automation. Runs alongside the existing Baileys-based system.

### Architecture

```
Express Server (port 8080)
├── REST API  /api/tracker/*
├── WebSocket  ws://host:8080/ws?userId=ID
└── Tracking Engine (in-process worker pool)
    ├── BrowserManager     — Chromium instances per user
    ├── SessionManager     — QR code login, cookie persistence
    ├── StatusDetector     — DOM polling for online/offline
    └── TrackingEngine     — per-job AbortController workers
```

### System Chromium
- Installed via Nix: `chromium`
- Detected at runtime via `which chromium`
- Args: `--no-sandbox`, `--disable-dev-shm-usage`, `--disable-gpu`

### New Database Tables
- `tracker_sessions` — browser session per user (cookies, localStorage, QR code)
- `tracker_jobs` — tracked phone numbers per user (status, poll interval)
- `activity_logs` — online/offline events with session duration

### New API Endpoints (all require auth)

**Session Management:**
- `POST /api/tracker/session/start` — start WhatsApp Web session, returns QR or connected status
- `GET /api/tracker/session/status` — get current session status + QR code base64
- `DELETE /api/tracker/session` — disconnect and clear session

**Tracking Jobs:**
- `POST /api/tracker/track` — `{ phoneNumber, label?, pollIntervalSeconds? }` — start tracking
- `DELETE /api/tracker/untrack/:jobId` — stop tracking a number
- `GET /api/tracker/jobs` — list all tracking jobs

**Analytics:**
- `GET /api/tracker/activity/:phoneNumber` — activity log `?limit=100&since=ISO_DATE`
- `GET /api/tracker/stats/:phoneNumber` — 7-day stats summary

**WebSocket:**
- `GET /api/tracker/ws/info` — WebSocket connection info
- Connect: `ws://HOST:8080/ws?userId=ID`
- Events: `{ type: "status_change", jobId, phoneNumber, status, previousStatus, statusText, durationSeconds, timestamp }`

### Anti-Ban Strategy
- Jittered polling intervals (±40% randomization)
- Realistic User-Agent header
- Session cookies/localStorage persisted across restarts
- Auto-reconnect on browser crash

### New Service Files
- `src/lib/chromium.ts` — Chromium binary path detection
- `src/services/tracker/browserManager.ts` — browser lifecycle
- `src/services/tracker/sessionManager.ts` — QR login + session restore
- `src/services/tracker/statusDetector.ts` — DOM-based status polling
- `src/services/tracker/trackingEngine.ts` — job orchestration
- `src/services/websocket/wsServer.ts` — WebSocket server

## Environment Variables

- `DATABASE_URL` — PostgreSQL connection string (auto-provisioned)
- `JWT_SECRET` — JWT signing secret (set in shared env)
- `PORT` — Server port (set per workflow)
