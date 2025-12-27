'use client';

import { useEffect, useState } from 'react';
import MetricsOverview from '@/components/MetricsOverview';
import ModelBreakdown from '@/components/ModelBreakdown';
import RecentRequests from '@/components/RecentRequests';
import TrendsChart from '@/components/TrendsChart';

interface MetricsData {
  summary: {
    totalRequests: number;
    totalTokens: number;
    totalCost: number;
    avgResponseTime: number;
    uniqueModels: number;
    uniqueClients: number;
  };
  recentRequests: any[];
  modelBreakdown: any[];
  hourlyTrends: any[];
}

export default function Dashboard() {
  const [data, setData] = useState<MetricsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [timeRange, setTimeRange] = useState(24);
  const [autoRefresh, setAutoRefresh] = useState(true);

  const fetchMetrics = async () => {
    try {
      const response = await fetch(`/api/metrics?hours=${timeRange}`);
      const result = await response.json();

      if (result.success) {
        setData(result.data);
        setError(null);
      } else {
        setError(result.error || 'Failed to fetch metrics');
      }
    } catch (err) {
      setError('Network error: Unable to fetch metrics');
      console.error('Fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMetrics();
  }, [timeRange]);

  useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(() => {
      fetchMetrics();
    }, 30000); // Refresh every 30 seconds

    return () => clearInterval(interval);
  }, [autoRefresh, timeRange]);

  if (loading) {
    return (
      <div style={styles.container}>
        <div style={styles.loading}>Loading metrics...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={styles.container}>
        <div style={styles.error}>
          <h2>Error</h2>
          <p>{error}</p>
          <button onClick={fetchMetrics} style={styles.retryButton}>
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div style={styles.container}>
        <div style={styles.error}>No data available</div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <h1 style={styles.title}>OpenProxy Metrics Dashboard</h1>
        <div style={styles.controls}>
          <select
            value={timeRange}
            onChange={(e) => setTimeRange(Number.parseInt(e.target.value))}
            style={styles.select}
          >
            <option value={1}>Last Hour</option>
            <option value={6}>Last 6 Hours</option>
            <option value={24}>Last 24 Hours</option>
            <option value={168}>Last 7 Days</option>
          </select>
          <label style={styles.checkboxLabel}>
            <input type="checkbox" checked={autoRefresh} onChange={(e) => setAutoRefresh(e.target.checked)} />
            Auto-refresh (30s)
          </label>
          <button onClick={fetchMetrics} style={styles.refreshButton}>
            Refresh
          </button>
        </div>
      </header>

      <main style={styles.main}>
        <MetricsOverview summary={data.summary} />
        <TrendsChart trends={data.hourlyTrends} />
        <ModelBreakdown models={data.modelBreakdown} />
        <RecentRequests requests={data.recentRequests} />
      </main>

      <footer style={styles.footer}>
        <p>Last updated: {new Date().toLocaleString()}</p>
      </footer>
    </div>
  );
}

const styles = {
  container: {
    minHeight: '100vh',
    backgroundColor: '#f5f7fa',
  },
  header: {
    backgroundColor: '#fff',
    padding: '1.5rem 2rem',
    boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap' as const,
    gap: '1rem',
  },
  title: {
    fontSize: '1.8rem',
    color: '#2c3e50',
    fontWeight: 600,
  },
  controls: {
    display: 'flex',
    gap: '1rem',
    alignItems: 'center',
  },
  select: {
    padding: '0.5rem 1rem',
    borderRadius: '6px',
    border: '1px solid #ddd',
    fontSize: '0.9rem',
    cursor: 'pointer',
  },
  checkboxLabel: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    fontSize: '0.9rem',
  },
  refreshButton: {
    padding: '0.5rem 1.5rem',
    backgroundColor: '#3498db',
    color: '#fff',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '0.9rem',
    fontWeight: 500,
  },
  main: {
    maxWidth: '1400px',
    margin: '0 auto',
    padding: '2rem',
  },
  loading: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    height: '100vh',
    fontSize: '1.2rem',
    color: '#7f8c8d',
  },
  error: {
    display: 'flex',
    flexDirection: 'column' as const,
    justifyContent: 'center',
    alignItems: 'center',
    height: '100vh',
    gap: '1rem',
    color: '#e74c3c',
  },
  retryButton: {
    padding: '0.5rem 1.5rem',
    backgroundColor: '#e74c3c',
    color: '#fff',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '0.9rem',
  },
  footer: {
    textAlign: 'center' as const,
    padding: '2rem',
    color: '#7f8c8d',
    fontSize: '0.9rem',
  },
};
