import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { fetchPeerMentorApplicationById, updatePeerMentorApplicationStatus } from '../../services/adminService';

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
  if (!application) return <div className="page-content"><div style={{ color: '#ef4444' }}>{error || 'Application not found.'}</div></div>;

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

      {error && <div style={{ color: '#ef4444', marginBottom: '1rem' }}>{error}</div>}
      {success && <div style={{ color: '#10b981', background: 'rgba(16,185,129,0.1)', padding: '1rem', borderRadius: '8px', marginBottom: '1rem', border: '1px solid #10b981' }}>{success}</div>}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
        {/* Section 1: Applicant Information */}
        <div className="glass-card" style={{ padding: '1.5rem' }}>
          <h3 style={{ marginTop: 0, marginBottom: '1rem', color: 'white' }}>Applicant Information</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
            <div><strong style={{ color: 'var(--text-primary)' }}>Name:</strong> {user?.name || 'N/A'}</div>
            <div><strong style={{ color: 'var(--text-primary)' }}>Email:</strong> {user?.email || 'N/A'}</div>
            <div><strong style={{ color: 'var(--text-primary)' }}>Role:</strong> {user?.role || 'N/A'}</div>
            <div><strong style={{ color: 'var(--text-primary)' }}>Account Active:</strong> {user?.isActive ? 'Yes' : 'No'}</div>
            <div><strong style={{ color: 'var(--text-primary)' }}>Suspended:</strong> {user?.isSuspended ? 'Yes' : 'No'}</div>
            <div><strong style={{ color: 'var(--text-primary)' }}>Member Since:</strong> {user?.createdAt ? new Date(user.createdAt).toLocaleDateString() : 'N/A'}</div>
          </div>
        </div>

        {/* Section 2: Learning Profile */}
        <div className="glass-card" style={{ padding: '1.5rem' }}>
          <h3 style={{ marginTop: 0, marginBottom: '1rem', color: 'white' }}>Learning Profile</h3>
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
          <h3 style={{ marginTop: 0, marginBottom: '1rem', color: 'white' }}>Peer Mentor Application</h3>
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
              <div style={{ marginTop: '0.5rem', padding: '0.75rem', background: 'rgba(239,68,68,0.1)', borderRadius: '6px', border: '1px solid rgba(239,68,68,0.3)' }}>
                <strong style={{ color: '#ef4444' }}>Rejection/Suspension Reason:</strong>
                <div style={{ marginTop: '0.25rem' }}>{application.rejectionReason}</div>
              </div>
            )}
          </div>
        </div>

        {/* Section 4: AI Preliminary Screening */}
        <div className="glass-card" style={{ padding: '1.5rem' }}>
          <h3 style={{ marginTop: 0, marginBottom: '0.5rem', color: 'white' }}>AI Preliminary Screening</h3>
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
                  <strong style={{ color: '#10b981' }}>Strengths:</strong>
                  <ul style={{ margin: '0.25rem 0 0 1.2rem', color: 'var(--text-secondary)' }}>
                    {screening.structuredFindings.strengths.map((s, i) => <li key={i}>{s}</li>)}
                  </ul>
                </div>
              )}
              {screening.structuredFindings?.concerns?.length > 0 && (
                <div>
                  <strong style={{ color: '#f59e0b' }}>Concerns:</strong>
                  <ul style={{ margin: '0.25rem 0 0 1.2rem', color: 'var(--text-secondary)' }}>
                    {screening.structuredFindings.concerns.map((c, i) => <li key={i}>{c}</li>)}
                  </ul>
                </div>
              )}
              {screening.structuredFindings?.developmentAreas?.length > 0 && (
                <div>
                  <strong style={{ color: '#3b82f6' }}>Development Areas:</strong>
                  <ul style={{ margin: '0.25rem 0 0 1.2rem', color: 'var(--text-secondary)' }}>
                    {screening.structuredFindings.developmentAreas.map((d, i) => <li key={i}>{d}</li>)}
                  </ul>
                </div>
              )}
              {screening.riskFlags && (Array.isArray(screening.riskFlags) ? screening.riskFlags.length > 0 : Object.keys(screening.riskFlags).length > 0) && (
                <div>
                  <strong style={{ color: '#ef4444' }}>Risk Flags:</strong>
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
        <h3 style={{ marginTop: 0, marginBottom: '1.5rem', color: 'white' }}>Admin Decision</h3>

        <div style={{ marginBottom: '1.5rem' }}>
          <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-secondary)' }}>Review Notes (optional):</label>
          <textarea
            value={reviewNotes}
            onChange={(e) => setReviewNotes(e.target.value)}
            rows="3"
            style={{ width: '100%', padding: '0.75rem', borderRadius: '4px', border: '1px solid var(--border-subtle)', background: 'rgba(0,0,0,0.2)', color: 'white', resize: 'vertical' }}
            placeholder="Internal review notes..."
          />
        </div>

        {/* Confirmation dialog */}
        {confirmAction && (
          <div style={{ marginBottom: '1.5rem', padding: '1.5rem', background: 'rgba(255,255,255,0.05)', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
            <h4 style={{ marginTop: 0, color: 'white' }}>
              Confirm: {confirmAction === 'APPROVED' ? 'Approve' : confirmAction === 'REJECTED' ? 'Reject' : confirmAction === 'SUSPENDED' ? 'Suspend' : confirmAction.replace('_', ' ')} this application?
            </h4>
            
            {(confirmAction === 'REJECTED' || confirmAction === 'SUSPENDED') && (
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-secondary)' }}>Reason (required):</label>
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  rows="3"
                  required
                  style={{ width: '100%', padding: '0.75rem', borderRadius: '4px', border: '1px solid var(--border-subtle)', background: 'rgba(0,0,0,0.2)', color: 'white', resize: 'vertical' }}
                  placeholder={`Reason for ${confirmAction.toLowerCase()}...`}
                />
              </div>
            )}

            <div style={{ display: 'flex', gap: '1rem' }}>
              <button 
                className="btn" 
                style={{ background: confirmAction === 'APPROVED' ? '#10b981' : '#ef4444', color: 'white' }}
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
            {(application.status === 'AI_SCREENED' || application.status === 'PENDING') && (
              <button className="btn" style={{ background: '#3b82f6', color: 'white' }} onClick={() => handleStatusUpdate('UNDER_REVIEW')} disabled={updating}>
                {updating ? 'Processing...' : 'Start Review'}
              </button>
            )}
            {application.status === 'UNDER_REVIEW' && (
              <>
                <button className="btn" style={{ background: '#10b981', color: 'white' }} onClick={() => setConfirmAction('APPROVED')} disabled={updating}>
                  Approve
                </button>
                <button className="btn" style={{ background: '#ef4444', color: 'white' }} onClick={() => setConfirmAction('REJECTED')} disabled={updating}>
                  Reject
                </button>
              </>
            )}
            {application.status === 'APPROVED' && (
              <button className="btn" style={{ background: '#ef4444', color: 'white' }} onClick={() => setConfirmAction('SUSPENDED')} disabled={updating}>
                Suspend Peer Mentor
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
