import { useState, useEffect } from 'react';
import { fetchAdminMentorships } from '../../services/adminService';

export default function AdminMentorships() {
  const [mentorships, setMentorships] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

  useEffect(() => {
    loadMentorships();
  }, [statusFilter]);

  const loadMentorships = async () => {
    try {
      setLoading(true);
      const data = await fetchAdminMentorships(statusFilter);
      setMentorships(data);
      setError('');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadgeClass = (status) => {
    switch(status) {
      case 'ACTIVE': return 'badge-success';
      case 'COMPLETED': return 'badge-purple';
      case 'CANCELLED': return 'badge-danger';
      default: return 'badge-warning';
    }
  };

  return (
    <div className="page-content">
      <div className="page-header">
        <div>
          <h2 className="page-title">Manage Mentorships 🔗</h2>
          <p className="page-subtitle">View all mentor-student connections across the platform.</p>
        </div>
      </div>

      <div className="glass-card" style={{ marginBottom: '1.5rem', padding: '1.5rem' }}>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <label style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Filter by Status:</label>
          <select 
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            className="form-input"
            style={{ maxWidth: '220px' }}
          >
            <option value="ALL">All Mentorships</option>
            <option value="PENDING">Pending</option>
            <option value="ACTIVE">Active</option>
            <option value="COMPLETED">Completed</option>
            <option value="CANCELLED">Cancelled</option>
          </select>
        </div>
      </div>

      <div className="glass-card" style={{ overflowX: 'auto' }}>
        {error && <div style={{ color: 'var(--error)', background: 'var(--error-bg)', border: '1px solid var(--error-border)', padding: '1rem', borderRadius: 'var(--radius-md)' }}>{error}</div>}
        
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border-subtle)', background: 'var(--bg-surface-elevated)' }}>
              <th style={{ padding: '1rem', color: 'var(--text-secondary)' }}>Student</th>
              <th style={{ padding: '1rem', color: 'var(--text-secondary)' }}>Mentor</th>
              <th style={{ padding: '1rem', color: 'var(--text-secondary)' }}>Status</th>
              <th style={{ padding: '1rem', color: 'var(--text-secondary)' }}>Started Date</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan="4" style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>Loading mentorships...</td></tr>
            ) : mentorships.length === 0 ? (
              <tr><td colSpan="4" style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>No mentorships found.</td></tr>
            ) : (
              mentorships.map(m => (
                <tr key={m.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                  <td style={{ padding: '1rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                    {m.student.user.name}
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 'normal' }}>{m.student.user.email}</div>
                  </td>
                  <td style={{ padding: '1rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                    {m.mentor.user.name}
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 'normal' }}>{m.mentor.user.email}</div>
                  </td>
                  <td style={{ padding: '1rem' }}>
                    <span className={`badge ${getStatusBadgeClass(m.status)}`}>
                      {m.status}
                    </span>
                  </td>
                  <td style={{ padding: '1rem', color: 'var(--text-secondary)' }}>
                    {new Date(m.createdAt).toLocaleDateString()}
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
