import { formatCurrency } from '../../utils/currency';
import React, { Component, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchAdminMentors, reconsiderMentorApplication, reconsiderPeerMentorApplication } from '../../services/adminService';

class AdminErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  componentDidCatch(error, errorInfo) {
    console.error('[AdminMentors ErrorBoundary]:', error, errorInfo);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="glass-card" style={{ padding: '3rem 1.5rem', textAlign: 'center', margin: '1.5rem 0' }}>
          <div style={{ fontSize: '2rem', marginBottom: '0.75rem' }}>⚠️</div>
          <h3 style={{ color: 'var(--text-primary)', marginBottom: '0.5rem' }}>Failed to display mentor records</h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginBottom: '1.5rem', maxWidth: '480px', margin: '0 auto 1.5rem' }}>
            {this.state.error?.message || 'An unexpected error occurred while rendering this queue.'}
          </p>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => this.setState({ hasError: false, error: null })}
          >
            Retry View
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function AdminMentors() {
  const [mentors, setMentors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Default to ELIGIBLE: Main pending approval queue shows only eligible applications
  const [activeTab, setActiveTab] = useState('ELIGIBLE');
  const [filterType, setFilterType] = useState('ALL');
  const [search, setSearch] = useState('');
  const [reconsiderModal, setReconsiderModal] = useState({ open: false, mentor: null, reason: '', loading: false });

  const navigate = useNavigate();

  const formatCriterion = (c) => {
    if (!c) return '';
    if (typeof c === 'string') return c;
    return c.message || c.code || c.category || JSON.stringify(c);
  };

  const loadMentors = async () => {
    try {
      setLoading(true);
      const data = await fetchAdminMentors('');
      setMentors(Array.isArray(data) ? data : []);
      setError('');
    } catch (err) {
      setError(err.message || 'Failed to load mentors.');
      setMentors([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMentors();
  }, []);

  const getLatestApp = (mentor) => {
    return mentor.mentorType === 'PEER'
      ? mentor.peerApplications?.[0]
      : mentor.applications?.[0];
  };

  const getMentorQueueOutcome = (mentor) => {
    const latestApp = getLatestApp(mentor);

    if (mentor.status === 'APPROVED') return 'APPROVED';
    if (mentor.status === 'SUSPENDED') return 'SUSPENDED';

    if (!latestApp) {
      return mentor.status === 'REJECTED' ? 'AUTO_REJECTED' : 'MANUAL_REVIEW';
    }

    const appStatus = latestApp.status;
    const screening = latestApp.aiScreening;
    const rec = screening?.recommendation;
    const findings = screening?.structuredFindings || {};
    const explicitOutcome = findings.outcome || findings.screeningOutcome;

    if (appStatus === 'REJECTED' || mentor.status === 'REJECTED') {
      return 'AUTO_REJECTED';
    }

    if (explicitOutcome === 'ELIGIBLE' || ['STRONG_PASS', 'PASS'].includes(rec)) {
      return 'ELIGIBLE';
    }

    if (explicitOutcome === 'NEEDS_MANUAL_REVIEW' || ['NEEDS_REVIEW', 'BORDERLINE'].includes(rec) || appStatus === 'UNDER_REVIEW') {
      return 'MANUAL_REVIEW';
    }

    if (appStatus === 'AI_SCREENED') return 'ELIGIBLE';
    return 'MANUAL_REVIEW';
  };

  const handleAction = (mentor) => {
    const latestApp = getLatestApp(mentor);
    if (!latestApp) {
      alert("No application found for this mentor.");
      return;
    }
    if (mentor.mentorType === 'PEER') {
      navigate(`/admin/peer-mentor-applications/${latestApp.id}`);
    } else {
      navigate(`/admin/mentor-applications/${latestApp.id}`);
    }
  };

  const handleReconsiderSubmit = async () => {
    if (!reconsiderModal.mentor) return;
    const m = reconsiderModal.mentor;
    const latestApp = getLatestApp(m);
    if (!latestApp) return;

    try {
      setReconsiderModal(prev => ({ ...prev, loading: true }));
      if (m.mentorType === 'PEER') {
        await reconsiderPeerMentorApplication(latestApp.id, reconsiderModal.reason);
      } else {
        await reconsiderMentorApplication(latestApp.id, reconsiderModal.reason);
      }
      setReconsiderModal({ open: false, mentor: null, reason: '', loading: false });
      await loadMentors();
    } catch (err) {
      alert(`Failed to reconsider application: ${err.message}`);
      setReconsiderModal(prev => ({ ...prev, loading: false }));
    }
  };

  // Counts for each tab
  const counts = (Array.isArray(mentors) ? mentors : []).reduce((acc, m) => {
    const outcome = getMentorQueueOutcome(m);
    acc[outcome] = (acc[outcome] || 0) + 1;
    acc.ALL = (acc.ALL || 0) + 1;
    return acc;
  }, {});

  const getFilteredMentors = () => {
    return (Array.isArray(mentors) ? mentors : []).filter(m => {
      const outcome = getMentorQueueOutcome(m);

      // Tab filter
      if (activeTab === 'ELIGIBLE' && outcome !== 'ELIGIBLE') return false;
      if (activeTab === 'MANUAL_REVIEW' && outcome !== 'MANUAL_REVIEW') return false;
      if (activeTab === 'AUTO_REJECTED' && outcome !== 'AUTO_REJECTED') return false;
      if (activeTab === 'APPROVED' && m.status !== 'APPROVED') return false;
      if (activeTab === 'SUSPENDED' && m.status !== 'SUSPENDED') return false;

      // Type filter
      if (filterType !== 'ALL' && m.mentorType !== filterType) return false;

      // Search filter
      if (search) {
        const query = search.toLowerCase();
        const nameMatch = m.user?.name?.toLowerCase().includes(query);
        const emailMatch = m.user?.email?.toLowerCase().includes(query);
        const topicMatch = m.expertise?.toLowerCase().includes(query);
        if (!nameMatch && !emailMatch && !topicMatch) return false;
      }

      return true;
    });
  };

  const filteredMentors = getFilteredMentors();

  return (
    <div className="page-content">
      <div className="page-header" style={{ borderBottom: '1px solid var(--border-subtle)', paddingBottom: '1rem', marginBottom: '1.5rem' }}>
        <div>
          <h2 className="page-title">Mentor Verification & Management</h2>
          <p className="page-subtitle">AI pre-screened verification queues, manual reviews, and auto-rejected audit history.</p>
        </div>
      </div>

      {error && (
        <div style={{
          padding: '1rem 1.25rem',
          background: 'var(--error-bg)',
          color: 'var(--error)',
          border: '1px solid var(--error-border)',
          borderRadius: 'var(--radius-md)',
          marginBottom: '1.5rem',
          fontWeight: 500,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '0.75rem'
        }}>
          <div>
            <strong>Error loading mentors:</strong> {error}
          </div>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={loadMentors}
            style={{ fontSize: '0.8rem', padding: '0.35rem 0.75rem' }}
          >
            Retry
          </button>
        </div>
      )}

      {/* Primary Queue Tabs */}
      <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.5rem', borderBottom: '1px solid var(--border-subtle)', flexWrap: 'wrap' }}>
        {[
          { key: 'ELIGIBLE', label: 'Eligible — Awaiting Final Approval', color: 'var(--success)', count: counts.ELIGIBLE || 0 },
          { key: 'MANUAL_REVIEW', label: 'Needs Manual Review', color: 'var(--warning)', count: counts.MANUAL_REVIEW || 0 },
          { key: 'AUTO_REJECTED', label: 'Auto-Rejected — History', color: 'var(--error)', count: counts.AUTO_REJECTED || 0 },
          { key: 'APPROVED', label: 'Approved Mentors', color: 'var(--info)', count: counts.APPROVED || 0 },
          { key: 'SUSPENDED', label: 'Suspended', color: 'var(--text-muted)', count: counts.SUSPENDED || 0 },
          { key: 'ALL', label: 'All Records', color: 'var(--text-primary)', count: counts.ALL || 0 },
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            style={{
              background: 'none',
              border: 'none',
              padding: '0.75rem 1.25rem',
              color: activeTab === tab.key ? tab.color : 'var(--text-secondary)',
              borderBottom: activeTab === tab.key ? `2px solid ${tab.color}` : '2px solid transparent',
              cursor: 'pointer',
              fontWeight: activeTab === tab.key ? 600 : 400,
              fontSize: '0.9rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem'
            }}
          >
            <span>{tab.label}</span>
            <span style={{
              fontSize: '0.75rem',
              padding: '0.15rem 0.45rem',
              borderRadius: '999px',
              background: activeTab === tab.key ? 'var(--accent-primary)' : 'var(--bg-surface-elevated)',
              color: activeTab === tab.key ? '#FFFFFF' : 'var(--text-secondary)',
              fontWeight: 600
            }}>
              {tab.count}
            </span>
          </button>
        ))}
      </div>

      {/* Queue Description Banner */}
      {activeTab === 'ELIGIBLE' && (
        <div style={{ padding: '0.85rem 1.25rem', background: 'var(--success-bg)', border: '1px solid var(--success-border)', borderRadius: 'var(--radius-md)', marginBottom: '1.5rem', color: 'var(--success)', fontSize: '0.85rem' }}>
          <strong>Main Pending-Approval Queue:</strong> These applications have successfully passed all mandatory objective criteria and AI verification checks. They are awaiting your final administrative decision.
        </div>
      )}
      {activeTab === 'MANUAL_REVIEW' && (
        <div style={{ padding: '0.85rem 1.25rem', background: 'var(--warning-bg)', border: '1px solid var(--warning-border)', borderRadius: 'var(--radius-md)', marginBottom: '1.5rem', color: 'var(--warning)', fontSize: '0.85rem' }}>
          <strong>Manual Review Queue:</strong> Applications flagged for ambiguous evidence, AI confidence below threshold, potential inconsistencies, or provider timeouts. They are separated from the eligible queue for careful human inspection.
        </div>
      )}
      {activeTab === 'AUTO_REJECTED' && (
        <div style={{ padding: '0.85rem 1.25rem', background: 'var(--error-bg)', border: '1px solid var(--error-border)', borderRadius: 'var(--radius-md)', marginBottom: '1.5rem', color: 'var(--error)', fontSize: '0.85rem' }}>
          <strong>Auto-Rejected History & Audit Trail:</strong> Applications that demonstrably failed objective eligibility requirements. All audit records, failed criteria, and applicant notifications are preserved here. Admins can reconsider or reopen applications anytime.
        </div>
      )}

      {/* Filter controls */}
      <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <input
          type="text"
          placeholder="Search name, email, or topics..."
          className="form-input"
          style={{ maxWidth: '300px' }}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          className="form-input"
          style={{ maxWidth: '200px' }}
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
        >
          <option value="ALL">All Types</option>
          <option value="PROFESSIONAL">Professional</option>
          <option value="PEER">Peer</option>
        </select>
      </div>

      <AdminErrorBoundary key={activeTab}>
        <div className="glass-card" style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '950px' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-subtle)', background: 'var(--bg-surface-elevated)' }}>
                <th style={{ padding: '1rem', color: 'var(--text-secondary)' }}>Mentor / Applicant</th>
                <th style={{ padding: '1rem', color: 'var(--text-secondary)' }}>Type</th>
                <th style={{ padding: '1rem', color: 'var(--text-secondary)' }}>Topics/Expertise</th>
                <th style={{ padding: '1rem', color: 'var(--text-secondary)' }}>Fee</th>
                <th style={{ padding: '1rem', color: 'var(--text-secondary)' }}>Screening Outcome</th>
                <th style={{ padding: '1rem', color: 'var(--text-secondary)' }}>Evaluated / Applied</th>
                <th style={{ padding: '1rem', textAlign: 'right', color: 'var(--text-secondary)' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan="7" style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>Loading mentors...</td></tr>
              ) : filteredMentors.length === 0 ? (
                <tr>
                  <td colSpan="7" style={{ padding: '3rem 1rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                    <div style={{ fontSize: '1.75rem', marginBottom: '0.5rem' }}>
                      {activeTab === 'AUTO_REJECTED' ? '🛡️' : '📋'}
                    </div>
                    <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.25rem' }}>
                      {activeTab === 'AUTO_REJECTED'
                        ? 'No auto-rejected applications found'
                        : 'No records found in this queue'}
                    </div>
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                      {activeTab === 'AUTO_REJECTED'
                        ? 'There are currently no mentor applications that failed automated screening.'
                        : search || filterType !== 'ALL'
                        ? 'No applications match your current search and type filters.'
                        : 'There are currently no mentor profiles in this queue.'}
                    </div>
                  </td>
                </tr>
              ) : (
                filteredMentors.map(mentor => {
                  const latestApp = getLatestApp(mentor);
                  const outcome = getMentorQueueOutcome(mentor);
                  const findings = latestApp?.aiScreening?.structuredFindings || {};
                  const failedCriteria = Array.isArray(findings.failedCriteria)
                    ? findings.failedCriteria
                    : (findings.failedCriteria ? [findings.failedCriteria] : []);
                  const rawConcerns = Array.isArray(findings.concerns)
                    ? findings.concerns
                    : Array.isArray(latestApp?.aiScreening?.riskFlags?.concerns)
                    ? latestApp.aiScreening.riskFlags.concerns
                    : (findings.concerns ? [findings.concerns] : []);
                  const firstFailedCriterion = failedCriteria.length > 0 ? formatCriterion(failedCriteria[0]) : '';
                  const firstConcern = rawConcerns.length > 0 ? formatCriterion(rawConcerns[0]) : '';

                  return (
                    <tr key={mentor.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                      <td style={{ padding: '1rem' }}>
                        <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{mentor.user?.name || 'Unnamed Mentor'}</div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{mentor.user?.email || '-'}</div>
                      </td>
                      <td style={{ padding: '1rem' }}>
                        <span className={`badge ${mentor.mentorType === 'PROFESSIONAL' ? 'badge-primary' : 'badge-secondary'}`}>
                          {mentor.mentorType}
                        </span>
                      </td>
                      <td style={{ padding: '1rem', color: 'var(--text-secondary)', maxWidth: '200px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {mentor.expertise || '-'}
                      </td>
                      <td style={{ padding: '1rem', color: 'var(--text-secondary)' }}>
                        {mentor.sessionFee ? formatCurrency(mentor.sessionFee) : mentor.hourlyRate ? formatCurrency(mentor.hourlyRate) : '-'}
                      </td>
                      <td style={{ padding: '1rem' }}>
                        {outcome === 'ELIGIBLE' && (
                          <div>
                            <span className="badge badge-success">
                              ✓ ELIGIBLE
                            </span>
                            <div style={{ fontSize: '0.75rem', color: 'var(--success)', marginTop: '0.25rem', fontWeight: 500 }}>Ready for Admin Approval</div>
                          </div>
                        )}
                        {outcome === 'MANUAL_REVIEW' && (
                          <div>
                            <span className="badge badge-warning">
                              ⚠ MANUAL REVIEW
                            </span>
                            {firstConcern && (
                              <div style={{ fontSize: '0.75rem', color: 'var(--warning)', marginTop: '0.25rem', maxWidth: '220px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontWeight: 500 }}>
                                {firstConcern}
                              </div>
                            )}
                          </div>
                        )}
                        {outcome === 'AUTO_REJECTED' && (
                          <div>
                            <span className="badge badge-danger">
                              ✕ AUTO-REJECTED
                            </span>
                            {firstFailedCriterion ? (
                              <div style={{ fontSize: '0.75rem', color: 'var(--error)', marginTop: '0.25rem', maxWidth: '220px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontWeight: 500 }}>
                                {firstFailedCriterion}
                              </div>
                            ) : latestApp?.rejectionReason && (
                              <div style={{ fontSize: '0.75rem', color: 'var(--error)', marginTop: '0.25rem', maxWidth: '220px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontWeight: 500 }}>
                                {latestApp.rejectionReason}
                              </div>
                            )}
                          </div>
                        )}
                        {outcome === 'APPROVED' && (
                          <span className="badge badge-success">ACTIVE MENTOR</span>
                        )}
                        {outcome === 'SUSPENDED' && (
                          <span className="badge badge-warning">SUSPENDED</span>
                        )}
                      </td>
                      <td style={{ padding: '1rem', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                        {new Date(latestApp?.createdAt || mentor.createdAt || Date.now()).toLocaleDateString()}
                      </td>
                      <td style={{ padding: '1rem', textAlign: 'right' }}>
                        <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                          <button
                            type="button"
                            className="btn btn-secondary"
                            onClick={() => handleAction(mentor)}
                            disabled={!latestApp}
                            title={!latestApp ? 'No application record found' : ''}
                            style={{ fontSize: '0.8rem', padding: '0.45rem 0.75rem' }}
                          >
                            {outcome === 'ELIGIBLE' ? 'Review & Approve' : outcome === 'MANUAL_REVIEW' ? 'Inspect Details' : 'View Application'}
                          </button>
                          {outcome === 'AUTO_REJECTED' && (
                            <button
                              type="button"
                              className="btn btn-primary"
                              onClick={() => setReconsiderModal({ open: true, mentor, reason: '', loading: false })}
                              disabled={!latestApp}
                              title={!latestApp ? 'No application record found' : 'Reconsider application'}
                              style={{ fontSize: '0.8rem', padding: '0.45rem 0.75rem' }}
                            >
                              Reconsider
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </AdminErrorBoundary>

      {/* Reconsideration Modal */}
      {reconsiderModal.open && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.6)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '1rem'
        }}>
          <div className="glass-card" style={{ maxWidth: '500px', width: '100%', padding: '2rem', background: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}>
            <h3 style={{ marginTop: 0, color: 'var(--text-primary)' }}>Reconsider Application</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '1rem' }}>
              Reopen <strong>{reconsiderModal.mentor?.user?.name}</strong>'s application for human administrative review. The applicant will be notified that their application has been reopened.
            </p>
            <div style={{ marginBottom: '1.25rem' }}>
              <label className="form-label">Reconsideration Reason / Audit Justification:</label>
              <textarea
                className="form-input"
                rows="3"
                placeholder="Reason for reopening this application..."
                value={reconsiderModal.reason}
                onChange={(e) => setReconsiderModal(prev => ({ ...prev, reason: e.target.value }))}
                disabled={reconsiderModal.loading}
              />
            </div>
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setReconsiderModal({ open: false, mentor: null, reason: '', loading: false })}
                disabled={reconsiderModal.loading}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleReconsiderSubmit}
                disabled={reconsiderModal.loading}
              >
                {reconsiderModal.loading ? 'Reopening...' : 'Confirm Reconsideration'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
