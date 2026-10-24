import { formatCurrency } from '../../utils/currency';
import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import {
  fetchAdminFinanceSummary,
  fetchAdminFinanceTrend,
  fetchAdminTransactions,
  fetchAdminPayouts,
  processPayout,
  completePayout
} from '../../services/financeService';
import {
  fetchAdminRefunds,
  processAdminRefundDecision,
  createAdminManualRefund,
  retryFailedRefund
} from '../../services/refundService';

// Simple SVG Chart Component for Revenue / Income
const FinanceChart = ({ data, dataKey, color, label }) => {
  if (!data || data.length === 0) {
    return (
      <div style={{ height: '200px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
        No {label.toLowerCase()} data available for this period.
      </div>
    );
  }

  const maxVal = Math.max(...data.map(d => d[dataKey]), 1); // Avoid division by zero

  return (
    <div style={{ marginTop: '1rem', height: '240px', position: 'relative' }}>
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: '30px', display: 'flex', alignItems: 'flex-end', gap: '8px', borderBottom: '1px solid var(--border-subtle)' }}>
        {data.map((item, idx) => {
          const heightPct = (item[dataKey] / maxVal) * 100;
          return (
            <div key={idx} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', height: '100%', justifyContent: 'flex-end', group: 'hover' }}>
              <div
                title={`${item.date}: ${formatCurrency(item[dataKey])}`}
                style={{
                  width: '100%',
                  background: color,
                  height: `${heightPct}%`,
                  minHeight: heightPct > 0 ? '4px' : '0',
                  borderRadius: '4px 4px 0 0',
                  opacity: 0.8,
                  cursor: 'pointer',
                  transition: 'opacity 0.2s ease, height 0.3s ease'
                }}
                onMouseEnter={e => e.currentTarget.style.opacity = '1'}
                onMouseLeave={e => e.currentTarget.style.opacity = '0.8'}
              />
            </div>
          );
        })}
      </div>
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '30px', display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)', fontSize: '0.75rem', paddingTop: '8px' }}>
        <span>{data[0]?.date}</span>
        <span>{data[data.length - 1]?.date}</span>
      </div>
    </div>
  );
};

export default function AdminFinanceDashboard() {
  const { token } = useAuth();

  // Data States
  const [summary, setSummary] = useState(null);
  const [trend, setTrend] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [payouts, setPayouts] = useState([]);
  const [refunds, setRefunds] = useState([]);
  const [refundFilter, setRefundFilter] = useState('ALL');

  // UI States
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('OVERVIEW'); // OVERVIEW, TRANSACTIONS, PAYOUTS, REFUNDS

  // Payout Action Modal state
  const [actionModal, setActionModal] = useState({ isOpen: false, payoutId: null, action: null, providerId: '' });

  // Refund Decision Modal state
  const [refundDecisionModal, setRefundDecisionModal] = useState({
    isOpen: false,
    refund: null,
    decision: 'APPROVE',
    amount: '',
    adminNotes: '',
    submitting: false,
    error: ''
  });

  // Manual Refund Modal state
  const [manualRefundModal, setManualRefundModal] = useState({
    isOpen: false,
    paymentId: '',
    amount: '',
    reason: '',
    adminNotes: '',
    submitting: false,
    error: ''
  });

  const loadData = async () => {
    try {
      setLoading(true);
      const [sumData, trendData, txData, payoutsData, refundsData] = await Promise.all([
        fetchAdminFinanceSummary(token),
        fetchAdminFinanceTrend(token),
        fetchAdminTransactions(token),
        fetchAdminPayouts(token, 'ALL'),
        fetchAdminRefunds(refundFilter).catch(() => [])
      ]);
      setSummary(sumData.summary);
      setTrend(trendData);
      setTransactions(txData);
      setPayouts(payoutsData);
      setRefunds(refundsData);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, [token, refundFilter]);

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

  const handleRefundDecision = async () => {
    try {
      setRefundDecisionModal(prev => ({ ...prev, submitting: true, error: '' }));
      await processAdminRefundDecision(
        refundDecisionModal.refund.id,
        refundDecisionModal.decision,
        refundDecisionModal.amount ? Number(refundDecisionModal.amount) : undefined,
        refundDecisionModal.adminNotes
      );
      setRefundDecisionModal({ isOpen: false, refund: null, decision: 'APPROVE', amount: '', adminNotes: '', submitting: false, error: '' });
      loadData();
    } catch (err) {
      setRefundDecisionModal(prev => ({ ...prev, submitting: false, error: err.message }));
    }
  };

  const handleManualRefund = async (e) => {
    e.preventDefault();
    try {
      setManualRefundModal(prev => ({ ...prev, submitting: true, error: '' }));
      await createAdminManualRefund(
        manualRefundModal.paymentId,
        Number(manualRefundModal.amount),
        manualRefundModal.reason,
        manualRefundModal.adminNotes
      );
      setManualRefundModal({ isOpen: false, paymentId: '', amount: '', reason: '', adminNotes: '', submitting: false, error: '' });
      loadData();
    } catch (err) {
      setManualRefundModal(prev => ({ ...prev, submitting: false, error: err.message }));
    }
  };

  const handleRetryRefund = async (id) => {
    if (!window.confirm('Reconcile gateway status and retry this refund?')) return;
    try {
      await retryFailedRefund(id);
      loadData();
    } catch (err) {
      alert('Retry failed: ' + err.message);
    }
  };

  const getStatusBadge = (status) => {
    const styles = {
      ELIGIBLE: { bg: 'var(--info-bg)', color: 'var(--info)', border: '1px solid var(--info-border)' },
      PROCESSING: { bg: 'var(--warning-bg)', color: 'var(--warning)', border: '1px solid var(--warning-border)' },
      PAID: { bg: 'var(--success-bg)', color: 'var(--success)', border: '1px solid var(--success-border)' },
      FAILED: { bg: 'var(--error-bg)', color: 'var(--error)', border: '1px solid var(--error-border)' },
      CREATED: { bg: 'var(--bg-surface-elevated)', color: 'var(--text-muted)', border: '1px solid var(--border-subtle)' },
      PROCESSED: { bg: 'var(--success-bg)', color: 'var(--success)', border: '1px solid var(--success-border)' },
      PENDING_GATEWAY: { bg: 'var(--warning-bg)', color: 'var(--warning)', border: '1px solid var(--warning-border)' },
      REQUESTED: { bg: 'var(--purple-bg)', color: 'var(--purple)', border: '1px solid var(--purple-border)' },
      REJECTED: { bg: 'var(--error-bg)', color: 'var(--error)', border: '1px solid var(--error-border)' },
      REFUNDED: { bg: 'var(--error-bg)', color: 'var(--error)', border: '1px solid var(--error-border)' },
      PARTIALLY_REFUNDED: { bg: 'var(--purple-bg)', color: 'var(--purple)', border: '1px solid var(--purple-border)' }
    };
    const style = styles[status] || { bg: 'var(--bg-surface-elevated)', color: 'var(--text-secondary)', border: '1px solid var(--border-subtle)' };
    return (
      <span style={{ fontSize: '0.75rem', padding: '0.25rem 0.75rem', borderRadius: '16px', fontWeight: 600, background: style.bg, color: style.color, border: style.border }}>
        {status}
      </span>
    );
  };

  if (loading) return <div className="page-content">Loading finance dashboard...</div>;

  return (
    <div className="page-content">
      <div className="page-header" style={{ borderBottom: '1px solid var(--border-subtle)', paddingBottom: '1rem', marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ color: 'var(--success)' }}>₹</span> Financial Overview &amp; Refunds
          </h2>
          <p className="page-subtitle">Track net platform revenue, income, mentor payouts, and Razorpay refunds.</p>
        </div>
        <button
          onClick={() => setManualRefundModal({ isOpen: true, paymentId: '', amount: '', reason: '', adminNotes: '', submitting: false, error: '' })}
          className="btn btn-secondary"
          style={{ fontSize: '0.85rem', padding: '0.5rem 1rem' }}
        >
          + Issue Manual Refund
        </button>
      </div>

      {error && <div style={{ padding: '1rem', background: 'var(--error-bg)', color: 'var(--error)', border: '1px solid var(--error-border)', borderRadius: 'var(--radius-md)', marginBottom: '1.5rem', fontWeight: 500 }}>{error}</div>}

      {/* TOP SUMMARY CARDS */}
      {summary && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.25rem', marginBottom: '2rem' }}>
          <div className="glass-card" style={{ padding: '1.5rem', borderLeft: '4px solid var(--accent-primary)' }}>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Net Revenue</div>
            <div style={{ fontSize: '1.75rem', fontWeight: 700, color: 'var(--text-primary)', marginTop: '0.5rem' }}>{formatCurrency(summary.totalRevenue)}</div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>Gross: {formatCurrency(summary.grossRevenue || 0)}</div>
          </div>
          <div className="glass-card" style={{ padding: '1.5rem', borderLeft: '4px solid var(--success)' }}>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Platform Income</div>
            <div style={{ fontSize: '1.75rem', fontWeight: 700, color: 'var(--success)', marginTop: '0.5rem' }}>{formatCurrency(summary.totalPlatformIncome)}</div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>Retained by MentorConnect</div>
          </div>
          <div className="glass-card" style={{ padding: '1.5rem', borderLeft: '4px solid var(--error)' }}>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total Refunds</div>
            <div style={{ fontSize: '1.75rem', fontWeight: 700, color: 'var(--error)', marginTop: '0.5rem' }}>{formatCurrency(summary.totalRefunds || 0)}</div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
              {summary.refundsCount || 0} processed | {summary.pendingRefundsCount || 0} pending
            </div>
          </div>
          <div className="glass-card" style={{ padding: '1.5rem', borderLeft: '4px solid var(--info)' }}>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Mentor Payouts</div>
            <div style={{ fontSize: '1.75rem', fontWeight: 700, color: 'var(--info)', marginTop: '0.5rem' }}>{formatCurrency(summary.totalMentorPayouts)}</div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>{summary.paidCount} payouts completed</div>
          </div>
          <div className="glass-card" style={{ padding: '1.5rem', borderLeft: '4px solid var(--warning)' }}>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Pending Payouts</div>
            <div style={{ fontSize: '1.75rem', fontWeight: 700, color: 'var(--warning)', marginTop: '0.5rem' }}>
              {formatCurrency(summary.eligibleAmount + summary.processingAmount)}
            </div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
              Eligible: {summary.eligibleCount} | Processing: {summary.processingCount}
            </div>
          </div>
        </div>
      )}

      {/* TABS */}
      <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', borderBottom: '1px solid var(--border-subtle)' }}>
        {['OVERVIEW', 'TRANSACTIONS', 'PAYOUTS', 'REFUNDS'].map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              background: 'none',
              border: 'none',
              padding: '0.75rem 1.5rem',
              color: activeTab === tab ? 'var(--accent-primary)' : 'var(--text-secondary)',
              borderBottom: activeTab === tab ? '2px solid var(--accent-primary)' : '2px solid transparent',
              cursor: 'pointer',
              fontWeight: activeTab === tab ? 600 : 400,
              fontSize: '0.9rem'
            }}
          >
            {tab.charAt(0) + tab.slice(1).toLowerCase()}
          </button>
        ))}
      </div>

      {/* TAB: OVERVIEW */}
      {activeTab === 'OVERVIEW' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '1.5rem' }}>
          <div className="glass-card" style={{ padding: '1.5rem' }}>
            <h3 style={{ margin: 0, fontSize: '1.1rem', color: 'var(--text-primary)' }}>Net Revenue Trend (Post-Refunds)</h3>
            <FinanceChart data={trend} dataKey="revenue" color="var(--accent-primary)" label="Revenue" />
          </div>

          <div className="glass-card" style={{ padding: '1.5rem' }}>
            <h3 style={{ margin: 0, fontSize: '1.1rem', color: 'var(--text-primary)' }}>Net Platform Income Trend</h3>
            <FinanceChart data={trend} dataKey="income" color="var(--success)" label="Income" />
          </div>
        </div>
      )}

      {/* TAB: TRANSACTIONS */}
      {activeTab === 'TRANSACTIONS' && (
        <div className="glass-card" style={{ padding: '1.5rem' }}>
          <h3 style={{ margin: '0 0 1rem 0', fontSize: '1.1rem', color: 'var(--text-primary)' }}>Recent Transactions</h3>
          {transactions.length === 0 ? (
            <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
              No completed payment data available.
            </div>
          ) : (
            <div className="table-responsive" style={{ overflowX: 'auto' }}>
              <table className="admin-table" style={{ width: '100%', minWidth: '950px' }}>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Student (Payer)</th>
                    <th>Mentor (Payee)</th>
                    <th>Gross Paid</th>
                    <th>Platform Fee</th>
                    <th>Refunded</th>
                    <th>Payment Status</th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.map(tx => {
                    const totalRefunded = (tx.refunds || []).filter(r => r.status === 'PROCESSED').reduce((sum, r) => sum + r.amount, 0);
                    return (
                      <tr key={tx.id}>
                        <td>{new Date(tx.createdAt).toLocaleDateString()}</td>
                        <td>
                          <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{tx.student?.user?.name || '-'}</div>
                          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{tx.student?.user?.email}</div>
                        </td>
                        <td>
                          <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{tx.session?.mentor?.user?.name || '-'}</div>
                          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{tx.session?.mentor?.user?.email}</div>
                        </td>
                        <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{formatCurrency(tx.amount)}</td>
                        <td style={{ color: 'var(--success)', fontWeight: 500 }}>{formatCurrency(tx.platformFee)}</td>
                        <td style={{ color: totalRefunded > 0 ? 'var(--error)' : 'var(--text-muted)', fontWeight: totalRefunded > 0 ? 600 : 400 }}>
                          {totalRefunded > 0 ? formatCurrency(totalRefunded) : '₹0'}
                        </td>
                        <td>{getStatusBadge(tx.status)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB: PAYOUTS */}
      {activeTab === 'PAYOUTS' && (
        <div className="glass-card" style={{ padding: '1.5rem' }}>
          <h3 style={{ margin: '0 0 1rem 0', fontSize: '1.1rem', color: 'var(--text-primary)' }}>Mentor Payouts</h3>
          {payouts.length === 0 ? (
            <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
              No mentor payouts available.
            </div>
          ) : (
            <div className="table-responsive" style={{ overflowX: 'auto' }}>
              <table className="admin-table" style={{ width: '100%', minWidth: '900px' }}>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Mentor</th>
                    <th>Gross Amount</th>
                    <th>Platform Fee</th>
                    <th>Net Amount</th>
                    <th>Status</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {payouts.map(p => (
                    <tr key={p.id}>
                      <td>{new Date(p.createdAt).toLocaleDateString()}</td>
                      <td>
                        <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{p.mentor?.user?.name || '-'}</div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{p.mentor?.user?.email}</div>
                      </td>
                      <td style={{ color: 'var(--text-primary)' }}>{formatCurrency(p.grossAmount)}</td>
                      <td style={{ color: 'var(--success)', fontWeight: 500 }}>{formatCurrency(p.platformFee)}</td>
                      <td style={{ fontWeight: 600, color: 'var(--accent-primary)' }}>{formatCurrency(p.netAmount)}</td>
                      <td>{getStatusBadge(p.status)}</td>
                      <td>
                        {p.status === 'ELIGIBLE' && (
                          <button
                            className="btn btn-secondary"
                            onClick={() => setActionModal({ isOpen: true, payoutId: p.id, action: 'PROCESS', providerId: '' })}
                            style={{ padding: '0.35rem 0.75rem', fontSize: '0.8rem' }}
                          >
                            Process
                          </button>
                        )}
                        {p.status === 'PROCESSING' && (
                          <div style={{ display: 'flex', gap: '0.5rem' }}>
                            <button
                              className="btn btn-primary"
                              onClick={() => setActionModal({ isOpen: true, payoutId: p.id, action: 'PAID', providerId: '' })}
                              style={{ background: 'var(--success)', borderColor: 'var(--success)', color: '#FFFFFF', padding: '0.35rem 0.75rem', fontSize: '0.8rem' }}
                            >
                              Mark Paid
                            </button>
                            <button
                              className="btn btn-secondary"
                              onClick={() => setActionModal({ isOpen: true, payoutId: p.id, action: 'FAILED', providerId: '' })}
                              style={{ color: 'var(--error)', borderColor: 'var(--error-border)', padding: '0.35rem 0.75rem', fontSize: '0.8rem' }}
                            >
                              Fail
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB: REFUNDS */}
      {activeTab === 'REFUNDS' && (
        <div className="glass-card" style={{ padding: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
            <h3 style={{ margin: 0, fontSize: '1.1rem', color: 'var(--text-primary)' }}>Razorpay Refund Ledger</h3>
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Status Filter:</span>
              <select
                className="form-input"
                value={refundFilter}
                onChange={e => setRefundFilter(e.target.value)}
                style={{ maxWidth: '240px', fontSize: '0.85rem' }}
              >
                <option value="ALL">All Statuses</option>
                <option value="REQUESTED">Pending Review (REQUESTED)</option>
                <option value="PENDING_GATEWAY">Pending Gateway</option>
                <option value="PROCESSED">Processed</option>
                <option value="FAILED">Failed</option>
                <option value="REJECTED">Rejected</option>
              </select>
            </div>
          </div>

          {refunds.length === 0 ? (
            <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
              No refund records found for the selected filter.
            </div>
          ) : (
            <div className="table-responsive" style={{ overflowX: 'auto' }}>
              <table className="admin-table" style={{ width: '100%', minWidth: '1050px' }}>
                <thead>
                  <tr>
                    <th>Reference / Date</th>
                    <th>Student (Payer)</th>
                    <th>Mentor</th>
                    <th>Refund Amount</th>
                    <th>Policy Tier</th>
                    <th>Reason / Notes</th>
                    <th>Status</th>
                    <th>Gateway ID</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {refunds.map(r => (
                    <tr key={r.id}>
                      <td>
                        <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{r.refundReference}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{new Date(r.createdAt).toLocaleDateString()}</div>
                      </td>
                      <td>
                        <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{r.payment?.student?.user?.name || '-'}</div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{r.payment?.student?.user?.email}</div>
                      </td>
                      <td>
                        <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{r.payment?.session?.mentorship?.mentor?.user?.name || '-'}</div>
                      </td>
                      <td style={{ fontWeight: 700, color: 'var(--error)' }}>{formatCurrency(r.amount)}</td>
                      <td>
                        <span style={{ fontSize: '0.75rem', padding: '0.2rem 0.5rem', borderRadius: '4px', background: 'var(--bg-surface-elevated)', color: 'var(--text-secondary)', border: '1px solid var(--border-subtle)' }}>
                          {r.policyTier?.replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td style={{ maxWidth: '200px', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                        <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={r.reason}>
                          {r.reason}
                        </div>
                        {r.studentNotes && <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>Note: {r.studentNotes}</div>}
                        {r.failureReason && <div style={{ color: 'var(--error)', fontSize: '0.75rem' }}>Error: {r.failureReason}</div>}
                      </td>
                      <td>{getStatusBadge(r.status)}</td>
                      <td style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                        {r.razorpayRefundId || '-'}
                      </td>
                      <td>
                        {r.status === 'REQUESTED' && (
                          <button
                            className="btn btn-primary"
                            onClick={() => setRefundDecisionModal({
                              isOpen: true,
                              refund: r,
                              decision: 'APPROVE',
                              amount: String(r.amount),
                              adminNotes: '',
                              submitting: false,
                              error: ''
                            })}
                            style={{ padding: '0.35rem 0.75rem', fontSize: '0.8rem' }}
                          >
                            Review
                          </button>
                        )}
                        {r.status === 'FAILED' && (
                          <button
                            className="btn btn-secondary"
                            onClick={() => handleRetryRefund(r.id)}
                            style={{ color: 'var(--error)', borderColor: 'var(--error-border)', padding: '0.35rem 0.75rem', fontSize: '0.8rem' }}
                          >
                            Retry Gateway
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* REFUND DECISION MODAL */}
      {refundDecisionModal.isOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem' }}>
          <div className="glass-card" style={{ padding: '2rem', width: '100%', maxWidth: '500px', background: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}>
            <h3 style={{ marginTop: 0, marginBottom: '0.5rem', color: 'var(--text-primary)' }}>Review Refund Request</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '1.25rem' }}>
              Reference: <strong>{refundDecisionModal.refund?.refundReference}</strong>
            </p>

            <div style={{ padding: '1rem', background: 'var(--bg-surface-elevated)', border: '1px solid var(--border-subtle)', borderRadius: '6px', marginBottom: '1.25rem', fontSize: '0.85rem', color: 'var(--text-primary)' }}>
              <div><strong>Requested Amount:</strong> {formatCurrency(refundDecisionModal.refund?.amount)}</div>
              <div><strong>Policy Tier:</strong> {refundDecisionModal.refund?.policyTier}</div>
              <div style={{ marginTop: '0.35rem' }}><strong>Reason:</strong> {refundDecisionModal.refund?.reason}</div>
            </div>

            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Action Decision:</label>
              <div style={{ display: 'flex', gap: '1rem' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', color: 'var(--text-primary)' }}>
                  <input
                    type="radio"
                    name="decision"
                    value="APPROVE"
                    checked={refundDecisionModal.decision === 'APPROVE'}
                    onChange={() => setRefundDecisionModal(p => ({ ...p, decision: 'APPROVE' }))}
                  />
                  <span>Approve Refund</span>
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', color: 'var(--text-primary)' }}>
                  <input
                    type="radio"
                    name="decision"
                    value="REJECT"
                    checked={refundDecisionModal.decision === 'REJECT'}
                    onChange={() => setRefundDecisionModal(p => ({ ...p, decision: 'REJECT' }))}
                  />
                  <span>Reject Request</span>
                </label>
              </div>
            </div>

            {refundDecisionModal.decision === 'APPROVE' && (
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Approved Amount (₹):</label>
                <input
                  type="number"
                  step="1"
                  className="form-input"
                  value={refundDecisionModal.amount}
                  onChange={e => setRefundDecisionModal(p => ({ ...p, amount: e.target.value }))}
                />
              </div>
            )}

            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Admin Audit Notes:</label>
              <textarea
                className="form-input"
                value={refundDecisionModal.adminNotes}
                onChange={e => setRefundDecisionModal(p => ({ ...p, adminNotes: e.target.value }))}
                placeholder="Reason for approval or rejection..."
                rows={3}
              />
            </div>

            {refundDecisionModal.error && (
              <div style={{ padding: '0.75rem', background: 'var(--error-bg)', color: 'var(--error)', border: '1px solid var(--error-border)', borderRadius: '4px', marginBottom: '1rem', fontSize: '0.85rem' }}>
                {refundDecisionModal.error}
              </div>
            )}

            <div style={{ display: 'flex', gap: '1rem' }}>
              <button
                onClick={handleRefundDecision}
                disabled={refundDecisionModal.submitting}
                className="btn btn-primary"
                style={{ flex: 1, background: refundDecisionModal.decision === 'APPROVE' ? 'var(--success)' : 'var(--error)', borderColor: refundDecisionModal.decision === 'APPROVE' ? 'var(--success)' : 'var(--error)', color: '#FFFFFF' }}
              >
                {refundDecisionModal.submitting ? 'Processing...' : `Confirm ${refundDecisionModal.decision}`}
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setRefundDecisionModal({ isOpen: false, refund: null, decision: 'APPROVE', amount: '', adminNotes: '', submitting: false, error: '' })}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MANUAL REFUND MODAL */}
      {manualRefundModal.isOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem' }}>
          <div className="glass-card" style={{ padding: '2rem', width: '100%', maxWidth: '500px', background: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}>
            <h3 style={{ marginTop: 0, marginBottom: '0.5rem', color: 'var(--text-primary)' }}>Create Manual Razorpay Refund</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '1.25rem' }}>
              Directly issue a full or partial refund against a captured payment.
            </p>

            <form onSubmit={handleManualRefund}>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Select Payment Record:</label>
                <select
                  className="form-input"
                  value={manualRefundModal.paymentId}
                  onChange={e => {
                    const sel = transactions.find(t => t.id === e.target.value);
                    setManualRefundModal(p => ({
                      ...p,
                      paymentId: e.target.value,
                      amount: sel ? String(sel.amount) : p.amount
                    }));
                  }}
                  required
                >
                  <option value="">-- Choose Payment --</option>
                  {transactions.filter(t => t.status === 'PAID' || t.status === 'PARTIALLY_REFUNDED').map(t => (
                    <option key={t.id} value={t.id}>
                      {t.student?.user?.name} - {formatCurrency(t.amount)} ({new Date(t.createdAt).toLocaleDateString()})
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Refund Amount (₹):</label>
                <input
                  type="number"
                  step="1"
                  className="form-input"
                  required
                  value={manualRefundModal.amount}
                  onChange={e => setManualRefundModal(p => ({ ...p, amount: e.target.value }))}
                />
              </div>

              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Reason for Refund:</label>
                <input
                  type="text"
                  className="form-input"
                  required
                  value={manualRefundModal.reason}
                  onChange={e => setManualRefundModal(p => ({ ...p, reason: e.target.value }))}
                  placeholder="e.g. Platform error, student billing dispute resolved..."
                />
              </div>

              <div style={{ marginBottom: '1.5rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Admin Notes:</label>
                <textarea
                  className="form-input"
                  value={manualRefundModal.adminNotes}
                  onChange={e => setManualRefundModal(p => ({ ...p, adminNotes: e.target.value }))}
                  placeholder="Internal audit reference..."
                  rows={2}
                />
              </div>

              {manualRefundModal.error && (
                <div style={{ padding: '0.75rem', background: 'var(--error-bg)', color: 'var(--error)', border: '1px solid var(--error-border)', borderRadius: '4px', marginBottom: '1rem', fontSize: '0.85rem' }}>
                  {manualRefundModal.error}
                </div>
              )}

              <div style={{ display: 'flex', gap: '1rem' }}>
                <button
                  type="submit"
                  disabled={manualRefundModal.submitting}
                  className="btn btn-primary"
                  style={{ flex: 1 }}
                >
                  {manualRefundModal.submitting ? 'Executing Refund...' : 'Execute Razorpay Refund'}
                </button>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setManualRefundModal({ isOpen: false, paymentId: '', amount: '', reason: '', adminNotes: '', submitting: false, error: '' })}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* PAYOUT STATUS MODAL */}
      {actionModal.isOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem' }}>
          <div className="glass-card" style={{ padding: '2rem', width: '100%', maxWidth: '400px', background: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}>
            <h3 style={{ marginTop: 0, color: 'var(--text-primary)' }}>
              {actionModal.action === 'PROCESS' ? 'Process Payout' : actionModal.action === 'PAID' ? 'Complete Payout' : 'Fail Payout'}
            </h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
              Are you sure you want to transition this payout to <strong>{actionModal.action}</strong>?
            </p>
            {actionModal.action === 'PAID' && (
              <div style={{ marginBottom: '1.5rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Reference / Provider ID (Optional)</label>
                <input
                  type="text"
                  className="form-input"
                  value={actionModal.providerId}
                  onChange={e => setActionModal({ ...actionModal, providerId: e.target.value })}
                  placeholder="e.g. BANK_REF_12345"
                />
              </div>
            )}
            <div style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem' }}>
              <button onClick={handleAction} className="btn btn-primary" style={{ flex: 1 }}>Confirm</button>
              <button onClick={() => setActionModal({ isOpen: false, payoutId: null, action: null, providerId: '' })} className="btn btn-secondary">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
