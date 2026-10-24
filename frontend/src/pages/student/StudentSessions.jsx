import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { fetchSessions } from '../../services/sessionService';
import { fetchStudentMentorships } from '../../services/mentorService';
import {
  fetchRefundEligibility,
  cancelSessionWithRefund,
  reportMentorNoShow,
  fetchMyRefunds
} from '../../services/refundService';
import { formatCurrency } from '../../utils/currency';
import SessionCountdown from '../../components/SessionCountdown';

export default function StudentSessions() {
  const [sessions, setSessions] = useState([]);
  const [mentorships, setMentorships] = useState([]);
  const [refunds, setRefunds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Booking Modal State
  const [showBookingModal, setShowBookingModal] = useState(false);
  const [bookingData, setBookingData] = useState({ mentorshipId: '', scheduledAtDate: '', scheduledAtTime: '', duration: '60' });

  // Cancel & Refund Modal State
  const [cancelModal, setCancelModal] = useState({
    isOpen: false,
    session: null,
    loadingEligibility: false,
    eligibility: null,
    reason: '',
    submitting: false,
    error: ''
  });

  // No-Show Report Modal State
  const [noShowModal, setNoShowModal] = useState({
    isOpen: false,
    session: null,
    notes: '',
    submitting: false,
    error: '',
    success: ''
  });

  const loadData = async () => {
    try {
      setLoading(true);
      const [sessionsData, mentorshipsData, refundsData] = await Promise.all([
        fetchSessions(),
        fetchStudentMentorships(),
        fetchMyRefunds().catch(() => [])
      ]);
      const activeMentorships = mentorshipsData.filter(m => m.status === 'ACTIVE');
      setSessions(sessionsData);
      setMentorships(activeMentorships);
      setRefunds(refundsData);
      if (activeMentorships.length > 0 && !bookingData.mentorshipId) {
        setBookingData(prev => ({ ...prev, mentorshipId: activeMentorships[0].id }));
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const openCancelModal = async (session) => {
    setCancelModal({
      isOpen: true,
      session,
      loadingEligibility: true,
      eligibility: null,
      reason: '',
      submitting: false,
      error: ''
    });

    try {
      const eligibility = await fetchRefundEligibility(session.id);
      setCancelModal(prev => ({
        ...prev,
        loadingEligibility: false,
        eligibility
      }));
    } catch (err) {
      setCancelModal(prev => ({
        ...prev,
        loadingEligibility: false,
        error: 'Failed to calculate refund eligibility. ' + err.message
      }));
    }
  };

  const handleConfirmCancel = async () => {
    if (!cancelModal.session) return;

    // If < 6h, require exceptional reason
    if (cancelModal.eligibility?.requiresAdminReview && !cancelModal.reason.trim()) {
      setCancelModal(prev => ({
        ...prev,
        error: 'Please provide a reason for this late cancellation / exceptional refund request.'
      }));
      return;
    }

    try {
      setCancelModal(prev => ({ ...prev, submitting: true, error: '' }));
      await cancelSessionWithRefund(cancelModal.session.id, cancelModal.reason);
      setCancelModal({ isOpen: false, session: null, loadingEligibility: false, eligibility: null, reason: '', submitting: false, error: '' });
      await loadData();
    } catch (err) {
      setCancelModal(prev => ({ ...prev, submitting: false, error: err.message }));
    }
  };

  const handleReportNoShow = async () => {
    if (!noShowModal.session) return;
    if (!noShowModal.notes.trim()) {
      setNoShowModal(prev => ({ ...prev, error: 'Please enter details regarding the mentor no-show.' }));
      return;
    }

    try {
      setNoShowModal(prev => ({ ...prev, submitting: true, error: '' }));
      await reportMentorNoShow(noShowModal.session.id, noShowModal.notes);
      setNoShowModal(prev => ({ ...prev, submitting: false, success: 'Mentor no-show refund request submitted for admin review.' }));
      setTimeout(() => {
        setNoShowModal({ isOpen: false, session: null, notes: '', submitting: false, error: '', success: '' });
        loadData();
      }, 1500);
    } catch (err) {
      setNoShowModal(prev => ({ ...prev, submitting: false, error: err.message }));
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

  const getRefundForSession = (sessionId) => {
    return refunds.find(r => r.sessionId === sessionId);
  };

  return (
    <div className="page-content">
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 className="page-title">My Sessions</h2>
          <p className="page-subtitle">Manage your mentoring sessions and refund requests.</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowBookingModal(true)}>
          Book New Session
        </button>
      </div>

      {/* BOOKING MODAL */}
      {showBookingModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div className="glass-card" style={{ padding: '2rem', width: '100%', maxWidth: '500px' }}>
            <h3 style={{ marginTop: 0, marginBottom: '1.5rem' }}>Book a Session</h3>

            {mentorships.length === 0 ? (
              <p style={{ color: 'var(--text-secondary)' }}>You don't have any active mentorships to book a session with.</p>
            ) : (
              <form onSubmit={(e) => {
                e.preventDefault();
                window.location.href = `/student/mentorships/${bookingData.mentorshipId}/book`;
              }}>
                <div style={{ marginBottom: '1.5rem' }}>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Select Mentor</label>
                  <select
                    className="form-input"
                    value={bookingData.mentorshipId}
                    onChange={e => setBookingData({...bookingData, mentorshipId: e.target.value})}
                    required
                  >
                    {mentorships.map(m => (
                      <option key={m.id} value={m.id}>{m.mentor?.user?.name}</option>
                    ))}
                  </select>
                </div>

                <div style={{ display: 'flex', gap: '1rem' }}>
                  <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>Continue</button>
                  <button type="button" className="btn btn-secondary" onClick={() => setShowBookingModal(false)}>Cancel</button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* CANCELLATION & REFUND POLICY MODAL */}
      {cancelModal.isOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem' }}>
          <div className="glass-card" style={{ padding: '2rem', width: '100%', maxWidth: '540px', maxHeight: '90vh', overflowY: 'auto' }}>
            <h3 style={{ marginTop: 0, marginBottom: '0.5rem', color: 'var(--error)' }}>Cancel Mentoring Session</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
              Review the refund policy calculation before confirming your cancellation.
            </p>

            {cancelModal.loadingEligibility ? (
              <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                Evaluating refund policy...
              </div>
            ) : cancelModal.eligibility ? (
              <div>
                {/* POLICY SUMMARY BOX */}
                <div style={{
                  padding: '1.25rem',
                  borderRadius: '8px',
                  marginBottom: '1.5rem',
                  background: cancelModal.eligibility.refundPercent === 100 ? 'var(--success-bg)' : cancelModal.eligibility.refundPercent === 50 ? 'var(--warning-bg)' : 'var(--error-bg)',
                  border: `1px solid var(--border-subtle)`
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                    <span style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-primary)' }}>Refund Determination</span>
                    <span style={{
                      padding: '0.2rem 0.6rem',
                      borderRadius: '12px',
                      fontSize: '0.75rem',
                      fontWeight: 700,
                      background: cancelModal.eligibility.refundPercent === 100 ? 'var(--success-bg)' : cancelModal.eligibility.refundPercent === 50 ? 'var(--warning-bg)' : 'var(--error-bg)',
                      color: cancelModal.eligibility.refundPercent === 100 ? 'var(--success)' : cancelModal.eligibility.refundPercent === 50 ? 'var(--warning)' : 'var(--error)',
                      border: '1px solid var(--border-subtle)'
                    }}>
                      {cancelModal.eligibility.refundPercent}% Refund
                    </span>
                  </div>
                  <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.5rem' }}>
                    {formatCurrency(cancelModal.eligibility.refundAmount)}
                  </div>
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                    {cancelModal.eligibility.reasonMessage}
                  </div>
                </div>

                {/* POLICY TIERS EXPLANATION */}
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '1.5rem', background: 'var(--bg-surface-elevated)', border: '1px solid var(--border-subtle)', padding: '0.75rem', borderRadius: '6px' }}>
                  <div style={{ fontWeight: 600, marginBottom: '0.3rem', color: 'var(--text-secondary)' }}>MentorConnect Refund Policy:</div>
                  • &gt; 24h before session: 100% refund<br/>
                  • 6–24h before session: 50% refund<br/>
                  • &lt; 6h before session: Requires Admin Review for exceptional cases
                </div>

                {/* REASON INPUT */}
                <div style={{ marginBottom: '1.5rem' }}>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                    {cancelModal.eligibility.requiresAdminReview ? 'Reason for Late Cancellation (Required for Admin Review):' : 'Reason for Cancellation (Optional):'}
                  </label>
                  <textarea
                    className="form-input"
                    value={cancelModal.reason}
                    onChange={e => setCancelModal(prev => ({ ...prev, reason: e.target.value }))}
                    placeholder="Enter details..."
                    rows={3}
                  />
                </div>
              </div>
            ) : null}

            {cancelModal.error && (
              <div style={{ padding: '0.75rem', background: 'var(--error-bg)', color: 'var(--error)', border: '1px solid var(--border-subtle)', borderRadius: '4px', marginBottom: '1rem', fontSize: '0.85rem' }}>
                {cancelModal.error}
              </div>
            )}

            <div style={{ display: 'flex', gap: '1rem' }}>
              <button
                onClick={handleConfirmCancel}
                disabled={cancelModal.submitting || cancelModal.loadingEligibility}
                className="btn btn-primary"
                style={{ flex: 1, background: 'var(--error)', borderColor: 'var(--error)', color: 'white' }}
              >
                {cancelModal.submitting ? 'Processing...' : 'Confirm Cancellation'}
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setCancelModal({ isOpen: false, session: null, loadingEligibility: false, eligibility: null, reason: '', submitting: false, error: '' })}
              >
                Keep Session
              </button>
            </div>
          </div>
        </div>
      )}

      {/* NO-SHOW REPORT MODAL */}
      {noShowModal.isOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem' }}>
          <div className="glass-card" style={{ padding: '2rem', width: '100%', maxWidth: '500px' }}>
            <h3 style={{ marginTop: 0, marginBottom: '0.5rem', color: 'var(--warning)' }}>Report Mentor No-Show</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
              If your mentor did not attend the scheduled session, you can submit a confirmed no-show report for a 100% refund.
            </p>

            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Details & Context:</label>
              <textarea
                className="form-input"
                value={noShowModal.notes}
                onChange={e => setNoShowModal(prev => ({ ...prev, notes: e.target.value }))}
                placeholder="Explain what happened (e.g., waited in meeting link for 15 minutes, mentor did not arrive)..."
                rows={4}
              />
            </div>

            {noShowModal.error && (
              <div style={{ padding: '0.75rem', background: 'var(--error-bg)', color: 'var(--error)', border: '1px solid var(--border-subtle)', borderRadius: '4px', marginBottom: '1rem', fontSize: '0.85rem' }}>
                {noShowModal.error}
              </div>
            )}

            {noShowModal.success && (
              <div style={{ padding: '0.75rem', background: 'var(--success-bg)', color: 'var(--success)', border: '1px solid var(--border-subtle)', borderRadius: '4px', marginBottom: '1rem', fontSize: '0.85rem' }}>
                {noShowModal.success}
              </div>
            )}

            <div style={{ display: 'flex', gap: '1rem' }}>
              <button
                onClick={handleReportNoShow}
                disabled={noShowModal.submitting}
                className="btn btn-primary"
                style={{ flex: 1, background: 'var(--warning)', borderColor: 'var(--warning)', color: 'white', fontWeight: 600 }}
              >
                {noShowModal.submitting ? 'Submitting...' : 'Submit No-Show Report'}
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setNoShowModal({ isOpen: false, session: null, notes: '', submitting: false, error: '', success: '' })}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {error && <div style={{ color: 'var(--error)', marginBottom: '1rem' }}>{error}</div>}

      {/* UPCOMING SESSIONS */}
      <div style={{ marginBottom: '3rem' }}>
        <h3 style={{ borderBottom: '1px solid var(--border-subtle)', paddingBottom: '0.5rem', marginBottom: '1.5rem' }}>Upcoming Sessions</h3>
        {upcoming.length === 0 ? (
          <p style={{ color: 'var(--text-muted)' }}>No upcoming sessions scheduled.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {upcoming.map(session => (
              <div key={session.id} className="glass-card" style={{ padding: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h4 style={{ margin: '0 0 0.5rem 0', color: 'var(--accent-primary)', fontSize: '1.2rem' }}>
                    {new Date(session.scheduledAt).toLocaleString([], { dateStyle: 'full', timeStyle: 'short' })}
                  </h4>
                  <div style={{ color: 'var(--text-primary)', marginBottom: '0.5rem' }}>
                    Mentor: <strong>{session.mentorship?.mentor?.user?.name}</strong>
                  </div>
                  <div style={{ display: 'flex', gap: '1.5rem', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                    <span>Duration: {session.duration} min</span>
                    {session.payment && <span>Paid: {formatCurrency(session.payment.amount)}</span>}
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', alignItems: 'flex-end', minWidth: '200px' }}>
                  <div style={{ width: '100%' }}>
                    <SessionCountdown
                      scheduledAt={session.scheduledAt}
                      duration={session.duration}
                      status={session.status}
                    />
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', width: '100%' }}>
                    {new Date() >= new Date(new Date(session.scheduledAt).getTime() - 10 * 60000) ? (
                      <Link to={`/student/sessions/${session.id}/live`} className="btn btn-primary" style={{ padding: '0.5rem', textDecoration: 'none', textAlign: 'center', width: '100%' }}>
                        Join Session
                      </Link>
                    ) : (
                      <button className="btn btn-secondary" disabled style={{ width: '100%', opacity: 0.5 }}>
                        Join (opens 10m before)
                      </button>
                    )}
                    <button
                      onClick={() => openCancelModal(session)}
                      style={{ width: '100%', background: 'var(--error-bg)', color: 'var(--error)', border: '1px solid var(--error-border)', padding: '0.5rem', borderRadius: 'var(--radius-sm)', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600 }}
                    >
                      Cancel & Refund Options
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* PAST & CANCELLED SESSIONS */}
      <div>
        <h3 style={{ borderBottom: '1px solid var(--border-subtle)', paddingBottom: '0.5rem', marginBottom: '1.5rem' }}>Past & Cancelled Sessions</h3>
        {past.length === 0 ? (
          <p style={{ color: 'var(--text-muted)' }}>No past sessions.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {past.map(session => {
              const sessionRefund = getRefundForSession(session.id);
              const isPaid = session.payment && session.payment.amount > 0;
              return (
                <div key={session.id} className="glass-card" style={{ padding: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', opacity: 0.9 }}>
                  <div>
                    <h4 style={{ margin: '0 0 0.5rem 0', color: 'var(--text-primary)', fontSize: '1.1rem' }}>
                      {new Date(session.scheduledAt).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}
                    </h4>
                    <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                      Mentor: {session.mentorship?.mentor?.user?.name} | {session.duration} min
                      {session.payment && ` | ${formatCurrency(session.payment.amount)}`}
                    </div>

                    {/* REFUND STATUS BADGE */}
                    {sessionRefund && (
                      <div style={{ marginTop: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem' }}>
                        <span style={{
                          padding: '0.15rem 0.5rem',
                          borderRadius: '10px',
                          fontWeight: 600,
                          fontSize: '0.75rem',
                          background: sessionRefund.status === 'PROCESSED' ? 'var(--success-bg)' : sessionRefund.status === 'FAILED' ? 'var(--error-bg)' : 'var(--warning-bg)',
                          color: sessionRefund.status === 'PROCESSED' ? 'var(--success)' : sessionRefund.status === 'FAILED' ? 'var(--error)' : 'var(--warning)',
                          border: '1px solid var(--border-subtle)'
                        }}>
                          Refund: {sessionRefund.status}
                        </span>
                        <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{formatCurrency(sessionRefund.amount)}</span>
                        <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>Ref: {sessionRefund.refundReference}</span>
                      </div>
                    )}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', alignItems: 'flex-end' }}>
                    <span style={{
                      padding: '0.25rem 0.75rem', borderRadius: '12px', fontSize: '0.8rem', fontWeight: 'bold',
                      background: session.status === 'COMPLETED' ? 'var(--success-bg)' : session.status === 'MISSED' ? 'var(--warning-bg)' : 'var(--error-bg)',
                      color: session.status === 'COMPLETED' ? 'var(--success)' : session.status === 'MISSED' ? 'var(--warning)' : 'var(--error)',
                      border: '1px solid var(--border-subtle)'
                    }}>
                      {session.status === 'MISSED' ? 'MISSED / NO-SHOW' : session.status}
                    </span>

                    {session.status === 'MISSED' && isPaid && !sessionRefund && (
                      <button
                        onClick={() => setNoShowModal({ isOpen: true, session, notes: '', submitting: false, error: '', success: '' })}
                        style={{ background: 'var(--warning-bg)', color: 'var(--warning)', border: '1px solid var(--border-subtle)', padding: '0.35rem 0.75rem', borderRadius: '4px', cursor: 'pointer', fontSize: '0.8rem' }}
                      >
                        Report Mentor No-Show
                      </button>
                    )}

                    {session.status === 'COMPLETED' && (
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <Link to={`/student/sessions/${session.id}/review`} style={{ fontSize: '0.85rem', color: 'var(--accent-primary)', textDecoration: 'underline' }}>
                          Rate Session
                        </Link>
                        <Link to={`/student/sessions/${session.id}/report`} style={{ fontSize: '0.85rem', color: 'var(--error)', textDecoration: 'underline' }}>
                          Report
                        </Link>
                      </div>
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
