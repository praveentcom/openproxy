import { NextRequest, NextResponse } from 'next/server';
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const TABLE_NAME = process.env.DATABASE_TABLE || 'llm_proxy';

// Validate table name against whitelist to prevent SQL injection
const ALLOWED_TABLES = ['llm_proxy', 'llm_proxy_dev', 'llm_proxy_test'];
const validatedTableName = ALLOWED_TABLES.includes(TABLE_NAME) ? TABLE_NAME : 'llm_proxy';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const hours = parseInt(searchParams.get('hours') || '24', 10);
  const limit = parseInt(searchParams.get('limit') || '100', 10);

  try {
    const client = await pool.connect();

    try {
      // Get summary statistics
      const summaryQuery = `
        SELECT
          COUNT(*) as total_requests,
          SUM(total_tokens) as total_tokens_used,
          SUM(total_cost) as total_cost,
          AVG(response_time) as avg_response_time,
          COUNT(DISTINCT model) as unique_models,
          COUNT(DISTINCT client_ip) as unique_clients
        FROM ${validatedTableName}
        WHERE timestamp >= NOW() - INTERVAL '$1 hours'
      `;
      const summaryResult = await client.query(summaryQuery, [hours]);
      const summary = summaryResult.rows[0];

      // Get recent requests
      const recentQuery = `
        SELECT
          request_id,
          timestamp,
          model,
          prompt_tokens,
          completion_tokens,
          total_tokens,
          total_cost,
          response_time,
          response_status,
          client_ip,
          stream
        FROM ${validatedTableName}
        WHERE timestamp >= NOW() - INTERVAL '$1 hours'
        ORDER BY timestamp DESC
        LIMIT $2
      `;
      const recentResult = await client.query(recentQuery, [hours, limit]);
      const recentRequests = recentResult.rows;

      // Get model breakdown
      const modelQuery = `
        SELECT
          model,
          COUNT(*) as request_count,
          SUM(total_tokens) as total_tokens,
          SUM(total_cost) as total_cost,
          AVG(response_time) as avg_response_time
        FROM ${validatedTableName}
        WHERE timestamp >= NOW() - INTERVAL '$1 hours'
        GROUP BY model
        ORDER BY request_count DESC
      `;
      const modelResult = await client.query(modelQuery, [hours]);
      const modelBreakdown = modelResult.rows;

      // Get hourly trends
      const trendsQuery = `
        SELECT
          DATE_TRUNC('hour', timestamp) as hour,
          COUNT(*) as requests,
          SUM(total_tokens) as tokens,
          SUM(total_cost) as cost,
          AVG(response_time) as avg_response_time
        FROM ${validatedTableName}
        WHERE timestamp >= NOW() - INTERVAL '$1 hours'
        GROUP BY hour
        ORDER BY hour ASC
      `;
      const trendsResult = await client.query(trendsQuery, [hours]);
      const hourlyTrends = trendsResult.rows;

      return NextResponse.json({
        success: true,
        data: {
          summary: {
            totalRequests: parseInt(summary.total_requests || '0'),
            totalTokens: parseInt(summary.total_tokens_used || '0'),
            totalCost: parseFloat(summary.total_cost || '0'),
            avgResponseTime: parseFloat(summary.avg_response_time || '0'),
            uniqueModels: parseInt(summary.unique_models || '0'),
            uniqueClients: parseInt(summary.unique_clients || '0'),
          },
          recentRequests,
          modelBreakdown,
          hourlyTrends,
        },
        timeRange: `${hours} hours`,
      });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Database error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch metrics',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
