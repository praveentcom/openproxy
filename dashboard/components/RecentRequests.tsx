interface RecentRequestsProps {
  requests: {
    request_id: string;
    timestamp: string;
    model: string;
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
    total_cost: string;
    response_time: number;
    response_status: number;
    client_ip: string;
    stream: boolean;
  }[];
}

export default function RecentRequests({ requests }: RecentRequestsProps) {
  if (!requests || requests.length === 0) {
    return (
      <div style={styles.container}>
        <h2 style={styles.title}>Recent Requests</h2>
        <div style={styles.card}>
          <p style={styles.noData}>No recent requests</p>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <h2 style={styles.title}>Recent Requests</h2>
      <div style={styles.card}>
        <div style={styles.tableWrapper}>
          <table style={styles.table}>
            <thead>
              <tr style={styles.headerRow}>
                <th style={styles.th}>Timestamp</th>
                <th style={styles.th}>Model</th>
                <th style={styles.th}>Tokens</th>
                <th style={styles.th}>Cost</th>
                <th style={styles.th}>Response Time</th>
                <th style={styles.th}>Status</th>
                <th style={styles.th}>Client IP</th>
                <th style={styles.th}>Stream</th>
              </tr>
            </thead>
            <tbody>
              {requests.map((req) => (
                <tr key={req.request_id} style={styles.row}>
                  <td style={styles.td}>
                    {new Date(req.timestamp).toLocaleString()}
                  </td>
                  <td style={styles.td}>
                    <span style={styles.modelBadge}>{req.model}</span>
                  </td>
                  <td style={styles.td}>
                    <div style={styles.tokenBreakdown}>
                      <small style={styles.tokenDetail}>
                        {req.prompt_tokens} + {req.completion_tokens} = {req.total_tokens}
                      </small>
                    </div>
                  </td>
                  <td style={styles.td}>${parseFloat(req.total_cost).toFixed(4)}</td>
                  <td style={styles.td}>{req.response_time}ms</td>
                  <td style={styles.td}>
                    <span
                      style={{
                        ...styles.statusBadge,
                        ...(req.response_status === 200
                          ? styles.statusSuccess
                          : styles.statusError),
                      }}
                    >
                      {req.response_status}
                    </span>
                  </td>
                  <td style={styles.td}>{req.client_ip}</td>
                  <td style={styles.td}>{req.stream ? '✓' : '✗'}</td>
                </tr>
              ))}
            </tbody>
          </table>
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
    overflow: 'hidden',
  },
  tableWrapper: {
    overflowX: 'auto' as const,
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse' as const,
    minWidth: '1000px',
  },
  headerRow: {
    backgroundColor: '#f8f9fa',
  },
  th: {
    padding: '1rem',
    textAlign: 'left' as const,
    fontSize: '0.85rem',
    fontWeight: 600,
    color: '#2c3e50',
    borderBottom: '2px solid #e9ecef',
  },
  row: {
    borderBottom: '1px solid #e9ecef',
  },
  td: {
    padding: '0.75rem 1rem',
    fontSize: '0.85rem',
    color: '#495057',
  },
  modelBadge: {
    backgroundColor: '#e3f2fd',
    color: '#1976d2',
    padding: '0.25rem 0.5rem',
    borderRadius: '4px',
    fontSize: '0.8rem',
    fontWeight: 500,
  },
  tokenBreakdown: {
    display: 'flex',
    flexDirection: 'column' as const,
  },
  tokenDetail: {
    color: '#7f8c8d',
    fontSize: '0.75rem',
  },
  statusBadge: {
    padding: '0.25rem 0.5rem',
    borderRadius: '4px',
    fontSize: '0.8rem',
    fontWeight: 500,
  },
  statusSuccess: {
    backgroundColor: '#d4edda',
    color: '#155724',
  },
  statusError: {
    backgroundColor: '#f8d7da',
    color: '#721c24',
  },
  noData: {
    padding: '2rem',
    textAlign: 'center' as const,
    color: '#7f8c8d',
  },
};
