import { useState, useEffect } from 'react';
import { getMyComplaints, getComplaintsAgainstMe, createComplaint } from '../../services/complaintService';
import { fetchSessions } from '../../services/sessionService';
import { useAuth } from '../../context/AuthContext';
import { Link } from 'react-router-dom';
import BackLink from '../../components/BackLink';

export default function MyComplaints() {
  const [complaints, setComplaints] = useState([]);
  const [complaintsAgainstMe, setComplaintsAgainstMe] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Form State
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState({ category: 'INAPPROPRIATE_BEHAVIOR', sessionId: '', description: '' });
  const { user } = useAuth();

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        const [complaintsData, againstMeData, sessionsData] = await Promise.all([
          getMyComplaints(),
          getComplaintsAgainstMe(),
          fetchSessions()
        ]);
        setComplaints(complaintsData);
        setComplaintsAgainstMe(againstMeData);
        setSessions(sessionsData);
      } catch (err) {
        setError(err.message || 'Failed to load data');
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (submitting) return;

    try {
      setSubmitting(true);
      setError('');
      setSuccessMsg('');

      await createComplaint(formData);

      setSuccessMsg('Complaint registered successfully.');
      setShowForm(false);
      setFormData({ category: 'INAPPROPRIATE_BEHAVIOR', sessionId: '', description: '' });

      // Reload complaints
      const updatedComplaints = await getMyComplaints();
      setComplaints(updatedComplaints);
    } catch (err) {
      setError(err.message || 'Failed to submit complaint');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <div className="page-content">Loading complaints...</div>;

  return (
    <div className="page-content">
      <BackLink />
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1rem' }}>
        <div>
          <h2 className="page-title">My Complaints</h2>
          <p className="page-subtitle" style={{ marginBottom: '1rem' }}>Manage your support tickets and complaints.</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowForm(true)}>
          Register a Complaint
        </button>
      </div>

      {error && <div style={{ color: 'var(--error)', marginBottom: '1rem', padding: '1rem', background: 'var(--error-subtle)', border: '1px solid var(--error)', borderRadius: '4px' }}>{error}</div>}
      {successMsg && <div style={{ color: 'var(--success)', marginBottom: '1rem', padding: '1rem', background: 'var(--success-subtle)', border: '1px solid var(--success)', borderRadius: '4px' }}>{successMsg}</div>}

      {showForm && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div className="glass-card" style={{ padding: '2rem', width: '100%', maxWidth: '600px', maxHeight: '90vh', overflowY: 'auto' }}>
            <h3 style={{ marginTop: 0, marginBottom: '1.5rem', color: 'var(--text-primary)' }}>Register a Complaint</h3>

            <form onSubmit={handleSubmit}>
              <div className="form-group" style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Category</label>
                <select
                  value={formData.category}
                  onChange={e => setFormData({...formData, category: e.target.value})}
                  required
                  className="form-input"
                >
                  <option value="INAPPROPRIATE_BEHAVIOR">Inappropriate Behavior</option>
                  <option value="NO_SHOW">No Show</option>
                  <option value="PAYMENT_ISSUE">Payment Issue</option>
                  <option value="OTHER">Other</option>
                </select>
              </div>

              <div className="form-group" style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Related Session</label>
                <select
                  value={formData.sessionId}
                  onChange={e => setFormData({...formData, sessionId: e.target.value})}
                  required
                  className="form-input"
                >
                  <option value="">-- Select a Session --</option>
                  {sessions.map(s => {
                    const otherUser = user?.role === 'STUDENT' ? s.mentorship?.mentor?.user?.name : s.mentorship?.student?.user?.name;
                    return (
                      <option key={s.id} value={s.id}>
                        {new Date(s.scheduledAt).toLocaleString()} with {otherUser || 'Unknown User'} ({s.status})
                      </option>
                    );
                  })}
                </select>
                {sessions.length === 0 && <small style={{ color: 'var(--text-muted)' }}>You don't have any sessions to report.</small>}
              </div>

              <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Description</label>
                <textarea
                  value={formData.description}
                  onChange={e => setFormData({...formData, description: e.target.value})}
                  required
                  rows="4"
                  minLength={10}
                  maxLength={2000}
                  placeholder="Please describe the issue in detail (at least 10 characters)..."
                  className="form-input"
                  style={{ resize: 'vertical' }}
                />
              </div>

              <div style={{ display: 'flex', gap: '1rem' }}>
                <button type="submit" className="btn btn-primary" style={{ flex: 1 }} disabled={submitting}>
                  {submitting ? 'Submitting...' : 'Submit Complaint'}
                </button>
                <button type="button" onClick={() => setShowForm(false)} disabled={submitting} className="btn btn-secondary">
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <h3 style={{ borderBottom: '1px solid var(--border-subtle)', paddingBottom: '0.5rem', marginBottom: '1.5rem' }}>Complaints Filed By Me</h3>

      {complaints.length === 0 ? (
        <p style={{ color: 'var(--text-muted)', marginBottom: '2rem' }}>You have not submitted any complaints.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '2rem' }}>
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
                <div style={{ fontSize: '0.9rem', color: 'var(--text-primary)', fontStyle: 'italic', background: 'var(--bg-surface-elevated)', border: '1px solid var(--border-subtle)', padding: '0.5rem', borderRadius: '4px', marginTop: '0.5rem' }}>
                  "{c.description.substring(0, 100)}{c.description.length > 100 ? '...' : ''}"
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.5rem' }}>
                <span style={{
                  padding: '0.25rem 0.75rem', borderRadius: '12px', fontSize: '0.8rem', fontWeight: 'bold',
                  background: c.status === 'OPEN' ? 'var(--info-subtle)' :
                              c.status === 'UNDER_REVIEW' ? 'var(--warning-subtle)' :
                              c.status === 'RESOLVED' ? 'var(--success-subtle)' : 'var(--bg-surface-elevated)',
                  color: c.status === 'OPEN' ? 'var(--info)' :
                         c.status === 'UNDER_REVIEW' ? 'var(--warning)' :
                         c.status === 'RESOLVED' ? 'var(--success)' : 'var(--text-muted)',
                  border: `1px solid ${c.status === 'OPEN' ? 'var(--info)' :
                           c.status === 'UNDER_REVIEW' ? 'var(--warning)' :
                           c.status === 'RESOLVED' ? 'var(--success)' : 'var(--border-subtle)'}`
                }}>
                  {c.status.replace(/_/g, ' ')}
                </span>
                <Link to={`/${user.role.toLowerCase()}/complaints/${c.id}`} className="btn btn-secondary" style={{ padding: '0.25rem 0.5rem', fontSize: '0.8rem' }}>
                  View Complaint
                </Link>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  {new Date(c.createdAt).toLocaleDateString()}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      <h3 style={{ borderBottom: '1px solid var(--border-subtle)', paddingBottom: '0.5rem', marginBottom: '1.5rem' }}>Complaints Against Me</h3>

      {complaintsAgainstMe.length === 0 ? (
        <p style={{ color: 'var(--text-muted)' }}>No complaints have been filed against you.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {complaintsAgainstMe.map(c => (
            <div key={c.id} className="glass-card" style={{ padding: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderLeft: '4px solid var(--error)' }}>
              <div>
                <h4 style={{ margin: '0 0 0.5rem 0', color: 'var(--text-primary)' }}>{c.category.replace(/_/g, ' ')}</h4>
                <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '0.25rem' }}>
                  Reported by: <strong>{c.reporter?.name || 'Hidden'}</strong>
                </div>
                {c.session && (
                  <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '0.5rem' }}>
                    Session: {new Date(c.session.scheduledAt).toLocaleString()}
                  </div>
                )}
                <div style={{ fontSize: '0.9rem', color: 'var(--text-primary)', fontStyle: 'italic', background: 'var(--bg-surface-elevated)', border: '1px solid var(--border-subtle)', padding: '0.5rem', borderRadius: '4px', marginTop: '0.5rem' }}>
                  "{c.description.substring(0, 100)}{c.description.length > 100 ? '...' : ''}"
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.5rem' }}>
                <span style={{
                  padding: '0.25rem 0.75rem', borderRadius: '12px', fontSize: '0.8rem', fontWeight: 'bold',
                  background: c.status === 'OPEN' ? 'var(--info-subtle)' :
                              c.status === 'UNDER_REVIEW' ? 'var(--warning-subtle)' :
                              c.status === 'RESOLVED' ? 'var(--success-subtle)' : 'var(--bg-surface-elevated)',
                  color: c.status === 'OPEN' ? 'var(--info)' :
                         c.status === 'UNDER_REVIEW' ? 'var(--warning)' :
                         c.status === 'RESOLVED' ? 'var(--success)' : 'var(--text-muted)',
                  border: `1px solid ${c.status === 'OPEN' ? 'var(--info)' :
                           c.status === 'UNDER_REVIEW' ? 'var(--warning)' :
                           c.status === 'RESOLVED' ? 'var(--success)' : 'var(--border-subtle)'}`
                }}>
                  {c.status.replace(/_/g, ' ')}
                </span>
                <Link to={`/${user.role.toLowerCase()}/complaints/${c.id}`} className="btn btn-primary" style={{ padding: '0.25rem 0.5rem', fontSize: '0.8rem' }}>
                  View & Respond
                </Link>
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
