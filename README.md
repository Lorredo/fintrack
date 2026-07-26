# Finance Tracker

A production-grade Personal Finance and Budget Tracker built with:

- React Native (Expo)
- Go Fiber
- PostgreSQL
- Redis
- TypeScript

## Architecture

Monorepo

## Status

🚧 Under Development

| Phase | Area | Status |
|---|---|---|
| **1** | **Project Setup** | 🟡 Partial |
| | Git | ✅ |
| | React Native (Expo) | ✅ |
| | Backend (Go Fiber) | ✅ |
| | PostgreSQL Schema | ✅ |
| | Docker | ✅ |
| **2** | **Authentication** | ✅ Complete |
| | Login & Register screens | ✅ |
| | JWT access + refresh tokens | ✅ |
| | API endpoints | ✅ |
| **3** | **Application Foundation** | ✅ Complete |
| | Design System (Button, Input, Card, etc.) | ✅ |
| | Theme System (colors, spacing, typography) | ✅ |
| | Form Components (TextField, PasswordField, Checkbox) | ✅ |
| | React Query Infrastructure (useApiQuery, useApiMutation) | ✅ |
| | API Error Handling (parseApiError, ErrorBoundary, useApiErrorHandler) | ✅ |
| | Loading Components (FullScreenLoader, Skeleton, Loader) | ✅ |
| | Toast / Snackbar | ✅ |
| | Empty & Error States (EmptyState, ErrorState) | ✅ |
| | Navigation Helpers (Routes, useAppNavigation) | ✅ |
| | Feature Template | ✅ |
| **4** | **Transactions** | ✅ Complete |
| | Backend CRUD (List, Get, Create, Update, Delete) | ✅ |
| | Paginated list with filters (type, category, date range) | ✅ |
| | Mobile list screen with summary cards | ✅ |
| | Add/Edit form with type toggle, category chips, amount, date | ✅ |
| | Delete with confirmation dialog | ✅ |
| | React Query hooks with cache invalidation | ✅ |
| **5** | **Dashboard** | ❌ Not Started |
| | Current Balance, Income, Expense, Charts | |
| **6** | **Budgets** | ❌ Not Started |
| **7** | **Reports** | ❌ Not Started |
| **8** | **Settings** | ❌ Not Started |
| **9** | **Production** | ❌ Not Started |

## Suggested Next Steps

If you'd like to proceed, here's what I recommend tackling:

1. ~~__Fix the mocked login__ and User.id type mismatch (quick wins)~~ ✅
2. ~~__Implement Transactions CRUD__ (backend + frontend)~~ ✅
3. __Build Dashboard__ - Summary cards (balance, income, expense), charts
4. __Implement Budgets__ - Set monthly budgets by category, track spending progress
5. __Implement Reports__ - Monthly trends, category breakdowns, export
6. __Add a migration runner__ to the Go backend
7. __Production readiness__ - Error monitoring, CI/CD, deployment

## Quick Start

### Prerequisites
- Go 1.25+
- Node.js 20+
- Docker & Docker Compose

### Backend

```bash
# Start PostgreSQL + API
docker compose up -d

# Or run API locally (requires PostgreSQL)
cd apps/api
cp .env.example .env
go run ./cmd/api
```

### Mobile

```bash
cd apps/mobile
npm install
npx expo start
```

## Project Structure

```
finance-tracker/
├── apps/
│   ├── api/                    # Go Fiber backend
│   │   ├── cmd/api/main.go     # Entry point
│   │   └── internal/
│   │       ├── config/         # Environment config
│   │       ├── database/       # DB connection & migrations
│   │       ├── handlers/       # Request handlers (auth, transactions)
│   │       ├── middleware/     # Auth middleware
│   │       ├── models/         # Data models & DTOs
│   │       └── routes/         # Route definitions
│   └── mobile/                 # React Native (Expo) frontend
│       ├── app/                # Expo Router pages
│       └── src/
│           ├── components/ui/  # Design system components
│           ├── features/       # Feature modules (auth, transactions)
│           ├── hooks/          # Shared React Query hooks
│           ├── lib/            # API client, storage, query client
│           ├── providers/      # App providers
│           ├── shared/         # Shared constants, utils, navigation
│           └── theme/          # Colors, spacing, typography
├── database/
│   └── migrations/             # SQL migration files
├── docker-compose.yml
└── README.md
```

## API Endpoints

### Authentication
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/v1/auth/register` | No | Register new user |
| POST | `/api/v1/auth/login` | No | Login |
| POST | `/api/v1/auth/refresh` | No | Refresh access token |
| POST | `/api/v1/auth/logout` | Yes | Logout |
| GET | `/api/v1/auth/me` | Yes | Get current user |

### Transactions
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/v1/transactions` | Yes | List (paginated, filterable) |
| GET | `/api/v1/transactions/:id` | Yes | Get single |
| POST | `/api/v1/transactions` | Yes | Create |
| PUT | `/api/v1/transactions/:id` | Yes | Update |
| DELETE | `/api/v1/transactions/:id` | Yes | Delete |

### Health
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/v1/health` | No | Health check |