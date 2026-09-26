import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { fetchMyMentorProfile, updateMyMentorProfile } from '../../services/mentorService';

export default function PeerMentorProfileForm() {
  const { user } = useAuth();
  const [profile, setProfile] = useState(null);
  const [isReady, setIsReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [form, setForm] = useState({ bio: '', expertise: '', experience: '', language: '', sessionFee: '', topics: '' });

  useEffect(() => {
    const loadProfile = async () => {
      try {
        const { profile: p, isReady: r } = await fetchMyMentorProfile();
        setProfile(p);
        setIsReady(r);
        setForm({
          bio: p.bio || '',
          expertise: p.expertise || '',
          experience: p.experience || '',
          language: p.language || '',
          sessionFee: p.sessionFee != null ? String(p.sessionFee) : '',
          topics: p.topics?.map(t => t.topic.name).join(', ') || ''
        });
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    loadProfile();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      setSaving(true);
      setError('');
      setSuccess('');
      const topicsArray = form.topics.split(',').map(t => t.trim()).filter(Boolean);
      await updateMyMentorProfile({
        bio: form.bio,
        expertise: form.expertise,
        experience: form.experience ? parseInt(form.experience) : undefined,
        language: form.language,
        sessionFee: form.sessionFee !== '' ? parseFloat(form.sessionFee) : undefined,
        topics: topicsArray
      });
      setSuccess('Profile updated successfully!');
      // Reload to get updated readiness
      const { profile: p, isReady: r } = await fetchMyMentorProfile();
      setProfile(p);
      setIsReady(r);
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
          <h2 className="page-title">Peer Mentor Profile</h2>
          <p className="page-subtitle">Configure your mentor profile so learners can find and book sessions with you.</p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <span style={{ 
            fontSize: '0.8rem', padding: '0.3rem 0.75rem', borderRadius: '16px', fontWeight: 600,
            background: isReady ? 'rgba(16, 185, 129, 0.15)' : 'rgba(245, 158, 11, 0.15)',
            color: isReady ? '#10b981' : '#f59e0b',
            border: isReady ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid rgba(245, 158, 11, 0.3)'
          }}>
            {isReady ? '✓ Discoverable' : '⚠ Not Ready'}
          </span>
        </div>
      </div>

      {!isReady && (
        <div className="glass-card" style={{ padding: '1.25rem', marginBottom: '1.5rem', background: 'rgba(245, 158, 11, 0.08)', border: '1px solid rgba(245, 158, 11, 0.2)' }}>
          <p style={{ color: '#f59e0b', margin: 0, fontSize: '0.9rem' }}>
            <strong>Complete your profile to become discoverable.</strong> You need: bio, expertise, at least one topic, session fee, and at least one availability slot.
          </p>
        </div>
      )}

      {success && <div style={{ color: '#10b981', marginBottom: '1rem', fontWeight: 'bold' }}>{success}</div>}
      {error && <div style={{ color: '#ef4444', marginBottom: '1rem' }}>{error}</div>}

      <form onSubmit={handleSubmit} className="glass-card" style={{ padding: '2rem' }}>
        <div style={{ display: 'grid', gap: '1.5rem' }}>
          <div>
            <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Bio</label>
            <textarea
              value={form.bio}
              onChange={e => setForm({ ...form, bio: e.target.value })}
              rows={4}
              placeholder="Tell learners about yourself and your mentoring approach..."
              style={{ width: '100%', padding: '0.75rem', borderRadius: '4px', border: '1px solid var(--border-subtle)', background: 'rgba(0,0,0,0.2)', color: 'white', resize: 'vertical' }}
            />
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Expertise / Skills</label>
            <input
              value={form.expertise}
              onChange={e => setForm({ ...form, expertise: e.target.value })}
              placeholder="e.g., JavaScript, React, Data Science"
              style={{ width: '100%', padding: '0.75rem', borderRadius: '4px', border: '1px solid var(--border-subtle)', background: 'rgba(0,0,0,0.2)', color: 'white' }}
            />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Experience (years)</label>
              <input
                type="number"
                value={form.experience}
                onChange={e => setForm({ ...form, experience: e.target.value })}
                min="0"
                style={{ width: '100%', padding: '0.75rem', borderRadius: '4px', border: '1px solid var(--border-subtle)', background: 'rgba(0,0,0,0.2)', color: 'white' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Language</label>
              <input
                value={form.language}
                onChange={e => setForm({ ...form, language: e.target.value })}
                placeholder="e.g., English"
                style={{ width: '100%', padding: '0.75rem', borderRadius: '4px', border: '1px solid var(--border-subtle)', background: 'rgba(0,0,0,0.2)', color: 'white' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Session Fee ($/hr)</label>
              <input
                type="number"
                value={form.sessionFee}
                onChange={e => setForm({ ...form, sessionFee: e.target.value })}
                min="0"
                step="0.01"
                placeholder="0 for free"
                style={{ width: '100%', padding: '0.75rem', borderRadius: '4px', border: '1px solid var(--border-subtle)', background: 'rgba(0,0,0,0.2)', color: 'white' }}
              />
            </div>
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Topics (comma-separated)</label>
            <input
              value={form.topics}
              onChange={e => setForm({ ...form, topics: e.target.value })}
              placeholder="e.g., Web Development, Python, Machine Learning"
              style={{ width: '100%', padding: '0.75rem', borderRadius: '4px', border: '1px solid var(--border-subtle)', background: 'rgba(0,0,0,0.2)', color: 'white' }}
            />
          </div>
        </div>

        <div style={{ marginTop: '2rem', display: 'flex', justifyContent: 'flex-end' }}>
          <button type="submit" disabled={saving} className="btn btn-primary" style={{ padding: '0.75rem 2rem' }}>
            {saving ? 'Saving...' : 'Save Profile'}
          </button>
        </div>
      </form>
    </div>
  );
}
