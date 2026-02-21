# CLAUDE.md

This file provides guidance for AI assistants working with the OpenProxy codebase.

## Project Overview

OpenProxy is a lightweight, production-ready LLM proxy server that forwards API requests to OpenAI and Anthropic-compatible endpoints. It provides comprehensive logging, automatic cost tracking, and PostgreSQL integration. It includes a Next.js metrics dashboard for real-time analytics.

## Repository Structure

```
openproxy/
├── proxy.ts                 # Main proxy server (Node.js http module, ~500 lines)
├── cost.ts                  # Cost calculation engine (Helicone API + custom pricing)
├── dashboard/               # Next.js metrics dashboard (separate workspace package)
│   ├── app/
│   │   ├── api/metrics/
│   │   │   └── route.ts     # Metrics API endpoint (GET /api/metrics)
│   │   ├── layout.tsx       # Root layout
│   │   └── page.tsx         # Main dashboard page (client component)
│   └── components/
│       ├── MetricsOverview.tsx
│       ├── ModelBreakdown.tsx
│       ├── RecentRequests.tsx
│       └── TrendsChart.tsx
├── package.json             # Root workspace package
├── pnpm-workspace.yaml      # Monorepo: root "." + "dashboard"
├── tsconfig.json            # ES2022, CommonJS, strict mode
├── Dockerfile               # node:22-slim, builds TS, runs dist/proxy.js
├── .env.example             # Environment variable template
└── .github/
    └── dependabot.yml       # Weekly dependency updates
```

## Tech Stack

- **Runtime**: Node.js 22
- **Language**: TypeScript (strict mode, ES2022 target, CommonJS module)
- **Package Manager**: pnpm (v10.26.1, monorepo workspace)
- **Proxy Server**: Node.js native `http` module (no Express/Fastify)
- **Dashboard**: Next.js 16, React 18, Recharts 3
- **Database**: PostgreSQL via `pg` library (connection pooling)
- **Key Dependencies**: `dotenv`, `pg`, `uuid`

## Development Commands

```bash
# Install dependencies
pnpm install

# Run proxy server in development (auto-reload via ts-node-dev)
pnpm dev

# Build TypeScript to dist/
pnpm build

# Run compiled proxy server
pnpm start

# Run dashboard in development (port 3008)
cd dashboard && pnpm dev

# Build dashboard
cd dashboard && pnpm build
```

## Environment Variables

Required in `.env` (see `.env.example`):

| Variable | Default | Description |
|---|---|---|
| `PORT` | `3007` | Proxy server port |
| `OPENAI_UPSTREAM_URL` | - | Upstream OpenAI-compatible endpoint |
| `ANTHROPIC_UPSTREAM_URL` | - | Upstream Anthropic-compatible endpoint |
| `DATABASE_URL` | - | PostgreSQL connection string |

The dashboard reads `DATABASE_URL` directly and runs on port 3008.

## Architecture

### Proxy Server (`proxy.ts`)

The proxy is a single-file HTTP server with this request flow:

1. **Route parsing** - Extract provider from URL prefix (`/openai/*` or `/anthropic/*`)
2. **Auth extraction** - Provider-specific: `x-api-key` for Anthropic, `Authorization: Bearer` for OpenAI
3. **Upstream forwarding** - Uses `fetch()` to proxy the request to the configured upstream URL
4. **Response handling** - Supports both streaming (SSE `text/event-stream`) and non-streaming responses
5. **Async logging** - Persists request/response data to PostgreSQL without blocking the response

Key functions:
- `parseRoute()` - Maps request paths to providers
- `getProviderConfig()` - Retrieves upstream URL configuration
- `getAuthToken()` - Extracts auth tokens with provider-specific logic
- `buildUpstreamHeaders()` - Constructs provider-appropriate headers
- `normalizeUsage()` - Normalizes token usage across OpenAI/Anthropic formats
- `persistDatabaseRecord()` - Logs request data to the `llm_proxy` table

### Cost Engine (`cost.ts`)

Calculates per-request costs in USD using token usage data:

1. **Custom costs** (`CUSTOM_MODEL_COSTS`) - Hardcoded overrides, checked first
2. **Helicone costs** - Fetched from Helicone API at startup, matched by operator priority: `equals` > `startsWith` > `includes`
3. **Fallback** - Returns zero cost if no match found

Costs are expressed per 1M tokens. The `calculateCost()` function accounts for cached tokens at reduced rates.

### Dashboard (`dashboard/`)

A standalone Next.js app that queries PostgreSQL directly for metrics:
- Summary statistics, hourly trends, model breakdown, recent requests
- Auto-refresh (30s intervals), time range selection (1h to 7d)
- Server-side API route at `/api/metrics` with parameter validation

## Key Types

```typescript
type Provider = "openai" | "anthropic"

interface NormalizedUsage {
  prompt_tokens: number | null
  completion_tokens: number | null
  total_tokens: number | null
  cached_tokens: number | null
}

type CostConfig = {
  input: number    // USD per 1M prompt tokens
  cached: number   // USD per 1M cached tokens
  output: number   // USD per 1M completion tokens
}
```

## Database Schema

The proxy logs to a `llm_proxy` table with columns including: `timestamp`, `request_method`, `request_path`, `provider`, `model`, token counts (`prompt_tokens`, `completion_tokens`, `total_tokens`, `cached_tokens`), `total_cost`, `response_time`, full `request_body`/`response_body` JSON, `response_status`, `client_ip`, `user_agent`, `request_size`, `response_size`, `stream`, `temperature`, `max_tokens`, and `request_id` (UUID).

## Error Handling Conventions

- **404** - Invalid provider prefix (`INVALID_PROVIDER_PREFIX`)
- **401** - Missing auth token (`MISSING_OR_INVALID_AUTHORIZATION_HEADER`)
- **503** - Upstream URL not configured (`UPSTREAM_URL_NOT_CONFIGURED`)
- **502** - Upstream connection failure or internal error (`UPSTREAM_CONNECTION_FAILED`, `INTERNAL_SERVER_ERROR`)
- Database errors are logged to console but never block the response to the client

## Code Conventions

- **No test framework** - No tests exist yet; no Jest/Vitest configured
- **No linter/formatter** - No ESLint or Prettier configured at the root level
- **Strict TypeScript** - `strict: true` in tsconfig
- **Async/await** throughout; database logging uses fire-and-forget with `.catch()`
- **Console logging** uses ANSI color codes for readability (green for success, yellow for warnings, etc.)
- **Parameterized SQL queries** - All database queries use `$1, $2, ...` placeholders to prevent injection
- **Numeric parsing** uses `Number.parseInt()` / `Number.parseFloat()` / `Number.isNaN()` (not global equivalents)
- **Commit messages** follow conventional commits loosely (`feat:`, `fix:`, `chore:`, `refactor:`)

## Docker

```bash
docker build -t openproxy .
docker run -p 8080:8080 --env-file .env openproxy
```

The Dockerfile builds TypeScript inside the container and runs the compiled `dist/proxy.js`. Default port inside the container is 8080.

## Important Notes

- The proxy passes auth tokens through without validation - it trusts whatever the client provides
- Streaming responses (SSE) are piped chunk-by-chunk to maintain real-time delivery
- The dashboard is a separate workspace package with its own `package.json` and `tsconfig.json`
- No external HTTP framework is used; the proxy is built entirely on `node:http` and `fetch()`
- The `@types/uuid` package is incorrectly listed under `dependencies` instead of `devDependencies` in the root `package.json`
