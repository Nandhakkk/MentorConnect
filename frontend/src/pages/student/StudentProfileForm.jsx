import { useState, useEffect } from 'react';
import { fetchMyStudentProfile, updateMyStudentProfile } from '../../services/studentService';
import { useAuth } from '../../context/AuthContext';

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
    </div>
  );
}
