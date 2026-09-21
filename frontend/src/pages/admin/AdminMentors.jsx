import { useState, useEffect } from 'react';
import { fetchAdminMentors, updateMentorStatus } from '../../services/adminService';

export default function AdminMentors() {
  const [mentors, setMentors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [actionInProgress, setActionInProgress] = useState(null);

  useEffect(() => {
    loadMentors();
  }, [statusFilter]);

  const loadMentors = async () => {
    try {
      setLoading(true);
      const data = await fetchAdminMentors(statusFilter);
      setMentors(data);
      setError('');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (mentorId) => {
    if (!window.confirm('Are you sure you want to approve this mentor?')) {
      return;
    }

    try {
      setActionInProgress(mentorId);
      await updateMentorStatus(mentorId, 'APPROVED');
      alert('Mentor approved successfully!');
      loadMentors();
    } catch (err) {
      alert(`Failed to approve mentor: ${err.message}`);
    } finally {
      setActionInProgress(null);
    }
  };

  const handleReject = async (mentorId) => {
    if (!window.confirm('Are you sure you want to reject this mentor?')) {
      return;
    }

    try {
      setActionInProgress(mentorId);
      await updateMentorStatus(mentorId, 'REJECTED');
      alert('Mentor rejected.');
      loadMentors();
    } catch (err) {
      alert(`Failed to reject mentor: ${err.message}`);
    } finally {
      setActionInProgress(null);
    }
  };

  const getStatusBadgeClass = (status) => {
    switch (status) {
      case 'APPROVED':
        return 'badge-success';
      case 'REJECTED':
        return 'badge-error';
      case 'PENDING':
      default:
        return 'badge-warning';
    }
  };

  return (
    <div className="page-content">
      <div className="page-header">
        <div>
          <h2 className="page-title">Manage Mentors 🎓</h2>
          <p className="page-subtitle">Review and approve mentor applications.</p>
        </div>
        <div>
          <select 
            value={statusFilter} 
            onChange={(e) => setStatusFilter(e.target.value)}
            style={{
              padding: '0.5rem 1rem',
              borderRadius: '8px',
              border: '1px solid var(--border-subtle)',
              background: 'rgba(255,255,255,0.05)',
              color: 'var(--text-primary)',
              cursor: 'pointer'
            }}
          >
            <option value="ALL">All Statuses</option>
            <option value="PENDING">Pending</option>
            <option value="APPROVED">Approved</option>
            <option value="REJECTED">Rejected</option>
          </select>
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
                    <span className={`badge ${getStatusBadgeClass(mentor.status)}`}>
                      {mentor.status}
                    </span>
                  </td>
                  <td style={{ padding: '1rem' }}>
                    {mentor.status === 'PENDING' && (
                      <>
                        <button
                          onClick={() => handleApprove(mentor.id)}
                          disabled={actionInProgress === mentor.id}
                          style={{
                            padding: '0.4rem 0.8rem',
                            marginRight: '0.5rem',
                            borderRadius: '6px',
                            border: 'none',
                            background: actionInProgress === mentor.id ? '#6b7280' : '#10b981',
                            color: 'white',
                            cursor: actionInProgress === mentor.id ? 'not-allowed' : 'pointer',
                            fontSize: '0.85rem'
                          }}
                        >
                          {actionInProgress === mentor.id ? '...' : 'Approve'}
                        </button>
                        <button
                          onClick={() => handleReject(mentor.id)}
                          disabled={actionInProgress === mentor.id}
                          style={{
                            padding: '0.4rem 0.8rem',
                            borderRadius: '6px',
                            border: 'none',
                            background: actionInProgress === mentor.id ? '#6b7280' : '#ef4444',
                            color: 'white',
                            cursor: actionInProgress === mentor.id ? 'not-allowed' : 'pointer',
                            fontSize: '0.85rem'
                          }}
                        >
                          {actionInProgress === mentor.id ? '...' : 'Reject'}
                        </button>
                      </>
                    )}
                    {mentor.status === 'APPROVED' && (
                      <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>—</span>
                    )}
                    {mentor.status === 'REJECTED' && (
                      <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>—</span>
                    )}
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
