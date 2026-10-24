import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { createAssignment } from '../../services/assignmentService';
import { fetchSessions } from '../../services/sessionService';
import BackLink from '../../components/BackLink';

export default function CreateAssignment() {
  const navigate = useNavigate();
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  const [formData, setFormData] = useState({
    sessionId: '',
    title: '',
    description: '',
    dueDate: '',
    resourceUrl: ''
  });
  const [referenceFiles, setReferenceFiles] = useState([]);

  useEffect(() => {
    const loadSessions = async () => {
      try {
        const data = await fetchSessions();
        // Allow creating assignments for COMPLETED or SCHEDULED sessions
        const validSessions = data.filter(s => s.status === 'COMPLETED' || s.status === 'SCHEDULED');
        setSessions(validSessions);
        if (validSessions.length > 0) {
          setFormData(prev => ({ ...prev, sessionId: validSessions[0].id }));
        }
      } catch (err) {
        setError('Failed to load sessions. Ensure you have valid mentoring sessions.');
      } finally {
        setLoading(false);
      }
    };
    loadSessions();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      setError('');
      
      const payload = new FormData();
      Object.keys(formData).forEach(key => payload.append(key, formData[key]));
      
      referenceFiles.forEach(file => {
        payload.append('referenceFiles', file);
      });

      await createAssignment(payload);
      navigate('/mentor/assignments');
    } catch (err) {
      setError(err.message);
    }
  };

  const handleFileChange = (e) => {
    if (e.target.files) {
      setReferenceFiles(Array.from(e.target.files));
    }
  };

  if (loading) return <div className="page-content">Loading...</div>;

  return (
    <div className="page-content">
      <BackLink to="/mentor/assignments" label="Back to Assignments" />
      <div className="glass-card" style={{ padding: '2rem', maxWidth: '600px', margin: '0 auto' }}>
        <h2 style={{ marginTop: 0, marginBottom: '1.5rem', color: 'var(--text-primary)' }}>Create New Assignment</h2>
        
        {sessions.length === 0 ? (
          <div style={{ color: 'var(--error)' }}>You have no eligible mentoring sessions to create assignments for.</div>
        ) : (
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-secondary)' }}>Select Mentoring Session</label>
              <select 
                className="form-input"
                value={formData.sessionId}
                onChange={e => setFormData({...formData, sessionId: e.target.value})}
                required
              >
                {sessions.map(s => (
                  <option key={s.id} value={s.id}>
                    {new Date(s.scheduledAt).toLocaleDateString()} - {s.mentorship?.student?.user?.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-secondary)' }}>Title</label>
              <input 
                type="text"
                className="form-input"
                value={formData.title}
                onChange={e => setFormData({...formData, title: e.target.value})}
                required
                placeholder="e.g., React Component Task"
              />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-secondary)' }}>Description & Instructions</label>
              <textarea 
                className="form-input"
                value={formData.description}
                onChange={e => setFormData({...formData, description: e.target.value})}
                required
                rows="5"
                style={{ resize: 'vertical' }}
                placeholder="Detail what the student needs to do..."
              ></textarea>
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-secondary)' }}>Due Date</label>
              <input 
                type="datetime-local"
                className="form-input"
                value={formData.dueDate}
                onChange={e => setFormData({...formData, dueDate: e.target.value})}
                required
              />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-secondary)' }}>Resource URL (Optional)</label>
              <input 
                type="url"
                className="form-input"
                value={formData.resourceUrl}
                onChange={e => setFormData({...formData, resourceUrl: e.target.value})}
                placeholder="https://example.com/resource"
              />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-secondary)' }}>Reference Files (Optional, Max 5)</label>
              <input 
                type="file"
                multiple
                onChange={handleFileChange}
                style={{ color: 'var(--text-primary)' }}
              />
              {referenceFiles.length > 0 && (
                <ul style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '0.5rem', paddingLeft: '1.5rem' }}>
                  {referenceFiles.map((f, i) => (
                    <li key={i}>{f.name} ({(f.size / 1024 / 1024).toFixed(2)} MB)</li>
                  ))}
                </ul>
              )}
            </div>
            
            {error && <div style={{ color: 'var(--error)' }}>{error}</div>}
            
            <button type="submit" className="btn btn-primary" style={{ marginTop: '1rem' }}>
              Assign Task
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
