import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { fetchMentorApplications } from '../../services/adminService';

export default function AdminMentorApplications() {
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

  useEffect(() => {
    loadApplications();
  }, [statusFilter]);

  const loadApplications = async () => {
    try {
      setLoading(true);
      const data = await fetchMentorApplications(statusFilter);
      setApplications(data);
      setError('');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadgeClass = (status) => {
    switch (status) {
      case 'APPROVED': return 'badge-success';
      case 'REJECTED': 
      case 'SUSPENDED': return 'badge-error';
      case 'UNDER_REVIEW':
      case 'AI_SCREENED': return 'badge-primary';
      default: return 'badge-warning';
    }
  };

  return (
    <div className="page-content">
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 className="page-title">Mentor Applications</h2>
          <p className="page-subtitle">Review and manage professional mentor applications.</p>
        </div>
      </div>

      <div className="glass-card" style={{ padding: '1.5rem', marginBottom: '2rem' }}>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <label style={{ color: 'var(--text-secondary)' }}>Filter by Status:</label>
          <select 
            className="form-input" 
            style={{ width: 'auto' }}
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="ALL">All Applications</option>
            <option value="PENDING">Pending</option>
            <option value="AI_SCREENED">AI Screened</option>
            <option value="UNDER_REVIEW">Under Review</option>
            <option value="APPROVED">Approved</option>
            <option value="REJECTED">Rejected</option>
            <option value="SUSPENDED">Suspended</option>
          </select>
          <button className="btn btn-secondary" onClick={loadApplications} disabled={loading}>
            Refresh
          </button>
        </div>
      </div>

      {error && <div style={{ color: 'var(--error)', marginBottom: '1rem' }}>{error}</div>}

      <div className="glass-card">
        {loading ? (
          <div style={{ padding: '2rem', textAlign: 'center' }}>Loading applications...</div>
        ) : applications.length === 0 ? (
          <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
            No mentor applications found for this filter.
          </div>
        ) : (
          <div className="table-responsive">
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-subtle)', color: 'var(--text-secondary)' }}>
                  <th style={{ padding: '1rem' }}>Applicant</th>
                  <th style={{ padding: '1rem' }}>Expertise</th>
                  <th style={{ padding: '1rem' }}>AI Screening</th>
                  <th style={{ padding: '1rem' }}>Status</th>
                  <th style={{ padding: '1rem' }}>Submitted</th>
                  <th style={{ padding: '1rem' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {applications.map(app => (
                  <tr key={app.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                    <td style={{ padding: '1rem' }}>
                      <div style={{ fontWeight: '600', color: 'white' }}>{app.mentor.user.name}</div>
                      <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{app.mentor.user.email}</div>
                    </td>
                    <td style={{ padding: '1rem' }}>
                      <div style={{ fontSize: '0.9rem', maxWidth: '200px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {app.expertise || 'N/A'}
                      </div>
                    </td>
                    <td style={{ padding: '1rem' }}>
                      {app.aiScreening ? (
                        <span style={{ color: 'var(--accent-primary)', fontSize: '0.9rem' }}>Completed</span>
                      ) : (
                        <span style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Pending</span>
                      )}
                    </td>
                    <td style={{ padding: '1rem' }}>
                      <span className={`badge ${getStatusBadgeClass(app.status)}`}>
                        {app.status.replace('_', ' ')}
                      </span>
                    </td>
                    <td style={{ padding: '1rem', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                      {new Date(app.createdAt).toLocaleDateString()}
                    </td>
                    <td style={{ padding: '1rem' }}>
                      <Link to={`/admin/mentor-applications/${app.id}`} className="btn btn-secondary" style={{ padding: '0.4rem 0.8rem', fontSize: '0.9rem' }}>
                        Review
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
