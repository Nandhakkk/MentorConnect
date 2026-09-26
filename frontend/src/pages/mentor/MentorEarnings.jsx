import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { fetchMentorEarnings } from '../../services/financeService';

export default function MentorEarnings() {
  const { user, token } = useAuth();
  const [summary, setSummary] = useState(null);
  const [payouts, setPayouts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const loadEarnings = async () => {
      try {
        setLoading(true);
        const data = await fetchMentorEarnings(token);
        setSummary(data.summary);
        setPayouts(data.payouts);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    loadEarnings();
  }, [token]);

  const getStatusBadge = (status) => {
    const styles = {
      ELIGIBLE: { bg: 'rgba(59, 130, 246, 0.15)', color: '#3b82f6', border: '1px solid rgba(59, 130, 246, 0.3)' },
      PROCESSING: { bg: 'rgba(245, 158, 11, 0.15)', color: '#f59e0b', border: '1px solid rgba(245, 158, 11, 0.3)' },
      PAID: { bg: 'rgba(16, 185, 129, 0.15)', color: '#10b981', border: '1px solid rgba(16, 185, 129, 0.3)' },
      FAILED: { bg: 'rgba(239, 68, 68, 0.15)', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.3)' },
      CANCELLED: { bg: 'rgba(107, 114, 128, 0.15)', color: '#9ca3af', border: '1px solid rgba(107, 114, 128, 0.3)' }
    };
    const style = styles[status] || { bg: 'transparent', color: 'white', border: 'none' };
    return (
      <span style={{ fontSize: '0.75rem', padding: '0.25rem 0.75rem', borderRadius: '16px', fontWeight: 600, background: style.bg, color: style.color, border: style.border }}>
        {status}
      </span>
    );
  };

  if (loading) return <div className="page-content">Loading earnings...</div>;

  return (
    <div className="page-content">
      <div className="page-header">
        <div>
          <h2 className="page-title">My Earnings</h2>
          <p className="page-subtitle">Track your platform income, completed sessions, and payouts.</p>
        </div>
      </div>

      {error && <div style={{ color: '#ef4444', marginBottom: '1rem' }}>{error}</div>}

      {summary && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
          <div className="glass-card" style={{ padding: '1.5rem', textAlign: 'center', borderTop: '4px solid #10b981' }}>
            <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total Net Earned</div>
            <div style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--text-primary)' }}>₹{summary.totalNet}</div>
          </div>
          <div className="glass-card" style={{ padding: '1.5rem', textAlign: 'center', borderTop: '4px solid #3b82f6' }}>
            <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Eligible (Next Payout)</div>
            <div style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--text-primary)' }}>₹{summary.eligible}</div>
          </div>
          <div className="glass-card" style={{ padding: '1.5rem', textAlign: 'center', borderTop: '4px solid #f59e0b' }}>
            <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Processing</div>
            <div style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--text-primary)' }}>₹{summary.processing}</div>
          </div>
          <div className="glass-card" style={{ padding: '1.5rem', textAlign: 'center', borderTop: '4px solid #10b981' }}>
            <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Paid Out</div>
            <div style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--text-primary)' }}>₹{summary.paid}</div>
          </div>
        </div>
      )}

      <h3 style={{ marginBottom: '1rem', color: 'var(--text-primary)' }}>Payout History</h3>
      {payouts.length === 0 ? (
        <div className="glass-card" style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
          No earnings yet. Complete a session to see your payouts here.
        </div>
      ) : (
        <div className="table-responsive glass-card" style={{ padding: '1px' }}>
          <table className="admin-table">
            <thead>
              <tr>
                <th>Date / Session</th>
                <th>Gross</th>
                <th>Platform Fee</th>
                <th>Net Earnings</th>
                <th>Status</th>
                <th>Reference</th>
              </tr>
            </thead>
            <tbody>
              {payouts.map(payout => (
                <tr key={payout.id}>
                  <td>
                    <div style={{ fontWeight: 500, color: 'var(--text-primary)' }}>
                      {new Date(payout.payment?.session?.scheduledAt || payout.createdAt).toLocaleDateString()}
                    </div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                      {payout.payment?.session?.topic || 'Session'}
                    </div>
                  </td>
                  <td>₹{payout.grossAmount}</td>
                  <td style={{ color: '#ef4444' }}>-₹{payout.platformFee}</td>
                  <td style={{ color: '#10b981', fontWeight: 600 }}>₹{payout.netAmount}</td>
                  <td>{getStatusBadge(payout.status)}</td>
                  <td style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                    {payout.providerId || '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
