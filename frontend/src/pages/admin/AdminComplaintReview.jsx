import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getAdminComplaint, updateComplaintStatus, suspendUser, sendComplaintMessage } from '../../services/complaintService';
import BackLink from '../../components/BackLink';

export default function AdminComplaintReview() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [complaint, setComplaint] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [resolutionNote, setResolutionNote] = useState('');
  const [issueRefund, setIssueRefund] = useState(false);
  const [refundAmount, setRefundAmount] = useState('');
  const [updating, setUpdating] = useState(false);

  const [newMessage, setNewMessage] = useState('');
  const [sendingMsg, setSendingMsg] = useState(false);
  const [msgError, setMsgError] = useState('');

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

  const handleUpdateStatus = async (status) => {
    if (['RESOLVED', 'DISMISSED'].includes(status) && !resolutionNote.trim()) {
      alert('Resolution note is required to resolve or dismiss.');
      return;
    }

    try {
      setUpdating(true);
      const payload = {
        status,
        resolutionNote: resolutionNote.trim(),
        issueRefund: status === 'RESOLVED' ? issueRefund : false,
        refundAmount: status === 'RESOLVED' && issueRefund && refundAmount ? Number(refundAmount) : undefined
      };
      await updateComplaintStatus(id, payload);
      setResolutionNote('');
      setIssueRefund(false);
      setRefundAmount('');
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
            <h2 style={{ marginTop: 0, marginBottom: '0.5rem', color: 'var(--text-primary)' }}>Complaint Review</h2>
            <div style={{ color: 'var(--text-secondary)' }}>ID: {complaint.id}</div>
          </div>
          <span style={{
            padding: '0.25rem 0.75rem', borderRadius: '12px', fontSize: '0.85rem', fontWeight: 600,
            background: complaint.status === 'OPEN' ? 'var(--info-bg)' :
                        complaint.status === 'UNDER_REVIEW' ? 'var(--warning-bg)' :
                        complaint.status === 'RESOLVED' ? 'var(--success-bg)' : 'var(--bg-surface-elevated)',
            color: complaint.status === 'OPEN' ? 'var(--info)' :
                   complaint.status === 'UNDER_REVIEW' ? 'var(--warning)' :
                   complaint.status === 'RESOLVED' ? 'var(--success)' : 'var(--text-muted)',
            border: complaint.status === 'OPEN' ? '1px solid var(--info-border)' :
                    complaint.status === 'UNDER_REVIEW' ? '1px solid var(--warning-border)' :
                    complaint.status === 'RESOLVED' ? '1px solid var(--success-border)' : '1px solid var(--border-subtle)'
          }}>
            {complaint.status.replace('_', ' ')}
          </span>
        </div>

        {error && <div style={{ color: 'var(--error)', background: 'var(--error-bg)', border: '1px solid var(--error-border)', padding: '0.75rem', borderRadius: 'var(--radius-md)', marginBottom: '1rem' }}>{error}</div>}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '2rem' }}>
          <div style={{ background: 'var(--bg-surface-elevated)', border: '1px solid var(--border-subtle)', padding: '1rem', borderRadius: '8px' }}>
            <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '0.25rem' }}>Reporter</div>
            <div style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{complaint.reporter?.name} <span style={{ fontWeight: 'normal', color: 'var(--text-secondary)' }}>({complaint.reporter?.role})</span></div>
          </div>
          <div style={{ background: 'var(--bg-surface-elevated)', border: '1px solid var(--border-subtle)', padding: '1rem', borderRadius: '8px' }}>
            <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '0.25rem' }}>Reported User</div>
            <div style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{complaint.reportedUser?.name} <span style={{ fontWeight: 'normal', color: 'var(--text-secondary)' }}>({complaint.reportedUser?.role})</span></div>
          </div>
          <div style={{ background: 'var(--bg-surface-elevated)', border: '1px solid var(--border-subtle)', padding: '1rem', borderRadius: '8px' }}>
            <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '0.25rem' }}>Category</div>
            <div style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{complaint.category.replace('_', ' ')}</div>
          </div>
          <div style={{ background: 'var(--bg-surface-elevated)', border: '1px solid var(--border-subtle)', padding: '1rem', borderRadius: '8px' }}>
            <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '0.25rem' }}>Session Date</div>
            <div style={{ color: 'var(--text-primary)' }}>{complaint.session ? new Date(complaint.session.scheduledAt).toLocaleString() : 'N/A'}</div>
          </div>
        </div>

        <div style={{ marginBottom: '2rem' }}>
          <h3 style={{ fontSize: '1.1rem', marginBottom: '0.75rem', color: 'var(--text-primary)' }}>Description</h3>
          <div style={{ background: 'var(--bg-surface-elevated)', border: '1px solid var(--border-subtle)', padding: '1rem', borderRadius: '8px', color: 'var(--text-primary)', whiteSpace: 'pre-wrap', lineHeight: 1.5, borderLeft: '4px solid var(--accent-primary)' }}>
            {complaint.description}
          </div>
        </div>

        {complaint.reportedUserResponse && (
          <div style={{ marginBottom: '2rem' }}>
            <h3 style={{ fontSize: '1.1rem', marginBottom: '0.75rem', color: 'var(--text-primary)' }}>Reported User's Response</h3>
            <div style={{ background: 'var(--bg-surface-elevated)', border: '1px solid var(--border-subtle)', padding: '1rem', borderRadius: '8px', color: 'var(--text-primary)', whiteSpace: 'pre-wrap', lineHeight: 1.5, borderLeft: '4px solid var(--success)' }}>
              {complaint.reportedUserResponse}
            </div>
            {complaint.reportedUserRespondedAt && (
              <div style={{ marginTop: '0.5rem', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                Responded at: {new Date(complaint.reportedUserRespondedAt).toLocaleString()}
              </div>
            )}
          </div>
        )}

        {complaint.resolution && (
          <div style={{ marginBottom: '2rem', padding: '1rem', background: 'var(--success-bg)', border: '1px solid var(--success-border)', borderRadius: '8px' }}>
            <h3 style={{ fontSize: '1.1rem', margin: '0 0 0.5rem 0', color: 'var(--success)' }}>Resolution Note</h3>
            <div style={{ color: 'var(--text-primary)', whiteSpace: 'pre-wrap' }}>{complaint.resolution}</div>
          </div>
        )}

        {/* Discussion Thread */}
        <div style={{ marginBottom: '2rem', borderTop: '1px solid var(--border-subtle)', paddingTop: '1.5rem' }}>
          <h3 style={{ marginTop: 0, marginBottom: '1.5rem', color: 'var(--text-primary)' }}>Complaint Discussion</h3>

          {(!complaint.messages || complaint.messages.length === 0) ? (
            <p style={{ color: 'var(--text-muted)', fontStyle: 'italic', marginBottom: '1.5rem' }}>No messages yet.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '2rem' }}>
              {complaint.messages.map(msg => {
                const isAdmin = msg.sender?.role === 'ADMIN';
                const isMine = isAdmin;
                return (
                  <div key={msg.id} style={{
                    alignSelf: isMine ? 'flex-end' : 'flex-start',
                    maxWidth: '80%',
                    background: isAdmin ? 'var(--info-bg)' : 'var(--bg-surface-elevated)',
                    border: `1px solid ${isAdmin ? 'var(--info-border)' : 'var(--border-subtle)'}`,
                    padding: '1rem',
                    borderRadius: '8px',
                    borderBottomRightRadius: isMine ? '0' : '8px',
                    borderBottomLeftRadius: isMine ? '8px' : '0'
                  }}>
                    <div style={{ fontSize: '0.8rem', color: isAdmin ? 'var(--accent-primary)' : 'var(--text-muted)', marginBottom: '0.25rem', fontWeight: 600 }}>
                      {msg.sender?.name || 'Unknown'} {isAdmin && '(You - Admin)'} {!isAdmin && `(${msg.sender?.role || 'User'})`}
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
                placeholder="Type a message to the reporter and reported user..."
                rows="3"
                className="form-input"
                style={{ marginBottom: '0.5rem' }}
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

        {/* Actions */}
        {['OPEN', 'UNDER_REVIEW'].includes(complaint.status) && (
          <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '1.5rem' }}>
            <h3 style={{ fontSize: '1.1rem', marginBottom: '1rem', color: 'var(--text-primary)' }}>Admin Actions</h3>

            {complaint.status === 'OPEN' && (
              <button
                onClick={() => handleUpdateStatus('UNDER_REVIEW')}
                disabled={updating}
                className="btn btn-primary"
                style={{ background: 'var(--warning)', borderColor: 'var(--warning)', color: '#000000', marginBottom: '1.5rem' }}
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
                  className="form-input"
                  placeholder="Enter resolution note (required for resolve/dismiss)..."
                />
                {complaint.sessionId && (
                  <div style={{ padding: '0.75rem', background: 'var(--bg-surface-elevated)', border: '1px solid var(--border-subtle)', borderRadius: '6px' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', marginBottom: issueRefund ? '0.5rem' : 0 }}>
                      <input
                        type="checkbox"
                        checked={issueRefund}
                        onChange={e => setIssueRefund(e.target.checked)}
                      />
                      <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)' }}>Issue Razorpay Refund for Session</span>
                    </label>
                    {issueRefund && (
                      <div style={{ marginTop: '0.5rem' }}>
                        <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>
                          Refund Amount (₹ - Leave blank for full session amount):
                        </label>
                        <input
                          type="number"
                          step="1"
                          placeholder="e.g. 500"
                          className="form-input"
                          value={refundAmount}
                          onChange={e => setRefundAmount(e.target.value)}
                        />
                      </div>
                    )}
                  </div>
                )}
                <div style={{ display: 'flex', gap: '1rem' }}>
                  <button
                    onClick={() => handleUpdateStatus('RESOLVED')}
                    disabled={updating}
                    className="btn btn-primary"
                    style={{ background: 'var(--success)', borderColor: 'var(--success)', color: '#FFFFFF' }}
                  >
                    Resolve Complaint
                  </button>
                  <button
                    onClick={() => handleUpdateStatus('DISMISSED')}
                    disabled={updating}
                    className="btn btn-secondary"
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
            <h4 style={{ margin: '0 0 0.25rem 0', color: 'var(--text-primary)' }}>Moderation</h4>
            <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.85rem' }}>If the reported user has severely violated rules, you can toggle their suspension.</p>
          </div>
          <button
            onClick={handleSuspend}
            disabled={updating}
            className="btn btn-secondary"
            style={{ color: 'var(--error)', borderColor: 'var(--error-border)' }}
          >
            Toggle Suspend User
          </button>
        </div>

      </div>
    </div>
  );
}
