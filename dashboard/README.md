# OpenProxy Metrics Dashboard

A lightweight Next.js dashboard for visualizing OpenProxy LLM request metrics in real-time.

## Features

- **Real-time Metrics Overview**: Total requests, tokens, costs, and response times
- **Model Breakdown**: Usage statistics grouped by LLM model
- **Hourly Trends**: Visual charts showing request patterns over time
- **Recent Requests**: Detailed table of recent API calls
- **Auto-refresh**: Automatic updates every 30 seconds
- **Time Range Selection**: View metrics for the last hour, 6 hours, 24 hours, or 7 days

## Prerequisites

- Node.js 18 or higher
- PostgreSQL database (same as the proxy server)
- OpenProxy proxy server running

## Installation

1. Navigate to the dashboard directory:
   ```bash
   cd dashboard
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Create a `.env` file (copy from `.env.example`):
   ```bash
   cp .env.example .env
   ```

4. Configure your `.env` file:
   ```env
   DATABASE_URL=postgresql://user:password@localhost:5432/database
   DATABASE_TABLE=llm_proxy
   ```

## Running the Dashboard

### Development Mode

```bash
npm run dev
```

The dashboard will be available at `http://localhost:3008`

### Production Mode

1. Build the application:
   ```bash
   npm run build
   ```

2. Start the production server:
   ```bash
   npm start
   ```

## Dashboard Sections

### 1. Overview Cards
Displays key metrics at a glance:
- Total requests processed
- Total tokens consumed
- Total cost incurred
- Average response time
- Number of unique models used
- Number of unique client IPs

### 2. Hourly Trends
Two charts showing:
- Requests count and average response time over time
- Token usage and costs over time

### 3. Model Breakdown
Table showing per-model statistics:
- Request count
- Total tokens used
- Total cost
- Average response time

### 4. Recent Requests
Detailed table of recent API calls showing:
- Timestamp
- Model used
- Token breakdown (prompt + completion = total)
- Cost
- Response time
- HTTP status code
- Client IP address
- Whether the request was streamed

## Configuration

### Port
The dashboard runs on port 3008 by default. To change this, modify the `dev` and `start` scripts in `package.json`:

```json
"dev": "next dev -p YOUR_PORT",
"start": "next start -p YOUR_PORT"
```

### Database Connection
Ensure the `DATABASE_URL` in your `.env` file matches the PostgreSQL connection string used by the proxy server.

### Time Ranges
Available time ranges:
- Last Hour (1 hour)
- Last 6 Hours
- Last 24 Hours (default)
- Last 7 Days (168 hours)

## Troubleshooting

### "Failed to fetch metrics" Error
- Verify that the `DATABASE_URL` in `.env` is correct
- Ensure PostgreSQL is running and accessible
- Check that the `llm_proxy` table exists in your database
- Verify network connectivity to the database

### Empty Dashboard
- Ensure the proxy server is running and processing requests
- Verify that requests are being logged to the database
- Check that the `DATABASE_TABLE` name matches your configuration

### Port Conflicts
If port 3008 is already in use, change the port in `package.json` scripts.

## Technology Stack

- **Framework**: Next.js 14 (React 18)
- **Charts**: Recharts
- **Database**: PostgreSQL (via `pg` driver)
- **Language**: TypeScript
- **Styling**: Inline CSS (no external dependencies)

## Architecture

```
dashboard/
├── app/
│   ├── api/
│   │   └── metrics/
│   │       └── route.ts       # API endpoint for fetching metrics
│   ├── layout.tsx             # Root layout
│   └── page.tsx               # Main dashboard page
├── components/
│   ├── MetricsOverview.tsx    # Overview cards component
│   ├── ModelBreakdown.tsx     # Model statistics table
│   ├── RecentRequests.tsx     # Recent requests table
│   └── TrendsChart.tsx        # Hourly trends charts
├── package.json
├── tsconfig.json
├── next.config.js
└── README.md
```

## API Endpoints

### GET `/api/metrics`

Query parameters:
- `hours` (optional): Number of hours to look back (default: 24)
- `limit` (optional): Maximum number of recent requests to return (default: 100)

Response:
```json
{
  "success": true,
  "data": {
    "summary": {
      "totalRequests": 1234,
      "totalTokens": 567890,
      "totalCost": 12.34,
      "avgResponseTime": 450.5,
      "uniqueModels": 3,
      "uniqueClients": 15
    },
    "recentRequests": [...],
    "modelBreakdown": [...],
    "hourlyTrends": [...]
  },
  "timeRange": "24 hours"
}
```

## License

Same as OpenProxy parent project.
