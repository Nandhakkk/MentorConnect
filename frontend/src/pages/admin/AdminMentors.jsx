import { useState, useEffect } from 'react';
import { fetchAdminMentors } from '../../services/adminService';

export default function AdminMentors() {
  const [mentors, setMentors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedMentor, setSelectedMentor] = useState(null);
  const [actioning, setActioning] = useState(false);

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

  const updateApplication = () => {}; // Replaced by Mentor Applications Portal

  const statusClass = (status) => {
    if (status === 'APPROVED') return 'badge-success';
    if (status === 'REJECTED') return 'badge-danger';
    return 'badge-warning';
  };

  return (
    <div className="page-content">
      <div className="page-header">
        <div>
          <h2 className="page-title">Manage Mentors 🎓</h2>
          <p className="page-subtitle">Review mentor applications and manage approval status.</p>
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
              <th style={{ padding: '1rem' }}>Application Status</th>
              <th style={{ padding: '1rem' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan="7" style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>Loading mentors...</td></tr>
            ) : mentors.length === 0 ? (
              <tr><td colSpan="7" style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>No mentors found.</td></tr>
            ) : (
              mentors.map(mentor => (
                <tr key={mentor.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                  <td style={{ padding: '1rem', fontWeight: 500, color: 'white' }}>{mentor.user.name}</td>
                  <td style={{ padding: '1rem', color: 'var(--text-secondary)' }}>{mentor.user.email}</td>
                  <td style={{ padding: '1rem', color: 'var(--text-secondary)' }}>{mentor.expertise || '-'}</td>
                  <td style={{ padding: '1rem', color: 'var(--text-secondary)' }}>{mentor.experience ? `${mentor.experience} yrs` : '-'}</td>
                  <td style={{ padding: '1rem', color: 'var(--text-secondary)' }}>{mentor.hourlyRate ? `$${mentor.hourlyRate}` : '-'}</td>
                  <td style={{ padding: '1rem' }}>
                    <span className={`badge ${statusClass(mentor.status)}`}>
                      {mentor.status}
                    </span>
                  </td>
                  <td style={{ padding: '1rem' }}>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={() => setSelectedMentor(mentor)}
                      style={{ fontSize: '0.8rem', padding: '0.45rem 0.75rem' }}
                    >
                      Review
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {selectedMentor && (
        <div className="glass-card" style={{ marginTop: '1.5rem', padding: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', alignItems: 'start' }}>
            <div>
              <h3 style={{ margin: 0 }}>{selectedMentor.user.name}</h3>
              <p style={{ color: 'var(--text-secondary)', margin: '0.35rem 0' }}>{selectedMentor.user.email}</p>
              <p style={{ color: 'var(--text-secondary)', margin: '0.35rem 0' }}>
                <strong>Expertise:</strong> {selectedMentor.expertise || 'Not provided'} · <strong>Experience:</strong> {selectedMentor.experience ?? 'Not provided'} years
              </p>
              <p style={{ color: 'var(--text-secondary)', margin: '0.75rem 0 0', whiteSpace: 'pre-wrap' }}>{selectedMentor.bio || 'No bio provided.'}</p>
            </div>
            <span className={`badge ${statusClass(selectedMentor.status)}`}>{selectedMentor.status}</span>
          </div>
          
          <div style={{ marginTop: '1.5rem', padding: '1rem', background: 'rgba(255,255,255,0.05)', borderRadius: 'var(--radius-sm)' }}>
            <p style={{ margin: 0, color: 'var(--text-secondary)' }}>
              To review mentor applications, please use the new <a href="/admin/mentor-applications" style={{ color: 'var(--accent-primary)', textDecoration: 'underline' }}>Mentor Applications Portal</a>.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
