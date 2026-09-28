import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { fetchStudentMentorships, cancelMentorship } from '../../services/mentorService';
import DashboardCard from '../../components/DashboardCard';

export default function StudentMentors() {
  const [mentorships, setMentorships] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadMentorships = async () => {
    try {
      setLoading(true);
      const data = await fetchStudentMentorships();
      setMentorships(data);
      setError('');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMentorships();
  }, []);

  const handleCancel = async (id) => {
    if (!window.confirm('Are you sure you want to cancel this mentorship?')) return;
    try {
      await cancelMentorship(id);
      await loadMentorships();
    } catch (err) {
      alert(err.message);
    }
  };

  if (loading) return <div className="page-content">Loading your mentors...</div>;

  const activeMentorships = mentorships.filter(m => m.status === 'ACTIVE').length;

  return (
    <div className="page-content">
      <div className="page-header">
        <div>
          <h2 className="page-title">My Mentors</h2>
          <p className="page-subtitle">Track your pending requests and active mentorships.</p>
        </div>
      </div>

      <div className="stats-grid stats-grid-4">
        <DashboardCard 
          title="Active Mentorships" 
          value={activeMentorships.toString()} 
          subtitle="Current connections" 
          color="#10b981"
          icon={
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
              <circle cx="9" cy="7" r="4"/>
              <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
            </svg>
          }
        />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', gap: '1.5rem' }}>
        {mentorships.filter(m => m.status === 'ACTIVE' || m.status === 'PENDING').length === 0 ? (
          <div className="glass-card" style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '3rem' }}>
            <p style={{ color: 'var(--text-secondary)' }}>You don't have any mentorship requests or active connections.</p>
          </div>
        ) : (
          mentorships.filter(m => m.status === 'ACTIVE' || m.status === 'PENDING').map(m => (
            <div key={m.id} className="glass-card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  <div style={{ 
                    width: '40px', height: '40px', borderRadius: '50%', background: 'var(--accent-primary)', 
                    display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 'bold' 
                  }}>
                    {m.mentor?.user?.name?.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <h3 style={{ margin: '0 0 0.25rem 0', color: 'var(--text-primary)', fontSize: '1.1rem' }}>{m.mentor?.user?.name}</h3>
                    <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>{m.mentor?.expertise || 'Mentor'}</div>
                  </div>
                </div>
                <span style={{ 
                  fontSize: '0.75rem', padding: '0.2rem 0.5rem', borderRadius: '12px', 
                  background: m.status === 'ACTIVE' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(107, 114, 128, 0.1)',
                  color: m.status === 'ACTIVE' ? '#10b981' : '#9ca3af' 
                }}>
                  {m.status}
                </span>
              </div>
              
              <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1.5rem' }}>
                {m.status === 'PENDING' ? 'Requested' : 'Started'}: {new Date(m.status === 'ACTIVE' && m.startedAt ? m.startedAt : m.createdAt).toLocaleDateString()}
              </div>

              <div style={{ display: 'flex', gap: '0.75rem', marginTop: 'auto' }}>
                {m.status === 'ACTIVE' && (
                  <Link to={`/student/mentorships/${m.id}/book`} className="btn btn-primary" style={{ flex: 1, textAlign: 'center', padding: '0.5rem', textDecoration: 'none' }}>
                    Book Session
                  </Link>
                )}
                <button onClick={() => handleCancel(m.id)} style={{ flex: 1, padding: '0.5rem', background: 'rgba(239,68,68,0.1)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '4px', cursor: 'pointer' }}>
                  {m.status === 'PENDING' ? 'Cancel Request' : 'Cancel Mentorship'}
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      <div className="page-header" style={{ marginTop: '3rem' }}>
        <div>
          <h2 className="page-title">Past Mentorships</h2>
          <p className="page-subtitle">Your historical mentorship records.</p>
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', gap: '1.5rem' }}>
        {mentorships.filter(m => m.status === 'CANCELLED' || m.status === 'COMPLETED').length === 0 ? (
          <div className="glass-card" style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '2rem' }}>
            <p style={{ color: 'var(--text-secondary)' }}>No past mentorships.</p>
          </div>
        ) : (
          mentorships.filter(m => m.status === 'CANCELLED' || m.status === 'COMPLETED').map(m => (
            <div key={m.id} className="glass-card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', opacity: 0.8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  <div style={{ 
                    width: '40px', height: '40px', borderRadius: '50%', background: 'var(--text-muted)', 
                    display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 'bold' 
                  }}>
                    {m.mentor?.user?.name?.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <h3 style={{ margin: '0 0 0.25rem 0', color: 'var(--text-primary)', fontSize: '1.1rem' }}>{m.mentor?.user?.name}</h3>
                    <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>{m.mentor?.expertise || 'Mentor'}</div>
                  </div>
                </div>
                <span style={{ 
                  fontSize: '0.75rem', padding: '0.2rem 0.5rem', borderRadius: '12px', 
                  background: 'rgba(107, 114, 128, 0.1)', color: '#9ca3af' 
                }}>
                  {m.status}
                </span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
