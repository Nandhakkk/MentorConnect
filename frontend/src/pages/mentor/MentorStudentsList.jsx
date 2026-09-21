import { useState, useEffect } from 'react';
import { fetchMentorMentorships } from '../../services/mentorService';
import DashboardCard from '../../components/DashboardCard';

export default function MentorStudentsList() {
  const [mentorships, setMentorships] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadMentorships = async () => {
    try {
      setLoading(true);
      const data = await fetchMentorMentorships();
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

  if (loading) return <div className="page-content">Loading your students...</div>;

  const activeMentorships = mentorships.filter(m => m.status === 'ACTIVE').length;

  return (
    <div className="page-content">
      <div className="page-header">
        <div>
          <h2 className="page-title">My Students</h2>
          <p className="page-subtitle">View and manage your mentees.</p>
        </div>
      </div>

      <div className="stats-grid stats-grid-4">
        <DashboardCard 
          title="Active Students" 
          value={activeMentorships.toString()} 
          subtitle="Currently enrolled" 
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
        {mentorships.length === 0 ? (
          <div className="glass-card" style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '3rem' }}>
            <p style={{ color: 'var(--text-secondary)' }}>You don't have any students yet.</p>
          </div>
        ) : (
          mentorships.map(m => (
            <div key={m.id} className="glass-card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  <div style={{ 
                    width: '40px', height: '40px', borderRadius: '50%', background: 'var(--accent-primary)', 
                    display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 'bold' 
                  }}>
                    {m.student?.user?.name?.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <h3 style={{ margin: '0 0 0.25rem 0', color: 'var(--text-primary)', fontSize: '1.1rem' }}>{m.student?.user?.name}</h3>
                    <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>{m.student?.careerGoal || 'Student'}</div>
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
              
              <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>
                <strong>Education:</strong> {m.student?.education || 'Not specified'}
              </div>
              
              <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1.5rem' }}>
                Started: {new Date(m.createdAt).toLocaleDateString()}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
