import { useState, useEffect } from 'react';
import { fetchVerificationRequests, updateVerificationRequestStatus } from '../../services/adminService';

export default function AdminVerificationRequests() {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('PENDING');

  useEffect(() => {
    loadRequests();
  }, [filter]);

  const loadRequests = async () => {
    try {
      setLoading(true);
      setError('');
      const data = await fetchVerificationRequests(filter);
      setRequests(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleStatusUpdate = async (id, newStatus) => {
    if (!window.confirm(`Are you sure you want to change status to ${newStatus}?`)) return;
    try {
      setError('');
      await updateVerificationRequestStatus(id, { status: newStatus });
      loadRequests();
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="page-content">
      <div className="page-header">
        <div>
          <h2 className="page-title">Verification Requests</h2>
          <p className="page-subtitle">Review post-approval profile updates from Professional Mentors.</p>
        </div>
      </div>

      <div className="glass-card" style={{ marginBottom: '2rem' }}>
        <div style={{ display: 'flex', gap: '1rem', padding: '1rem 0' }}>
          {['ALL', 'PENDING', 'AI_SCREENED', 'UNDER_REVIEW', 'APPROVED', 'REJECTED'].map(status => (
            <button
              key={status}
              className={`btn ${filter === status ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setFilter(status)}
              style={{ fontSize: '0.85rem', padding: '0.5rem 1rem' }}
            >
              {status.replace(/_/g, ' ')}
            </button>
          ))}
        </div>

        {error && <div style={{ color: 'var(--error)', marginBottom: '1rem' }}>{error}</div>}

        {loading ? (
          <p>Loading requests...</p>
        ) : requests.length === 0 ? (
          <div className="empty-list-state">
            <p>No verification requests found for this status.</p>
          </div>
        ) : (
          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Mentor</th>
                  <th>Request Type</th>
                  <th>Details</th>
                  <th>Date</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {requests.map(req => (
                  <tr key={req.id}>
                    <td>
                      <div style={{ fontWeight: '500' }}>{req.mentor?.user?.name}</div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{req.mentor?.user?.email}</div>
                    </td>
                    <td><span className="status-badge" style={{ background: 'var(--bg-surface-elevated)', color: 'var(--text-secondary)', border: '1px solid var(--border-subtle)' }}>{req.type.replace(/_/g, ' ')}</span></td>
                    <td>
                      <div style={{ fontWeight: '500' }}>{req.title}</div>
                      <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: '0.5rem' }}>
                        {req.description}
                      </div>

                      {/* Evidence Files */}
                      {req.evidenceFiles && (() => {
                        try {
                          const files = JSON.parse(req.evidenceFiles);
                          return files.map((url, i) => (
                            <div key={`file-${i}`}>
                              <a href={url} target="_blank" rel="noreferrer" style={{ fontSize: '0.8rem', color: 'var(--accent-primary)', display: 'inline-flex', alignItems: 'center', gap: '0.25rem', marginBottom: '0.25rem' }}>
                                📄 View Uploaded Document
                              </a>
                            </div>
                          ));
                        } catch(e) { return null; }
                      })()}

                      {/* Evidence Links */}
                      {req.evidenceLinks && (() => {
                        try {
                          // Try parsing as JSON array
                          const links = JSON.parse(req.evidenceLinks);
                          if (Array.isArray(links)) {
                            return links.map((link, i) => (
                              <div key={`link-${i}`}>
                                <a href={link} target="_blank" rel="noreferrer" style={{ fontSize: '0.8rem', color: 'var(--accent-primary)', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                                  🔗 Supporting Link
                                </a>
                              </div>
                            ));
                          }
                          // Fallback for legacy string (if any)
                          return (
                            <div>
                              <a href={req.evidenceLinks} target="_blank" rel="noreferrer" style={{ fontSize: '0.8rem', color: 'var(--accent-primary)', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                                🔗 Supporting Link
                              </a>
                            </div>
                          );
                        } catch(e) { return null; }
                      })()}
                    </td>
                    <td style={{ whiteSpace: 'nowrap' }}>
                      {new Date(req.submittedAt).toLocaleDateString()}
                    </td>
                    <td>
                      <span className={`status-badge ${req.status.toLowerCase()}`}>
                        {req.status.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        {req.status !== 'APPROVED' && (
                          <button
                            className="btn btn-primary"
                            style={{ padding: '0.3rem 0.6rem', fontSize: '0.75rem' }}
                            onClick={() => handleStatusUpdate(req.id, 'APPROVED')}
                          >
                            Approve
                          </button>
                        )}
                        {req.status !== 'REJECTED' && (
                          <button
                            className="btn"
                            style={{ padding: '0.3rem 0.6rem', fontSize: '0.75rem', background: 'var(--error-bg)', color: 'var(--error)', border: '1px solid var(--border-subtle)' }}
                            onClick={() => handleStatusUpdate(req.id, 'REJECTED')}
                          >
                            Reject
                          </button>
                        )}
                      </div>
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
