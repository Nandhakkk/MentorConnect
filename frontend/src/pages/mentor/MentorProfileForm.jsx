import { useState, useEffect } from 'react';
import { fetchMyMentorProfile, updateMyMentorProfile } from '../../services/mentorService';
import { useAuth } from '../../context/AuthContext';

export default function MentorProfileForm() {
  const { user } = useAuth();
  const [profile, setProfile] = useState({
    bio: '',
    expertise: '',
    experience: '',
    language: '',
    linkedinUrl: '',
    teachingExperience: '',
    sessionFee: '',
    topics: '',
    isAvailable: true
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    const loadProfile = async () => {
      try {
        setLoading(true);
        const data = await fetchMyMentorProfile();
        setProfile({
          bio: data.profile.bio || '',
          expertise: data.profile.expertise || '',
          experience: data.profile.experience || '',
          language: data.profile.language || '',
          linkedinUrl: data.profile.linkedinUrl || '',
          teachingExperience: data.profile.teachingExperience || '',
          sessionFee: data.profile.sessionFee || '',
          topics: data.profile.topics ? data.profile.topics.map(t => t.topic.name).join(', ') : '',
          isAvailable: data.profile.isAvailable
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
      const payload = {
        ...profile,
        topics: profile.topics ? profile.topics.split(',').map(t => t.trim()).filter(Boolean) : []
      };
      await updateMyMentorProfile(payload);
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
          <p className="page-subtitle">Update your mentor details to attract students.</p>
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
            <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem' }}>Expertise (e.g., React, Node.js)</label>
            <input 
              type="text" 
              value={profile.expertise} 
              onChange={e => setProfile({...profile, expertise: e.target.value})}
              style={{ width: '100%', padding: '0.75rem', borderRadius: '4px', border: '1px solid var(--border-subtle)', background: 'rgba(0,0,0,0.2)', color: 'white' }}
            />
          </div>

          <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem' }}>
            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem' }}>Experience (Years)</label>
              <input 
                type="number" 
                min="0"
                value={profile.experience} 
                onChange={e => setProfile({...profile, experience: e.target.value})}
                style={{ width: '100%', padding: '0.75rem', borderRadius: '4px', border: '1px solid var(--border-subtle)', background: 'rgba(0,0,0,0.2)', color: 'white' }}
              />
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem' }}>Session Fee ($/hr)</label>
              <input 
                type="number" 
                min="0"
                step="0.01"
                value={profile.sessionFee} 
                onChange={e => setProfile({...profile, sessionFee: e.target.value})}
                style={{ width: '100%', padding: '0.75rem', borderRadius: '4px', border: '1px solid var(--border-subtle)', background: 'rgba(0,0,0,0.2)', color: 'white' }}
              />
            </div>
          </div>

          <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem' }}>
            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem' }}>Language</label>
              <input 
                type="text" 
                placeholder="e.g. English, Spanish"
                value={profile.language} 
                onChange={e => setProfile({...profile, language: e.target.value})}
                style={{ width: '100%', padding: '0.75rem', borderRadius: '4px', border: '1px solid var(--border-subtle)', background: 'rgba(0,0,0,0.2)', color: 'white' }}
              />
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem' }}>Teaching Exp (Years)</label>
              <input 
                type="number" 
                min="0"
                value={profile.teachingExperience} 
                onChange={e => setProfile({...profile, teachingExperience: e.target.value})}
                style={{ width: '100%', padding: '0.75rem', borderRadius: '4px', border: '1px solid var(--border-subtle)', background: 'rgba(0,0,0,0.2)', color: 'white' }}
              />
            </div>
          </div>

          <div style={{ marginBottom: '1.5rem' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem' }}>Topics (Comma separated)</label>
            <input 
              type="text" 
              placeholder="e.g. React, Career Growth, Interview Prep"
              value={profile.topics} 
              onChange={e => setProfile({...profile, topics: e.target.value})}
              style={{ width: '100%', padding: '0.75rem', borderRadius: '4px', border: '1px solid var(--border-subtle)', background: 'rgba(0,0,0,0.2)', color: 'white' }}
            />
          </div>

          <div style={{ marginBottom: '1.5rem' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem' }}>LinkedIn URL</label>
            <input 
              type="url" 
              value={profile.linkedinUrl} 
              onChange={e => setProfile({...profile, linkedinUrl: e.target.value})}
              style={{ width: '100%', padding: '0.75rem', borderRadius: '4px', border: '1px solid var(--border-subtle)', background: 'rgba(0,0,0,0.2)', color: 'white' }}
            />
          </div>

          <div style={{ marginBottom: '1.5rem' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem' }}>Bio</label>
            <textarea 
              value={profile.bio} 
              onChange={e => setProfile({...profile, bio: e.target.value})}
              rows="4"
              style={{ width: '100%', padding: '0.75rem', borderRadius: '4px', border: '1px solid var(--border-subtle)', background: 'rgba(0,0,0,0.2)', color: 'white' }}
            />
          </div>

          <div style={{ marginBottom: '2rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <input 
              type="checkbox" 
              id="isAvailable"
              checked={profile.isAvailable} 
              onChange={e => setProfile({...profile, isAvailable: e.target.checked})}
              style={{ width: '1.2rem', height: '1.2rem', cursor: 'pointer' }}
            />
            <label htmlFor="isAvailable" style={{ fontSize: '0.9rem', cursor: 'pointer' }}>
              I am currently available to take on new students
            </label>
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
