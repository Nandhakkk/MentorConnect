import { useState, useEffect } from 'react';
import { getLinkedLearners, getLearnerSessions, getLearnerProgress } from '../../services/guardianService';
import { useAuth } from '../../context/AuthContext';

export default function GuardianDashboard() {
  const { user, token } = useAuth();
  const [learners, setLearners] = useState([]);
  const [selectedLearner, setSelectedLearner] = useState(null);
  
  const [sessions, setSessions] = useState([]);
  const [progress, setProgress] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchLearners = async () => {
      try {
        setLoading(true);
        const data = await getLinkedLearners(token);
        setLearners(data);
        if (data.length > 0) {
          setSelectedLearner(data[0]);
        }
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    if (token) fetchLearners();
  }, [token]);

  useEffect(() => {
    const fetchLearnerData = async () => {
      if (!selectedLearner) return;
      try {
        setLoading(true);
        const [sessData, progData] = await Promise.all([
          getLearnerSessions(selectedLearner.id, token),
          getLearnerProgress(selectedLearner.id, token)
        ]);
        setSessions(sessData);
        setProgress(progData);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchLearnerData();
  }, [selectedLearner, token]);

  if (loading && !learners.length) return <div className="page-content">Loading guardian dashboard...</div>;

  return (
    <div className="page-content">
      <div className="page-header">
        <div>
          <h2 className="page-title">Guardian Dashboard</h2>
          <p className="page-subtitle">Monitor learning progress, upcoming sessions, and platform safety.</p>
        </div>
      </div>

      {error && <div style={{ color: '#ef4444', marginBottom: '1rem' }}>{error}</div>}

      {learners.length === 0 && !loading ? (
        <div className="glass-card" style={{ padding: '3rem', textAlign: 'center' }}>
          <h3 style={{ fontSize: '1.25rem', marginBottom: '1rem' }}>No Linked Learners</h3>
          <p style={{ color: 'var(--text-secondary)' }}>
            You have not been linked to any minor learners yet. Have the learner go to their profile settings and link your account using your email address.
          </p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 3fr', gap: '2rem' }}>
          {/* Sidebar */}
          <div>
            <h3 style={{ fontSize: '1.1rem', marginBottom: '1rem', color: 'var(--text-secondary)' }}>Linked Learners</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {learners.map(learner => (
                <button
                  key={learner.id}
                  onClick={() => setSelectedLearner(learner)}
                  style={{
                    padding: '1rem',
                    textAlign: 'left',
                    borderRadius: 'var(--radius-md)',
                    background: selectedLearner?.id === learner.id ? 'rgba(99, 102, 241, 0.2)' : 'rgba(255,255,255,0.05)',
                    border: selectedLearner?.id === learner.id ? '1px solid var(--accent-primary)' : '1px solid var(--border-subtle)',
                    color: 'white',
                    cursor: 'pointer'
                  }}
                >
                  <div style={{ fontWeight: 600 }}>{learner.name}</div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{learner.relationship}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Main Content */}
          {selectedLearner && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
              
              {/* Learner Info */}
              <div className="glass-card" style={{ padding: '1.5rem' }}>
                <h3 style={{ fontSize: '1.25rem', marginBottom: '1rem' }}>Learner Profile</h3>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', color: 'var(--text-secondary)' }}>
                  <div><strong>Name:</strong> {selectedLearner.name}</div>
                  <div><strong>Email:</strong> {selectedLearner.email}</div>
                  <div><strong>Education:</strong> {selectedLearner.studentProfile?.education || 'N/A'}</div>
                  <div>
                    <strong>Status:</strong> <span className="badge badge-warning">Minor Learner</span>
                  </div>
                </div>
              </div>

              {/* Sessions & Bookings */}
              <div className="glass-card" style={{ padding: '1.5rem' }}>
                <h3 style={{ fontSize: '1.25rem', marginBottom: '1rem' }}>Upcoming Sessions & Payments</h3>
                {sessions.length === 0 ? (
                  <p style={{ color: 'var(--text-muted)' }}>No sessions found.</p>
                ) : (
                  <div className="table-responsive">
                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                      <thead>
                        <tr style={{ borderBottom: '1px solid var(--border-subtle)', color: 'var(--text-secondary)' }}>
                          <th style={{ padding: '0.75rem 0' }}>Date</th>
                          <th style={{ padding: '0.75rem 0' }}>Mentor</th>
                          <th style={{ padding: '0.75rem 0' }}>Status</th>
                          <th style={{ padding: '0.75rem 0' }}>Payment</th>
                        </tr>
                      </thead>
                      <tbody>
                        {sessions.map(sess => (
                          <tr key={sess.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                            <td style={{ padding: '1rem 0' }}>{new Date(sess.scheduledAt).toLocaleString()} ({sess.duration}m)</td>
                            <td style={{ padding: '1rem 0' }}>{sess.mentorship.mentor.user.name}</td>
                            <td style={{ padding: '1rem 0' }}>
                              <span className={`badge badge-${sess.status === 'SCHEDULED' ? 'primary' : 'secondary'}`}>
                                {sess.status}
                              </span>
                            </td>
                            <td style={{ padding: '1rem 0' }}>
                              {sess.payment ? (
                                <span className={`badge badge-${sess.payment.status === 'PAID' ? 'success' : 'warning'}`}>
                                  {sess.payment.amount} INR - {sess.payment.status}
                                </span>
                              ) : (
                                <span className="badge badge-secondary">Free / No Bill</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Progress */}
              <div className="glass-card" style={{ padding: '1.5rem' }}>
                <h3 style={{ fontSize: '1.25rem', marginBottom: '1rem' }}>Learning Progress</h3>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                  <div>
                    <h4 style={{ marginBottom: '0.75rem', color: 'var(--text-secondary)' }}>Goals</h4>
                    {progress?.goals.length === 0 ? (
                      <p style={{ color: 'var(--text-muted)' }}>No goals set.</p>
                    ) : (
                      <ul style={{ paddingLeft: '1.2rem', color: 'var(--text-primary)' }}>
                        {progress?.goals.map(g => (
                          <li key={g.id} style={{ marginBottom: '0.5rem' }}>
                            <strong>{g.title}</strong> - {g.status}
                            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                              Milestones: {g.milestones.filter(m => m.status === 'COMPLETED').length} / {g.milestones.length}
                            </div>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                  <div>
                    <h4 style={{ marginBottom: '0.75rem', color: 'var(--text-secondary)' }}>Assignments</h4>
                    {progress?.assignments.length === 0 ? (
                      <p style={{ color: 'var(--text-muted)' }}>No assignments.</p>
                    ) : (
                      <ul style={{ paddingLeft: '1.2rem', color: 'var(--text-primary)' }}>
                        {progress?.assignments.map(a => (
                          <li key={a.id} style={{ marginBottom: '0.5rem' }}>
                            <strong>{a.title}</strong> - {a.status}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              </div>

              {/* Safety & Reports */}
              <div className="glass-card" style={{ padding: '1.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <h3 style={{ fontSize: '1.25rem', marginBottom: '0.25rem' }}>Safety & Support</h3>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Report inappropriate behavior or platform issues regarding this learner.</p>
                  </div>
                  <button className="btn btn-secondary" onClick={() => alert('Support / Complaint portal coming in later phases.')}>
                    Report Issue
                  </button>
                </div>
              </div>

            </div>
          )}
        </div>
      )}
    </div>
  );
}
