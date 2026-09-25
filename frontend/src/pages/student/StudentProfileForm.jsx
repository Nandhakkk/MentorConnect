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

      <div className="glass-card" style={{ maxWidth: '600px', padding: '2rem' }}>
        <form onSubmit={handleSave}>
          <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem' }}>
            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Full Name</label>
              <input 
                type="text" 
                value={user?.name || ''} 
                disabled 
                style={{ width: '100%', padding: '0.75rem', borderRadius: '4px', border: '1px solid var(--border-subtle)', background: 'rgba(255,255,255,0.05)', color: 'var(--text-muted)', cursor: 'not-allowed' }}
              />
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Email</label>
              <input 
                type="email" 
                value={user?.email || ''} 
                disabled 
                style={{ width: '100%', padding: '0.75rem', borderRadius: '4px', border: '1px solid var(--border-subtle)', background: 'rgba(255,255,255,0.05)', color: 'var(--text-muted)', cursor: 'not-allowed' }}
              />
            </div>
          </div>

          <div style={{ marginBottom: '1.5rem' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem' }}>Career Goal</label>
            <input 
              type="text" 
              value={profile.careerGoal} 
              onChange={e => setProfile({...profile, careerGoal: e.target.value})}
              placeholder="e.g. Become a Full-Stack Developer"
              style={{ width: '100%', padding: '0.75rem', borderRadius: '4px', border: '1px solid var(--border-subtle)', background: 'rgba(0,0,0,0.2)', color: 'white' }}
            />
          </div>

          <div style={{ marginBottom: '1.5rem' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem' }}>Education</label>
            <input 
              type="text" 
              value={profile.education} 
              onChange={e => setProfile({...profile, education: e.target.value})}
              placeholder="e.g. MCA at XYZ University"
              style={{ width: '100%', padding: '0.75rem', borderRadius: '4px', border: '1px solid var(--border-subtle)', background: 'rgba(0,0,0,0.2)', color: 'white' }}
            />
          </div>

          <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem' }}>
            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem' }}>Skills</label>
              <input 
                type="text" 
                value={profile.skills} 
                onChange={e => setProfile({...profile, skills: e.target.value})}
                placeholder="e.g. JavaScript, React, SQL"
                style={{ width: '100%', padding: '0.75rem', borderRadius: '4px', border: '1px solid var(--border-subtle)', background: 'rgba(0,0,0,0.2)', color: 'white' }}
              />
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem' }}>Interests</label>
              <input 
                type="text" 
                value={profile.interests} 
                onChange={e => setProfile({...profile, interests: e.target.value})}
                placeholder="e.g. Web Development, AI"
                style={{ width: '100%', padding: '0.75rem', borderRadius: '4px', border: '1px solid var(--border-subtle)', background: 'rgba(0,0,0,0.2)', color: 'white' }}
              />
            </div>
          </div>

          <div style={{ marginBottom: '2rem' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem' }}>Bio</label>
            <textarea 
              value={profile.bio} 
              onChange={e => setProfile({...profile, bio: e.target.value})}
              rows="4"
              placeholder="Tell mentors about yourself..."
              style={{ width: '100%', padding: '0.75rem', borderRadius: '4px', border: '1px solid var(--border-subtle)', background: 'rgba(0,0,0,0.2)', color: 'white' }}
            />
          </div>

          {message && <div style={{ color: '#10b981', marginBottom: '1rem', fontWeight: 'bold' }}>{message}</div>}
          {error && <div style={{ color: '#ef4444', marginBottom: '1rem' }}>{error}</div>}

          <button type="submit" className="btn btn-primary" disabled={saving} style={{ padding: '0.75rem 2rem' }}>
            {saving ? 'Saving...' : 'Save Profile'}
          </button>
        </form>
      </div>

      {isMinor(user?.dateOfBirth) && (
        <div className="glass-card" style={{ maxWidth: '600px', padding: '2rem', marginTop: '2rem' }}>
          <h3 style={{ marginBottom: '1rem' }}>Link Guardian</h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
            As a minor, you can link a parent or guardian to your account so they can monitor your progress and sessions.
          </p>
          <form onSubmit={handleLinkGuardian}>
            <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem' }}>
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem' }}>Guardian Email</label>
                <input 
                  type="email" 
                  required
                  value={guardianEmail} 
                  onChange={e => setGuardianEmail(e.target.value)}
                  placeholder="e.g. parent@example.com"
                  style={{ width: '100%', padding: '0.75rem', borderRadius: '4px', border: '1px solid var(--border-subtle)', background: 'rgba(0,0,0,0.2)', color: 'white' }}
                />
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem' }}>Relationship</label>
                <select 
                  required
                  value={relationship}
                  onChange={e => setRelationship(e.target.value)}
                  style={{ width: '100%', padding: '0.75rem', borderRadius: '4px', border: '1px solid var(--border-subtle)', background: 'rgba(0,0,0,0.2)', color: 'white' }}
                >
                  <option value="">Select...</option>
                  <option value="Parent">Parent</option>
                  <option value="Legal Guardian">Legal Guardian</option>
                  <option value="Other">Other</option>
                </select>
              </div>
            </div>

            {linkMsg && <div style={{ color: '#10b981', marginBottom: '1rem', fontWeight: 'bold' }}>{linkMsg}</div>}
            {linkErr && <div style={{ color: '#ef4444', marginBottom: '1rem' }}>{linkErr}</div>}

            <button type="submit" className="btn btn-secondary" disabled={linking} style={{ padding: '0.75rem 2rem' }}>
              {linking ? 'Linking...' : 'Send Link Request'}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
