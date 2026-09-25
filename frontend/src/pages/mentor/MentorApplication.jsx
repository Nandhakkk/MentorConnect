import { useState, useEffect } from 'react';
import { getMyApplication, createApplication, updateMyApplication, screenApplication } from '../../services/mentorApplicationService';
import { useAuth } from '../../context/AuthContext';
import { useNavigate } from 'react-router-dom';

export default function MentorApplication() {
  const { user, token } = useAuth();
  const navigate = useNavigate();

  const [application, setApplication] = useState(null);
  const [formData, setFormData] = useState({
    professionalSummary: '',
    expertise: '',
    experience: '',
    teachingExperience: '',
    linkedinUrl: '',
    languages: '',
    proposedSessionFee: ''
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [screening, setScreening] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    const fetchApp = async () => {
      try {
        setLoading(true);
        const appData = await getMyApplication(token);
        if (appData) {
          setApplication(appData);
          setFormData({
            professionalSummary: appData.professionalSummary || '',
            expertise: appData.expertise || '',
            experience: appData.experience?.toString() || '',
            teachingExperience: appData.teachingExperience?.toString() || '',
            linkedinUrl: appData.linkedinUrl || '',
            languages: appData.languages || '',
            proposedSessionFee: appData.proposedSessionFee?.toString() || ''
          });
        }
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    if (token) fetchApp();
  }, [token]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSave = async (e) => {
    e.preventDefault();
    try {
      setSaving(true);
      setError('');
      setSuccess('');
      
      let updatedApp;
      if (application) {
        updatedApp = await updateMyApplication(formData, token);
        setSuccess('Application updated successfully.');
      } else {
        updatedApp = await createApplication(formData, token);
        setSuccess('Application created successfully.');
      }
      setApplication(updatedApp);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleScreening = async () => {
    try {
      setScreening(true);
      setError('');
      setSuccess('');
      const screeningResult = await screenApplication(token);
      setApplication(prev => ({
        ...prev,
        status: 'AI_SCREENED',
        aiScreening: screeningResult
      }));
      setSuccess('AI Preliminary Screening completed.');
    } catch (err) {
      setError(err.message);
    } finally {
      setScreening(false);
    }
  };

  if (loading) return <div className="page-content">Loading application...</div>;

  const isReadOnly = application && application.status !== 'PENDING' && application.status !== 'REJECTED';

  return (
    <div className="page-content">
      <div className="page-header">
        <div>
          <h2 className="page-title">Professional Mentor Application</h2>
          <p className="page-subtitle">Submit your professional experience, expertise, and credentials for verification.</p>
        </div>
      </div>

      <div className="glass-card" style={{ maxWidth: '800px', padding: '2rem' }}>
        
        {application && (
          <div style={{ marginBottom: '2rem', padding: '1rem', borderRadius: 'var(--radius-md)', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border-subtle)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <strong style={{ display: 'block', marginBottom: '0.25rem', color: 'var(--text-secondary)' }}>Application Status</strong>
                <span className={`badge badge-${application.status === 'APPROVED' ? 'success' : application.status === 'REJECTED' ? 'error' : 'warning'}`}>
                  {application.status}
                </span>
              </div>
              <div>
                <strong style={{ display: 'block', marginBottom: '0.25rem', color: 'var(--text-secondary)' }}>Submitted On</strong>
                <span style={{ color: 'var(--text-primary)' }}>{new Date(application.createdAt).toLocaleDateString()}</span>
              </div>
            </div>
            {application.rejectionReason && (
              <div style={{ marginTop: '1rem', color: 'var(--error)' }}>
                <strong>Rejection Reason:</strong> {application.rejectionReason}
              </div>
            )}
            {isReadOnly && (
              <div style={{ marginTop: '1rem', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                Your application is currently {application.status.replace('_', ' ').toLowerCase()}. The fields below are locked while not in PENDING status.
              </div>
            )}
          </div>
        )}

        {application && (application.status === 'PENDING' || application.status === 'AI_SCREENED') && (
          <div style={{ marginBottom: '2rem', padding: '1.5rem', borderRadius: 'var(--radius-md)', background: 'rgba(99, 102, 241, 0.1)', border: '1px solid var(--accent-primary)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <h3 style={{ fontSize: '1.1rem', marginBottom: '0.5rem', color: 'var(--text-primary)' }}>AI Preliminary Screening</h3>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '1rem', maxWidth: '600px' }}>
                  Run an AI-generated assessment for administrative review. This helps our team verify your application faster. 
                  Final mentor approval is performed by an administrator.
                </p>
              </div>
              {application.status === 'PENDING' && (
                <button className="btn btn-primary" onClick={handleScreening} disabled={screening}>
                  {screening ? 'Screening...' : 'Run AI Screening'}
                </button>
              )}
            </div>

            {application.aiScreening && (
              <div style={{ marginTop: '1rem', padding: '1rem', background: 'rgba(255,255,255,0.05)', borderRadius: 'var(--radius-sm)' }}>
                <h4 style={{ marginBottom: '0.5rem', color: 'var(--text-primary)' }}>Screening Result</h4>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                  <div><strong>Completeness:</strong> {application.aiScreening.structuredFindings?.profileCompleteness}</div>
                  <div><strong>Expertise:</strong> {application.aiScreening.structuredFindings?.expertiseRelevance}</div>
                  <div><strong>Experience:</strong> {application.aiScreening.structuredFindings?.experienceAssessment}</div>
                  <div><strong>Teaching:</strong> {application.aiScreening.structuredFindings?.teachingAssessment}</div>
                </div>
                
                {application.aiScreening.structuredFindings?.strengths?.length > 0 && (
                  <div style={{ marginBottom: '0.5rem' }}>
                    <strong style={{ color: '#10b981', fontSize: '0.9rem' }}>Strengths:</strong>
                    <ul style={{ paddingLeft: '1.2rem', margin: '0.25rem 0', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                      {application.aiScreening.structuredFindings.strengths.map((s, i) => <li key={i}>{s}</li>)}
                    </ul>
                  </div>
                )}
                
                {application.aiScreening.riskFlags?.concerns?.length > 0 && (
                  <div style={{ marginBottom: '0.5rem' }}>
                    <strong style={{ color: '#ef4444', fontSize: '0.9rem' }}>Concerns / Missing Info:</strong>
                    <ul style={{ paddingLeft: '1.2rem', margin: '0.25rem 0', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                      {application.aiScreening.riskFlags.concerns.map((c, i) => <li key={i}>{c}</li>)}
                    </ul>
                  </div>
                )}
                
                {application.aiScreening.riskFlags?.verificationItems?.length > 0 && (
                  <div style={{ marginBottom: '0.5rem' }}>
                    <strong style={{ color: '#f59e0b', fontSize: '0.9rem' }}>Admin Verification Items:</strong>
                    <ul style={{ paddingLeft: '1.2rem', margin: '0.25rem 0', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                      {application.aiScreening.riskFlags.verificationItems.map((v, i) => <li key={i}>{v}</li>)}
                    </ul>
                  </div>
                )}

                <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid rgba(255,255,255,0.1)', fontSize: '0.9rem' }}>
                  <strong style={{ color: 'var(--text-primary)' }}>Recommendation to Admin:</strong>{' '}
                  <span style={{ color: 'var(--text-secondary)' }}>{application.aiScreening.recommendation.replace(/_/g, ' ')}</span>
                </div>
              </div>
            )}
          </div>
        )}

        <form onSubmit={handleSave}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '1.5rem' }}>
            <div>
              <label className="form-label">LinkedIn Profile URL</label>
              <input 
                type="url" 
                name="linkedinUrl"
                className="form-input"
                value={formData.linkedinUrl} 
                onChange={handleChange}
                disabled={isReadOnly}
                placeholder="https://linkedin.com/in/username"
              />
            </div>
            <div>
              <label className="form-label">Languages Spoken</label>
              <input 
                type="text" 
                name="languages"
                className="form-input"
                required
                value={formData.languages} 
                onChange={handleChange}
                disabled={isReadOnly}
                placeholder="e.g. English, Spanish"
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '1.5rem' }}>
            <div>
              <label className="form-label">Total Industry Experience (Years)</label>
              <input 
                type="number" 
                name="experience"
                className="form-input"
                min="0"
                required
                value={formData.experience} 
                onChange={handleChange}
                disabled={isReadOnly}
                placeholder="e.g. 5"
              />
            </div>
            <div>
              <label className="form-label">Teaching/Mentoring Experience (Years)</label>
              <input 
                type="number" 
                name="teachingExperience"
                className="form-input"
                min="0"
                value={formData.teachingExperience} 
                onChange={handleChange}
                disabled={isReadOnly}
                placeholder="e.g. 2"
              />
            </div>
          </div>

          <div style={{ marginBottom: '1.5rem' }}>
            <label className="form-label">Primary Expertise / Topics</label>
            <input 
              type="text" 
              name="expertise"
              className="form-input"
              required
              value={formData.expertise} 
              onChange={handleChange}
              disabled={isReadOnly}
              placeholder="e.g. Full-Stack Development, Node.js, React, Career Coaching"
            />
          </div>

          <div style={{ marginBottom: '1.5rem' }}>
            <label className="form-label">Proposed Session Fee (Approx USD/hour)</label>
            <input 
              type="number" 
              name="proposedSessionFee"
              className="form-input"
              min="0"
              step="0.01"
              required
              value={formData.proposedSessionFee} 
              onChange={handleChange}
              disabled={isReadOnly}
              placeholder="e.g. 25.00"
            />
          </div>

          <div style={{ marginBottom: '2rem' }}>
            <label className="form-label">Professional Summary</label>
            <textarea 
              name="professionalSummary"
              className="form-input"
              rows="5"
              required
              value={formData.professionalSummary} 
              onChange={handleChange}
              disabled={isReadOnly}
              placeholder="Summarize your professional background, achievements, and why you want to be a mentor..."
            />
          </div>

          {/* Credentials / Certificates Placeholder */}
          <div style={{ marginBottom: '2rem', padding: '1.5rem', border: '1px dashed var(--border-subtle)', borderRadius: 'var(--radius-md)' }}>
            <h4 style={{ marginBottom: '0.5rem' }}>Certificates & Evidence</h4>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '1rem' }}>
              Upload your degrees, certificates, or evidence of experience. (Document upload functionality will be implemented in a later phase).
            </p>
            <button type="button" className="btn btn-secondary" disabled>
              Upload Document (Coming Soon)
            </button>
            {application && application.credentials && application.credentials.length > 0 && (
              <ul style={{ marginTop: '1rem', paddingLeft: '1.2rem', color: 'var(--text-primary)' }}>
                {application.credentials.map(cred => (
                  <li key={cred.id}>{cred.title} - {cred.status}</li>
                ))}
              </ul>
            )}
          </div>

          {error && <div style={{ padding: '1rem', background: 'var(--error-bg)', color: 'var(--error)', borderRadius: 'var(--radius-md)', marginBottom: '1.5rem' }}>{error}</div>}
          {success && <div style={{ padding: '1rem', background: 'rgba(16, 185, 129, 0.1)', color: '#10b981', borderRadius: 'var(--radius-md)', marginBottom: '1.5rem' }}>{success}</div>}

          {!isReadOnly && (
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button type="submit" className="btn btn-primary" disabled={saving}>
                {saving ? 'Saving...' : application ? 'Update Application' : 'Submit Application'}
              </button>
            </div>
          )}
        </form>
      </div>
    </div>
  );
}
