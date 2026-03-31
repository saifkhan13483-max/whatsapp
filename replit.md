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

### Tech
- Expo Router (file-based routing)
- React Query for server state
- Inter font family
- WhatsApp-inspired dark green color palette
- `useColors()` hook for all theming
- Liquid glass tab bars on iOS 26+, BlurView fallback on older iOS/Android
- AsyncStorage for persistence
- Expo Haptics for feedback

### Design Tokens (constants/colors.ts)
- Primary: #25D366 (WhatsApp green)
- Dark: #128C7E / Darkest: #075E54
- Blue accent: #34B7F1, Purple: #7C4DFF
- Dark background: #0b141a, Dark surface: #111b21

## TypeScript & Composite Projects

Every package extends `tsconfig.base.json` which sets `composite: true`.

## Root Scripts

- `pnpm run build` — typecheck + build all packages
- `pnpm run typecheck` — runs `tsc --build --emitDeclarationOnly`

## Packages

### `artifacts/mobile` (`@workspace/mobile`)

Expo mobile app. Entry: `app/_layout.tsx`. Providers: SafeAreaProvider, QueryClientProvider, ThemeProvider, AuthProvider.

### `artifacts/api-server` (`@workspace/api-server`)

Express 5 API server on port 8080. Routes in `src/routes/`.

### `lib/db` (`@workspace/db`)

Database layer using Drizzle ORM with PostgreSQL.

### `lib/api-spec` (`@workspace/api-spec`)

OpenAPI 3.1 spec (`openapi.yaml`) and Orval config.

Run codegen: `pnpm --filter @workspace/api-spec run codegen`

### `lib/api-zod` (`@workspace/api-zod`)

Generated Zod schemas.

### `lib/api-client-react` (`@workspace/api-client-react`)

Generated React Query hooks.
