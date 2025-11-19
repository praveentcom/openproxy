interface MetricsOverviewProps {
  summary: {
    totalRequests: number;
    totalTokens: number;
    totalCost: number;
    avgResponseTime: number;
    uniqueModels: number;
    uniqueClients: number;
  };
}

export default function MetricsOverview({ summary }: MetricsOverviewProps) {
  const metrics = [
    {
      label: 'Total Requests',
      value: summary.totalRequests.toLocaleString(),
      icon: '📊',
    },
    {
      label: 'Total Tokens',
      value: summary.totalTokens.toLocaleString(),
      icon: '🔢',
    },
    {
      label: 'Total Cost',
      value: `$${summary.totalCost.toFixed(4)}`,
      icon: '💰',
    },
    {
      label: 'Avg Response Time',
      value: `${Math.round(summary.avgResponseTime)}ms`,
      icon: '⚡',
    },
    {
      label: 'Unique Models',
      value: summary.uniqueModels.toString(),
      icon: '🤖',
    },
    {
      label: 'Unique Clients',
      value: summary.uniqueClients.toString(),
      icon: '👥',
    },
  ];

  return (
    <div style={styles.container}>
      <h2 style={styles.title}>Overview</h2>
      <div style={styles.grid}>
        {metrics.map((metric) => (
          <div key={metric.label} style={styles.card}>
            <div style={styles.icon}>{metric.icon}</div>
            <div style={styles.content}>
              <div style={styles.label}>{metric.label}</div>
              <div style={styles.value}>{metric.value}</div>
            </div>
          </div>
        ))}
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
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
    gap: '1rem',
  },
  card: {
    backgroundColor: '#fff',
    padding: '1.5rem',
    borderRadius: '8px',
    boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
    display: 'flex',
    gap: '1rem',
    alignItems: 'center',
  },
  icon: {
    fontSize: '2rem',
  },
  content: {
    flex: 1,
  },
  label: {
    fontSize: '0.9rem',
    color: '#7f8c8d',
    marginBottom: '0.25rem',
  },
  value: {
    fontSize: '1.5rem',
    fontWeight: 600,
    color: '#2c3e50',
  },
};
