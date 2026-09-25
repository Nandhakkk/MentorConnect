import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getAssignment, reviewAssignment, getSecureFileUrl } from '../../services/assignmentService';
import BackLink from '../../components/BackLink';

export default function ReviewAssignment() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [assignment, setAssignment] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  const [feedback, setFeedback] = useState('');
  const [actionError, setActionError] = useState('');

  useEffect(() => {
    const loadData = async () => {
      try {
        const data = await getAssignment(id);
        setAssignment(data);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [id]);

  const handleReview = async (action) => {
    try {
      setActionError('');
      if (!feedback) {
        setActionError('Feedback is required.');
        return;
      }
      await reviewAssignment(id, { feedback, action });
      navigate('/mentor/assignments');
    } catch (err) {
      setActionError(err.message);
    }
  };

  const downloadFile = async (assetId) => {
    try {
      const data = await getSecureFileUrl(assetId);
      window.open(data.url, '_blank');
    } catch (err) {
      alert(err.message);
    }
  };

  if (loading) return <div className="page-content">Loading...</div>;
  if (error || !assignment) return <div className="page-content" style={{ color: '#ef4444' }}>{error || 'Not found'}</div>;

  const latestSubmission = assignment.submissions?.[0];

  return (
    <div className="page-content">
      <BackLink to="/mentor/assignments" label="Back to Assignments" />
      
      <div className="glass-card" style={{ padding: '2rem', marginBottom: '2rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
          <h2 style={{ margin: 0, color: 'white' }}>{assignment.title}</h2>
          <span style={{
            padding: '0.25rem 0.75rem', borderRadius: '12px', fontSize: '0.8rem', fontWeight: 'bold',
            background: 'rgba(255,255,255,0.1)', color: 'white'
          }}>
            Status: {assignment.status}
          </span>
        </div>
        
        <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>
          Student: <strong>{assignment.student?.user?.name}</strong> | 
          Due: <strong>{assignment.dueDate ? new Date(assignment.dueDate).toLocaleString() : 'No due date'}</strong>
        </p>

        <div style={{ background: 'rgba(0,0,0,0.2)', padding: '1.5rem', borderRadius: '8px', marginBottom: '1.5rem' }}>
          <h4 style={{ margin: '0 0 1rem 0', color: 'var(--text-muted)' }}>Original Instructions</h4>
          <p style={{ margin: 0, whiteSpace: 'pre-wrap', color: 'var(--text-secondary)' }}>{assignment.description}</p>
          
          {assignment.referenceFiles && assignment.referenceFiles.length > 0 && (
            <div style={{ marginTop: '1rem' }}>
              <h5 style={{ margin: '0 0 0.5rem 0', color: 'var(--text-secondary)' }}>Reference Files:</h5>
              <ul style={{ margin: 0, paddingLeft: '1.5rem', color: 'white' }}>
                {assignment.referenceFiles.map(f => (
                  <li key={f.id} style={{ marginBottom: '0.25rem' }}>
                    <button onClick={() => downloadFile(f.id)} style={{ background: 'none', border: 'none', color: '#6366f1', cursor: 'pointer', padding: 0, textDecoration: 'underline' }}>
                      {f.originalName}
                    </button>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginLeft: '0.5rem' }}>
                      ({(f.size / 1024 / 1024).toFixed(2)} MB)
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
        
        {latestSubmission ? (
          <div style={{ borderLeft: '4px solid #10b981', paddingLeft: '1.5rem', marginBottom: '1.5rem' }}>
            <h4 style={{ margin: '0 0 1rem 0', color: 'white' }}>Student's Submission</h4>
            <p style={{ margin: 0, whiteSpace: 'pre-wrap', color: 'var(--text-primary)', marginBottom: '1rem' }}>{latestSubmission.content}</p>
            {latestSubmission.fileReference && (
              <div style={{ marginBottom: '1rem' }}>
                <a href={latestSubmission.fileReference} target="_blank" rel="noopener noreferrer" style={{ color: '#6366f1' }}>
                  Submission Link
                </a>
              </div>
            )}
            
            {latestSubmission.submissionFiles && latestSubmission.submissionFiles.length > 0 && (
              <div style={{ marginBottom: '1rem' }}>
                <h5 style={{ margin: '0 0 0.5rem 0', color: 'var(--text-secondary)' }}>Attached Files:</h5>
                <ul style={{ margin: 0, paddingLeft: '1.5rem', color: 'white' }}>
                  {latestSubmission.submissionFiles.map(f => (
                    <li key={f.id} style={{ marginBottom: '0.25rem' }}>
                      <button onClick={() => downloadFile(f.id)} style={{ background: 'none', border: 'none', color: '#6366f1', cursor: 'pointer', padding: 0, textDecoration: 'underline' }}>
                        {f.originalName}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              Submitted at: {new Date(latestSubmission.submittedAt).toLocaleString()} 
              {latestSubmission.status === 'LATE' && <span style={{ color: '#ef4444', marginLeft: '0.5rem' }}>(LATE)</span>}
            </div>
          </div>
        ) : (
          <div style={{ padding: '1rem', background: 'rgba(255,255,255,0.05)', borderRadius: '8px', color: 'var(--text-muted)', textAlign: 'center' }}>
            The student has not submitted any work yet.
          </div>
        )}

        {assignment.status === 'SUBMITTED' && latestSubmission && (
          <div style={{ marginTop: '2rem', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '2rem' }}>
            <h3 style={{ margin: '0 0 1rem 0' }}>Provide Feedback</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-secondary)' }}>Your Feedback (Required)</label>
                <textarea 
                  value={feedback}
                  onChange={e => setFeedback(e.target.value)}
                  rows="4"
                  style={{ width: '100%', padding: '0.75rem', borderRadius: '4px', border: '1px solid var(--border-subtle)', background: 'rgba(0,0,0,0.2)', color: 'white', resize: 'vertical' }}
                  placeholder="Provide constructive feedback..."
                ></textarea>
              </div>
              
              {actionError && <div style={{ color: '#ef4444' }}>{actionError}</div>}
              
              <div style={{ display: 'flex', gap: '1rem' }}>
                <button onClick={() => handleReview('REVIEW')} className="btn btn-primary" style={{ background: '#10b981', color: 'white', border: 'none' }}>
                  Accept & Mark Reviewed
                </button>
                <button onClick={() => handleReview('RETURN')} className="btn" style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.3)' }}>
                  Return for Revision
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
