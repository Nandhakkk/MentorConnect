import { useState, useEffect } from 'react';
import { fetchMyStudentProfile, updateMyStudentProfile } from '../../services/studentService';
import { linkGuardian } from '../../services/guardianService';
import { useAuth } from '../../context/AuthContext';

const isMinor = (dobString) => {
  if (!dobString) return false;
  const dob = new Date(dobString);
  const today = new Date();
  let age = today.getFullYear() - dob.getFullYear();
  const m = today.getMonth() - dob.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) {
    age--;
  }
  return age < 18;
};

export default function StudentProfileForm() {
  const { user } = useAuth();
  const [profile, setProfile] = useState({
    bio: '',
    education: '',
    skills: '',
    interests: '',
    careerGoal: ''
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const [guardianEmail, setGuardianEmail] = useState('');
  const [relationship, setRelationship] = useState('');
  const [linking, setLinking] = useState(false);
  const [linkMsg, setLinkMsg] = useState('');
  const [linkErr, setLinkErr] = useState('');

  useEffect(() => {
    const loadProfile = async () => {
      try {
        setLoading(true);
        const data = await fetchMyStudentProfile();
        setProfile({
          bio: data.bio || '',
          education: data.education || '',
          skills: data.skills || '',
          interests: data.interests || '',
          careerGoal: data.careerGoal || ''
        });
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    loadProfile();
  }, []);

  const handleSave = async (e) => {
    e.preventDefault();
    try {
      setSaving(true);
      setMessage('');
      setError('');
      await updateMyStudentProfile(profile);
      setMessage('Profile updated successfully.');
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleLinkGuardian = async (e) => {
    e.preventDefault();
    try {
      setLinking(true);
      setLinkMsg('');
      setLinkErr('');
      const { token } = useAuth(); // Actually better to get token directly from useAuth if exposed, wait we don't have token exposed in useAuth here?
      // Wait, let's just get it from localStorage or authContext.
      const authToken = localStorage.getItem('mentorconnect_token');
      await linkGuardian(guardianEmail, relationship, authToken);
      setLinkMsg('Guardian linked successfully.');
      setGuardianEmail('');
      setRelationship('');
    } catch (err) {
      setLinkErr(err.message);
    } finally {
      setLinking(false);
    }
  };

  if (loading) return <div className="page-content">Loading profile...</div>;

  return (
    <div className="page-content">
      <div className="page-header">
        <div>
          <h2 className="page-title">My Profile</h2>
          <p className="page-subtitle">Update your student details and career aspirations.</p>
        </div>
      </div>

      <div className="profile-grid">
        <div className="profile-sidebar">
          <div className="glass-card profile-header-card">
            <div className="profile-large-avatar">
              {user?.name?.charAt(0)?.toUpperCase() || 'U'}
            </div>
            <h3 style={{ fontSize: '1.25rem', marginBottom: '0.25rem' }}>{user?.name}</h3>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '1rem' }}>Student</p>
            <div style={{ textAlign: 'left', marginTop: '1.5rem', paddingTop: '1.5rem', borderTop: '1px solid var(--border-subtle)' }}>
              <div className="info-item" style={{ marginBottom: '0.75rem' }}>
                <span className="info-label">Email</span>
                <span className="info-value" style={{ wordBreak: 'break-all' }}>{user?.email}</span>
              </div>
              <div className="info-item">
                <span className="info-label">Role</span>
                <span className="info-value">Student</span>
              </div>
            </div>
          </div>
        </div>

        <div className="profile-main">
          <div className="glass-card profile-section">
            <h3>Profile Details</h3>
            <form onSubmit={handleSave}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.25rem' }}>
                <div>
                  <label className="form-label">Career Goal</label>
                  <input 
                    type="text" 
                    className="form-input"
                    value={profile.careerGoal} 
                    onChange={e => setProfile({...profile, careerGoal: e.target.value})}
                    placeholder="e.g. Become a Full-Stack Developer"
                  />
                </div>
                <div>
                  <label className="form-label">Education</label>
                  <input 
                    type="text" 
                    className="form-input"
                    value={profile.education} 
                    onChange={e => setProfile({...profile, education: e.target.value})}
                    placeholder="e.g. MCA at XYZ University"
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.25rem' }}>
                <div>
                  <label className="form-label">Skills</label>
                  <input 
                    type="text" 
                    className="form-input"
                    value={profile.skills} 
                    onChange={e => setProfile({...profile, skills: e.target.value})}
                    placeholder="e.g. JavaScript, React, SQL"
                  />
                </div>
                <div>
                  <label className="form-label">Interests</label>
                  <input 
                    type="text" 
                    className="form-input"
                    value={profile.interests} 
                    onChange={e => setProfile({...profile, interests: e.target.value})}
                    placeholder="e.g. Web Development, AI"
                  />
                </div>
              </div>

              <div style={{ marginBottom: '1.5rem' }}>
                <label className="form-label">Bio</label>
                <textarea 
                  className="form-input"
                  value={profile.bio} 
                  onChange={e => setProfile({...profile, bio: e.target.value})}
                  rows="4"
                  placeholder="Tell mentors about yourself..."
                />
              </div>

              {message && <div style={{ padding: '0.75rem', background: 'var(--success-bg)', color: 'var(--success)', borderRadius: 'var(--radius-md)', marginBottom: '1rem' }}>{message}</div>}
              {error && <div style={{ padding: '0.75rem', background: 'var(--error-bg)', color: 'var(--error)', borderRadius: 'var(--radius-md)', marginBottom: '1rem' }}>{error}</div>}

              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? 'Saving...' : 'Save Profile'}
                </button>
              </div>
            </form>
          </div>

          {isMinor(user?.dateOfBirth) && (
            <div className="glass-card profile-section">
              <h3>Link Guardian</h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
                As a minor, you can link a parent or guardian to your account so they can monitor your progress and sessions.
              </p>
              <form onSubmit={handleLinkGuardian}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.25rem' }}>
                  <div>
                    <label className="form-label">Guardian Email</label>
                    <input 
                      type="email" 
                      className="form-input"
                      required
                      value={guardianEmail} 
                      onChange={e => setGuardianEmail(e.target.value)}
                      placeholder="e.g. parent@example.com"
                    />
                  </div>
                  <div>
                    <label className="form-label">Relationship</label>
                    <select 
                      required
                      className="form-input"
                      value={relationship}
                      onChange={e => setRelationship(e.target.value)}
                    >
                      <option value="">Select...</option>
                      <option value="Parent">Parent</option>
                      <option value="Legal Guardian">Legal Guardian</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>
                </div>

                {linkMsg && <div style={{ padding: '0.75rem', background: 'var(--success-bg)', color: 'var(--success)', borderRadius: 'var(--radius-md)', marginBottom: '1rem' }}>{linkMsg}</div>}
                {linkErr && <div style={{ padding: '0.75rem', background: 'var(--error-bg)', color: 'var(--error)', borderRadius: 'var(--radius-md)', marginBottom: '1rem' }}>{linkErr}</div>}

                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <button type="submit" className="btn btn-secondary" disabled={linking}>
                    {linking ? 'Linking...' : 'Send Link Request'}
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
