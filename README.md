# OpenProxy: Proxy for OpenAI/Anthropic-compatible APIs

OpenProxy is a lightweight LLM proxy server that seamlessly forwards API requests to OpenAI and Anthropic compatible endpoints with comprehensive logging, cost tracking, and PostgreSQL integration.

<img width="2400" height="1260" alt="openproxy_cover-image" src="https://github.com/user-attachments/assets/c98db1b5-2685-4309-a809-0f98a9a9d432" />

## How to configure?

You should be able to get OpenProxy running with minimal configuration. Follow the steps to get started.

```bash
pnpm install
```

#### Set your environment variables

```bash
export PORT=3007
export OPENAI_UPSTREAM_URL="https://api.example.com/v1"
export ANTHROPIC_UPSTREAM_URL="https://api.example.com/api/anthropic/v1"
export DATABASE_URL="postgresql://user:password@localhost:5432/database_name"
```

#### Start the server

```bash
# Development mode with auto-reload
pnpm dev

# Production build
pnpm build && pnpm start
```

## Log to PostgreSQL

Every request is logged with comprehensive details to the PostgreSQL database. The table schema is as follows:

```sql
CREATE TABLE IF NOT EXISTS llm_proxy (
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  request_method VARCHAR(10) NOT NULL,
  request_path VARCHAR(255) NOT NULL,
  provider TEXT,
  model VARCHAR(50) NOT NULL,
  completion_tokens INTEGER,
  prompt_tokens INTEGER,
  total_tokens INTEGER,
  cached_tokens INTEGER,
  total_cost NUMERIC,
  response_time INTEGER,
  request_body JSONB,
  response_body JSONB,
  response_status INTEGER,
  provider_url VARCHAR(500),
  client_ip INET,
  user_agent TEXT,
  request_size INTEGER,
  response_size INTEGER,
  stream BOOLEAN,
  temperature REAL,
  max_tokens INTEGER,
  request_id UUID
);
```

### Cost Calculation

OpenProxy automatically calculates costs based on model and token usage using the Helicone API. You can customize the costs for your own models in `cost.ts`.

## SSRF Warning [Important]

Some clients (e.g. Cursor) may block access to `localhost` or `127.0.0.1` URLs. If you encounter this issue, you can use an external proxy service like `ngrok` to open up your `localhost:3007` port to a public domain. This will enable you to use OpenProxy with such services.

## Using with Claude Code

For example, to use Z.AI or other Anthropic-compatible providers with Claude Code:

```bash
export ANTHROPIC_UPSTREAM_URL="https://api.z.ai/api/anthropic"
export DATABASE_URL="postgresql://user:password@localhost:5432/database_name"
pnpm dev
```

Configure Claude Code to use the following URL: `http://localhost:3007/anthropic`

## Using with Cursor

For example, to use Z.AI or other Anthropic-compatible providers with Cursor:

```bash
export ANTHROPIC_UPSTREAM_URL="https://api.z.ai/api/anthropic"
export DATABASE_URL="postgresql://user:password@localhost:5432/database_name"
pnpm dev
```

> Cursor blocks access to `localhost` or `127.0.0.1` URLs by default. You can use an external proxy service like `ngrok` to open up your `localhost:3007` port to a public domain. Refer to the [SSRF Warning](#ssrf-warning-important) for more details.

Configure Cursor to use the following URLs:

1. OpenAI API requests: `http://public-domain.ngrok-free.app/openai`
2. Anthropic API requests: `http://public-domain.ngrok-free.app/anthropic`

## Using with other OpenAI-compatible clients

For example, to use Z.AI or other OpenAI-compatible providers with OpenAI-compatible clients:

```bash
export OPENAI_UPSTREAM_URL="https://api.z.ai/api/coding/paas/v4"
export DATABASE_URL="postgresql://user:password@localhost:5432/database_name"
pnpm dev

# Configure your client to use:
# API Base URL: http://localhost:3007/openai
```

## Metrics Dashboard

OpenProxy includes a lightweight Next.js dashboard for real-time metrics visualization. The dashboard is accessible at `http://localhost:3008`. To run the dashboard, run the following command:

```bash
pnpm --filter dashboard dev
```

## Final notes

Get started today and for assistance, you can reach me on [GitHub](https://github.com/praveentcom/openproxy) or [X](https://x.com/praveentcom). PRs are always welcome if you'd like to add features or fix bugs!

This project is open source and available under the [MIT License](./LICENSE).
