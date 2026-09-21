import { useState, useEffect } from 'react';
import { fetchAdminMentors } from '../../services/adminService';

export default function AdminMentors() {
  const [mentors, setMentors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const loadMentors = async () => {
      try {
        setLoading(true);
        const data = await fetchAdminMentors();
        setMentors(data);
        setError('');
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    loadMentors();
  }, []);

  return (
    <div className="page-content">
      <div className="page-header">
        <div>
          <h2 className="page-title">Manage Mentors 🎓</h2>
          <p className="page-subtitle">View and monitor all mentor profiles.</p>
        </div>
      </div>

      <div className="glass-card" style={{ overflowX: 'auto' }}>
        {error && <div style={{ color: '#ef4444', padding: '1rem' }}>{error}</div>}
        
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border-subtle)', background: 'rgba(255,255,255,0.02)' }}>
              <th style={{ padding: '1rem' }}>Mentor Name</th>
              <th style={{ padding: '1rem' }}>Email</th>
              <th style={{ padding: '1rem' }}>Expertise</th>
              <th style={{ padding: '1rem' }}>Experience</th>
              <th style={{ padding: '1rem' }}>Rate/hr</th>
              <th style={{ padding: '1rem' }}>Status</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan="6" style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>Loading mentors...</td></tr>
            ) : mentors.length === 0 ? (
              <tr><td colSpan="6" style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>No mentors found.</td></tr>
            ) : (
              mentors.map(mentor => (
                <tr key={mentor.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                  <td style={{ padding: '1rem', fontWeight: 500, color: 'white' }}>{mentor.user.name}</td>
                  <td style={{ padding: '1rem', color: 'var(--text-secondary)' }}>{mentor.user.email}</td>
                  <td style={{ padding: '1rem', color: 'var(--text-secondary)' }}>{mentor.expertise || '-'}</td>
                  <td style={{ padding: '1rem', color: 'var(--text-secondary)' }}>{mentor.experience ? `${mentor.experience} yrs` : '-'}</td>
                  <td style={{ padding: '1rem', color: 'var(--text-secondary)' }}>{mentor.hourlyRate ? `$${mentor.hourlyRate}` : '-'}</td>
                  <td style={{ padding: '1rem' }}>
                    <span className={`badge ${mentor.isAvailable ? 'badge-success' : 'badge-warning'}`}>
                      {mentor.isAvailable ? 'Available' : 'Unavailable'}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
