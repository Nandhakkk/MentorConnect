import { formatCurrency } from '../../utils/currency';
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchAdminMentors } from '../../services/adminService';

export default function AdminPeerMentors() {
  const [mentors, setMentors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    const loadMentors = async () => {
      try {
        setLoading(true);
        const data = await fetchAdminMentors('PEER');
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

  const handleReview = (mentor) => {
    if (mentor.mentorType === 'PEER' && mentor.peerApplications?.length > 0) {
      navigate(`/admin/peer-mentor-applications/${mentor.peerApplications[0].id}`);
    } else if (mentor.applications?.length > 0) {
      navigate(`/admin/mentor-applications/${mentor.applications[0].id}`);
    } else {
      alert("No application found for this mentor.");
    }
  };

  const statusClass = (status) => {
    if (status === 'APPROVED') return 'badge-success';
    if (status === 'REJECTED') return 'badge-danger';
    return 'badge-warning';
  };

  return (
    <div className="page-content">
      <div className="page-header">
        <div>
          <h2 className="page-title">Manage Peer Mentors 🎓</h2>
          <p className="page-subtitle">Review peer mentor profiles and manage approval status.</p>
        </div>
      </div>

      <div className="glass-card" style={{ overflowX: 'auto' }}>
        {error && <div style={{ color: 'var(--error)', padding: '1rem' }}>{error}</div>}

        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border-subtle)', background: 'var(--bg-surface-elevated)' }}>
              <th style={{ padding: '1rem' }}>Mentor Name</th>
              <th style={{ padding: '1rem' }}>Email</th>
              <th style={{ padding: '1rem' }}>Expertise</th>
              <th style={{ padding: '1rem' }}>Experience</th>
              <th style={{ padding: '1rem' }}>Application Status</th>
              <th style={{ padding: '1rem' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan="6" style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>Loading peer mentors...</td></tr>
            ) : mentors.length === 0 ? (
              <tr><td colSpan="6" style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>No peer mentors found.</td></tr>
            ) : (
              mentors.map(mentor => (
                <tr key={mentor.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                  <td style={{ padding: '1rem', fontWeight: 500, color: 'var(--text-primary)' }}>{mentor.user.name}</td>
                  <td style={{ padding: '1rem', color: 'var(--text-secondary)' }}>{mentor.user.email}</td>
                  <td style={{ padding: '1rem', color: 'var(--text-secondary)' }}>{mentor.expertise || '-'}</td>
                  <td style={{ padding: '1rem', color: 'var(--text-secondary)' }}>{mentor.experience ? `${mentor.experience} yrs` : '-'}</td>
                  <td style={{ padding: '1rem' }}>
                    <span className={`badge ${statusClass(mentor.status)}`}>
                      {mentor.status}
                    </span>
                  </td>
                  <td style={{ padding: '1rem' }}>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={() => handleReview(mentor)}
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


    </div>
  );
}
