import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { fetchSessions, completeSession } from '../../services/sessionService';
import { cancelSessionWithRefund } from '../../services/refundService';
import { formatCurrency } from '../../utils/currency';
import SessionCountdown from '../../components/SessionCountdown';

export default function MentorSessions() {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Cancel Modal State
  const [cancelModal, setCancelModal] = useState({
    isOpen: false,
    session: null,
    reason: '',
    submitting: false,
    error: ''
  });

  const loadSessions = async () => {
    try {
      setLoading(true);
      const data = await fetchSessions();
      setSessions(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSessions();
  }, []);

  const openCancelModal = (session) => {
    setCancelModal({
      isOpen: true,
      session,
      reason: '',
      submitting: false,
      error: ''
    });
  };

  const handleConfirmCancel = async () => {
    if (!cancelModal.session) return;
    try {
      setCancelModal(prev => ({ ...prev, submitting: true, error: '' }));
      await cancelSessionWithRefund(cancelModal.session.id, cancelModal.reason);
      setCancelModal({ isOpen: false, session: null, reason: '', submitting: false, error: '' });
      await loadSessions();
    } catch (err) {
      setCancelModal(prev => ({ ...prev, submitting: false, error: err.message }));
    }
  };

  const handleCompleteSession = async (id) => {
    if (!window.confirm('Mark this session as completed?')) return;
    try {
      await completeSession(id);
      await loadSessions();
    } catch (err) {
      alert(err.message);
    }
  };

  if (loading) return <div className="page-content">Loading sessions...</div>;

  const now = new Date();
  const upcoming = sessions.filter(s => {
    const sessionEnd = new Date(new Date(s.scheduledAt).getTime() + s.duration * 60000);
    if (now > sessionEnd || s.status !== 'SCHEDULED') return false;
    if (s.payment && s.payment.amount > 0 && s.payment.status !== 'PAID') return false;
    return true;
  });
  const past = sessions.filter(s => {
    const sessionEnd = new Date(new Date(s.scheduledAt).getTime() + s.duration * 60000);
    if (s.status === 'SCHEDULED' && now <= sessionEnd) return false;
    if (s.status === 'SCHEDULED' && s.payment && s.payment.amount > 0 && s.payment.status !== 'PAID') return false;
    return true;
  });

  return (
    <div className="page-content">
      <div className="page-header">
        <div>
          <h2 className="page-title">Session Schedule</h2>
          <p className="page-subtitle">Manage your upcoming mentoring sessions with students.</p>
        </div>
      </div>

      {/* CANCEL MODAL */}
      {cancelModal.isOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem' }}>
          <div className="glass-card" style={{ padding: '2rem', width: '100%', maxWidth: '500px' }}>
            <h3 style={{ marginTop: 0, marginBottom: '0.5rem', color: 'var(--error)' }}>Cancel Mentoring Session</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '1rem' }}>
              Student: <strong>{cancelModal.session?.mentorship?.student?.user?.name}</strong>
            </p>

            {cancelModal.session?.payment && cancelModal.session.payment.amount > 0 ? (
              <div style={{ padding: '1rem', background: 'var(--error-bg)', border: '1px solid var(--border-subtle)', borderRadius: '6px', marginBottom: '1.25rem', fontSize: '0.85rem', color: 'var(--error)' }}>
                <strong>Refund Notice:</strong> Because this is a paid session ({formatCurrency(cancelModal.session.payment.amount)}), cancelling will automatically initiate a <strong>100% refund</strong> back to the student.
              </div>
            ) : (
              <div style={{ padding: '1rem', background: 'var(--bg-surface-elevated)', border: '1px solid var(--border-subtle)', borderRadius: '6px', marginBottom: '1.25rem', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                This is a free or unpaid session. The slot will be released immediately.
              </div>
            )}

            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Reason for Cancellation:</label>
              <textarea
                className="form-input"
                value={cancelModal.reason}
                onChange={e => setCancelModal(prev => ({ ...prev, reason: e.target.value }))}
                placeholder="Reason provided will be sent to the student..."
                rows={3}
              />
            </div>

            {cancelModal.error && (
              <div style={{ padding: '0.75rem', background: 'var(--error-bg)', color: 'var(--error)', border: '1px solid var(--border-subtle)', borderRadius: '4px', marginBottom: '1rem', fontSize: '0.85rem' }}>
                {cancelModal.error}
              </div>
            )}

            <div style={{ display: 'flex', gap: '1rem' }}>
              <button
                onClick={handleConfirmCancel}
                disabled={cancelModal.submitting}
                className="btn btn-primary"
                style={{ flex: 1, background: 'var(--error)', borderColor: 'var(--error)', color: 'white' }}
              >
                {cancelModal.submitting ? 'Cancelling...' : 'Confirm Cancellation'}
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setCancelModal({ isOpen: false, session: null, reason: '', submitting: false, error: '' })}
              >
                Keep Session
              </button>
            </div>
          </div>
        </div>
      )}

      {error && <div style={{ color: 'var(--error)', marginBottom: '1rem' }}>{error}</div>}

      <div style={{ marginBottom: '3rem' }}>
        <h3 style={{ borderBottom: '1px solid var(--border-subtle)', paddingBottom: '0.5rem', marginBottom: '1.5rem' }}>Upcoming Sessions</h3>
        {upcoming.length === 0 ? (
          <p style={{ color: 'var(--text-muted)' }}>No upcoming sessions scheduled.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {upcoming.map(session => {
              const sessionEnd = new Date(new Date(session.scheduledAt).getTime() + (session.duration || 0) * 60000);
              const canComplete = new Date() >= sessionEnd;
              return (
                <div key={session.id} className="glass-card" style={{ padding: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <h4 style={{ margin: '0 0 0.5rem 0', color: 'var(--accent-primary)', fontSize: '1.2rem' }}>
                      {new Date(session.scheduledAt).toLocaleString([], { dateStyle: 'full', timeStyle: 'short' })}
                    </h4>
                    <div style={{ color: 'var(--text-primary)', marginBottom: '0.5rem' }}>
                      Student: <strong>{session.mentorship?.student?.user?.name}</strong>
                    </div>
                    <div style={{ display: 'flex', gap: '1.5rem', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                      <span>Duration: {session.duration} min</span>
                      {session.payment && <span>Fee: {formatCurrency(session.payment.amount)}</span>}
                    </div>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', alignItems: 'flex-end' }}>
                    <SessionCountdown
                      scheduledAt={session.scheduledAt}
                      duration={session.duration}
                      status={session.status}
                    />

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', alignItems: 'flex-end', width: '100%' }}>
                      {new Date() >= new Date(new Date(session.scheduledAt).getTime() - 10 * 60000) ? (
                        <Link to={`/mentor/sessions/${session.id}/live`} className="btn btn-primary" style={{ padding: '0.5rem 1rem', textDecoration: 'none', textAlign: 'center', width: '100%' }}>
                          Join Session
                        </Link>
                      ) : (
                        <button className="btn btn-secondary" disabled style={{ width: '100%', opacity: 0.5 }}>
                          Join (opens 10m before)
                        </button>
                      )}
                      <div style={{ display: 'flex', gap: '0.5rem', width: '100%' }}>
                        {canComplete && (
                          <button onClick={() => handleCompleteSession(session.id)} style={{ flex: 1, background: 'var(--success-bg)', color: 'var(--success)', border: '1px solid var(--border-subtle)', padding: '0.5rem', borderRadius: '4px', cursor: 'pointer', fontSize: '0.85rem' }}>
                            Mark Complete
                          </button>
                        )}
                        <button onClick={() => openCancelModal(session)} style={{ flex: 1, background: 'var(--error-bg)', color: 'var(--error)', border: '1px solid var(--border-subtle)', padding: '0.5rem', borderRadius: '4px', cursor: 'pointer', fontSize: '0.85rem' }}>
                          Cancel
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div>
        <h3 style={{ borderBottom: '1px solid var(--border-subtle)', paddingBottom: '0.5rem', marginBottom: '1.5rem' }}>Past & Cancelled Sessions</h3>
        {past.length === 0 ? (
          <p style={{ color: 'var(--text-muted)' }}>No past sessions.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {past.map(session => {
              const sessionEnd = new Date(new Date(session.scheduledAt).getTime() + (session.duration || 0) * 60000);
              const canComplete = session.status !== 'COMPLETED' && session.status !== 'CANCELLED' && new Date() >= sessionEnd;
              return (
                <div key={session.id} className="glass-card" style={{ padding: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', opacity: canComplete ? 1 : 0.8 }}>
                  <div>
                    <h4 style={{ margin: '0 0 0.5rem 0', color: 'var(--text-primary)', fontSize: '1.1rem' }}>
                      {new Date(session.scheduledAt).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}
                    </h4>
                    <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                      Student: {session.mentorship?.student?.user?.name} | {session.duration} min
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <span style={{
                      padding: '0.25rem 0.75rem', borderRadius: '12px', fontSize: '0.8rem', fontWeight: 'bold',
                      background: session.status === 'COMPLETED' ? 'var(--success-bg)' : session.status === 'MISSED' ? 'var(--warning-bg)' : session.status === 'SCHEDULED' ? 'var(--info-bg)' : 'var(--error-bg)',
                      color: session.status === 'COMPLETED' ? 'var(--success)' : session.status === 'MISSED' ? 'var(--warning)' : session.status === 'SCHEDULED' ? 'var(--info)' : 'var(--error)',
                      border: '1px solid var(--border-subtle)'
                    }}>
                      {session.status}
                    </span>
                    {canComplete && (
                      <button
                        onClick={() => handleCompleteSession(session.id)}
                        style={{ background: 'var(--success-bg)', color: 'var(--success)', border: '1px solid var(--border-subtle)', padding: '0.4rem 0.8rem', borderRadius: '4px', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600 }}
                      >
                        Mark Complete
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
