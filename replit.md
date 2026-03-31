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

### Features
- **Dashboard**: Live stats, online contacts, quick actions
- **Chat Tracker**: Browse tracked conversations
- **View Once Recovery**: Recover disappeared media
- **Notifications/Alerts**: Filterable push notifications with badge counts
- **Settings**: Theme, notification preferences, account management
- **Contact Detail**: Per-contact stats, hourly activity charts, session data
- **Family Dashboard**: Aggregated family monitoring overview
- **Reports**: Full activity reports with charts, range filters
- **Subscription**: Plan management UI
- **Keyword Alerts**: Add/manage keywords for content monitoring
- **Contact Groups**: Organize contacts into groups
- **Geofence Zones**: Location-based monitoring zones
- **Activity Timeline**: Full day timeline for all contacts
- **Contact Comparison**: Side-by-side contact activity comparison

### Tech
- Expo Router (file-based routing)
- React Query for server state
- Inter font family (@expo-google-fonts/inter)
- WhatsApp-inspired dark green color palette
- `useColors()` hook for all theming (never hardcode hex values)
- Liquid glass tab bars on iOS 26+, BlurView fallback on older iOS/Android
- AsyncStorage for persistence (theme, onboarding, biometric lock, favorites, DND)
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

## Metro Bundler Configuration

The `artifacts/mobile/metro.config.js` explicitly sets `projectRoot = __dirname` and `watchFolders = [workspaceRoot]` with `nodeModulesPaths` pointing to both the mobile app's and the workspace root's `node_modules`. This ensures Metro resolves modules from the correct root in the pnpm monorepo context and avoids the blank-screen "Unable to resolve ./index from workspace root" error.

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
- Authenticated but onboarding not done (StorageKeys.ONBOARDING_DONE ≠ "true") → redirect to `/onboarding`
- Biometric lock enabled + not passed → overlay BiometricGate over Stack
- Otherwise → render Stack normally

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

## Environment Variables

- `DATABASE_URL` — PostgreSQL connection string (auto-provisioned)
- `JWT_SECRET` — JWT signing secret (set in shared env)
- `PORT` — Server port (set per workflow)
