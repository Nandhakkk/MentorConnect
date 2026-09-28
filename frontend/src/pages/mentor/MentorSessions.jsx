import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { fetchSessions, cancelSession, completeSession } from '../../services/sessionService';
import SessionCountdown from '../../components/SessionCountdown';

export default function MentorSessions() {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

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

  const handleCancelSession = async (id) => {
    if (!window.confirm('Are you sure you want to cancel this session?')) return;
    try {
      await cancelSession(id);
      await loadSessions();
    } catch (err) {
      alert(err.message);
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
    if (new Date(s.scheduledAt) < now || s.status !== 'SCHEDULED') return false;
    if (s.payment && s.payment.amount > 0 && s.payment.status !== 'PAID') return false;
    return true;
  });
  const past = sessions.filter(s => {
    if (s.status === 'SCHEDULED' && new Date(s.scheduledAt) >= now) return false;
    // Don't show abandoned carts in past either
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

      {error && <div style={{ color: '#ef4444', marginBottom: '1rem' }}>{error}</div>}

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
                    Student: <strong>{session.mentorship?.student?.user?.name}</strong>
                  </div>
                  <div style={{ display: 'flex', gap: '1.5rem', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                    <span>Duration: {session.duration} min</span>
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
                      <button onClick={() => handleCompleteSession(session.id)} style={{ flex: 1, background: 'rgba(16,185,129,0.1)', color: '#10b981', border: '1px solid rgba(16,185,129,0.3)', padding: '0.5rem', borderRadius: '4px', cursor: 'pointer', fontSize: '0.85rem' }}>
                        Mark Complete
                      </button>
                      <button onClick={() => handleCancelSession(session.id)} style={{ flex: 1, background: 'rgba(239,68,68,0.1)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.3)', padding: '0.5rem', borderRadius: '4px', cursor: 'pointer', fontSize: '0.85rem' }}>
                        Cancel
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div>
        <h3 style={{ borderBottom: '1px solid var(--border-subtle)', paddingBottom: '0.5rem', marginBottom: '1.5rem' }}>Past & Cancelled Sessions</h3>
        {past.length === 0 ? (
          <p style={{ color: 'var(--text-muted)' }}>No past sessions.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {past.map(session => (
              <div key={session.id} className="glass-card" style={{ padding: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', opacity: 0.8 }}>
                <div>
                  <h4 style={{ margin: '0 0 0.5rem 0', color: 'var(--text-primary)', fontSize: '1.1rem' }}>
                    {new Date(session.scheduledAt).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}
                  </h4>
                  <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                    Student: {session.mentorship?.student?.user?.name} | {session.duration} min
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', alignItems: 'flex-end' }}>
                  <span style={{ 
                    padding: '0.25rem 0.75rem', borderRadius: '12px', fontSize: '0.8rem', fontWeight: 'bold',
                    background: session.status === 'COMPLETED' ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)',
                    color: session.status === 'COMPLETED' ? '#10b981' : '#ef4444'
                  }}>
                    {session.status}
                  </span>
                  {session.status === 'COMPLETED' && (
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <Link to={`/mentor/sessions/${session.id}/review`} style={{ fontSize: '0.85rem', color: 'var(--accent-primary)', textDecoration: 'underline' }}>
                        Provide Feedback
                      </Link>
                      <Link to={`/mentor/sessions/${session.id}/report`} style={{ fontSize: '0.85rem', color: '#ef4444', textDecoration: 'underline' }}>
                        Report
                      </Link>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
