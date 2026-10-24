import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { createComplaint } from '../../services/complaintService';
import BackLink from '../../components/BackLink';

export default function ReportSession() {
  const { id } = useParams(); // sessionId
  const navigate = useNavigate();
  const [category, setCategory] = useState('INAPPROPRIATE_BEHAVIOR');
  const [description, setDescription] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (description.length < 10) {
      setError('Description must be at least 10 characters long.');
      return;
    }
    
    try {
      setLoading(true);
      setError('');
      await createComplaint({ sessionId: id, category, description });
      setSuccess('Complaint submitted successfully. Our team will review it.');
      setTimeout(() => {
        navigate(-1);
      }, 2000);
    } catch (err) {
      setError(err.message || 'Failed to submit complaint.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page-content">
      <BackLink to="#" onClick={(e) => { e.preventDefault(); navigate(-1); }} label="Back to Sessions" />
      <div className="glass-card" style={{ padding: '2rem', maxWidth: '600px', margin: '0 auto' }}>
        <h2 style={{ marginTop: 0, marginBottom: '1.5rem', color: 'var(--text-primary)' }}>Report an Issue</h2>
        
        <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem', fontSize: '0.9rem' }}>
          Please provide details about the issue you experienced during this session.
          Submitting a report will alert our moderation team to investigate.
        </p>

        {success ? (
          <div style={{ padding: '1rem', background: 'var(--success-subtle)', border: '1px solid var(--success)', borderRadius: '8px', color: 'var(--success)' }}>
            {success}
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-secondary)' }}>Category</label>
              <select 
                value={category} 
                onChange={e => setCategory(e.target.value)}
                className="form-input"
              >
                <option value="INAPPROPRIATE_BEHAVIOR">Inappropriate Behavior</option>
                <option value="NO_SHOW">No Show</option>
                <option value="PAYMENT_ISSUE">Payment Issue</option>
                <option value="OTHER">Other</option>
              </select>
            </div>
            
            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-secondary)' }}>Description</label>
              <textarea 
                value={description}
                onChange={e => setDescription(e.target.value)}
                rows="6"
                className="form-input"
                style={{ resize: 'vertical' }}
                placeholder="Please describe what happened in detail..."
                required
              ></textarea>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>Minimum 10 characters</div>
            </div>
            
            {error && <div style={{ color: 'var(--error)' }}>{error}</div>}
            
            <button type="submit" disabled={loading} className="btn" style={{ alignSelf: 'flex-start', background: 'var(--error)', color: '#ffffff', padding: '0.65rem 1.5rem' }}>
              {loading ? 'Submitting...' : 'Submit Report'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
