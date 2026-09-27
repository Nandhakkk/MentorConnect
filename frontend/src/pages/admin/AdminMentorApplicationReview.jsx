import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { fetchMentorApplicationById, updateMentorApplicationStatus } from '../../services/adminService';

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

export default function AdminMentorApplicationReview() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [app, setApp] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [reviewNotes, setReviewNotes] = useState('');
  const [rejectionReason, setRejectionReason] = useState('');

  useEffect(() => {
    loadApp();
  }, [id]);

  const loadApp = async () => {
    try {
      setLoading(true);
      const data = await fetchMentorApplicationById(id);
      setApp(data);
      setReviewNotes(data.reviewNotes || '');
      setRejectionReason(data.rejectionReason || '');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleStatusUpdate = async (newStatus) => {
    if ((newStatus === 'REJECTED' || newStatus === 'SUSPENDED') && !window.confirm(`Are you sure you want to ${newStatus.toLowerCase()} this mentor?`)) {
      return;
    }
    try {
      setActionLoading(true);
      const updated = await updateMentorApplicationStatus(id, { 
        status: newStatus,
        reviewNotes,
        rejectionReason: newStatus === 'REJECTED' ? rejectionReason : undefined
      });
      setApp(updated);
      alert(`Application status successfully updated to ${newStatus}.`);
    } catch (err) {
      alert(`Failed to update status: ${err.message}`);
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) return <div className="page-content">Loading application details...</div>;
  if (error) return <div className="page-content" style={{ color: 'var(--error)' }}>{error}</div>;
  if (!app) return <div className="page-content">Application not found.</div>;

  return (
    <div className="page-content">
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 className="page-title">Application Review</h2>
          <p className="page-subtitle">Verify professional mentor application for {app.mentor.user.name}</p>
        </div>
        <button className="btn btn-secondary" onClick={() => navigate('/admin/mentor-applications')}>
          Back to List
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '2rem' }}>
        {/* Left Column: Data */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          
          <div className="glass-card" style={{ padding: '1.5rem' }}>
            <h3 style={{ fontSize: '1.25rem', marginBottom: '1rem', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '0.5rem' }}>Personal Information</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', color: 'var(--text-secondary)' }}>
              <div><strong>Name:</strong> <span style={{ color: 'white' }}>{app.mentor.user.name}</span></div>
              <div><strong>Email:</strong> <span style={{ color: 'white' }}>{app.mentor.user.email}</span></div>
              <div><strong>Phone:</strong> {app.mentor.user.phone || 'N/A'}</div>
              <div><strong>DOB:</strong> {app.mentor.user.dateOfBirth ? new Date(app.mentor.user.dateOfBirth).toLocaleDateString() : 'N/A'}</div>
              {app.mentor.user.dateOfBirth && (
                <>
                  <div><strong>Age:</strong> {calculateAge(app.mentor.user.dateOfBirth)}</div>
                  <div><strong>Category:</strong> {calculateAge(app.mentor.user.dateOfBirth) < 18 ? 'Minor' : 'Adult'}</div>
                </>
              )}
              <div><strong>Languages:</strong> {app.languages || 'N/A'}</div>
              <div><strong>LinkedIn:</strong> {app.linkedinUrl ? <a href={app.linkedinUrl} target="_blank" rel="noreferrer" style={{ color: 'var(--accent-primary)' }}>{app.linkedinUrl}</a> : 'N/A'}</div>
            </div>
          </div>

          <div className="glass-card" style={{ padding: '1.5rem' }}>
            <h3 style={{ fontSize: '1.25rem', marginBottom: '1rem', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '0.5rem' }}>Professional Profile</h3>
            <div style={{ color: 'var(--text-secondary)', marginBottom: '1rem' }}>
              <strong>Expertise:</strong> {app.expertise || 'N/A'}
            </div>
            <div style={{ color: 'var(--text-secondary)', marginBottom: '1rem' }}>
              <strong>Industry Experience:</strong> {app.experience} years
            </div>
            <div style={{ color: 'var(--text-secondary)', marginBottom: '1rem' }}>
              <strong>Teaching Experience:</strong> {app.teachingExperience || 0} years
            </div>
            <div style={{ color: 'var(--text-secondary)', marginBottom: '1rem' }}>
              <strong>Proposed Session Fee:</strong> {app.proposedSessionFee ? `$${app.proposedSessionFee}/hr` : 'N/A'}
            </div>
            <div style={{ color: 'var(--text-secondary)' }}>
              <strong>Professional Summary:</strong>
              <p style={{ marginTop: '0.5rem', padding: '1rem', background: 'rgba(0,0,0,0.2)', borderRadius: 'var(--radius-sm)' }}>
                {app.professionalSummary || 'No summary provided.'}
              </p>
            </div>
          </div>

          <div className="glass-card" style={{ padding: '1.5rem' }}>
            <h3 style={{ fontSize: '1.25rem', marginBottom: '1rem', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '0.5rem' }}>Credentials & Evidence</h3>
            {app.credentials && app.credentials.length > 0 ? (
              <ul style={{ paddingLeft: '1.2rem', color: 'var(--text-primary)' }}>
                {app.credentials.map(c => (
                  <li key={c.id} style={{ marginBottom: '0.5rem' }}>
                    <strong>{c.title}</strong> ({c.type}) - <span className="badge badge-warning">{c.status}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p style={{ color: 'var(--text-muted)' }}>No credentials uploaded.</p>
            )}
          </div>
          
          <div className="glass-card" style={{ padding: '1.5rem', background: 'rgba(99, 102, 241, 0.05)', border: '1px solid var(--accent-primary)' }}>
            <h3 style={{ fontSize: '1.25rem', marginBottom: '0.5rem', color: 'var(--accent-primary)' }}>AI Preliminary Screening</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '1.5rem' }}>AI-generated preliminary assessment. Final verification must be performed by an administrator.</p>
            
            {app.aiScreening ? (
              <div>
                <div style={{ marginBottom: '1rem', padding: '1rem', background: 'rgba(0,0,0,0.2)', borderRadius: 'var(--radius-sm)' }}>
                  <strong style={{ color: 'var(--text-secondary)' }}>Overall Assessment:</strong>
                  <p style={{ marginTop: '0.25rem' }}>{app.aiScreening.structuredFindings?.overallAssessment}</p>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem', fontSize: '0.9rem' }}>
                  <div><strong style={{ color: 'var(--text-secondary)' }}>Completeness:</strong> {app.aiScreening.structuredFindings?.profileCompleteness}</div>
                  <div><strong style={{ color: 'var(--text-secondary)' }}>Expertise:</strong> {app.aiScreening.structuredFindings?.expertiseRelevance}</div>
                  <div><strong style={{ color: 'var(--text-secondary)' }}>Experience:</strong> {app.aiScreening.structuredFindings?.experienceAssessment}</div>
                  <div><strong style={{ color: 'var(--text-secondary)' }}>Teaching:</strong> {app.aiScreening.structuredFindings?.teachingAssessment}</div>
                </div>
                
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
                  <div>
                    <strong style={{ color: '#10b981', fontSize: '0.95rem' }}>Strengths:</strong>
                    <ul style={{ paddingLeft: '1.2rem', margin: '0.5rem 0', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                      {app.aiScreening.structuredFindings?.strengths?.map((s, i) => <li key={i}>{s}</li>) || <li>None noted.</li>}
                    </ul>
                  </div>
                  <div>
                    <strong style={{ color: '#ef4444', fontSize: '0.95rem' }}>Concerns / Verification Needs:</strong>
                    <ul style={{ paddingLeft: '1.2rem', margin: '0.5rem 0', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                      {app.aiScreening.riskFlags?.concerns?.map((c, i) => <li key={i}>{c}</li>)}
                      {app.aiScreening.riskFlags?.verificationItems?.map((v, i) => <li key={`v-${i}`}>{v}</li>)}
                      {(!app.aiScreening.riskFlags?.concerns?.length && !app.aiScreening.riskFlags?.verificationItems?.length) && <li>None noted.</li>}
                    </ul>
                  </div>
                </div>

                <div style={{ paddingTop: '1rem', borderTop: '1px solid var(--border-subtle)' }}>
                  <strong style={{ color: 'var(--text-secondary)' }}>Recommendation:</strong>{' '}
                  <span className="badge badge-primary">{app.aiScreening.recommendation.replace(/_/g, ' ')}</span>
                </div>
              </div>
            ) : (
              <p style={{ color: 'var(--text-muted)' }}>AI Screening has not been run for this application.</p>
            )}
          </div>

        </div>

        {/* Right Column: Actions */}
        <div>
          <div className="glass-card" style={{ padding: '1.5rem', position: 'sticky', top: '2rem' }}>
            <h3 style={{ fontSize: '1.25rem', marginBottom: '1.5rem' }}>Verification Decision</h3>
            
            <div style={{ marginBottom: '1.5rem' }}>
              <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '0.25rem' }}>Current Status</div>
              <div style={{ fontSize: '1.1rem', fontWeight: 'bold', color: 'white' }}>{app.status.replace('_', ' ')}</div>
            </div>

            <div style={{ marginBottom: '1.5rem' }}>
              <label className="form-label">Internal Review Notes</label>
              <textarea
                className="form-input"
                rows="4"
                placeholder="Private notes for other admins..."
                value={reviewNotes}
                onChange={(e) => setReviewNotes(e.target.value)}
                disabled={actionLoading}
              />
            </div>

            {app.status === 'UNDER_REVIEW' && (
              <div style={{ marginBottom: '1.5rem' }}>
                <label className="form-label" style={{ color: 'var(--error)' }}>Rejection Reason (Required if Rejecting)</label>
                <textarea
                  className="form-input"
                  rows="3"
                  placeholder="Will be visible to the applicant if rejected..."
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  disabled={actionLoading}
                />
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {(app.status === 'PENDING' || app.status === 'AI_SCREENED') && (
                <button 
                  className="btn btn-secondary" 
                  onClick={() => handleStatusUpdate('UNDER_REVIEW')}
                  disabled={actionLoading}
                >
                  Start Human Review
                </button>
              )}

              {app.status === 'UNDER_REVIEW' && (
                <>
                  <button 
                    className="btn btn-primary" 
                    style={{ background: '#10b981', borderColor: '#10b981' }}
                    onClick={() => handleStatusUpdate('APPROVED')}
                    disabled={actionLoading}
                  >
                    Approve Mentor
                  </button>
                  <button 
                    className="btn btn-primary" 
                    style={{ background: '#ef4444', borderColor: '#ef4444' }}
                    onClick={() => {
                      if (!rejectionReason.trim()) {
                        alert("Please provide a rejection reason first.");
                        return;
                      }
                      handleStatusUpdate('REJECTED');
                    }}
                    disabled={actionLoading}
                  >
                    Reject Application
                  </button>
                </>
              )}

              {app.status === 'APPROVED' && (
                <button 
                  className="btn btn-secondary" 
                  style={{ color: '#ef4444', borderColor: '#ef4444' }}
                  onClick={() => handleStatusUpdate('SUSPENDED')}
                  disabled={actionLoading}
                >
                  Suspend Approved Mentor
                </button>
              )}
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}
