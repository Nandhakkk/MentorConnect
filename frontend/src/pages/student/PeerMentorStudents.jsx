import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { fetchMyMentorProfile } from '../../services/mentorService';
import { fetchMentorMentorships, acceptMentorship, rejectMentorship } from '../../services/mentorService';

export default function PeerMentorStudents() {
  const { user } = useAuth();
  const [mentorships, setMentorships] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadMentorships = async () => {
    try {
      setLoading(true);
      const data = await fetchMentorMentorships();
      setMentorships(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadMentorships(); }, []);

  const handleAccept = async (id) => {
    try { await acceptMentorship(id); loadMentorships(); } catch (err) { setError(err.message); }
  };
  const handleReject = async (id) => {
    try { await rejectMentorship(id); loadMentorships(); } catch (err) { setError(err.message); }
  };

  const pending = mentorships.filter(m => m.status === 'PENDING');
  const active = mentorships.filter(m => m.status === 'ACTIVE');
  const other = mentorships.filter(m => !['PENDING', 'ACTIVE'].includes(m.status));

  return (
    <div className="page-content">
      <div className="page-header">
        <div>
          <h2 className="page-title">My Students</h2>
          <p className="page-subtitle">Manage your peer mentoring relationships.</p>
        </div>
      </div>

      {error && <div style={{ color: '#ef4444', marginBottom: '1rem' }}>{error}</div>}

      {loading ? <div>Loading...</div> : (
        <>
          {pending.length > 0 && (
            <div style={{ marginBottom: '2rem' }}>
              <h3 style={{ marginBottom: '1rem', color: '#f59e0b' }}>Pending Requests ({pending.length})</h3>
              {pending.map(m => (
                <div key={m.id} className="glass-card" style={{ padding: '1.25rem', marginBottom: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
                  <div>
                    <strong>{m.student?.user?.name || 'Student'}</strong>
                    <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>{m.student?.user?.email}</div>
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button onClick={() => handleAccept(m.id)} className="btn btn-primary" style={{ padding: '0.4rem 1rem', fontSize: '0.85rem' }}>Accept</button>
                    <button onClick={() => handleReject(m.id)} className="btn btn-secondary" style={{ padding: '0.4rem 1rem', fontSize: '0.85rem' }}>Reject</button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {active.length > 0 && (
            <div style={{ marginBottom: '2rem' }}>
              <h3 style={{ marginBottom: '1rem', color: '#10b981' }}>Active Mentorships ({active.length})</h3>
              {active.map(m => (
                <div key={m.id} className="glass-card" style={{ padding: '1.25rem', marginBottom: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <strong>{m.student?.user?.name || 'Student'}</strong>
                    <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Active since {new Date(m.startedAt).toLocaleDateString()}</div>
                  </div>
                  <span style={{ fontSize: '0.75rem', padding: '0.2rem 0.5rem', borderRadius: '12px', background: 'rgba(16, 185, 129, 0.1)', color: '#10b981' }}>Active</span>
                </div>
              ))}
            </div>
          )}

          {pending.length === 0 && active.length === 0 && (
            <div className="glass-card" style={{ padding: '3rem', textAlign: 'center' }}>
              <p style={{ color: 'var(--text-secondary)' }}>No student mentorships yet. Once learners find you and request mentorship, they'll appear here.</p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
