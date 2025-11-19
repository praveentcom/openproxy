'use client';

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

interface TrendsChartProps {
  trends: {
    hour: string;
    requests: string;
    tokens: string;
    cost: string;
    avg_response_time: string;
  }[];
}

export default function TrendsChart({ trends }: TrendsChartProps) {
  if (!trends || trends.length === 0) {
    return (
      <div style={styles.container}>
        <h2 style={styles.title}>Hourly Trends</h2>
        <div style={styles.card}>
          <p style={styles.noData}>No trend data available</p>
        </div>
      </div>
    );
  }

  const chartData = trends.map((trend) => ({
    time: new Date(trend.hour).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
    }),
    requests: parseInt(trend.requests),
    tokens: parseInt(trend.tokens),
    cost: parseFloat(trend.cost),
    responseTime: Math.round(parseFloat(trend.avg_response_time)),
  }));

  return (
    <div style={styles.container}>
      <h2 style={styles.title}>Hourly Trends</h2>
      <div style={styles.card}>
        <div style={styles.chartContainer}>
          <h3 style={styles.chartTitle}>Requests & Response Time</h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
              <XAxis dataKey="time" stroke="#7f8c8d" fontSize={12} />
              <YAxis yAxisId="left" stroke="#3498db" fontSize={12} />
              <YAxis yAxisId="right" orientation="right" stroke="#e74c3c" fontSize={12} />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#fff',
                  border: '1px solid #ddd',
                  borderRadius: '4px',
                }}
              />
              <Legend />
              <Line
                yAxisId="left"
                type="monotone"
                dataKey="requests"
                stroke="#3498db"
                strokeWidth={2}
                name="Requests"
                dot={{ r: 3 }}
              />
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="responseTime"
                stroke="#e74c3c"
                strokeWidth={2}
                name="Avg Response Time (ms)"
                dot={{ r: 3 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div style={styles.chartContainer}>
          <h3 style={styles.chartTitle}>Tokens & Cost</h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
              <XAxis dataKey="time" stroke="#7f8c8d" fontSize={12} />
              <YAxis yAxisId="left" stroke="#9b59b6" fontSize={12} />
              <YAxis yAxisId="right" orientation="right" stroke="#27ae60" fontSize={12} />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#fff',
                  border: '1px solid #ddd',
                  borderRadius: '4px',
                }}
              />
              <Legend />
              <Line
                yAxisId="left"
                type="monotone"
                dataKey="tokens"
                stroke="#9b59b6"
                strokeWidth={2}
                name="Tokens"
                dot={{ r: 3 }}
              />
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="cost"
                stroke="#27ae60"
                strokeWidth={2}
                name="Cost ($)"
                dot={{ r: 3 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

const styles = {
  container: {
    marginBottom: '2rem',
  },
  title: {
    fontSize: '1.5rem',
    marginBottom: '1.5rem',
    color: '#2c3e50',
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: '8px',
    boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
    padding: '1.5rem',
  },
  chartContainer: {
    marginBottom: '2rem',
  },
  chartTitle: {
    fontSize: '1.1rem',
    marginBottom: '1rem',
    color: '#2c3e50',
  },
  noData: {
    padding: '2rem',
    textAlign: 'center' as const,
    color: '#7f8c8d',
  },
};
