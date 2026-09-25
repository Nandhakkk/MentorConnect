import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getAdminComplaint, updateComplaintStatus, suspendUser } from '../../services/complaintService';
import BackLink from '../../components/BackLink';

export default function AdminComplaintReview() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [complaint, setComplaint] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  const [resolutionNote, setResolutionNote] = useState('');
  const [updating, setUpdating] = useState(false);

  const fetchComplaint = async () => {
    try {
      setLoading(true);
      const data = await getAdminComplaint(id);
      setComplaint(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchComplaint();
  }, [id]);

  const handleUpdateStatus = async (status) => {
    if (['RESOLVED', 'DISMISSED'].includes(status) && !resolutionNote.trim()) {
      alert('Resolution note is required to resolve or dismiss.');
      return;
    }
    
    try {
      setUpdating(true);
      await updateComplaintStatus(id, { status, resolutionNote: resolutionNote.trim() });
      setResolutionNote('');
      await fetchComplaint();
    } catch (err) {
      alert(err.message);
    } finally {
      setUpdating(false);
    }
  };

  const handleSuspend = async () => {
    if (!window.confirm(`Are you sure you want to toggle suspension for ${complaint.reportedUser.name}?`)) return;
    try {
      setUpdating(true);
      await suspendUser(complaint.reportedUserId);
      alert('User suspension status toggled.');
      await fetchComplaint(); // Refetch to show any new status if we were returning it, but we can just alert for now.
    } catch (err) {
      alert(err.message);
    } finally {
      setUpdating(false);
    }
  };

  if (loading) return <div className="page-content">Loading complaint details...</div>;
  if (!complaint) return <div className="page-content">Complaint not found.</div>;

  return (
    <div className="page-content">
      <BackLink to="/admin/complaints" label="Back to Complaints" />
      <div className="glass-card" style={{ padding: '2rem', maxWidth: '800px', margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '2rem' }}>
          <div>
            <h2 style={{ marginTop: 0, marginBottom: '0.5rem', color: 'white' }}>Complaint Review</h2>
            <div style={{ color: 'var(--text-secondary)' }}>ID: {complaint.id}</div>
          </div>
          <span style={{ 
            padding: '0.25rem 0.75rem', borderRadius: '12px', fontSize: '0.9rem', fontWeight: 'bold',
            background: complaint.status === 'OPEN' ? 'rgba(59, 130, 246, 0.1)' : 
                        complaint.status === 'UNDER_REVIEW' ? 'rgba(245, 158, 11, 0.1)' : 
                        complaint.status === 'RESOLVED' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(107, 114, 128, 0.1)',
            color: complaint.status === 'OPEN' ? '#3b82f6' : 
                   complaint.status === 'UNDER_REVIEW' ? '#f59e0b' : 
                   complaint.status === 'RESOLVED' ? '#10b981' : '#9ca3af'
          }}>
            {complaint.status.replace('_', ' ')}
          </span>
        </div>

        {error && <div style={{ color: '#ef4444', marginBottom: '1rem' }}>{error}</div>}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '2rem' }}>
          <div style={{ background: 'rgba(255,255,255,0.05)', padding: '1rem', borderRadius: '8px' }}>
            <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '0.25rem' }}>Reporter</div>
            <div style={{ color: 'white', fontWeight: 'bold' }}>{complaint.reporter?.name} <span style={{ fontWeight: 'normal', color: 'var(--text-secondary)' }}>({complaint.reporter?.role})</span></div>
          </div>
          <div style={{ background: 'rgba(255,255,255,0.05)', padding: '1rem', borderRadius: '8px' }}>
            <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '0.25rem' }}>Reported User</div>
            <div style={{ color: 'white', fontWeight: 'bold' }}>{complaint.reportedUser?.name} <span style={{ fontWeight: 'normal', color: 'var(--text-secondary)' }}>({complaint.reportedUser?.role})</span></div>
          </div>
          <div style={{ background: 'rgba(255,255,255,0.05)', padding: '1rem', borderRadius: '8px' }}>
            <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '0.25rem' }}>Category</div>
            <div style={{ color: 'white' }}>{complaint.category.replace('_', ' ')}</div>
          </div>
          <div style={{ background: 'rgba(255,255,255,0.05)', padding: '1rem', borderRadius: '8px' }}>
            <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '0.25rem' }}>Session Date</div>
            <div style={{ color: 'white' }}>{complaint.session ? new Date(complaint.session.scheduledAt).toLocaleString() : 'N/A'}</div>
          </div>
        </div>

        <div style={{ marginBottom: '2rem' }}>
          <h3 style={{ fontSize: '1.1rem', marginBottom: '0.75rem', color: 'var(--text-primary)' }}>Description</h3>
          <div style={{ background: 'rgba(0,0,0,0.2)', padding: '1rem', borderRadius: '8px', color: 'var(--text-secondary)', whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>
            {complaint.description}
          </div>
        </div>

        {complaint.resolution && (
          <div style={{ marginBottom: '2rem', padding: '1rem', background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.3)', borderRadius: '8px' }}>
            <h3 style={{ fontSize: '1.1rem', margin: '0 0 0.5rem 0', color: '#10b981' }}>Resolution Note</h3>
            <div style={{ color: 'white', whiteSpace: 'pre-wrap' }}>{complaint.resolution}</div>
          </div>
        )}

        {/* Actions */}
        {['OPEN', 'UNDER_REVIEW'].includes(complaint.status) && (
          <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '1.5rem' }}>
            <h3 style={{ fontSize: '1.1rem', marginBottom: '1rem', color: 'var(--text-primary)' }}>Admin Actions</h3>
            
            {complaint.status === 'OPEN' && (
              <button 
                onClick={() => handleUpdateStatus('UNDER_REVIEW')} 
                disabled={updating}
                className="btn" 
                style={{ background: '#f59e0b', color: 'white', marginBottom: '1.5rem' }}
              >
                Mark Under Review
              </button>
            )}

            {complaint.status === 'UNDER_REVIEW' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <textarea 
                  value={resolutionNote}
                  onChange={e => setResolutionNote(e.target.value)}
                  rows="3"
                  placeholder="Enter resolution note (required for resolve/dismiss)..."
                  style={{ width: '100%', padding: '0.75rem', borderRadius: '4px', border: '1px solid var(--border-subtle)', background: 'rgba(0,0,0,0.2)', color: 'white', resize: 'vertical' }}
                ></textarea>
                <div style={{ display: 'flex', gap: '1rem' }}>
                  <button 
                    onClick={() => handleUpdateStatus('RESOLVED')} 
                    disabled={updating}
                    className="btn" 
                    style={{ background: '#10b981', color: 'white' }}
                  >
                    Resolve Complaint
                  </button>
                  <button 
                    onClick={() => handleUpdateStatus('DISMISSED')} 
                    disabled={updating}
                    className="btn" 
                    style={{ background: '#6b7280', color: 'white' }}
                  >
                    Dismiss Complaint
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        <div style={{ borderTop: '1px solid var(--border-subtle)', marginTop: '2rem', paddingTop: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h4 style={{ margin: '0 0 0.25rem 0' }}>Moderation</h4>
            <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.85rem' }}>If the reported user has severely violated rules, you can toggle their suspension.</p>
          </div>
          <button 
            onClick={handleSuspend}
            disabled={updating}
            className="btn" 
            style={{ background: 'transparent', color: '#ef4444', border: '1px solid #ef4444' }}
          >
            Toggle Suspend User
          </button>
        </div>

      </div>
    </div>
  );
}
