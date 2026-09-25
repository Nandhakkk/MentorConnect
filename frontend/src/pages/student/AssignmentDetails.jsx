import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getAssignment, submitAssignment } from '../../services/assignmentService';
import BackLink from '../../components/BackLink';

export default function AssignmentDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [assignment, setAssignment] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [submitError, setSubmitError] = useState('');
  
  const [content, setContent] = useState('');
  const [resourceUrl, setResourceUrl] = useState('');

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

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      setSubmitError('');
      await submitAssignment(id, { content, resourceUrl });
      // Reload
      const updated = await getAssignment(id);
      setAssignment(updated);
      setContent('');
      setResourceUrl('');
    } catch (err) {
      setSubmitError(err.message);
    }
  };

  if (loading) return <div className="page-content">Loading...</div>;
  if (error || !assignment) return <div className="page-content" style={{ color: '#ef4444' }}>{error || 'Not found'}</div>;

  const latestSubmission = assignment.submissions?.[0];
  const canSubmit = assignment.status === 'ASSIGNED' || assignment.status === 'RETURNED';

  return (
    <div className="page-content">
      <BackLink to="/student/assignments" label="Back to Assignments" />
      
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
          Mentor: <strong>{assignment.mentor?.user?.name}</strong> | 
          Due: <strong>{assignment.dueDate ? new Date(assignment.dueDate).toLocaleString() : 'No due date'}</strong>
        </p>

        <div style={{ background: 'rgba(0,0,0,0.2)', padding: '1.5rem', borderRadius: '8px', marginBottom: '1.5rem' }}>
          <h4 style={{ margin: '0 0 1rem 0', color: 'var(--accent-primary)' }}>Instructions</h4>
          <p style={{ margin: 0, whiteSpace: 'pre-wrap', color: 'var(--text-primary)' }}>{assignment.description}</p>
          {assignment.instructions && (
            <div style={{ marginTop: '1rem' }}>
              <a href={assignment.instructions} target="_blank" rel="noopener noreferrer" style={{ color: '#6366f1' }}>
                Resource Link
              </a>
            </div>
          )}
        </div>
        
        {latestSubmission && assignment.status !== 'ASSIGNED' && (
          <div style={{ borderLeft: '4px solid #6366f1', paddingLeft: '1.5rem', marginBottom: '1.5rem' }}>
            <h4 style={{ margin: '0 0 1rem 0', color: 'white' }}>Your Submission</h4>
            <p style={{ margin: 0, whiteSpace: 'pre-wrap', color: 'var(--text-secondary)', marginBottom: '1rem' }}>{latestSubmission.content}</p>
            {latestSubmission.fileReference && (
              <div style={{ marginBottom: '1rem' }}>
                <a href={latestSubmission.fileReference} target="_blank" rel="noopener noreferrer" style={{ color: '#6366f1' }}>
                  Submission Link
                </a>
              </div>
            )}
            <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              Submitted at: {new Date(latestSubmission.submittedAt).toLocaleString()} ({latestSubmission.status})
            </div>
            
            {latestSubmission.feedback && (
              <div style={{ background: 'rgba(239, 68, 68, 0.1)', padding: '1rem', borderRadius: '8px', marginTop: '1rem' }}>
                <h5 style={{ margin: '0 0 0.5rem 0', color: '#ef4444' }}>Mentor Feedback</h5>
                <p style={{ margin: 0, color: 'white', whiteSpace: 'pre-wrap' }}>{latestSubmission.feedback}</p>
              </div>
            )}
          </div>
        )}

        {canSubmit && (
          <div style={{ marginTop: '2rem', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '2rem' }}>
            <h3 style={{ margin: '0 0 1rem 0' }}>{assignment.status === 'RETURNED' ? 'Resubmit Work' : 'Submit Work'}</h3>
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-secondary)' }}>Your Answer</label>
                <textarea 
                  value={content}
                  onChange={e => setContent(e.target.value)}
                  required
                  rows="6"
                  style={{ width: '100%', padding: '0.75rem', borderRadius: '4px', border: '1px solid var(--border-subtle)', background: 'rgba(0,0,0,0.2)', color: 'white', resize: 'vertical' }}
                  placeholder="Type your submission here..."
                ></textarea>
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-secondary)' }}>Resource URL (Optional)</label>
                <input 
                  type="url"
                  value={resourceUrl}
                  onChange={e => setResourceUrl(e.target.value)}
                  style={{ width: '100%', padding: '0.75rem', borderRadius: '4px', border: '1px solid var(--border-subtle)', background: 'rgba(0,0,0,0.2)', color: 'white' }}
                  placeholder="https://github.com/..."
                />
              </div>
              {submitError && <div style={{ color: '#ef4444' }}>{submitError}</div>}
              <button type="submit" className="btn btn-primary" style={{ alignSelf: 'flex-start' }}>
                Submit Assignment
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
