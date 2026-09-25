import { useState, useEffect } from 'react';
import { getEligibility, createApplication, getMyApplication, updateApplication } from '../../services/peerMentorService';

export default function PeerMentorApplication() {
  const [eligibility, setEligibility] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  const [formData, setFormData] = useState({
    motivation: '',
    topics: '',
    teachingExperience: ''
  });
  
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState('');

  const fetchStatus = async () => {
    try {
      setLoading(true);
      const data = await getEligibility();
      setEligibility(data);
      
      if (data.applicationStatus === 'PENDING') {
        const app = await getMyApplication();
        if (app && app.eligibilityInfo) {
          try {
            const parsed = JSON.parse(app.eligibilityInfo);
            setFormData(parsed);
          } catch(e) {
            console.error('Failed to parse app data', e);
          }
        }
      }
    } catch (err) {
      setError(err.message || 'Failed to check eligibility');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
  }, []);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      setSubmitting(true);
      setError('');
      
      if (eligibility?.applicationStatus === 'PENDING') {
        await updateApplication({ eligibilityInfo: formData });
        setSuccess('Application updated successfully.');
      } else {
        await createApplication({ eligibilityInfo: formData });
        setSuccess('Application submitted successfully.');
      }
      
      setTimeout(() => {
        setSuccess('');
        fetchStatus();
      }, 2000);
    } catch (err) {
      setError(err.message || 'Failed to submit application');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <div className="page-content">Loading...</div>;

  return (
    <div className="page-content">
      <h2 className="page-title">Become a Peer Mentor</h2>
      <p className="page-subtitle" style={{ marginBottom: '2rem' }}>
        You can continue learning as a student while also mentoring other learners after approval.
      </p>

      {error && <div style={{ color: '#ef4444', marginBottom: '1rem' }}>{error}</div>}
      {success && <div style={{ color: '#10b981', background: 'rgba(16, 185, 129, 0.1)', padding: '1rem', borderRadius: '8px', marginBottom: '1rem', border: '1px solid #10b981' }}>{success}</div>}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '2rem' }}>
        {/* Eligibility Panel */}
        <div className="glass-card" style={{ padding: '1.5rem', alignSelf: 'start' }}>
          <h3 style={{ marginTop: 0, marginBottom: '1rem', color: 'white' }}>Eligibility Status</h3>
          
          <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 1.5rem 0', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {eligibility?.requirements?.map((req, idx) => (
              <li key={idx} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                <span style={{ color: eligibility.eligible ? '#10b981' : 'var(--text-muted)' }}>{eligibility.eligible ? '✓' : '○'}</span>
                {req}
              </li>
            ))}
          </ul>
          
          {!eligibility?.eligible && eligibility?.reasons?.length > 0 && (
            <div style={{ background: 'rgba(239, 68, 68, 0.1)', padding: '1rem', borderRadius: '8px', border: '1px solid rgba(239, 68, 68, 0.3)' }}>
              <h4 style={{ margin: '0 0 0.5rem 0', color: '#ef4444', fontSize: '0.9rem' }}>Missing Requirements:</h4>
              <ul style={{ margin: 0, paddingLeft: '1.2rem', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                {eligibility.reasons.map((r, i) => <li key={i} style={{ marginBottom: '0.25rem' }}>{r}</li>)}
              </ul>
            </div>
          )}

          {eligibility?.eligible && !eligibility?.applicationStatus && (
            <div style={{ color: '#10b981', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span>✓</span> You are eligible to apply!
            </div>
          )}
        </div>

        {/* Application Form / Status */}
        <div className="glass-card" style={{ padding: '2rem' }}>
          {eligibility?.applicationStatus === 'APPROVED' ? (
            <div style={{ textAlign: 'center', padding: '2rem 0' }}>
              <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🎉</div>
              <h3 style={{ color: 'white', margin: '0 0 1rem 0' }}>You are an approved peer mentor.</h3>
              <p style={{ color: 'var(--text-secondary)' }}>You can access peer mentor features through your dashboard navigation.</p>
            </div>
          ) : eligibility?.applicationStatus && eligibility.applicationStatus !== 'PENDING' ? (
            <div style={{ textAlign: 'center', padding: '2rem 0' }}>
              <h3 style={{ color: 'white', margin: '0 0 1rem 0' }}>Application Status: {eligibility.applicationStatus.replace('_', ' ')}</h3>
              <p style={{ color: 'var(--text-secondary)' }}>An AI preliminary assessment and administrator review will happen in later stages.</p>
            </div>
          ) : (
            <>
              {eligibility?.applicationStatus === 'PENDING' && (
                <div style={{ background: 'rgba(59, 130, 246, 0.1)', border: '1px solid #3b82f6', color: '#3b82f6', padding: '1rem', borderRadius: '8px', marginBottom: '1.5rem' }}>
                  <strong>Your peer mentor application is currently PENDING.</strong>
                  <div style={{ fontSize: '0.85rem', marginTop: '0.25rem' }}>You may update your information below while it is still pending. An AI preliminary assessment and administrator review will happen in later stages.</div>
                </div>
              )}

              <h3 style={{ marginTop: 0, marginBottom: '1.5rem', color: 'white' }}>
                {eligibility?.applicationStatus === 'PENDING' ? 'Edit Application' : 'Application Form'}
              </h3>
              
              <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-secondary)' }}>Why do you want to become a peer mentor?</label>
                  <textarea 
                    name="motivation"
                    value={formData.motivation}
                    onChange={handleChange}
                    rows="4"
                    style={{ width: '100%', padding: '0.75rem', borderRadius: '4px', border: '1px solid var(--border-subtle)', background: 'rgba(0,0,0,0.2)', color: 'white', resize: 'vertical' }}
                    required
                    disabled={!eligibility?.eligible && !eligibility?.applicationStatus}
                  ></textarea>
                </div>
                
                <div>
                  <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-secondary)' }}>What topics can you mentor?</label>
                  <input 
                    type="text"
                    name="topics"
                    value={formData.topics}
                    onChange={handleChange}
                    style={{ width: '100%', padding: '0.75rem', borderRadius: '4px', border: '1px solid var(--border-subtle)', background: 'rgba(0,0,0,0.2)', color: 'white' }}
                    placeholder="e.g. React, Python, Data Structures..."
                    required
                    disabled={!eligibility?.eligible && !eligibility?.applicationStatus}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-secondary)' }}>Previous mentoring or teaching experience (if any)</label>
                  <textarea 
                    name="teachingExperience"
                    value={formData.teachingExperience}
                    onChange={handleChange}
                    rows="4"
                    style={{ width: '100%', padding: '0.75rem', borderRadius: '4px', border: '1px solid var(--border-subtle)', background: 'rgba(0,0,0,0.2)', color: 'white', resize: 'vertical' }}
                    placeholder="Describe any informal or formal experience helping others learn..."
                    disabled={!eligibility?.eligible && !eligibility?.applicationStatus}
                  ></textarea>
                </div>
                
                <button 
                  type="submit" 
                  disabled={submitting || (!eligibility?.eligible && eligibility?.applicationStatus !== 'PENDING')} 
                  className="btn btn-primary" 
                  style={{ alignSelf: 'flex-start' }}
                >
                  {submitting ? 'Submitting...' : eligibility?.applicationStatus === 'PENDING' ? 'Update Application' : 'Submit Application'}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
