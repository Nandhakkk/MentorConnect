import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getEligibility, createApplication, getMyApplication, updateApplication, screenApplication } from '../../services/peerMentorService';

export default function PeerMentorApplication() {
  const [eligibility, setEligibility] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [formData, setFormData] = useState({
    motivation: '',
    topics: '',
    teachingExperience: ''
  });

  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState('');
  const [isEditing, setIsEditing] = useState(false);

  const [aiScreening, setAiScreening] = useState(null);
  const [screeningLoading, setScreeningLoading] = useState(false);

  const fetchStatus = async () => {
    try {
      setLoading(true);
      setError('');
      const data = await getEligibility();
      setEligibility(data);

      if (['PENDING', 'AI_SCREENED', 'UNDER_REVIEW'].includes(data.applicationStatus)) {
        const app = await getMyApplication();
        if (app) {
          if (app.eligibilityInfo) {
            try {
              const parsed = typeof app.eligibilityInfo === 'string' ? JSON.parse(app.eligibilityInfo) : app.eligibilityInfo;
              setFormData({
                motivation: parsed.motivation || '',
                topics: parsed.topics || '',
                teachingExperience: parsed.teachingExperience || ''
              });
            } catch(e) {
              setFormData({ motivation: app.eligibilityInfo, topics: '', teachingExperience: '' });
            }
          }
          if (app.aiScreening) {
            setAiScreening(app.aiScreening);
          }
        }
      }
    } catch (err) {
      setError(err.message || 'Failed to check peer mentor eligibility');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
  }, []);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      setSubmitting(true);
      setError('');

      if (eligibility?.applicationStatus === 'PENDING') {
        await updateApplication({ eligibilityInfo: formData });
        setSuccess('Application updated successfully.');
        setIsEditing(false);
      } else {
        await createApplication({ eligibilityInfo: formData });
        setSuccess('Application submitted successfully! It has entered the review workflow.');
      }

      setTimeout(() => {
        setSuccess('');
        fetchStatus();
      }, 1500);
    } catch (err) {
      setError(err.message || 'Failed to submit application');
      if (err.reasons && Array.isArray(err.reasons)) {
        setError(`${err.message}: ${err.reasons.join(' | ')}`);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleScreening = async () => {
    try {
      setScreeningLoading(true);
      setError('');
      await screenApplication();
      setSuccess('AI preliminary screening completed successfully.');
      setTimeout(() => {
        setSuccess('');
        fetchStatus();
      }, 1500);
    } catch (err) {
      setError(err.message || 'Failed to run AI screening');
    } finally {
      setScreeningLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="page-content" style={{ display: 'flex', justifyContent: 'center', padding: '4rem 0' }}>
        <div style={{ color: 'var(--text-secondary)' }}>Checking Peer Mentor eligibility & requirements...</div>
      </div>
    );
  }

  const isApproved = eligibility?.applicationStatus === 'APPROVED' || eligibility?.alreadyApproved;
  const isInReview = ['PENDING', 'AI_SCREENED', 'UNDER_REVIEW'].includes(eligibility?.applicationStatus);
  const isRejected = eligibility?.applicationStatus === 'REJECTED';
  const isEligibleToApply = eligibility?.eligible && !eligibility?.applicationStatus;

  const criteria = eligibility?.criteria || {};
  const metCount = eligibility?.metCount || 0;
  const totalCount = eligibility?.totalCriteriaCount || 6;
  const progressPercent = eligibility?.overallProgress || 0;

  return (
    <div className="page-content">
      {/* ─── Header & Status Badge ─── */}
      <div className="page-header" style={{ alignItems: 'flex-start' }}>
        <div>
          <div className="breadcrumbs">
            <Link to="/student/dashboard">Student Dashboard</Link> / <span>Peer Mentor</span>
          </div>
          <h2 className="page-title">
            {isApproved ? 'Peer Mentor Hub 🎓' : 'Become a Peer Mentor 🎓'}
          </h2>
          <p className="page-subtitle">
            {isApproved
              ? 'Manage your peer mentorship activities, availability, and mentees while continuing your studies.'
              : 'MentorConnect empowers experienced learners to guide peers. Build a measurable platform track record to qualify.'}
          </p>
        </div>

        <div>
          {isApproved && (
            <span className="badge badge-success" style={{ fontSize: '0.85rem', padding: '0.4rem 0.8rem' }}>
              ✓ Approved Peer Mentor
            </span>
          )}
          {isInReview && (
            <span className="badge badge-warning" style={{ fontSize: '0.85rem', padding: '0.4rem 0.8rem' }}>
              ⏳ Application: {eligibility.applicationStatus.replace('_', ' ')}
            </span>
          )}
          {!isApproved && !isInReview && isEligibleToApply && (
            <span className="badge badge-success" style={{ fontSize: '0.85rem', padding: '0.4rem 0.8rem' }}>
              ✓ Eligible to Apply
            </span>
          )}
          {!isApproved && !isInReview && !isEligibleToApply && !isRejected && (
            <span className="badge badge-warning" style={{ fontSize: '0.85rem', padding: '0.4rem 0.8rem' }}>
              ⚠ Eligibility In Progress ({metCount}/{totalCount})
            </span>
          )}
          {isRejected && (
            <span className="badge badge-danger" style={{ fontSize: '0.85rem', padding: '0.4rem 0.8rem' }}>
              Application Rejected
            </span>
          )}
        </div>
      </div>

      {error && (
        <div style={{ background: 'var(--error-subtle)', border: '1px solid var(--error)', color: 'var(--error)', padding: '1rem', borderRadius: '8px', marginBottom: '1.5rem' }}>
          <strong>Error:</strong> {error}
        </div>
      )}
      {success && (
        <div style={{ background: 'var(--success-subtle)', border: '1px solid var(--success)', color: 'var(--success)', padding: '1rem', borderRadius: '8px', marginBottom: '1.5rem' }}>
          {success}
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          STATE 1: APPROVED PEER MENTOR HUB
         ───────────────────────────────────────────────────────────── */}
      {isApproved && (
        <div>
          <div className="glass-card" style={{ padding: '2rem', marginBottom: '2rem', background: 'linear-gradient(135deg, rgba(168, 85, 247, 0.1) 0%, rgba(59, 130, 246, 0.05) 100%)', border: '1px solid rgba(168, 85, 247, 0.3)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', flexWrap: 'wrap' }}>
              <div style={{ fontSize: '2.5rem', background: 'var(--purple-bg, rgba(168, 85, 247, 0.15))', padding: '1rem', borderRadius: '12px' }}>🎓</div>
              <div style={{ flex: 1, minWidth: '240px' }}>
                <h3 style={{ margin: '0 0 0.5rem 0', color: 'var(--text-primary)' }}>Welcome to your Peer Mentor Hub!</h3>
                <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.95rem' }}>
                  You hold an active dual role on MentorConnect: learn from professional mentors as a student, and guide fellow peers in your qualified subjects.
                </p>
              </div>
            </div>
          </div>

          <h3 style={{ marginBottom: '1rem', color: 'var(--text-primary)' }}>Peer Mentor Actions & Tools</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1.25rem', marginBottom: '2.5rem' }}>
            <Link to="/student/mentor-dashboard/students" className="quick-action-link" style={{ padding: '1.25rem', flexDirection: 'column', alignItems: 'flex-start' }}>
              <span style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>♙</span>
              <strong style={{ fontSize: '1rem', color: 'var(--text-primary)' }}>My Students & Requests</strong>
              <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
                Review, accept, or reject incoming peer mentorship requests from other learners.
              </span>
            </Link>

            <Link to="/student/mentor-dashboard/sessions" className="quick-action-link" style={{ padding: '1.25rem', flexDirection: 'column', alignItems: 'flex-start' }}>
              <span style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>◷</span>
              <strong style={{ fontSize: '1rem', color: 'var(--text-primary)' }}>Mentor Sessions</strong>
              <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
                View upcoming booked mentoring sessions with your mentees and manage class links.
              </span>
            </Link>

            <Link to="/student/mentor-dashboard/availability" className="quick-action-link" style={{ padding: '1.25rem', flexDirection: 'column', alignItems: 'flex-start' }}>
              <span style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>◴</span>
              <strong style={{ fontSize: '1rem', color: 'var(--text-primary)' }}>Manage Availability</strong>
              <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
                Configure recurring days and time windows when you are available for peer sessions.
              </span>
            </Link>

            <Link to="/student/mentor-dashboard/profile" className="quick-action-link" style={{ padding: '1.25rem', flexDirection: 'column', alignItems: 'flex-start' }}>
              <span style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>◉</span>
              <strong style={{ fontSize: '1rem', color: 'var(--text-primary)' }}>Peer Mentor Profile</strong>
              <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
                Update your teaching bio, topics, and ensure your discoverability status is ready.
              </span>
            </Link>

            <Link to="/student/mentor-dashboard/assignments" className="quick-action-link" style={{ padding: '1.25rem', flexDirection: 'column', alignItems: 'flex-start' }}>
              <span style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>▤</span>
              <strong style={{ fontSize: '1rem', color: 'var(--text-primary)' }}>Mentor Assignments</strong>
              <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
                Create practice tasks for your students and grade/review their submitted work.
              </span>
            </Link>

            <Link to="/student/mentor-dashboard/earnings" className="quick-action-link" style={{ padding: '1.25rem', flexDirection: 'column', alignItems: 'flex-start' }}>
              <span style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>₹</span>
              <strong style={{ fontSize: '1rem', color: 'var(--text-primary)' }}>Earnings & Rewards</strong>
              <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
                Track completed peer mentoring sessions, reward points, and payout summaries.
              </span>
            </Link>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          STATE 2: APPLICATION IN REVIEW (PENDING / AI_SCREENED / UNDER_REVIEW)
         ───────────────────────────────────────────────────────────── */}
      {isInReview && (
        <div style={{ marginBottom: '2.5rem' }}>
          <div className="glass-card" style={{ padding: '2rem', marginBottom: '2rem' }}>
            <h3 style={{ margin: '0 0 1rem 0', color: 'var(--text-primary)' }}>Application Review Status</h3>

            {/* Timeline Progress */}
            <div style={{ display: 'flex', justifyContent: 'space-between', margin: '2rem 0', position: 'relative', flexWrap: 'wrap', gap: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ width: '28px', height: '28px', borderRadius: '50%', background: 'var(--success)', color: '#FFF', display: 'grid', placeItems: 'center', fontSize: '0.85rem', fontWeight: 800 }}>✓</span>
                <div>
                  <div style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-primary)' }}>Application Submitted</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Verified & Saved</div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ width: '28px', height: '28px', borderRadius: '50%', background: eligibility.applicationStatus === 'PENDING' ? 'var(--warning)' : 'var(--success)', color: '#FFF', display: 'grid', placeItems: 'center', fontSize: '0.85rem', fontWeight: 800 }}>
                  {eligibility.applicationStatus === 'PENDING' ? '2' : '✓'}
                </span>
                <div>
                  <div style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-primary)' }}>AI Pre-Screening</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    {eligibility.applicationStatus === 'PENDING' ? 'Action Required Below' : 'Screening Completed'}
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ width: '28px', height: '28px', borderRadius: '50%', background: eligibility.applicationStatus === 'UNDER_REVIEW' ? 'var(--accent-primary)' : 'var(--bg-surface-elevated)', color: 'var(--text-primary)', border: '1px solid var(--border-subtle)', display: 'grid', placeItems: 'center', fontSize: '0.85rem', fontWeight: 800 }}>
                  3
                </span>
                <div>
                  <div style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-primary)' }}>Admin Final Review</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    {eligibility.applicationStatus === 'UNDER_REVIEW' ? 'Under Review by Admin' : 'Queued for Evaluation'}
                  </div>
                </div>
              </div>
            </div>

            {/* AI Screening trigger if pending */}
            {eligibility.applicationStatus === 'PENDING' && (
              <div style={{ background: 'var(--bg-surface-elevated)', padding: '1.25rem', borderRadius: '8px', border: '1px solid var(--border-subtle)', marginTop: '1.5rem' }}>
                <h4 style={{ margin: '0 0 0.5rem 0', color: 'var(--text-primary)' }}>Step 2: Run AI Pre-Screening</h4>
                <p style={{ margin: '0 0 1rem 0', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                  Your application has been received! Please trigger the preliminary AI screening to evaluate your application against objective quality criteria before admin review.
                </p>
                <button onClick={handleScreening} disabled={screeningLoading} className="btn btn-primary">
                  {screeningLoading ? 'Running AI Screening...' : 'Run AI Screening Now'}
                </button>
              </div>
            )}

            {/* AI Screening Results display */}
            {aiScreening && (
              <div style={{ background: 'var(--bg-surface-elevated)', border: '1px solid var(--border-subtle)', padding: '1.5rem', borderRadius: '8px', marginTop: '1.5rem' }}>
                <h4 style={{ margin: '0 0 0.5rem 0', color: 'var(--text-primary)' }}>AI Pre-Screening Findings</h4>
                <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '1rem' }}>
                  <strong>Recommendation:</strong> {aiScreening.recommendation}
                </div>

                {aiScreening.structuredFindings?.strengths?.length > 0 && (
                  <div style={{ marginBottom: '0.75rem' }}>
                    <strong style={{ color: 'var(--success)', fontSize: '0.85rem' }}>Identified Strengths:</strong>
                    <ul style={{ margin: '0.25rem 0 0 1.2rem', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                      {aiScreening.structuredFindings.strengths.map((s, i) => <li key={i}>{s}</li>)}
                    </ul>
                  </div>
                )}
              </div>
            )}

            {/* Submitted Application Data */}
            <div style={{ marginTop: '2rem', borderTop: '1px solid var(--border-subtle)', paddingTop: '1.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <h4 style={{ margin: 0, color: 'var(--text-primary)' }}>Submitted Application Information</h4>
                {eligibility.applicationStatus === 'PENDING' && (
                  <button onClick={() => setIsEditing(!isEditing)} className="btn btn-secondary" style={{ fontSize: '0.8rem', padding: '0.35rem 0.8rem' }}>
                    {isEditing ? 'Cancel Edit' : 'Edit Application'}
                  </button>
                )}
              </div>

              {!isEditing ? (
                <div style={{ display: 'grid', gap: '1rem', background: 'var(--bg-surface)', padding: '1.25rem', borderRadius: '8px' }}>
                  <div>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>Motivation:</span>
                    <p style={{ margin: '0.25rem 0 0 0', color: 'var(--text-primary)', whiteSpace: 'pre-wrap' }}>{formData.motivation || 'N/A'}</p>
                  </div>
                  <div>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>Topics Offered:</span>
                    <p style={{ margin: '0.25rem 0 0 0', color: 'var(--text-primary)' }}>{formData.topics || 'N/A'}</p>
                  </div>
                  <div>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>Previous Mentoring / Tutoring Experience:</span>
                    <p style={{ margin: '0.25rem 0 0 0', color: 'var(--text-primary)', whiteSpace: 'pre-wrap' }}>{formData.teachingExperience || 'None provided'}</p>
                  </div>
                </div>
              ) : (
                <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                  <div>
                    <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Why do you want to become a peer mentor?</label>
                    <textarea name="motivation" value={formData.motivation} onChange={handleChange} rows="3" className="form-input" required />
                  </div>
                  <div>
                    <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Topics you can mentor in:</label>
                    <input type="text" name="topics" value={formData.topics} onChange={handleChange} className="form-input" required />
                  </div>
                  <div>
                    <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Relevant tutoring or coaching experience:</label>
                    <textarea name="teachingExperience" value={formData.teachingExperience} onChange={handleChange} rows="3" className="form-input" />
                  </div>
                  <div style={{ display: 'flex', gap: '0.75rem' }}>
                    <button type="submit" disabled={submitting} className="btn btn-primary">
                      {submitting ? 'Saving...' : 'Save Updated Application'}
                    </button>
                    <button type="button" onClick={() => setIsEditing(false)} className="btn btn-secondary">
                      Cancel
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          SECTION: EXPERIENCE-BASED ELIGIBILITY CRITERIA BREAKDOWN
          (Shown to all students who are not yet approved)
         ───────────────────────────────────────────────────────────── */}
      {!isApproved && (
        <div style={{ marginBottom: '2.5rem' }}>
          {/* Progress Overview Card */}
          <div className="glass-card" style={{ padding: '1.75rem', marginBottom: '1.75rem', background: isEligibleToApply ? 'var(--success-subtle)' : 'var(--bg-card)', border: isEligibleToApply ? '1px solid var(--success)' : '1px solid var(--border-subtle)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginBottom: '1rem' }}>
              <div>
                <h3 style={{ margin: 0, color: 'var(--text-primary)' }}>
                  {isEligibleToApply ? '🎉 You Meet All Experience Criteria!' : 'Track Record & Eligibility Progress'}
                </h3>
                <p style={{ margin: '0.35rem 0 0 0', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                  {isEligibleToApply
                    ? 'You have built an active learning track record on MentorConnect. You can now submit your Peer Mentor application.'
                    : `You have completed ${metCount} of ${totalCount} mandatory experience criteria. Complete the remaining milestones to unlock your application.`}
                </p>
              </div>

              <div style={{ textAlign: 'right' }}>
                <span style={{ fontSize: '1.6rem', fontWeight: 800, color: isEligibleToApply ? 'var(--success)' : 'var(--accent-primary)' }}>
                  {progressPercent}%
                </span>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  {metCount} of {totalCount} Met
                </div>
              </div>
            </div>

            {/* Progress Bar */}
            <div style={{ height: '8px', width: '100%', background: 'rgba(255, 255, 255, 0.08)', borderRadius: '4px', overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${progressPercent}%`, background: isEligibleToApply ? 'var(--success)' : 'var(--accent-primary)', transition: 'width 0.4s ease' }} />
            </div>
          </div>

          {/* 6 Measurable Criteria Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.25rem' }}>

            {/* 1. Account Maturity */}
            {criteria.accountMaturity && (
              <div className="glass-card" style={{ padding: '1.25rem', borderLeft: `4px solid ${criteria.accountMaturity.met ? 'var(--success)' : 'var(--warning)'}` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                  <strong style={{ color: 'var(--text-primary)', fontSize: '0.95rem' }}>1. Account Maturity</strong>
                  <span className={`badge ${criteria.accountMaturity.met ? 'badge-success' : 'badge-warning'}`}>
                    {criteria.accountMaturity.met ? '✓ Satisfied' : 'In Progress'}
                  </span>
                </div>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.75rem' }}>
                  Tenure: <strong>{criteria.accountMaturity.current}</strong> / {criteria.accountMaturity.required} days on MentorConnect
                </div>
                <div style={{ fontSize: '0.8rem', color: criteria.accountMaturity.met ? 'var(--success)' : 'var(--text-muted)' }}>
                  {criteria.accountMaturity.met
                    ? '✓ Account registered for 30+ days'
                    : criteria.accountMaturity.reason}
                </div>
              </div>
            )}

            {/* 2. Mentoring Sessions as Mentee */}
            {criteria.mentoringExperience && (
              <div className="glass-card" style={{ padding: '1.25rem', borderLeft: `4px solid ${criteria.mentoringExperience.met ? 'var(--success)' : 'var(--warning)'}` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                  <strong style={{ color: 'var(--text-primary)', fontSize: '0.95rem' }}>2. Completed Mentee Sessions</strong>
                  <span className={`badge ${criteria.mentoringExperience.met ? 'badge-success' : 'badge-warning'}`}>
                    {criteria.mentoringExperience.met ? '✓ Satisfied' : 'In Progress'}
                  </span>
                </div>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.75rem' }}>
                  Sessions: <strong>{criteria.mentoringExperience.current}</strong> / {criteria.mentoringExperience.required} completed as learner
                </div>
                <div style={{ fontSize: '0.8rem', color: criteria.mentoringExperience.met ? 'var(--success)' : 'var(--text-muted)' }}>
                  {criteria.mentoringExperience.met
                    ? '✓ 5+ completed sessions on record'
                    : criteria.mentoringExperience.reason}
                </div>
                {!criteria.mentoringExperience.met && (
                  <Link to="/student/mentor" style={{ fontSize: '0.8rem', color: 'var(--accent-primary)', display: 'inline-block', marginTop: '0.5rem', fontWeight: 600 }}>
                    Find Mentors to book sessions →
                  </Link>
                )}
              </div>
            )}

            {/* 3. Learning Goals */}
            {criteria.learningGoals && (
              <div className="glass-card" style={{ padding: '1.25rem', borderLeft: `4px solid ${criteria.learningGoals.met ? 'var(--success)' : 'var(--warning)'}` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                  <strong style={{ color: 'var(--text-primary)', fontSize: '0.95rem' }}>3. Learning Goals</strong>
                  <span className={`badge ${criteria.learningGoals.met ? 'badge-success' : 'badge-warning'}`}>
                    {criteria.learningGoals.met ? '✓ Satisfied' : 'In Progress'}
                  </span>
                </div>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.75rem' }}>
                  Goals: <strong>{criteria.learningGoals.current?.total || 0}</strong>/2 total, <strong>{criteria.learningGoals.current?.completed || 0}</strong>/1 completed
                </div>
                <div style={{ fontSize: '0.8rem', color: criteria.learningGoals.met ? 'var(--success)' : 'var(--text-muted)' }}>
                  {criteria.learningGoals.met
                    ? '✓ 2+ goals with completed goal verified'
                    : criteria.learningGoals.reason}
                </div>
                {!criteria.learningGoals.met && (
                  <Link to="/student/goals" style={{ fontSize: '0.8rem', color: 'var(--accent-primary)', display: 'inline-block', marginTop: '0.5rem', fontWeight: 600 }}>
                    Manage Goals & Milestones →
                  </Link>
                )}
              </div>
            )}

            {/* 4. Assignments Completed */}
            {criteria.assignmentsCompleted && (
              <div className="glass-card" style={{ padding: '1.25rem', borderLeft: `4px solid ${criteria.assignmentsCompleted.met ? 'var(--success)' : 'var(--warning)'}` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                  <strong style={{ color: 'var(--text-primary)', fontSize: '0.95rem' }}>4. Assignments Completed</strong>
                  <span className={`badge ${criteria.assignmentsCompleted.met ? 'badge-success' : 'badge-warning'}`}>
                    {criteria.assignmentsCompleted.met ? '✓ Satisfied' : 'In Progress'}
                  </span>
                </div>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.75rem' }}>
                  Assignments: <strong>{criteria.assignmentsCompleted.current}</strong> / {criteria.assignmentsCompleted.required} submitted
                </div>
                <div style={{ fontSize: '0.8rem', color: criteria.assignmentsCompleted.met ? 'var(--success)' : 'var(--text-muted)' }}>
                  {criteria.assignmentsCompleted.met
                    ? '✓ 3+ assignments completed & submitted'
                    : criteria.assignmentsCompleted.reason}
                </div>
                {!criteria.assignmentsCompleted.met && (
                  <Link to="/student/assignments" style={{ fontSize: '0.8rem', color: 'var(--accent-primary)', display: 'inline-block', marginTop: '0.5rem', fontWeight: 600 }}>
                    View Student Assignments →
                  </Link>
                )}
              </div>
            )}

            {/* 5. Good Standing & Conduct */}
            {criteria.feedbackAndConduct && (
              <div className="glass-card" style={{ padding: '1.25rem', borderLeft: `4px solid ${criteria.feedbackAndConduct.met ? 'var(--success)' : 'var(--error)'}` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                  <strong style={{ color: 'var(--text-primary)', fontSize: '0.95rem' }}>5. Good Standing & Conduct</strong>
                  <span className={`badge ${criteria.feedbackAndConduct.met ? 'badge-success' : 'badge-danger'}`}>
                    {criteria.feedbackAndConduct.met ? '✓ Satisfied' : 'Action Required'}
                  </span>
                </div>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.75rem' }}>
                  Status: Age {criteria.feedbackAndConduct.current?.age || 'N/A'}, {criteria.feedbackAndConduct.current?.openComplaintsCount || 0} open complaints
                </div>
                <div style={{ fontSize: '0.8rem', color: criteria.feedbackAndConduct.met ? 'var(--success)' : 'var(--error)' }}>
                  {criteria.feedbackAndConduct.met
                    ? '✓ Adult learner in good standing without unresolved disputes'
                    : criteria.feedbackAndConduct.reason}
                </div>
              </div>
            )}

            {/* 6. Profile Completeness */}
            {criteria.profileCompleteness && (
              <div className="glass-card" style={{ padding: '1.25rem', borderLeft: `4px solid ${criteria.profileCompleteness.met ? 'var(--success)' : 'var(--warning)'}` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                  <strong style={{ color: 'var(--text-primary)', fontSize: '0.95rem' }}>6. Profile Completeness</strong>
                  <span className={`badge ${criteria.profileCompleteness.met ? 'badge-success' : 'badge-warning'}`}>
                    {criteria.profileCompleteness.met ? '✓ Satisfied' : 'Incomplete'}
                  </span>
                </div>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.75rem' }}>
                  Onboarding: {criteria.profileCompleteness.current?.onboardingCompleted ? '✓ Done' : 'Pending'}, Bio & Skills provided
                </div>
                <div style={{ fontSize: '0.8rem', color: criteria.profileCompleteness.met ? 'var(--success)' : 'var(--text-muted)' }}>
                  {criteria.profileCompleteness.met
                    ? '✓ Student bio, skills, interests & onboarding complete'
                    : criteria.profileCompleteness.reason}
                </div>
                {!criteria.profileCompleteness.met && (
                  <Link to="/student/profile" style={{ fontSize: '0.8rem', color: 'var(--accent-primary)', display: 'inline-block', marginTop: '0.5rem', fontWeight: 600 }}>
                    Complete Student Profile →
                  </Link>
                )}
              </div>
            )}

          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          SECTION: APPLICATION FORM / SUBMISSION GATE
          (Shown to students who do not have an active application in review)
         ───────────────────────────────────────────────────────────── */}
      {!isApproved && !isInReview && (
        <div className="glass-card" style={{ padding: '2rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.5rem', paddingBottom: '1rem', borderBottom: '1px solid var(--border-subtle)' }}>
            <div>
              <h3 style={{ margin: 0, color: 'var(--text-primary)' }}>Peer Mentor Application Form</h3>
              <p style={{ margin: '0.25rem 0 0 0', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                {isEligibleToApply
                  ? 'Please tell us about your mentoring motivations and the subject areas you are confident teaching.'
                  : 'The application form is locked until you meet all 6 experience criteria.'}
              </p>
            </div>

            {!isEligibleToApply && (
              <span style={{ fontSize: '0.85rem', color: 'var(--warning)', background: 'var(--warning-subtle)', padding: '0.35rem 0.75rem', borderRadius: '6px', border: '1px solid var(--warning)', fontWeight: 600 }}>
                🔒 Locked ({metCount}/6 Requirements Met)
              </span>
            )}
          </div>

          {!isEligibleToApply && eligibility?.reasons?.length > 0 && (
            <div style={{ background: 'var(--bg-surface-elevated)', border: '1px solid var(--border-subtle)', borderRadius: '8px', padding: '1.25rem', marginBottom: '1.5rem' }}>
              <strong style={{ color: 'var(--text-primary)', fontSize: '0.9rem', display: 'block', marginBottom: '0.5rem' }}>
                Why is the application locked?
              </strong>
              <p style={{ margin: '0 0 0.75rem 0', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                To maintain high quality peer mentorship, applicants must first satisfy all requirements:
              </p>
              <ul style={{ margin: 0, paddingLeft: '1.25rem', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                {eligibility.reasons.map((r, i) => (
                  <li key={i} style={{ marginBottom: '0.35rem' }}>{r}</li>
                ))}
              </ul>
            </div>
          )}

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <div>
              <label htmlFor="motivation" style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
                Why do you want to become a peer mentor? <span style={{ color: 'var(--error)' }}>*</span>
              </label>
              <textarea
                id="motivation"
                name="motivation"
                value={formData.motivation}
                onChange={handleChange}
                rows="4"
                className="form-input"
                style={{ resize: 'vertical' }}
                placeholder={isEligibleToApply ? "Explain your motivation to help fellow learners..." : "Form unlocked once eligibility requirements are met."}
                required
                disabled={!isEligibleToApply}
              />
            </div>

            <div>
              <label htmlFor="topics" style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
                Which topics or technologies can you teach? <span style={{ color: 'var(--error)' }}>*</span>
              </label>
              <input
                id="topics"
                type="text"
                name="topics"
                value={formData.topics}
                onChange={handleChange}
                className="form-input"
                placeholder="e.g. Data Structures & Algorithms, React, Python, System Foundations"
                required
                disabled={!isEligibleToApply}
              />
            </div>

            <div>
              <label htmlFor="teachingExperience" style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
                Previous tutoring or peer mentoring experience (Optional)
              </label>
              <textarea
                id="teachingExperience"
                name="teachingExperience"
                value={formData.teachingExperience}
                onChange={handleChange}
                rows="3"
                className="form-input"
                style={{ resize: 'vertical' }}
                placeholder="Describe any informal or formal experience helping classmates or juniors learn..."
                disabled={!isEligibleToApply}
              />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap', marginTop: '0.5rem' }}>
              <button
                id="peer-mentor-submit-btn"
                type="submit"
                disabled={submitting || !isEligibleToApply}
                className="btn btn-primary"
                style={{
                  opacity: !isEligibleToApply ? 0.6 : 1,
                  cursor: !isEligibleToApply ? 'not-allowed' : 'pointer'
                }}
              >
                {submitting ? 'Submitting...' : isEligibleToApply ? 'Submit Peer Mentor Application' : '🔒 Complete Requirements to Submit'}
              </button>

              {!isEligibleToApply && (
                <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                  Submit button activates automatically upon fulfilling all 6 criteria.
                </span>
              )}
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
