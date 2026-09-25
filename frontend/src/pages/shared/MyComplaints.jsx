import { useState, useEffect } from 'react';
import { getMyComplaints } from '../../services/complaintService';

export default function MyComplaints() {
  const [complaints, setComplaints] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchComplaints = async () => {
      try {
        setLoading(true);
        const data = await getMyComplaints();
        setComplaints(data);
      } catch (err) {
        setError(err.message || 'Failed to load complaints');
      } finally {
        setLoading(false);
      }
    };
    fetchComplaints();
  }, []);

  if (loading) return <div className="page-content">Loading complaints...</div>;

  return (
    <div className="page-content">
      <h2 className="page-title">My Complaints</h2>
      <p className="page-subtitle" style={{ marginBottom: '2rem' }}>Review the status of your submitted reports.</p>

      {error && <div style={{ color: '#ef4444', marginBottom: '1rem' }}>{error}</div>}

      {complaints.length === 0 ? (
        <p style={{ color: 'var(--text-muted)' }}>You have not submitted any complaints.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {complaints.map(c => (
            <div key={c.id} className="glass-card" style={{ padding: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <h4 style={{ margin: '0 0 0.5rem 0', color: 'var(--text-primary)' }}>{c.category.replace('_', ' ')}</h4>
                <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '0.25rem' }}>
                  Reported User: <strong>{c.reportedUser?.name}</strong>
                </div>
                {c.session && (
                  <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '0.5rem' }}>
                    Session: {new Date(c.session.scheduledAt).toLocaleString()}
                  </div>
                )}
                <div style={{ fontSize: '0.9rem', color: 'var(--text-primary)', fontStyle: 'italic', background: 'rgba(0,0,0,0.1)', padding: '0.5rem', borderRadius: '4px', marginTop: '0.5rem' }}>
                  "{c.description.substring(0, 100)}{c.description.length > 100 ? '...' : ''}"
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.5rem' }}>
                <span style={{ 
                  padding: '0.25rem 0.75rem', borderRadius: '12px', fontSize: '0.8rem', fontWeight: 'bold',
                  background: c.status === 'OPEN' ? 'rgba(59, 130, 246, 0.1)' : 
                              c.status === 'UNDER_REVIEW' ? 'rgba(245, 158, 11, 0.1)' : 
                              c.status === 'RESOLVED' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(107, 114, 128, 0.1)',
                  color: c.status === 'OPEN' ? '#3b82f6' : 
                         c.status === 'UNDER_REVIEW' ? '#f59e0b' : 
                         c.status === 'RESOLVED' ? '#10b981' : '#9ca3af'
                }}>
                  {c.status.replace('_', ' ')}
                </span>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  {new Date(c.createdAt).toLocaleDateString()}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
