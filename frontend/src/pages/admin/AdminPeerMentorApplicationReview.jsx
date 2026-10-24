import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { fetchPeerMentorApplicationById, updatePeerMentorApplicationStatus, reconsiderPeerMentorApplication } from '../../services/adminService';

const calculateAge = (dobString) => {
  if (!dobString) return null;
  const dob = new Date(dobString);
  const today = new Date();
  let age = today.getFullYear() - dob.getFullYear();
  const m = today.getMonth() - dob.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) {
    age--;
  }
  return age;
};

export default function AdminPeerMentorApplicationReview() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [application, setApplication] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [updating, setUpdating] = useState(false);
  const [reason, setReason] = useState('');
  const [reviewNotes, setReviewNotes] = useState('');
  const [confirmAction, setConfirmAction] = useState(null);
  const [showReconsiderModal, setShowReconsiderModal] = useState(false);
  const [reconsiderReason, setReconsiderReason] = useState('');

  useEffect(() => {
    loadApplication();
  }, [id]);

  const loadApplication = async () => {
    try {
      setLoading(true);
      const data = await fetchPeerMentorApplicationById(id);
      setApplication(data);
      setReviewNotes(data.reviewNotes || '');
      setError('');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleReconsider = async () => {
    try {
      setUpdating(true);
      setError('');
      await reconsiderPeerMentorApplication(id, reconsiderReason);
      setShowReconsiderModal(false);
      setReconsiderReason('');
      setSuccess('Application successfully reopened for administrative review.');
      setTimeout(() => {
        setSuccess('');
        loadApplication();
      }, 1500);
    } catch (err) {
      setError(err.message);
    } finally {
      setUpdating(false);
    }
  };

  const handleStatusUpdate = async (newStatus) => {
    try {
      setUpdating(true);
      setError('');
      const updateData = { status: newStatus, reviewNotes };
      if (newStatus === 'REJECTED' || newStatus === 'SUSPENDED') {
        if (!reason.trim()) {
          setError('A reason is required for rejection or suspension.');
          setUpdating(false);
          return;
        }
        updateData.rejectionReason = reason;
      }
      await updatePeerMentorApplicationStatus(id, updateData);
      setSuccess(`Application status updated to ${newStatus}.`);
      setConfirmAction(null);
      setReason('');
      setTimeout(() => {
        setSuccess('');
        loadApplication();
      }, 2000);
    } catch (err) {
      setError(err.message);
    } finally {
      setUpdating(false);
    }
  };

  const getStatusBadgeClass = (status) => {
    switch (status) {
      case 'APPROVED': return 'badge-success';
      case 'REJECTED': case 'SUSPENDED': return 'badge-error';
      case 'UNDER_REVIEW': case 'AI_SCREENED': return 'badge-primary';
      default: return 'badge-warning';
    }
  };

  if (loading) return <div className="page-content">Loading application...</div>;
  if (!application) return <div className="page-content"><div style={{ color: 'var(--error)' }}>{error || 'Application not found.'}</div></div>;

  const user = application.mentor?.user;
  const profile = user?.studentProfile;
  const screening = application.aiScreening;
  let parsedMotivation = null;
  try { parsedMotivation = JSON.parse(application.eligibilityInfo); } catch(e) { /* not JSON */ }

  return (
    <div className="page-content">
      <button onClick={() => navigate('/admin/peer-mentor-applications')} className="btn btn-secondary" style={{ marginBottom: '1.5rem' }}>
        ← Back to Applications
      </button>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <h2 className="page-title" style={{ margin: 0 }}>Peer Mentor Application Review</h2>
        <span className={`badge ${getStatusBadgeClass(application.status)}`} style={{ fontSize: '1rem', padding: '0.5rem 1rem' }}>
          {application.status.replace('_', ' ')}
        </span>
      </div>

      {error && <div style={{ color: 'var(--error)', background: 'var(--error-bg)', padding: '1rem', borderRadius: 'var(--radius-md)', marginBottom: '1rem', border: '1px solid var(--error-border)', fontWeight: 500 }}>{error}</div>}
      {success && <div style={{ color: 'var(--success)', background: 'var(--success-bg)', padding: '1rem', borderRadius: 'var(--radius-md)', marginBottom: '1rem', border: '1px solid var(--success-border)', fontWeight: 500 }}>{success}</div>}

      {/* Pre-Screening Outcome Banner */}
      {(() => {
        const findings = screening?.structuredFindings || {};
        const outcome = findings.outcome || findings.screeningOutcome || (application.status === 'REJECTED' ? 'AUTO_REJECTED' : application.status === 'AI_SCREENED' ? 'ELIGIBLE' : 'NEEDS_MANUAL_REVIEW');
        const failedCriteria = findings.failedCriteria || [];
        const concerns = findings.concerns || screening?.riskFlags?.concerns || [];
        const isReconsidered = findings.reconsideration?.isReconsidered;

        if (application.status === 'REJECTED' || outcome === 'AUTO_REJECTED') {
          return (
            <div style={{ padding: '1.25rem', background: 'var(--error-bg)', border: '1px solid var(--error-border)', borderRadius: 'var(--radius-md)', marginBottom: '1.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem', flexWrap: 'wrap' }}>
                <span className="badge badge-danger" style={{ fontSize: '0.85rem' }}>✕ AUTO-REJECTED</span>
                <strong style={{ color: 'var(--error)' }}>Objective Criteria Verification Failed</strong>
                {application.reviewedAt && (
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginLeft: 'auto' }}>
                    Decision Timestamp: {new Date(application.reviewedAt).toLocaleString()}
                  </span>
                )}
              </div>
              <p style={{ margin: '0 0 0.5rem 0', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                This peer mentor application was automatically rejected because it demonstrably failed published mandatory eligibility requirements. The applicant was notified with corrective guidance.
              </p>
              {failedCriteria.length > 0 ? (
                <div style={{ marginTop: '0.5rem' }}>
                  <strong style={{ fontSize: '0.85rem', color: 'var(--error)' }}>Failed Mandatory Requirements:</strong>
                  <ul style={{ margin: '0.25rem 0 0 1.25rem', color: 'var(--error)', fontSize: '0.85rem' }}>
                    {failedCriteria.map((c, i) => (
                      <li key={i}>{typeof c === 'string' ? c : (c?.message || c?.code || JSON.stringify(c))}</li>
                    ))}
                  </ul>
                </div>
              ) : application.rejectionReason && (
                <div style={{ color: 'var(--error)', fontSize: '0.85rem' }}>
                  <strong>Failed Requirement:</strong> {application.rejectionReason}
                </div>
              )}
            </div>
          );
        }

        if (application.status === 'UNDER_REVIEW' || outcome === 'NEEDS_MANUAL_REVIEW') {
          return (
            <div style={{ padding: '1.25rem', background: 'var(--warning-bg)', border: '1px solid var(--warning-border)', borderRadius: 'var(--radius-md)', marginBottom: '1.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem', flexWrap: 'wrap' }}>
                <span className="badge badge-warning" style={{ fontSize: '0.85rem' }}>⚠ NEEDS MANUAL REVIEW</span>
                <strong style={{ color: 'var(--warning)' }}>Inconclusive or Ambiguous Evidence Detected</strong>
                {isReconsidered && (
                  <span className="badge badge-primary" style={{ fontSize: '0.75rem' }}>
                    Reopened by Admin
                  </span>
                )}
              </div>
              <p style={{ margin: '0 0 0.5rem 0', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                This application requires manual human evaluation because the AI verification returned inconclusive results or evidence requiring human discretion.
              </p>
              {concerns.length > 0 && (
                <div style={{ marginTop: '0.5rem' }}>
                  <strong style={{ fontSize: '0.85rem', color: 'var(--warning)' }}>Flagged Review Areas / Inconsistencies:</strong>
                  <ul style={{ margin: '0.25rem 0 0 1.25rem', color: 'var(--warning)', fontSize: '0.85rem' }}>
                    {concerns.map((c, i) => <li key={i}>{c}</li>)}
                  </ul>
                </div>
              )}
            </div>
          );
        }

        if (application.status === 'AI_SCREENED' || outcome === 'ELIGIBLE') {
          return (
            <div style={{ padding: '1.25rem', background: 'var(--success-bg)', border: '1px solid var(--success-border)', borderRadius: 'var(--radius-md)', marginBottom: '1.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
                <span className="badge badge-success" style={{ fontSize: '0.85rem' }}>✓ ELIGIBLE — PRE-SCREENING PASSED</span>
                <strong style={{ color: 'var(--success)' }}>Mandatory Criteria Satisfied</strong>
              </div>
              <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                All published objective peer mentor requirements have been confirmed. This application is ready for final administrative approval.
              </p>
            </div>
          );
        }

        return null;
      })()}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
        {/* Section 1: Applicant Information */}
        <div className="glass-card" style={{ padding: '1.5rem' }}>
          <h3 style={{ marginTop: 0, marginBottom: '1rem', color: 'var(--text-primary)' }}>Applicant Information</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
            <div><strong style={{ color: 'var(--text-primary)' }}>Name:</strong> {user?.name || 'N/A'}</div>
            <div><strong style={{ color: 'var(--text-primary)' }}>Email:</strong> {user?.email || 'N/A'}</div>
            {user?.dateOfBirth && (
              <>
                <div><strong style={{ color: 'var(--text-primary)' }}>DOB:</strong> {new Date(user.dateOfBirth).toLocaleDateString()}</div>
                <div><strong style={{ color: 'var(--text-primary)' }}>Age:</strong> {calculateAge(user.dateOfBirth)}</div>
                <div><strong style={{ color: 'var(--text-primary)' }}>Category:</strong> {calculateAge(user.dateOfBirth) < 18 ? 'Minor' : 'Adult'}</div>
              </>
            )}
            <div><strong style={{ color: 'var(--text-primary)' }}>Role:</strong> {user?.role || 'N/A'}</div>
            <div><strong style={{ color: 'var(--text-primary)' }}>Account Active:</strong> {user?.isActive ? 'Yes' : 'No'}</div>
            <div><strong style={{ color: 'var(--text-primary)' }}>Suspended:</strong> {user?.isSuspended ? 'Yes' : 'No'}</div>
            <div><strong style={{ color: 'var(--text-primary)' }}>Member Since:</strong> {user?.createdAt ? new Date(user.createdAt).toLocaleDateString() : 'N/A'}</div>
          </div>
        </div>

        {/* Section 2: Learning Profile */}
        <div className="glass-card" style={{ padding: '1.5rem' }}>
          <h3 style={{ marginTop: 0, marginBottom: '1rem', color: 'var(--text-primary)' }}>Learning Profile</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
            <div><strong style={{ color: 'var(--text-primary)' }}>Education:</strong> {profile?.education || 'N/A'}</div>
            <div><strong style={{ color: 'var(--text-primary)' }}>Experience Level:</strong> {profile?.experienceLevel || 'N/A'}</div>
            <div><strong style={{ color: 'var(--text-primary)' }}>Skills:</strong> {profile?.skills || 'N/A'}</div>
            <div><strong style={{ color: 'var(--text-primary)' }}>Interests:</strong> {profile?.interests || 'N/A'}</div>
            <div><strong style={{ color: 'var(--text-primary)' }}>Career Goal:</strong> {profile?.careerGoal || 'N/A'}</div>
            <div><strong style={{ color: 'var(--text-primary)' }}>Learning Style:</strong> {profile?.preferredLearningStyle || 'N/A'}</div>
            <div><strong style={{ color: 'var(--text-primary)' }}>Language:</strong> {profile?.preferredLanguage || 'N/A'}</div>
            <div><strong style={{ color: 'var(--text-primary)' }}>Study Availability:</strong> {profile?.studyAvailability || 'N/A'}</div>
            <div><strong style={{ color: 'var(--text-primary)' }}>Onboarding:</strong> {profile?.onboardingCompleted ? '✓ Complete' : '✗ Incomplete'}</div>
          </div>
        </div>

        {/* Section 3: Peer Mentor Application / Motivation */}
        <div className="glass-card" style={{ padding: '1.5rem' }}>
          <h3 style={{ marginTop: 0, marginBottom: '1rem', color: 'var(--text-primary)' }}>Peer Mentor Application</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
            <div><strong style={{ color: 'var(--text-primary)' }}>Submitted:</strong> {new Date(application.createdAt).toLocaleDateString()}</div>
            {parsedMotivation ? (
              <>
                <div><strong style={{ color: 'var(--text-primary)' }}>Motivation:</strong> {parsedMotivation.motivation || 'N/A'}</div>
                <div><strong style={{ color: 'var(--text-primary)' }}>Topics:</strong> {parsedMotivation.topics || 'N/A'}</div>
                <div><strong style={{ color: 'var(--text-primary)' }}>Teaching Experience:</strong> {parsedMotivation.teachingExperience || 'N/A'}</div>
              </>
            ) : (
              <div><strong style={{ color: 'var(--text-primary)' }}>Application Info:</strong> {application.eligibilityInfo || 'N/A'}</div>
            )}
            {application.rejectionReason && (
              <div style={{ marginTop: '0.5rem', padding: '0.75rem', background: 'var(--error-bg)', borderRadius: '6px', border: '1px solid var(--error-border)', color: 'var(--error)' }}>
                <strong>Rejection/Suspension Reason:</strong>
                <div style={{ marginTop: '0.25rem' }}>{application.rejectionReason}</div>
              </div>
            )}
          </div>
        </div>

        {/* Section 4: AI Preliminary Screening */}
        <div className="glass-card" style={{ padding: '1.5rem' }}>
          <h3 style={{ marginTop: 0, marginBottom: '0.5rem', color: 'var(--text-primary)' }}>AI Preliminary Screening</h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginBottom: '1rem', fontStyle: 'italic' }}>
            AI screening is advisory. Final approval is made by an administrator.
          </p>
          {screening ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', fontSize: '0.9rem' }}>
              <div>
                <strong style={{ color: 'var(--text-primary)' }}>Recommendation:</strong>
                <div style={{ color: 'var(--text-secondary)', marginTop: '0.25rem' }}>{screening.recommendation}</div>
              </div>
              {screening.structuredFindings?.strengths?.length > 0 && (
                <div>
                  <strong style={{ color: 'var(--success)' }}>Strengths:</strong>
                  <ul style={{ margin: '0.25rem 0 0 1.2rem', color: 'var(--text-secondary)' }}>
                    {screening.structuredFindings.strengths.map((s, i) => <li key={i}>{s}</li>)}
                  </ul>
                </div>
              )}
              {screening.structuredFindings?.concerns?.length > 0 && (
                <div>
                  <strong style={{ color: 'var(--warning)' }}>Concerns:</strong>
                  <ul style={{ margin: '0.25rem 0 0 1.2rem', color: 'var(--text-secondary)' }}>
                    {screening.structuredFindings.concerns.map((c, i) => <li key={i}>{c}</li>)}
                  </ul>
                </div>
              )}
              {screening.structuredFindings?.developmentAreas?.length > 0 && (
                <div>
                  <strong style={{ color: 'var(--info)' }}>Development Areas:</strong>
                  <ul style={{ margin: '0.25rem 0 0 1.2rem', color: 'var(--text-secondary)' }}>
                    {screening.structuredFindings.developmentAreas.map((d, i) => <li key={i}>{d}</li>)}
                  </ul>
                </div>
              )}
              {screening.riskFlags && (Array.isArray(screening.riskFlags) ? screening.riskFlags.length > 0 : Object.keys(screening.riskFlags).length > 0) && (
                <div>
                  <strong style={{ color: 'var(--error)' }}>Risk Flags:</strong>
                  <ul style={{ margin: '0.25rem 0 0 1.2rem', color: 'var(--text-secondary)' }}>
                    {Array.isArray(screening.riskFlags)
                      ? screening.riskFlags.map((r, i) => <li key={i}>{r}</li>)
                      : <li>Flagged items present</li>}
                  </ul>
                </div>
              )}
            </div>
          ) : (
            <div style={{ color: 'var(--text-muted)' }}>No AI screening has been performed yet.</div>
          )}
        </div>
      </div>

      {/* Section 5: Admin Decision */}
      <div className="glass-card" style={{ padding: '2rem', marginTop: '2rem' }}>
        <h3 style={{ marginTop: 0, marginBottom: '1.5rem', color: 'var(--text-primary)' }}>Admin Decision</h3>

        <div style={{ marginBottom: '1.5rem' }}>
          <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-secondary)' }}>Review Notes (optional):</label>
          <textarea
            className="form-input"
            value={reviewNotes}
            onChange={(e) => setReviewNotes(e.target.value)}
            rows="3"
            placeholder="Internal review notes..."
          />
        </div>

        {/* Confirmation dialog */}
        {confirmAction && (
          <div style={{ marginBottom: '1.5rem', padding: '1.5rem', background: 'var(--bg-surface-elevated)', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
            <h4 style={{ marginTop: 0, color: 'var(--text-primary)' }}>
              Confirm: {confirmAction === 'APPROVED' ? 'Approve' : confirmAction === 'REJECTED' ? 'Reject' : confirmAction === 'SUSPENDED' ? 'Suspend' : confirmAction.replace('_', ' ')} this application?
            </h4>

            {(confirmAction === 'REJECTED' || confirmAction === 'SUSPENDED') && (
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--error)' }}>Reason (required):</label>
                <textarea
                  className="form-input"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  rows="3"
                  required
                  placeholder={`Reason for ${confirmAction.toLowerCase()}...`}
                />
              </div>
            )}

            <div style={{ display: 'flex', gap: '1rem' }}>
              <button
                className="btn btn-primary"
                style={{ background: confirmAction === 'APPROVED' ? 'var(--success)' : 'var(--error)', borderColor: confirmAction === 'APPROVED' ? 'var(--success)' : 'var(--error)', color: '#FFFFFF' }}
                onClick={() => handleStatusUpdate(confirmAction)}
                disabled={updating}
              >
                {updating ? 'Processing...' : `Yes, ${confirmAction === 'APPROVED' ? 'Approve' : confirmAction === 'REJECTED' ? 'Reject' : 'Suspend'}`}
              </button>
              <button className="btn btn-secondary" onClick={() => { setConfirmAction(null); setReason(''); }} disabled={updating}>
                Cancel
              </button>
            </div>
          </div>
        )}

        {!confirmAction && (
          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
            {application.status === 'AI_SCREENED' && (
              <>
                <button className="btn btn-primary" style={{ background: 'var(--success)', borderColor: 'var(--success)', color: '#FFFFFF' }} onClick={() => handleStatusUpdate('APPROVED')} disabled={updating}>
                  ✓ Final Approve Peer Mentor
                </button>
                <button className="btn btn-secondary" onClick={() => handleStatusUpdate('UNDER_REVIEW')} disabled={updating}>
                  Move to Human Review
                </button>
                <button className="btn btn-secondary" style={{ color: 'var(--error)', borderColor: 'var(--error-border)' }} onClick={() => setConfirmAction('REJECTED')} disabled={updating}>
                  Reject
                </button>
              </>
            )}
            {application.status === 'PENDING' && (
              <button className="btn btn-primary" onClick={() => handleStatusUpdate('UNDER_REVIEW')} disabled={updating}>
                {updating ? 'Processing...' : 'Start Review'}
              </button>
            )}
            {application.status === 'UNDER_REVIEW' && (
              <>
                <button className="btn btn-primary" style={{ background: 'var(--success)', borderColor: 'var(--success)', color: '#FFFFFF' }} onClick={() => setConfirmAction('APPROVED')} disabled={updating}>
                  Approve
                </button>
                <button className="btn btn-secondary" style={{ color: 'var(--error)', borderColor: 'var(--error-border)' }} onClick={() => setConfirmAction('REJECTED')} disabled={updating}>
                  Reject
                </button>
              </>
            )}
            {application.status === 'REJECTED' && (
              <button className="btn btn-primary" onClick={() => setShowReconsiderModal(true)} disabled={updating}>
                🔄 Reopen / Reconsider Application
              </button>
            )}
            {application.status === 'APPROVED' && (
              <button className="btn btn-secondary" style={{ color: 'var(--error)', borderColor: 'var(--error-border)' }} onClick={() => setConfirmAction('SUSPENDED')} disabled={updating}>
                Suspend Peer Mentor
              </button>
            )}
          </div>
        )}
      </div>

      {/* Reconsideration Modal */}
      {showReconsiderModal && (
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
            <h3 style={{ marginTop: 0, color: 'var(--text-primary)' }}>Reconsider Peer Application</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '1rem' }}>
              Reopen <strong>{user?.name}</strong>'s peer mentor application for human administrative review. The applicant will be notified that their application has been reopened.
            </p>
            <div style={{ marginBottom: '1.25rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-secondary)' }}>Reconsideration Reason / Audit Justification:</label>
              <textarea
                className="form-input"
                rows="3"
                placeholder="Reason for reopening this application..."
                value={reconsiderReason}
                onChange={(e) => setReconsiderReason(e.target.value)}
                disabled={updating}
              />
            </div>
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => { setShowReconsiderModal(false); setReconsiderReason(''); }}
                disabled={updating}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleReconsider}
                disabled={updating}
              >
                {updating ? 'Reopening...' : 'Confirm Reconsideration'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
