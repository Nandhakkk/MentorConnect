import { formatCurrency } from '../../utils/currency';
import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { fetchMentorApplicationById, updateMentorApplicationStatus, generateMentorPortfolio, reconsiderMentorApplication } from '../../services/adminService';

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

const getCorrectedUrl = (url) => {
  if (!url) return url;
  // If a document was incorrectly stored with /image/upload/, rewrite to /raw/upload/
  if (url.includes('/image/upload/') && url.match(/\.(pdf|docx?|txt|csv|xlsx?|pptx?)$/i)) {
    return url.replace('/image/upload/', '/raw/upload/');
  }
  return url;
};

export default function AdminMentorApplicationReview() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [app, setApp] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [regeneratingPortfolio, setRegeneratingPortfolio] = useState(false);
  const [reviewNotes, setReviewNotes] = useState('');
  const [rejectionReason, setRejectionReason] = useState('');
  const [feedbackMsg, setFeedbackMsg] = useState('');
  const [showReconsiderModal, setShowReconsiderModal] = useState(false);
  const [reconsiderReason, setReconsiderReason] = useState('');

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

  const handleReconsider = async () => {
    try {
      setActionLoading(true);
      setFeedbackMsg('');
      await reconsiderMentorApplication(id, reconsiderReason);
      setShowReconsiderModal(false);
      setReconsiderReason('');
      setFeedbackMsg('Application successfully reopened for administrative review.');
      await loadApp();
    } catch (err) {
      alert(`Failed to reconsider application: ${err.message}`);
    } finally {
      setActionLoading(false);
    }
  };

  const handleStatusUpdate = async (newStatus) => {
    if ((newStatus === 'REJECTED' || newStatus === 'SUSPENDED') && !window.confirm(`Are you sure you want to ${newStatus.toLowerCase()} this mentor?`)) {
      return;
    }
    try {
      setActionLoading(true);
      setFeedbackMsg('');
      const updated = await updateMentorApplicationStatus(id, {
        status: newStatus,
        reviewNotes,
        rejectionReason: newStatus === 'REJECTED' ? rejectionReason : undefined
      });
      setApp(updated);
      setFeedbackMsg(`Application status successfully updated to ${newStatus}.`);
      // Reload full app data to display generated portfolio if approved
      if (newStatus === 'APPROVED') {
        setTimeout(loadApp, 1000);
      }
    } catch (err) {
      alert(`Failed to update status: ${err.message}`);
    } finally {
      setActionLoading(false);
    }
  };

  const handleRegeneratePortfolio = async () => {
    try {
      setRegeneratingPortfolio(true);
      setFeedbackMsg('');
      await generateMentorPortfolio(id);
      await loadApp();
      setFeedbackMsg('AI Professional Portfolio regenerated successfully.');
    } catch (err) {
      alert(`Failed to regenerate portfolio: ${err.message}`);
    } finally {
      setRegeneratingPortfolio(false);
    }
  };

  const getResultBadge = (result) => {
    switch (result) {
      case 'SUPPORTED':
        return { label: 'Supported', bg: 'var(--success-bg)', color: 'var(--success)', border: '1px solid var(--success-border)' };
      case 'PARTIALLY_SUPPORTED':
        return { label: 'Partially Supported', bg: 'var(--warning-bg)', color: 'var(--warning)', border: '1px solid var(--warning-border)' };
      case 'UNSUPPORTED':
        return { label: 'Unsupported', bg: 'var(--error-bg)', color: 'var(--error)', border: '1px solid var(--error-border)' };
      default:
        return { label: 'Unable to Verify', bg: 'var(--bg-surface-elevated)', color: 'var(--text-muted)', border: '1px solid var(--border-subtle)' };
    }
  };

  if (loading) return <div className="page-content">Loading application verification workspace...</div>;
  if (error) return <div className="page-content" style={{ color: 'var(--error)' }}>{error}</div>;
  if (!app) return <div className="page-content">Application not found.</div>;

  const mentorUser = app.mentor?.user || {};
  const screening = app.aiScreening;
  const portfolio = app.mentor?.portfolio;
  const claimSummary = screening?.structuredFindings?.claimSummary || {};
  const claimsAnalysis = screening?.structuredFindings?.claimsAnalysis || [];

  return (
    <div className="page-content">
      {/* Header */}
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h2 className="page-title">Professional Mentor Verification Workspace 🛡️</h2>
          <p className="page-subtitle">Review applicant profile, verify claimed experience against supporting documents, and review AI assessment.</p>
        </div>
        <button className="btn btn-secondary" onClick={() => navigate('/admin/mentor-applications')}>
          ← Back to Applications
        </button>
      </div>

      {feedbackMsg && (
        <div style={{ padding: '1rem', background: 'var(--success-bg)', color: 'var(--success)', border: '1px solid var(--success-border)', borderRadius: 'var(--radius-md)', marginBottom: '1.5rem', fontWeight: 500 }}>
          {feedbackMsg}
        </div>
      )}

      {/* Pre-Screening Outcome Banner */}
      {(() => {
        const findings = screening?.structuredFindings || {};
        const outcome = findings.outcome || findings.screeningOutcome || (app.status === 'REJECTED' ? 'AUTO_REJECTED' : app.status === 'AI_SCREENED' ? 'ELIGIBLE' : 'NEEDS_MANUAL_REVIEW');
        const failedCriteria = findings.failedCriteria || [];
        const concerns = findings.concerns || screening?.riskFlags?.concerns || [];
        const isReconsidered = findings.reconsideration?.isReconsidered;

        if (app.status === 'REJECTED' || outcome === 'AUTO_REJECTED') {
          return (
            <div style={{ padding: '1.25rem', background: 'var(--error-bg)', border: '1px solid var(--error-border)', borderRadius: 'var(--radius-md)', marginBottom: '1.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem', flexWrap: 'wrap' }}>
                <span className="badge badge-danger" style={{ fontSize: '0.85rem' }}>✕ AUTO-REJECTED</span>
                <strong style={{ color: 'var(--error)' }}>Objective Criteria Verification Failed</strong>
                {app.reviewedAt && (
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginLeft: 'auto' }}>
                    Decision Timestamp: {new Date(app.reviewedAt).toLocaleString()}
                  </span>
                )}
              </div>
              <p style={{ margin: '0 0 0.5rem 0', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                This application was automatically rejected because it demonstrably failed published mandatory eligibility requirements. The applicant was notified with corrective guidance.
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
              ) : app.rejectionReason && (
                <div style={{ color: 'var(--error)', fontSize: '0.85rem' }}>
                  <strong>Failed Requirement:</strong> {app.rejectionReason}
                </div>
              )}
            </div>
          );
        }

        if (app.status === 'UNDER_REVIEW' || outcome === 'NEEDS_MANUAL_REVIEW') {
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
                This application requires manual human evaluation because the AI verification returned inconclusive results, low confidence, or evidence requiring human discretion.
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

        if (app.status === 'AI_SCREENED' || outcome === 'ELIGIBLE') {
          return (
            <div style={{ padding: '1.25rem', background: 'var(--success-bg)', border: '1px solid var(--success-border)', borderRadius: 'var(--radius-md)', marginBottom: '1.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
                <span className="badge badge-success" style={{ fontSize: '0.85rem' }}>✓ ELIGIBLE — PRE-SCREENING PASSED</span>
                <strong style={{ color: 'var(--success)' }}>Mandatory Criteria Satisfied</strong>
              </div>
              <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                All published objective eligibility requirements and credential verifications have been confirmed. This application is ready for final administrative approval.
              </p>
            </div>
          );
        }

        return null;
      })()}

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '2rem' }}>
        {/* Left Column: Complete Verification Workspace */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

          {/* 1. PROFILE */}
          <div className="glass-card" style={{ padding: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '0.75rem', marginBottom: '1rem' }}>
              <h3 style={{ fontSize: '1.25rem', margin: 0, color: 'var(--text-primary)' }}>1. Profile & Identity</h3>
              <span className={`badge ${app.status === 'APPROVED' ? 'badge-success' : app.status === 'REJECTED' ? 'badge-danger' : 'badge-warning'}`}>
                {app.status.replace('_', ' ')}
              </span>
            </div>

            <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'flex-start', flexWrap: 'wrap' }}>
              <div style={{ width: '80px', height: '80px', borderRadius: '50%', background: 'linear-gradient(135deg, #1D4ED8 0%, #7C3AED 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '2rem', color: '#FFFFFF', overflow: 'hidden', flexShrink: 0 }}>
                {mentorUser.profileImage ? (
                  <img src={mentorUser.profileImage} alt={mentorUser.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  mentorUser.name?.charAt(0) || 'M'
                )}
              </div>

              <div style={{ flex: 1, minWidth: '240px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                <div><strong>Full Name:</strong> <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{mentorUser.name}</span></div>
                <div><strong>Email:</strong> <span style={{ color: 'var(--text-primary)' }}>{mentorUser.email}</span></div>
                <div><strong>Phone:</strong> {mentorUser.phone || 'N/A'}</div>
                <div><strong>DOB:</strong> {mentorUser.dateOfBirth ? new Date(mentorUser.dateOfBirth).toLocaleDateString() : 'N/A'}</div>
                {mentorUser.dateOfBirth && (
                  <>
                    <div><strong>Age:</strong> {calculateAge(mentorUser.dateOfBirth)} yrs</div>
                    <div><strong>Age Class:</strong> {calculateAge(mentorUser.dateOfBirth) < 18 ? '⚠️ Minor' : 'Adult (18+)'}</div>
                  </>
                )}
                <div><strong>Language:</strong> {app.languages || 'N/A'}</div>
                <div><strong>LinkedIn:</strong> {app.linkedinUrl ? <a href={app.linkedinUrl} target="_blank" rel="noreferrer" style={{ color: 'var(--accent-primary)', fontWeight: 500 }}>View LinkedIn ↗</a> : 'N/A'}</div>
                <div><strong>Session Fee:</strong> <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{app.proposedSessionFee ? `${formatCurrency(app.proposedSessionFee)}/hr` : 'N/A'}</span></div>
              </div>
            </div>

            <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid var(--border-subtle)' }}>
              <strong style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Primary Expertise:</strong>
              <div style={{ color: 'var(--text-primary)', marginTop: '0.25rem', fontSize: '0.95rem', fontWeight: 500 }}>{app.expertise || 'None specified'}</div>
            </div>

            {app.topics && (
              <div style={{ marginTop: '0.75rem' }}>
                <strong style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Topics:</strong>
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: '0.25rem' }}>
                  {app.topics.split(',').map((t, idx) => (
                    <span key={idx} style={{ padding: '0.2rem 0.6rem', borderRadius: '12px', background: 'var(--info-bg)', color: 'var(--info)', border: '1px solid var(--info-border)', fontSize: '0.8rem', fontWeight: 500 }}>
                      {t.trim()}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div style={{ marginTop: '0.75rem' }}>
              <strong style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Bio / Summary:</strong>
              <p style={{ marginTop: '0.25rem', padding: '0.75rem', background: 'var(--bg-surface-elevated)', borderRadius: 'var(--radius-sm)', fontSize: '0.9rem', color: 'var(--text-primary)', lineHeight: 1.5, border: '1px solid var(--border-subtle)' }}>
                {app.professionalSummary || 'No summary provided.'}
              </p>
            </div>
          </div>

          {/* 2. EXPERIENCE CLAIMS */}
          <div className="glass-card" style={{ padding: '1.5rem' }}>
            <h3 style={{ fontSize: '1.25rem', marginBottom: '1rem', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '0.5rem', color: 'var(--text-primary)' }}>
              2. Experience Claims
            </h3>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
              <div style={{ padding: '1rem', background: 'var(--bg-surface-elevated)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Claimed Industry Experience</div>
                <div style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--text-primary)', marginTop: '0.25rem' }}>
                  {app.experience != null ? `${app.experience} Years` : 'Not specified'}
                </div>
              </div>

              <div style={{ padding: '1rem', background: 'var(--bg-surface-elevated)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Claimed Teaching / Mentoring Experience</div>
                <div style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--accent-primary)', marginTop: '0.25rem' }}>
                  {app.teachingExperience != null ? `${app.teachingExperience} Years` : 'Not specified'}
                </div>
              </div>
            </div>

            {app.employmentHistory && (
              <div style={{ marginBottom: '1rem' }}>
                <strong style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Employment History / Organizations:</strong>
                <p style={{ marginTop: '0.25rem', padding: '0.75rem', background: 'var(--bg-surface-elevated)', borderRadius: 'var(--radius-sm)', fontSize: '0.9rem', color: 'var(--text-primary)', lineHeight: 1.5, border: '1px solid var(--border-subtle)' }}>
                  {app.employmentHistory}
                </p>
              </div>
            )}

            {app.teachingExperienceDetails && (
              <div style={{ marginBottom: '0.5rem' }}>
                <strong style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Teaching & Mentoring Details:</strong>
                <p style={{ marginTop: '0.25rem', padding: '0.75rem', background: 'var(--bg-surface-elevated)', borderRadius: 'var(--radius-sm)', fontSize: '0.9rem', color: 'var(--text-primary)', lineHeight: 1.5, border: '1px solid var(--border-subtle)' }}>
                  {app.teachingExperienceDetails}
                </p>
              </div>
            )}
          </div>

          {/* 3. QUALIFICATIONS */}
          <div className="glass-card" style={{ padding: '1.5rem' }}>
            <h3 style={{ fontSize: '1.25rem', marginBottom: '1rem', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '0.5rem', color: 'var(--text-primary)' }}>
              3. Stated Qualifications & Skills
            </h3>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
              <div>
                <strong style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Education / Degrees:</strong>
                <div style={{ marginTop: '0.25rem', padding: '0.75rem', background: 'var(--bg-surface-elevated)', borderRadius: 'var(--radius-sm)', fontSize: '0.9rem', color: 'var(--text-primary)', border: '1px solid var(--border-subtle)' }}>
                  {app.education || 'None specified'}
                </div>
              </div>

              <div>
                <strong style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Key Skills:</strong>
                <div style={{ marginTop: '0.25rem', padding: '0.75rem', background: 'var(--bg-surface-elevated)', borderRadius: 'var(--radius-sm)', fontSize: '0.9rem', color: 'var(--text-primary)', border: '1px solid var(--border-subtle)' }}>
                  {app.skills || 'None specified'}
                </div>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div>
                <strong style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Certifications:</strong>
                <div style={{ marginTop: '0.25rem', padding: '0.75rem', background: 'var(--bg-surface-elevated)', borderRadius: 'var(--radius-sm)', fontSize: '0.9rem', color: 'var(--text-primary)', border: '1px solid var(--border-subtle)' }}>
                  {app.certifications || 'None specified'}
                </div>
              </div>

              <div>
                <strong style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Achievements / Awards:</strong>
                <div style={{ marginTop: '0.25rem', padding: '0.75rem', background: 'var(--bg-surface-elevated)', borderRadius: 'var(--radius-sm)', fontSize: '0.9rem', color: 'var(--text-primary)', border: '1px solid var(--border-subtle)' }}>
                  {app.achievements || 'None specified'}
                </div>
              </div>
            </div>

            {app.otherInfo && (
              <div style={{ marginTop: '1rem' }}>
                <strong style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Other Relevant Info:</strong>
                <div style={{ marginTop: '0.25rem', padding: '0.75rem', background: 'var(--bg-surface-elevated)', borderRadius: 'var(--radius-sm)', fontSize: '0.9rem', color: 'var(--text-primary)', border: '1px solid var(--border-subtle)' }}>
                  {app.otherInfo}
                </div>
              </div>
            )}
          </div>

          {/* 4. DOCUMENTS & EVIDENCE */}
          <div className="glass-card" style={{ padding: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '0.5rem' }}>
              <h3 style={{ fontSize: '1.25rem', margin: 0, color: 'var(--text-primary)' }}>
                4. Uploaded Evidence & Verification ({app.credentials?.length || 0})
              </h3>
            </div>

            {app.credentials && app.credentials.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {app.credentials.map(c => {
                  const badge = getResultBadge(c.aiVerificationResult || 'PENDING');
                  return (
                    <div key={c.id} style={{ padding: '1.25rem', background: 'var(--bg-surface-elevated)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
                        <div style={{ flex: 1, minWidth: '260px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                            <strong style={{ fontSize: '1.1rem', color: 'var(--text-primary)' }}>{c.title}</strong>
                            <span style={{ fontSize: '0.75rem', padding: '0.2rem 0.5rem', borderRadius: '4px', background: 'var(--purple-bg)', color: 'var(--purple)', border: '1px solid var(--purple-border)', fontWeight: 500 }}>
                              {c.type.replace(/_/g, ' ')}
                            </span>
                            <span className={`badge badge-${c.status === 'VERIFIED' ? 'success' : c.status === 'REJECTED' ? 'error' : 'warning'}`}>
                              {c.status}
                            </span>
                          </div>

                          <div style={{ fontSize: '0.85rem', color: 'var(--accent-primary)', marginTop: '0.35rem', fontWeight: 500 }}>
                            <strong>Supports Claim:</strong> {c.claimType?.replace(/_/g, ' ') || 'General Experience'} {c.claimDescription ? `— "${c.claimDescription}"` : ''}
                          </div>

                          {c.issuingOrganization && (
                            <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
                              <strong>Issuer:</strong> {c.issuingOrganization}
                            </div>
                          )}

                          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                            Uploaded: {new Date(c.uploadedAt).toLocaleDateString()}
                          </div>

                          {/* AI Findings per Document */}
                          {c.aiVerificationResult && (
                            <div style={{ marginTop: '0.75rem', padding: '0.75rem', background: 'var(--bg-card)', borderRadius: '4px', borderLeft: `3px solid ${badge.color}`, border: '1px solid var(--border-subtle)' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: badge.color, textTransform: 'uppercase' }}>
                                  AI Verification: {badge.label}
                                </span>
                                {c.aiConfidence && (
                                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                    ({c.aiConfidence} confidence)
                                  </span>
                                )}
                              </div>
                              {c.aiEvidenceFound && (
                                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                                  <strong>Evidence Found:</strong> {c.aiEvidenceFound}
                                </div>
                              )}
                              {c.aiReasoning && (
                                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                                  <em>{c.aiReasoning}</em>
                                </div>
                              )}
                            </div>
                          )}
                        </div>

                        <div>
                          {c.fileReference && (
                            <a href={getCorrectedUrl(c.fileReference)} target="_blank" rel="noopener noreferrer" className="btn btn-secondary" style={{ padding: '0.4rem 0.9rem', fontSize: '0.85rem' }}>
                              Open / Download Document ↗
                            </a>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div style={{ padding: '1.5rem', textAlign: 'center', color: 'var(--error)', background: 'var(--error-bg)', border: '1px solid var(--error-border)', borderRadius: 'var(--radius-sm)', fontWeight: 500 }}>
                ⚠️ No supporting documents uploaded. Major experience claims lack evidence.
              </div>
            )}
          </div>

          {/* 5. AI VERIFICATION SUMMARY */}
          <div className="glass-card" style={{ padding: '1.5rem', background: 'var(--info-bg)', border: '1px solid var(--info-border)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '0.5rem' }}>
              <h3 style={{ fontSize: '1.25rem', margin: 0, color: 'var(--accent-primary)' }}>5. AI Verification Summary</h3>
              {screening && (
                <span className="badge badge-primary">{screening.recommendation?.replace(/_/g, ' ')}</span>
              )}
            </div>

            {/* Authenticity Notice */}
            <div style={{ padding: '0.75rem 1rem', background: 'var(--warning-bg)', border: '1px solid var(--warning-border)', borderRadius: 'var(--radius-sm)', marginBottom: '1.25rem', fontSize: '0.85rem', color: 'var(--warning)' }}>
              <strong>Authenticity Notice:</strong> {screening?.structuredFindings?.authenticityNotice || "Preliminary AI evaluation of submitted claims against provided documentation metadata. Document authenticity has NOT been independently verified and must be reviewed by the administrator."}
            </div>

            {screening ? (
              <div>
                {/* Metric Summary Cards */}
                {claimSummary.totalClaims !== undefined && (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: '0.75rem', marginBottom: '1.25rem' }}>
                    <div style={{ padding: '0.75rem', background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: '4px', textAlign: 'center' }}>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Total Claims</div>
                      <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)' }}>{claimSummary.totalClaims}</div>
                    </div>
                    <div style={{ padding: '0.75rem', background: 'var(--success-bg)', border: '1px solid var(--success-border)', borderRadius: '4px', textAlign: 'center' }}>
                      <div style={{ fontSize: '0.75rem', color: 'var(--success)' }}>Supported</div>
                      <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--success)' }}>{claimSummary.supported || 0}</div>
                    </div>
                    <div style={{ padding: '0.75rem', background: 'var(--warning-bg)', border: '1px solid var(--warning-border)', borderRadius: '4px', textAlign: 'center' }}>
                      <div style={{ fontSize: '0.75rem', color: 'var(--warning)' }}>Partially Supported</div>
                      <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--warning)' }}>{claimSummary.partiallySupported || 0}</div>
                    </div>
                    <div style={{ padding: '0.75rem', background: 'var(--error-bg)', border: '1px solid var(--error-border)', borderRadius: '4px', textAlign: 'center' }}>
                      <div style={{ fontSize: '0.75rem', color: 'var(--error)' }}>Unsupported</div>
                      <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--error)' }}>{claimSummary.unsupported || 0}</div>
                    </div>
                  </div>
                )}

                <div style={{ marginBottom: '1rem', padding: '1rem', background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-sm)' }}>
                  <strong style={{ color: 'var(--text-secondary)' }}>AI Notes & Overall Assessment:</strong>
                  <p style={{ margin: '0.35rem 0 0 0', color: 'var(--text-primary)', lineHeight: 1.5, fontSize: '0.9rem' }}>
                    {screening.structuredFindings?.overallAssessment}
                  </p>
                </div>

                {/* Claims Analysis Matrix */}
                {claimsAnalysis.length > 0 && (
                  <div style={{ marginBottom: '1rem' }}>
                    <h5 style={{ margin: '0 0 0.5rem 0', color: 'var(--text-primary)' }}>Claims Evaluated by AI:</h5>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      {claimsAnalysis.map((c, i) => {
                        const b = getResultBadge(c.result);
                        return (
                          <div key={i} style={{ padding: '0.75rem', background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: '4px', borderLeft: `3px solid ${b.color}` }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <strong style={{ color: 'var(--text-primary)', fontSize: '0.85rem' }}>{c.claim}</strong>
                              <span style={{ fontSize: '0.75rem', fontWeight: 700, color: b.color }}>{b.label} ({c.confidence} confidence)</span>
                            </div>
                            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
                              {c.reasoning}
                            </div>
                            {c.missingEvidence && (
                              <div style={{ fontSize: '0.75rem', color: 'var(--error)', marginTop: '0.2rem', fontWeight: 500 }}>
                                ⚠️ Missing: {c.missingEvidence}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginTop: '1rem' }}>
                  <div>
                    <strong style={{ color: 'var(--success)', fontSize: '0.85rem' }}>Identified Strengths:</strong>
                    <ul style={{ paddingLeft: '1.2rem', margin: '0.25rem 0 0 0', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                      {screening.structuredFindings?.strengths?.map((s, i) => <li key={i}>{s}</li>) || <li>None noted.</li>}
                    </ul>
                  </div>

                  <div>
                    <strong style={{ color: 'var(--error)', fontSize: '0.85rem' }}>Potential Inconsistencies & Concerns:</strong>
                    <ul style={{ paddingLeft: '1.2rem', margin: '0.25rem 0 0 0', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                      {screening.riskFlags?.concerns?.map((c, i) => <li key={i}>{c}</li>)}
                      {screening.riskFlags?.verificationItems?.map((v, i) => <li key={`v-${i}`}>{v}</li>)}
                      {(!screening.riskFlags?.concerns?.length && !screening.riskFlags?.verificationItems?.length) && <li>No concerns flagged.</li>}
                    </ul>
                  </div>
                </div>
              </div>
            ) : (
              <p style={{ color: 'var(--text-muted)', margin: 0 }}>AI Screening has not been run for this application yet.</p>
            )}
          </div>

          {/* 6. AI-GENERATED PORTFOLIO (IF APPROVED) */}
          {portfolio && (
            <div className="glass-card" style={{ padding: '1.5rem', border: '1px solid var(--success-border)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '0.5rem' }}>
                <h3 style={{ fontSize: '1.25rem', margin: 0, color: 'var(--success)' }}>
                  ✨ Active AI Professional Portfolio
                </h3>
                <button
                  className="btn btn-secondary"
                  onClick={handleRegeneratePortfolio}
                  disabled={regeneratingPortfolio}
                  style={{ fontSize: '0.85rem', padding: '0.35rem 0.75rem' }}
                >
                  {regeneratingPortfolio ? 'Regenerating...' : '🔄 Refresh / Regenerate Portfolio'}
                </button>
              </div>

              <div style={{ marginBottom: '1rem' }}>
                <div style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)' }}>{portfolio.headline}</div>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: '0.4rem', lineHeight: 1.6 }}>
                  {portfolio.introduction}
                </p>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', fontSize: '0.85rem' }}>
                <div style={{ padding: '0.75rem', background: 'var(--bg-surface-elevated)', borderRadius: '4px', border: '1px solid var(--border-subtle)' }}>
                  <strong style={{ color: 'var(--accent-primary)', display: 'block', marginBottom: '0.25rem' }}>Teaching Approach:</strong>
                  <p style={{ margin: 0, color: 'var(--text-secondary)' }}>{portfolio.teachingApproach}</p>
                </div>
                <div style={{ padding: '0.75rem', background: 'var(--bg-surface-elevated)', borderRadius: '4px', border: '1px solid var(--border-subtle)' }}>
                  <strong style={{ color: 'var(--success)', display: 'block', marginBottom: '0.25rem' }}>Mentoring Approach:</strong>
                  <p style={{ margin: 0, color: 'var(--text-secondary)' }}>{portfolio.mentoringApproach}</p>
                </div>
              </div>
            </div>
          )}

        </div>

        {/* Right Column: Admin Actions & Decision Controls */}
        <div>
          <div className="glass-card" style={{ padding: '1.5rem', position: 'sticky', top: '2rem' }}>
            <h3 style={{ fontSize: '1.25rem', marginBottom: '1.25rem', color: 'var(--text-primary)' }}>Admin Decision</h3>

            <div style={{ marginBottom: '1.25rem' }}>
              <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '0.25rem' }}>Current Application Status</div>
              <div style={{ fontSize: '1.2rem', fontWeight: 'bold', color: 'var(--text-primary)' }}>{app.status.replace('_', ' ')}</div>
            </div>

            <div style={{ marginBottom: '1.25rem' }}>
              <label className="form-label">Internal Administrator Review Notes</label>
              <textarea
                className="form-input"
                rows="4"
                placeholder="Private notes for review team..."
                value={reviewNotes}
                onChange={(e) => setReviewNotes(e.target.value)}
                disabled={actionLoading}
              />
            </div>

            {(app.status === 'UNDER_REVIEW' || app.status === 'AI_SCREENED') && (
              <div style={{ marginBottom: '1.25rem' }}>
                <label className="form-label" style={{ color: 'var(--error)' }}>Rejection Reason (Required if Rejecting)</label>
                <textarea
                  className="form-input"
                  rows="3"
                  placeholder="Visible to applicant upon rejection..."
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  disabled={actionLoading}
                />
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {/* Eligible / AI_SCREENED: Can directly approve or move to human review */}
              {app.status === 'AI_SCREENED' && (
                <>
                  <button
                    className="btn btn-primary"
                    style={{ background: 'var(--success)', borderColor: 'var(--success)', color: '#FFFFFF', width: '100%', padding: '0.75rem' }}
                    onClick={() => handleStatusUpdate('APPROVED')}
                    disabled={actionLoading}
                  >
                    ✓ Final Approve Mentor & Publish
                  </button>
                  <button
                    className="btn btn-secondary"
                    onClick={() => handleStatusUpdate('UNDER_REVIEW')}
                    disabled={actionLoading}
                    style={{ width: '100%' }}
                  >
                    Move to Human Review
                  </button>
                  <button
                    className="btn btn-secondary"
                    style={{ color: 'var(--error)', borderColor: 'var(--error-border)', width: '100%' }}
                    onClick={() => {
                      if (!rejectionReason.trim()) {
                        alert("Please provide a rejection reason first.");
                        return;
                      }
                      handleStatusUpdate('REJECTED');
                    }}
                    disabled={actionLoading}
                  >
                    ✕ Reject Application
                  </button>
                </>
              )}

              {app.status === 'PENDING' && (
                <button
                  className="btn btn-secondary"
                  onClick={() => handleStatusUpdate('UNDER_REVIEW')}
                  disabled={actionLoading}
                  style={{ width: '100%' }}
                >
                  Start Human Review
                </button>
              )}

              {app.status === 'UNDER_REVIEW' && (
                <>
                  <button
                    className="btn btn-primary"
                    style={{ background: 'var(--success)', borderColor: 'var(--success)', color: '#FFFFFF', width: '100%', padding: '0.75rem' }}
                    onClick={() => handleStatusUpdate('APPROVED')}
                    disabled={actionLoading}
                  >
                    ✓ Approve Mentor & Generate Portfolio
                  </button>
                  <button
                    className="btn btn-primary"
                    style={{ background: 'var(--error)', borderColor: 'var(--error)', color: '#FFFFFF', width: '100%', padding: '0.75rem' }}
                    onClick={() => {
                      if (!rejectionReason.trim()) {
                        alert("Please provide a rejection reason first.");
                        return;
                      }
                      handleStatusUpdate('REJECTED');
                    }}
                    disabled={actionLoading}
                  >
                    ✕ Reject Application
                  </button>
                </>
              )}

              {app.status === 'REJECTED' && (
                <button
                  className="btn btn-primary"
                  style={{ width: '100%', padding: '0.75rem' }}
                  onClick={() => setShowReconsiderModal(true)}
                  disabled={actionLoading}
                >
                  🔄 Reopen / Reconsider Application
                </button>
              )}

              {app.status === 'APPROVED' && (
                <button
                  className="btn btn-secondary"
                  style={{ color: 'var(--error)', borderColor: 'var(--error-border)', width: '100%' }}
                  onClick={() => handleStatusUpdate('SUSPENDED')}
                  disabled={actionLoading}
                >
                  Suspend Approved Mentor
                </button>
              )}
            </div>

            {/* Workflow steps reminder */}
            <div style={{ marginTop: '1.5rem', paddingTop: '1.25rem', borderTop: '1px solid var(--border-subtle)', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              <strong style={{ color: 'var(--text-secondary)', display: 'block', marginBottom: '0.5rem' }}>Verification Rules:</strong>
              • Eligible applications have passed objective validation and are ready for admin approval.<br/>
              • Reopening an auto-rejected application records an audit log and moves it to human review.<br/>
              • Approved mentors become publicly discoverable in Find Mentors.
            </div>

          </div>
        </div>
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
            <h3 style={{ marginTop: 0, color: 'var(--text-primary)' }}>Reconsider Application</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '1rem' }}>
              Reopen <strong>{mentorUser.name}</strong>'s application for human administrative review. The applicant will be notified that their application has been reopened.
            </p>
            <div style={{ marginBottom: '1.25rem' }}>
              <label className="form-label">Reconsideration Reason / Audit Justification:</label>
              <textarea
                className="form-input"
                rows="3"
                placeholder="Reason for reopening this application..."
                value={reconsiderReason}
                onChange={(e) => setReconsiderReason(e.target.value)}
                disabled={actionLoading}
              />
            </div>
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => { setShowReconsiderModal(false); setReconsiderReason(''); }}
                disabled={actionLoading}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleReconsider}
                disabled={actionLoading}
              >
                {actionLoading ? 'Reopening...' : 'Confirm Reconsideration'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
