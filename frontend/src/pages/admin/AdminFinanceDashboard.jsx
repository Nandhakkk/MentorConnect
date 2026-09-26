import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { fetchAdminFinanceSummary, fetchAdminPayouts, processPayout, completePayout } from '../../services/financeService';

export default function AdminFinanceDashboard() {
  const { token } = useAuth();
  const [summary, setSummary] = useState(null);
  const [payouts, setPayouts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Modal state
  const [actionModal, setActionModal] = useState({ isOpen: false, payoutId: null, action: null, providerId: '' });

  const loadData = async () => {
    try {
      setLoading(true);
      const [sumData, payoutsData] = await Promise.all([
        fetchAdminFinanceSummary(token),
        fetchAdminPayouts(token, 'ALL')
      ]);
      setSummary(sumData.summary);
      setPayouts(payoutsData);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, [token]);

  const handleAction = async () => {
    try {
      setError('');
      if (actionModal.action === 'PROCESS') {
        await processPayout(token, actionModal.payoutId);
      } else if (actionModal.action === 'PAID' || actionModal.action === 'FAILED') {
        await completePayout(token, actionModal.payoutId, actionModal.action, actionModal.providerId);
      }
      setActionModal({ isOpen: false, payoutId: null, action: null, providerId: '' });
      loadData();
    } catch (err) {
      setError(err.message);
    }
  };

  const getStatusBadge = (status) => {
    const styles = {
      ELIGIBLE: { bg: 'rgba(59, 130, 246, 0.15)', color: '#3b82f6', border: '1px solid rgba(59, 130, 246, 0.3)' },
      PROCESSING: { bg: 'rgba(245, 158, 11, 0.15)', color: '#f59e0b', border: '1px solid rgba(245, 158, 11, 0.3)' },
      PAID: { bg: 'rgba(16, 185, 129, 0.15)', color: '#10b981', border: '1px solid rgba(16, 185, 129, 0.3)' },
      FAILED: { bg: 'rgba(239, 68, 68, 0.15)', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.3)' }
    };
    const style = styles[status] || { bg: 'transparent', color: 'white', border: 'none' };
    return (
      <span style={{ fontSize: '0.75rem', padding: '0.25rem 0.75rem', borderRadius: '16px', fontWeight: 600, background: style.bg, color: style.color, border: style.border }}>
        {status}
      </span>
    );
  };

  if (loading) return <div className="page-content">Loading finance dashboard...</div>;

  return (
    <div className="page-content">
      <div className="page-header">
        <div>
          <h2 className="page-title">Financial Dashboard</h2>
          <p className="page-subtitle">Track platform income and manage mentor payouts.</p>
        </div>
      </div>

      {error && <div style={{ color: '#ef4444', marginBottom: '1rem' }}>{error}</div>}

      {summary && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
          <div className="glass-card" style={{ padding: '1.5rem', textAlign: 'center', borderTop: '4px solid var(--accent-primary)' }}>
            <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '0.5rem', textTransform: 'uppercase' }}>Gross Volume</div>
            <div style={{ fontSize: '1.8rem', fontWeight: 700, color: 'var(--text-primary)' }}>₹{summary.totalStudentPayments}</div>
          </div>
          <div className="glass-card" style={{ padding: '1.5rem', textAlign: 'center', borderTop: '4px solid #10b981' }}>
            <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '0.5rem', textTransform: 'uppercase' }}>Platform Income</div>
            <div style={{ fontSize: '1.8rem', fontWeight: 700, color: '#10b981' }}>₹{summary.totalPlatformIncome}</div>
          </div>
          <div className="glass-card" style={{ padding: '1.5rem', textAlign: 'center', borderTop: '4px solid #3b82f6' }}>
            <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '0.5rem', textTransform: 'uppercase' }}>Pending Payouts (Eligible)</div>
            <div style={{ fontSize: '1.8rem', fontWeight: 700, color: '#3b82f6' }}>₹{summary.eligibleAmount} <span style={{fontSize:'1rem', color:'var(--text-muted)'}}>({summary.eligibleCount})</span></div>
          </div>
          <div className="glass-card" style={{ padding: '1.5rem', textAlign: 'center', borderTop: '4px solid #f59e0b' }}>
            <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '0.5rem', textTransform: 'uppercase' }}>Processing Payouts</div>
            <div style={{ fontSize: '1.8rem', fontWeight: 700, color: '#f59e0b' }}>₹{summary.processingAmount} <span style={{fontSize:'1rem', color:'var(--text-muted)'}}>({summary.processingCount})</span></div>
          </div>
        </div>
      )}

      <h3 style={{ marginBottom: '1rem', color: 'var(--text-primary)' }}>Payout Ledger</h3>
      <div className="table-responsive glass-card" style={{ padding: '1px' }}>
        <table className="admin-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Mentor</th>
              <th>Session Gross</th>
              <th>Platform Fee</th>
              <th>Net Payout</th>
              <th>Status</th>
              <th>Reference</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {payouts.map(payout => (
              <tr key={payout.id}>
                <td>{new Date(payout.createdAt).toLocaleDateString()}</td>
                <td>
                  <div style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{payout.mentor?.user?.name}</div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{payout.mentor?.user?.email}</div>
                </td>
                <td>₹{payout.grossAmount}</td>
                <td style={{ color: '#10b981' }}>₹{payout.platformFee}</td>
                <td style={{ fontWeight: 600 }}>₹{payout.netAmount}</td>
                <td>{getStatusBadge(payout.status)}</td>
                <td style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                  {payout.providerId || '-'}
                </td>
                <td>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    {(payout.status === 'ELIGIBLE' || payout.status === 'FAILED') && (
                      <button 
                        onClick={() => setActionModal({ isOpen: true, payoutId: payout.id, action: 'PROCESS', providerId: '' })}
                        className="btn btn-primary" style={{ padding: '0.3rem 0.6rem', fontSize: '0.75rem', background: '#3b82f6', border: 'none' }}
                      >
                        Process
                      </button>
                    )}
                    {payout.status === 'PROCESSING' && (
                      <>
                        <button 
                          onClick={() => setActionModal({ isOpen: true, payoutId: payout.id, action: 'PAID', providerId: '' })}
                          className="btn btn-primary" style={{ padding: '0.3rem 0.6rem', fontSize: '0.75rem', background: '#10b981', border: 'none' }}
                        >
                          Mark Paid
                        </button>
                        <button 
                          onClick={() => setActionModal({ isOpen: true, payoutId: payout.id, action: 'FAILED', providerId: '' })}
                          className="btn btn-secondary" style={{ padding: '0.3rem 0.6rem', fontSize: '0.75rem', background: 'transparent', color: '#ef4444', border: '1px solid #ef4444' }}
                        >
                          Fail
                        </button>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {actionModal.isOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div className="glass-card" style={{ width: '400px', padding: '2rem' }}>
            <h3 style={{ marginTop: 0, marginBottom: '1rem' }}>
              {actionModal.action === 'PROCESS' ? 'Process Payout' : actionModal.action === 'PAID' ? 'Complete Payout' : 'Fail Payout'}
            </h3>
            
            {actionModal.action === 'PROCESS' && (
              <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>
                Move this payout to PROCESSING state? This indicates you are initiating the bank transfer.
              </p>
            )}
            
            {actionModal.action === 'PAID' && (
              <div style={{ marginBottom: '1.5rem' }}>
                <p style={{ color: 'var(--text-secondary)', marginBottom: '1rem' }}>
                  Mark this payout as completed. Enter the external provider reference number (e.g. Bank UTR).
                </p>
                <input
                  type="text"
                  placeholder="Provider / UTR Reference (Optional)"
                  value={actionModal.providerId}
                  onChange={e => setActionModal({ ...actionModal, providerId: e.target.value })}
                  style={{ width: '100%', padding: '0.75rem', borderRadius: '4px', border: '1px solid var(--border-subtle)', background: 'rgba(0,0,0,0.2)', color: 'white' }}
                />
              </div>
            )}
            
            {actionModal.action === 'FAILED' && (
              <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>
                Mark this payout as FAILED? The mentor will be notified.
              </p>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
              <button 
                onClick={() => setActionModal({ isOpen: false, payoutId: null, action: null, providerId: '' })}
                className="btn btn-secondary" style={{ padding: '0.5rem 1.5rem' }}
              >
                Cancel
              </button>
              <button 
                onClick={handleAction}
                className="btn btn-primary" style={{ padding: '0.5rem 1.5rem', background: actionModal.action === 'FAILED' ? '#ef4444' : 'var(--accent-primary)', border: 'none' }}
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
