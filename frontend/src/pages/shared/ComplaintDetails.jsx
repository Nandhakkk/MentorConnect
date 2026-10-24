import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getComplaint, respondToComplaint, sendComplaintMessage } from '../../services/complaintService';
import { useAuth } from '../../context/AuthContext';
import BackLink from '../../components/BackLink';

export default function ComplaintDetails() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [complaint, setComplaint] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [response, setResponse] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  const [newMessage, setNewMessage] = useState('');
  const [sendingMsg, setSendingMsg] = useState(false);
  const [msgError, setMsgError] = useState('');

  const fetchComplaint = async () => {
    try {
      setLoading(true);
      const data = await getComplaint(id);
      setComplaint(data);
    } catch (err) {
      setError(err.message || 'Failed to fetch complaint details');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchComplaint();
  }, [id]);

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim() || sendingMsg) return;

    try {
      setSendingMsg(true);
      setMsgError('');
      await sendComplaintMessage(id, newMessage);
      setNewMessage('');
      await fetchComplaint();
    } catch (err) {
      setMsgError(err.message || 'Failed to send message');
    } finally {
      setSendingMsg(false);
    }
  };

  const handleSubmitResponse = async (e) => {
    e.preventDefault();
    if (submitting) return;

    try {
      setSubmitting(true);
      setSubmitError('');
      const updated = await respondToComplaint(id, { response });
      setComplaint({ ...complaint, ...updated });
    } catch (err) {
      setSubmitError(err.message || 'Failed to submit response');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <div className="page-content">Loading complaint details...</div>;
  if (error || !complaint) return <div className="page-content" style={{ color: 'var(--error)' }}>{error || 'Complaint not found'}</div>;

  const isReportedUser = complaint.reportedUserId === user.id;
  const isReporter = complaint.reporterId === user.id;

  return (
    <div className="page-content">
      <BackLink />
      <div style={{ marginTop: '1rem', marginBottom: '2rem' }}>
        <h2 className="page-title">Complaint Details</h2>
        <p className="page-subtitle">View information and manage responses regarding this complaint.</p>
      </div>

      <div className="glass-card" style={{ padding: '2rem', marginBottom: '2rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '1rem', marginBottom: '1.5rem' }}>
          <h3 style={{ margin: 0, color: 'var(--text-primary)' }}>{complaint.category.replace(/_/g, ' ')}</h3>
          <span style={{
            padding: '0.25rem 0.75rem', borderRadius: '12px', fontSize: '0.8rem', fontWeight: 'bold',
            background: complaint.status === 'OPEN' ? 'var(--info-subtle)' :
                        complaint.status === 'UNDER_REVIEW' ? 'var(--warning-subtle)' :
                        complaint.status === 'RESOLVED' ? 'var(--success-subtle)' : 'var(--bg-surface-elevated)',
            color: complaint.status === 'OPEN' ? 'var(--info)' :
                   complaint.status === 'UNDER_REVIEW' ? 'var(--warning)' :
                   complaint.status === 'RESOLVED' ? 'var(--success)' : 'var(--text-muted)',
            border: `1px solid ${complaint.status === 'OPEN' ? 'var(--info)' :
                     complaint.status === 'UNDER_REVIEW' ? 'var(--warning)' :
                     complaint.status === 'RESOLVED' ? 'var(--success)' : 'var(--border-subtle)'}`
          }}>
            {complaint.status.replace(/_/g, ' ')}
          </span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '1.5rem' }}>
          <div>
            <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Filed By</label>
            <div style={{ fontWeight: 'bold', color: 'var(--text-primary)' }}>{complaint.reporter?.name || 'Unknown'}</div>
          </div>
          <div>
            <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Reported User</label>
            <div style={{ fontWeight: 'bold', color: 'var(--text-primary)' }}>{complaint.reportedUser?.name || 'Unknown'}</div>
          </div>
          <div>
            <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Date Filed</label>
            <div style={{ color: 'var(--text-primary)' }}>{new Date(complaint.createdAt).toLocaleString()}</div>
          </div>
          {complaint.session && (
            <div>
              <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Related Session</label>
              <div style={{ color: 'var(--text-primary)' }}>{new Date(complaint.session.scheduledAt).toLocaleString()}</div>
            </div>
          )}
        </div>

        <div style={{ marginBottom: '1.5rem' }}>
          <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.5rem' }}>Reporter's Description</label>
          <div style={{ background: 'var(--bg-surface-elevated)', border: '1px solid var(--border-subtle)', padding: '1rem', borderRadius: '4px', fontStyle: 'italic', borderLeft: '3px solid var(--accent-primary)', color: 'var(--text-primary)' }}>
            {complaint.description}
          </div>
        </div>

        {complaint.reportedUserResponse && (
          <div style={{ marginBottom: '1.5rem' }}>
            <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.5rem' }}>Reported User's Response</label>
            <div style={{ background: 'var(--bg-surface-elevated)', border: '1px solid var(--border-subtle)', padding: '1rem', borderRadius: '4px', fontStyle: 'italic', borderLeft: '3px solid var(--success)', color: 'var(--text-primary)' }}>
              {complaint.reportedUserResponse}
            </div>
            {complaint.reportedUserRespondedAt && (
              <small style={{ color: 'var(--text-muted)' }}>Responded at: {new Date(complaint.reportedUserRespondedAt).toLocaleString()}</small>
            )}
          </div>
        )}

        {complaint.resolution && (
          <div style={{ marginBottom: '1.5rem', background: 'var(--success-subtle)', padding: '1.5rem', borderRadius: '4px', border: '1px solid var(--success)' }}>
            <h4 style={{ margin: '0 0 0.5rem 0', color: 'var(--success)' }}>Admin Resolution</h4>
            <div style={{ whiteSpace: 'pre-wrap', color: 'var(--text-primary)' }}>{complaint.resolution}</div>
          </div>
        )}

      </div>

      {isReportedUser && !complaint.reportedUserResponse && ['OPEN', 'UNDER_REVIEW'].includes(complaint.status) && (
        <div className="glass-card" style={{ padding: '2rem', marginBottom: '2rem' }}>
          <h3 style={{ marginTop: 0, marginBottom: '1rem', color: 'var(--text-primary)' }}>Your Initial Response</h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
            A complaint has been filed regarding you. Please explain your side of the situation. This will be reviewed by the administration.
          </p>

          <form onSubmit={handleSubmitResponse}>
            <textarea
              value={response}
              onChange={e => setResponse(e.target.value)}
              required
              rows="5"
              minLength={10}
              placeholder="Explain your side of the situation..."
              className="form-input"
              style={{ resize: 'vertical', marginBottom: '1rem' }}
            />
            {submitError && <div style={{ color: 'var(--error)', marginBottom: '1rem' }}>{submitError}</div>}

            <button type="submit" className="btn btn-primary" disabled={submitting}>
              {submitting ? 'Submitting...' : 'Submit Initial Response'}
            </button>
          </form>
        </div>
      )}

      {/* Discussion Thread */}
      <div className="glass-card" style={{ padding: '2rem' }}>
        <h3 style={{ marginTop: 0, marginBottom: '1.5rem', color: 'var(--text-primary)' }}>Complaint Discussion</h3>

        {(!complaint.messages || complaint.messages.length === 0) ? (
          <p style={{ color: 'var(--text-muted)', fontStyle: 'italic', marginBottom: '1.5rem' }}>No messages yet.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '2rem' }}>
            {complaint.messages.map(msg => {
              const isMine = msg.senderId === user.id;
              const isAdmin = msg.sender?.role === 'ADMIN';
              return (
                <div key={msg.id} style={{
                  alignSelf: isMine ? 'flex-end' : 'flex-start',
                  maxWidth: '80%',
                  background: isAdmin ? 'var(--purple-subtle)' : (isMine ? 'var(--info-subtle)' : 'var(--bg-surface-elevated)'),
                  border: `1px solid ${isAdmin ? 'var(--purple)' : (isMine ? 'var(--info)' : 'var(--border-subtle)')}`,
                  padding: '1rem',
                  borderRadius: '8px',
                  borderBottomRightRadius: isMine ? '0' : '8px',
                  borderBottomLeftRadius: isMine ? '8px' : '0'
                }}>
                  <div style={{ fontSize: '0.8rem', color: isAdmin ? 'var(--purple)' : 'var(--text-muted)', marginBottom: '0.25rem', fontWeight: 'bold' }}>
                    {msg.sender?.name || 'Unknown'} {isAdmin && '(Admin)'}
                  </div>
                  <div style={{ color: 'var(--text-primary)', whiteSpace: 'pre-wrap', lineHeight: 1.4 }}>{msg.content}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.5rem', textAlign: 'right' }}>
                    {new Date(msg.createdAt).toLocaleString()}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {['OPEN', 'UNDER_REVIEW'].includes(complaint.status) ? (
          <form onSubmit={handleSendMessage} style={{ marginTop: '1rem' }}>
            <textarea
              value={newMessage}
              onChange={e => setNewMessage(e.target.value)}
              placeholder="Type your message..."
              rows="3"
              className="form-input"
              style={{ resize: 'vertical', marginBottom: '0.5rem' }}
            />
            {msgError && <div style={{ color: 'var(--error)', marginBottom: '0.5rem' }}>{msgError}</div>}
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button type="submit" className="btn btn-primary" disabled={sendingMsg || !newMessage.trim()}>
                {sendingMsg ? 'Sending...' : 'Send Message'}
              </button>
            </div>
          </form>
        ) : (
          <div style={{ padding: '1rem', background: 'var(--bg-surface-elevated)', border: '1px solid var(--border-subtle)', borderRadius: '4px', textAlign: 'center', color: 'var(--text-muted)', fontStyle: 'italic' }}>
            This complaint is closed. You can no longer send messages.
          </div>
        )}
      </div>
    </div>
  );
}
