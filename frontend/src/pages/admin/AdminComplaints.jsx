import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getAdminComplaints } from '../../services/complaintService';

export default function AdminComplaints() {
  const [complaints, setComplaints] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [filterStatus, setFilterStatus] = useState('ALL');

  useEffect(() => {
    const fetchComplaints = async () => {
      try {
        setLoading(true);
        const data = await getAdminComplaints();
        setComplaints(data);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchComplaints();
  }, []);

  const filteredComplaints = filterStatus === 'ALL'
    ? complaints
    : complaints.filter(c => c.status === filterStatus);

  if (loading) return <div className="page-content">Loading complaints...</div>;

  return (
    <div className="page-content">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <div>
          <h2 className="page-title">Safety & Complaints</h2>
          <p className="page-subtitle">Manage user reports and safety concerns.</p>
        </div>
      </div>

      {error && <div style={{ color: 'var(--error)', background: 'var(--error-bg)', border: '1px solid var(--error-border)', padding: '0.75rem', borderRadius: 'var(--radius-md)', marginBottom: '1rem' }}>{error}</div>}

      <div style={{ marginBottom: '1.5rem', display: 'flex', gap: '1rem', alignItems: 'center' }}>
        <span style={{ color: 'var(--text-secondary)' }}>Filter Status:</span>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="form-input"
          style={{ maxWidth: '200px' }}
        >
          <option value="ALL">All Statuses</option>
          <option value="OPEN">Open</option>
          <option value="UNDER_REVIEW">Under Review</option>
          <option value="RESOLVED">Resolved</option>
          <option value="DISMISSED">Dismissed</option>
        </select>
      </div>

      {filteredComplaints.length === 0 ? (
        <p style={{ color: 'var(--text-muted)' }}>No complaints found.</p>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-subtle)', color: 'var(--text-secondary)', background: 'var(--bg-surface-elevated)' }}>
                <th style={{ padding: '1rem' }}>Date</th>
                <th style={{ padding: '1rem' }}>Reporter</th>
                <th style={{ padding: '1rem' }}>Reported User</th>
                <th style={{ padding: '1rem' }}>Category</th>
                <th style={{ padding: '1rem' }}>Status</th>
                <th style={{ padding: '1rem' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredComplaints.map(c => (
                <tr key={c.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                  <td style={{ padding: '1rem', color: 'var(--text-primary)' }}>{new Date(c.createdAt).toLocaleDateString()}</td>
                  <td style={{ padding: '1rem', color: 'var(--text-primary)', fontWeight: 600 }}>{c.reporter?.name}</td>
                  <td style={{ padding: '1rem', color: 'var(--text-primary)', fontWeight: 600 }}>{c.reportedUser?.name}</td>
                  <td style={{ padding: '1rem', color: 'var(--text-secondary)' }}>{c.category.replace('_', ' ')}</td>
                  <td style={{ padding: '1rem' }}>
                    <span style={{
                      padding: '0.25rem 0.75rem', borderRadius: '12px', fontSize: '0.8rem', fontWeight: 600,
                      background: c.status === 'OPEN' ? 'var(--info-bg)' :
                                  c.status === 'UNDER_REVIEW' ? 'var(--warning-bg)' :
                                  c.status === 'RESOLVED' ? 'var(--success-bg)' : 'var(--bg-surface-elevated)',
                      color: c.status === 'OPEN' ? 'var(--info)' :
                             c.status === 'UNDER_REVIEW' ? 'var(--warning)' :
                             c.status === 'RESOLVED' ? 'var(--success)' : 'var(--text-muted)',
                      border: c.status === 'OPEN' ? '1px solid var(--info-border)' :
                              c.status === 'UNDER_REVIEW' ? '1px solid var(--warning-border)' :
                              c.status === 'RESOLVED' ? '1px solid var(--success-border)' : '1px solid var(--border-subtle)'
                    }}>
                      {c.status.replace('_', ' ')}
                    </span>
                  </td>
                  <td style={{ padding: '1rem' }}>
                    <Link to={`/admin/complaints/${c.id}`} className="btn btn-primary" style={{ padding: '0.4rem 0.8rem', fontSize: '0.85rem' }}>Review</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
