interface ModelBreakdownProps {
  models: {
    model: string;
    request_count: string;
    total_tokens: string;
    total_cost: string;
    avg_response_time: string;
  }[];
}

export default function ModelBreakdown({ models }: ModelBreakdownProps) {
  if (!models || models.length === 0) {
    return (
      <div style={styles.container}>
        <h2 style={styles.title}>Model Breakdown</h2>
        <div style={styles.card}>
          <p style={styles.noData}>No model data available</p>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <h2 style={styles.title}>Model Breakdown</h2>
      <div style={styles.card}>
        <table style={styles.table}>
          <thead>
            <tr style={styles.headerRow}>
              <th style={styles.th}>Model</th>
              <th style={styles.th}>Requests</th>
              <th style={styles.th}>Total Tokens</th>
              <th style={styles.th}>Total Cost</th>
              <th style={styles.th}>Avg Response Time</th>
            </tr>
          </thead>
          <tbody>
            {models.map((model) => (
              <tr key={model.model} style={styles.row}>
                <td style={styles.td}>
                  <strong>{model.model}</strong>
                </td>
                <td style={styles.td}>{Number.parseInt(model.request_count).toLocaleString()}</td>
                <td style={styles.td}>{Number.parseInt(model.total_tokens).toLocaleString()}</td>
                <td style={styles.td}>${Number.parseFloat(model.total_cost).toFixed(4)}</td>
                <td style={styles.td}>{Math.round(Number.parseFloat(model.avg_response_time))}ms</td>
              </tr>
            ))}
          </tbody>
        </table>
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
    overflow: 'hidden',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse' as const,
  },
  headerRow: {
    backgroundColor: '#f8f9fa',
  },
  th: {
    padding: '1rem',
    textAlign: 'left' as const,
    fontSize: '0.9rem',
    fontWeight: 600,
    color: '#2c3e50',
    borderBottom: '2px solid #e9ecef',
  },
  row: {
    borderBottom: '1px solid #e9ecef',
  },
  td: {
    padding: '1rem',
    fontSize: '0.9rem',
    color: '#495057',
  },
  noData: {
    padding: '2rem',
    textAlign: 'center' as const,
    color: '#7f8c8d',
  },
};
