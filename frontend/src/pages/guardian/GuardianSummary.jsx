import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { fetchGuardianSummary } from '../../services/guardianService';

export default function GuardianSummary() {
  const { token } = useParams();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [errorInfo, setErrorInfo] = useState(null);

  useEffect(() => {
    // Prevent search engine indexing
    let meta = document.querySelector('meta[name="robots"]');
    if (!meta) {
      meta = document.createElement('meta');
      meta.name = 'robots';
      meta.content = 'noindex, nofollow';
      document.head.appendChild(meta);
    } else {
      meta.content = 'noindex, nofollow';
    }

    const loadSummary = async () => {
      try {
        setLoading(true);
        setErrorInfo(null);
        const res = await fetchGuardianSummary(token);
        setData(res);
      } catch (err) {
        setErrorInfo({
          message: err.message,
          code: err.code,
          status: err.status
        });
      } finally {
        setLoading(false);
      }
    };

    if (token) {
      loadSummary();
    } else {
      setErrorInfo({ message: 'No access token provided.', status: 400 });
      setLoading(false);
    }
  }, [token]);

  const formatDate = (dateStr) => {
    if (!dateStr) return '—';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return '—';
    return d.toLocaleString('en-IN', {
      timeZone: 'Asia/Kolkata',
      dateStyle: 'medium',
      timeStyle: 'short'
    });
  };

  if (loading) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'var(--bg-primary)',
        color: 'var(--text-primary)',
        padding: '2rem'
      }}>
        <div className="glass-card" style={{ padding: '2.5rem', textAlign: 'center', maxWidth: '400px' }}>
          <div style={{ fontSize: '2rem', marginBottom: '1rem' }}>⏳</div>
          <p style={{ margin: 0, color: 'var(--text-secondary)' }}>Loading secure student summary...</p>
        </div>
      </div>
    );
  }

  // Handle Error States
  if (errorInfo) {
    const isTransitioned18 = errorInfo.code === 'STUDENT_TRANSITIONED_18' || (errorInfo.message && errorInfo.message.includes('18 years'));
    const isExpiredOrRevoked = errorInfo.status === 410 || (errorInfo.message && (errorInfo.message.includes('expired') || errorInfo.message.includes('revoked')));

    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'var(--bg-primary)',
        color: 'var(--text-primary)',
        padding: '2rem'
      }}>
        <div className="glass-card" style={{ maxWidth: '560px', width: '100%', padding: '2.5rem', textAlign: 'center' }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>
            {isTransitioned18 ? '🎓' : isExpiredOrRevoked ? '⏰' : '🔒'}
          </div>

          <h2 style={{ fontSize: '1.4rem', marginBottom: '0.75rem', color: 'var(--text-primary)' }}>
            {isTransitioned18 ? 'Guardian Monitoring Concluded' : isExpiredOrRevoked ? 'Summary Link Expired or Revoked' : 'Access Restricted'}
          </h2>

          <div style={{
            background: isTransitioned18 ? 'var(--info-bg)' : 'var(--error-bg)',
            border: `1px solid var(--border-subtle)`,
            borderRadius: '8px',
            padding: '1.25rem',
            marginBottom: '1.5rem',
            fontSize: '0.9rem',
            lineHeight: '1.5',
            color: isTransitioned18 ? 'var(--info)' : 'var(--error)'
          }}>
            {errorInfo.message}
          </div>

          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: '1.6', marginBottom: '1.5rem' }}>
            {isTransitioned18
              ? 'Automated guardian monitoring applies only to learners under 18 years of age. Once an adult, learners manage their own learning interactions directly.'
              : 'For security and pupil privacy, summary links expire after 24 hours. If you need updated access, please ask the student to generate a fresh link from their profile.'}
          </p>

          <Link to="/" className="btn btn-secondary" style={{ display: 'inline-block' }}>
            MentorConnect Home
          </Link>
        </div>
      </div>
    );
  }

  const { student, guardian, learningProgress, upcomingSessions, recentSessions, assignments, payments, complaintUpdates, safetyNotice, lastUpdated, linkExpiresAt } = data;

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: 'var(--bg-primary)',
      color: 'var(--text-primary)',
      padding: '2rem 1rem'
    }}>
      <div style={{ maxWidth: '1040px', margin: '0 auto' }}>
        {/* Top Header */}
        <header style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '1rem',
          paddingBottom: '1.5rem',
          marginBottom: '1.5rem',
          borderBottom: '1px solid var(--border-subtle)'
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <span style={{ fontSize: '1.6rem', color: 'var(--accent-primary)' }}>🛡️</span>
              <h1 style={{ margin: 0, fontSize: '1.5rem', letterSpacing: '-0.02em', color: 'var(--text-primary)' }}>
                Guardian Monitoring Summary
              </h1>
            </div>
            <p style={{ margin: '0.25rem 0 0', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              Read-Only Oversight Portal · MentorConnect Platform
            </p>
          </div>

          <div style={{ textAlign: 'right', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
            <div>Last Updated: <strong>{formatDate(lastUpdated)}</strong></div>
            <div style={{ color: 'var(--warning)', marginTop: '2px', fontWeight: 500 }}>
              Link Expires: {formatDate(linkExpiresAt)}
            </div>
          </div>
        </header>

        {/* Pupil & Guardian Identity Card */}
        <div className="glass-card" style={{ padding: '1.25rem 1.75rem', marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <span style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)' }}>
              Learner
            </span>
            <div style={{ fontSize: '1.2rem', fontWeight: 600, color: 'var(--accent-primary)' }}>
              {student?.name}
            </div>
          </div>

          <div>
            <span style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)' }}>
              Authorized Contact
            </span>
            <div style={{ fontSize: '1rem', fontWeight: 500, color: 'var(--text-primary)' }}>
              {guardian?.name} <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>({guardian?.relationship})</span>
            </div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{guardian?.email}</div>
          </div>

          <div>
            <span style={{
              display: 'inline-block',
              padding: '6px 12px',
              borderRadius: '20px',
              fontSize: '0.75rem',
              fontWeight: 600,
              background: 'var(--success-bg)',
              color: 'var(--success)',
              border: '1px solid var(--border-subtle)'
            }}>
              ✓ Read-Only Monitoring Active
            </span>
          </div>
        </div>

        {/* Safeguarding & Privacy Notice */}
        <div style={{
          background: 'var(--info-bg)',
          borderLeft: '4px solid var(--info)',
          borderRadius: '6px',
          padding: '1rem 1.25rem',
          marginBottom: '1.75rem'
        }}>
          <h4 style={{ margin: '0 0 0.4rem', fontSize: '0.9rem', color: 'var(--info)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <span>🔒</span> Privacy & Safeguarding Notice
          </h4>
          <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: '1.5' }}>
            {safetyNotice?.policy}
          </p>
        </div>

        {/* Section 1: Learning Progress */}
        <section className="glass-card" style={{ padding: '1.5rem', marginBottom: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
            <h3 style={{ margin: 0, fontSize: '1.15rem', color: 'var(--text-primary)' }}>🎯 Learning Goals & Milestones</h3>
            <span style={{ fontSize: '0.85rem', color: 'var(--accent-primary)', fontWeight: 600 }}>
              {learningProgress?.completedMilestones} of {learningProgress?.totalMilestones} Milestones Completed ({learningProgress?.completionPercentage}%)
            </span>
          </div>

          {/* Progress Bar */}
          <div style={{ width: '100%', height: '8px', background: 'var(--border-subtle)', borderRadius: '4px', overflow: 'hidden', marginBottom: '1.25rem' }}>
            <div style={{ width: `${learningProgress?.completionPercentage || 0}%`, height: '100%', background: 'var(--accent-primary)', transition: 'width 0.4s ease' }}></div>
          </div>

          {learningProgress?.goals?.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {learningProgress.goals.map(goal => (
                <div key={goal.id} style={{ background: 'var(--bg-surface-elevated)', padding: '1rem', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                    <span style={{ fontWeight: 600, fontSize: '0.95rem', color: 'var(--text-primary)' }}>{goal.title}</span>
                    <span style={{
                      fontSize: '0.75rem',
                      padding: '2px 8px',
                      borderRadius: '10px',
                      background: goal.status === 'COMPLETED' ? 'var(--success-bg)' : 'var(--info-bg)',
                      color: goal.status === 'COMPLETED' ? 'var(--success)' : 'var(--info)',
                      border: '1px solid var(--border-subtle)'
                    }}>
                      {goal.status}
                    </span>
                  </div>

                  {goal.milestones?.length > 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', marginTop: '0.5rem' }}>
                      {goal.milestones.map(m => (
                        <div key={m.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.85rem', padding: '4px 0', borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                          <span style={{ color: m.status === 'COMPLETED' ? 'var(--text-secondary)' : 'var(--text-primary)', textDecoration: m.status === 'COMPLETED' ? 'line-through' : 'none' }}>
                            {m.status === 'COMPLETED' ? '✓ ' : '○ '} {m.title}
                          </span>
                          <span style={{ fontSize: '0.75rem', color: m.status === 'COMPLETED' ? 'var(--success)' : 'var(--text-muted)' }}>
                            {m.status === 'COMPLETED' ? 'Completed' : (m.dueDate ? `Due ${new Date(m.dueDate).toLocaleDateString()}` : 'Pending')}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-muted)' }}>No milestones set yet.</p>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>No learning goals active at this time.</p>
          )}
        </section>

        {/* Grid for Sessions and Assignments */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(460px, 1fr))', gap: '1.5rem', marginBottom: '1.5rem' }}>
          {/* Section 2: Mentoring Sessions */}
          <section className="glass-card" style={{ padding: '1.5rem' }}>
            <h3 style={{ margin: '0 0 1rem', fontSize: '1.15rem', color: 'var(--text-primary)' }}>🗓️ Mentoring Sessions</h3>

            {/* Upcoming */}
            <div style={{ marginBottom: '1.25rem' }}>
              <h4 style={{ fontSize: '0.9rem', color: 'var(--accent-primary)', margin: '0 0 0.5rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Upcoming Scheduled
              </h4>
              {upcomingSessions?.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                  {upcomingSessions.map(s => (
                    <div key={s.id} style={{ padding: '0.75rem', background: 'var(--info-bg)', borderLeft: '3px solid var(--accent-primary)', borderRadius: '4px' }}>
                      <div style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-primary)' }}>{s.topic}</div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                        Mentor: <strong>{s.mentorName}</strong> · Duration: {s.durationMinutes} mins
                      </div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--info)', marginTop: '2px', fontWeight: 500 }}>
                        {formatDate(s.scheduledAt)}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: 0 }}>No upcoming sessions scheduled.</p>
              )}
            </div>

            {/* Recent Sessions */}
            <div>
              <h4 style={{ fontSize: '0.9rem', color: 'var(--text-muted)', margin: '0 0 0.5rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Recent Sessions
              </h4>
              {recentSessions?.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {recentSessions.slice(0, 5).map(s => (
                    <div key={s.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.85rem', padding: '6px 0', borderBottom: '1px solid var(--border-subtle)' }}>
                      <div>
                        <div style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{s.topic}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{s.mentorName} · {formatDate(s.scheduledAt)}</div>
                      </div>
                      <span style={{
                        fontSize: '0.75rem',
                        padding: '2px 8px',
                        borderRadius: '4px',
                        background: s.status === 'COMPLETED' ? 'var(--success-bg)' : 'var(--error-bg)',
                        color: s.status === 'COMPLETED' ? 'var(--success)' : 'var(--error)',
                        border: '1px solid var(--border-subtle)'
                      }}>
                        {s.status}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: 0 }}>No recent session history.</p>
              )}
            </div>
          </section>

          {/* Section 3: Assignments */}
          <section className="glass-card" style={{ padding: '1.5rem' }}>
            <h3 style={{ margin: '0 0 1rem', fontSize: '1.15rem', color: 'var(--text-primary)' }}>📋 Assignments & Tasks</h3>
            {assignments?.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {assignments.map(a => (
                  <div key={a.id} style={{ padding: '0.75rem', background: 'var(--bg-surface-elevated)', borderRadius: '6px', border: '1px solid var(--border-subtle)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem' }}>
                      <span style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-primary)' }}>{a.title}</span>
                      <div style={{ display: 'flex', gap: '4px' }}>
                        {a.isOverdue && (
                          <span style={{ fontSize: '0.7rem', padding: '2px 6px', borderRadius: '4px', background: 'var(--error-bg)', color: 'var(--error)', fontWeight: 600, border: '1px solid var(--border-subtle)' }}>
                            OVERDUE
                          </span>
                        )}
                        <span style={{
                          fontSize: '0.7rem',
                          padding: '2px 6px',
                          borderRadius: '4px',
                          background: a.status === 'REVIEWED' ? 'var(--success-bg)' : 'var(--warning-bg)',
                          color: a.status === 'REVIEWED' ? 'var(--success)' : 'var(--warning)',
                          border: '1px solid var(--border-subtle)'
                        }}>
                          {a.status}
                        </span>
                      </div>
                    </div>
                    {a.description && (
                      <p style={{ margin: '4px 0', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                        {a.description.length > 90 ? `${a.description.substring(0, 90)}...` : a.description}
                      </p>
                    )}
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                      Due: {a.dueDate ? new Date(a.dueDate).toLocaleDateString() : 'No date'} · Submission: <strong>{a.submissionStatus}</strong>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>No assignments assigned yet.</p>
            )}
          </section>
        </div>

        {/* Section 4 & 5: Payments and Support Status */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(460px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
          {/* Payments */}
          <section className="glass-card" style={{ padding: '1.5rem' }}>
            <h3 style={{ margin: '0 0 1rem', fontSize: '1.15rem', color: 'var(--text-primary)' }}>💳 Payments</h3>
            {payments?.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                {payments.map(p => (
                  <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.85rem', padding: '8px 0', borderBottom: '1px solid var(--border-subtle)' }}>
                    <div>
                      <div style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{p.sessionTopic}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{formatDate(p.paymentDate)}</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>₹{p.amount}</div>
                      <span style={{
                        fontSize: '0.7rem',
                        fontWeight: 600,
                        color: p.status === 'PAID' ? 'var(--success)' : 'var(--warning)'
                      }}>
                        {p.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>No payment records available.</p>
            )}
          </section>

          {/* Support & Safeguarding Updates */}
          <section className="glass-card" style={{ padding: '1.5rem' }}>
            <h3 style={{ margin: '0 0 1rem', fontSize: '1.15rem', color: 'var(--text-primary)' }}>🛡️ Support & Authorized Updates</h3>
            {complaintUpdates?.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {complaintUpdates.map(c => (
                  <div key={c.id} style={{ padding: '0.75rem', background: 'var(--bg-surface-elevated)', borderRadius: '6px', border: '1px solid var(--border-subtle)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                      <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)' }}>Category: {c.category?.replace(/_/g, ' ')}</span>
                      <span style={{ fontSize: '0.75rem', fontWeight: 600, color: c.status === 'RESOLVED' ? 'var(--success)' : 'var(--info)' }}>{c.status}</span>
                    </div>
                    {c.resolutionSummary && (
                      <p style={{ margin: '4px 0', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                        Resolution: {c.resolutionSummary}
                      </p>
                    )}
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Filed: {formatDate(c.filedDate)}</div>
                  </div>
                ))}
              </div>
            ) : (
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>No active support cases or inquiries.</p>
            )}

            <div style={{ marginTop: '1.25rem', paddingTop: '1rem', borderTop: '1px solid var(--border-subtle)', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              For urgent safety questions or concerns, reach our designated support contact at{' '}
              <a href={`mailto:${safetyNotice?.supportContact}`} style={{ color: 'var(--accent-primary)', textDecoration: 'underline' }}>
                {safetyNotice?.supportContact}
              </a>.
            </div>
          </section>
        </div>

        {/* Footer */}
        <footer style={{ textAlign: 'center', fontSize: '0.75rem', color: 'var(--text-muted)', padding: '1.5rem 0' }}>
          MentorConnect AI-Powered Goal-Based Mentoring Platform · Read-Only Guardian Oversight · No Account or Login Required
        </footer>
      </div>
    </div>
  );
}
