import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { fetchMentorById, createMentorship } from '../../services/mentorService';
import BackLink from '../../components/BackLink';
import PageHeader from '../../components/PageHeader';

export default function PublicMentorProfile() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [mentor, setMentor] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [requesting, setRequesting] = useState(false);
  const [success, setSuccess] = useState('');

  useEffect(() => {
    const loadMentor = async () => {
      try {
        setLoading(true);
        const data = await fetchMentorById(id);
        setMentor(data);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    loadMentor();
  }, [id]);

  const handleStartMentorship = async () => {
    try {
      setRequesting(true);
      setError('');
      await createMentorship(id);
      setSuccess('Mentorship started successfully!');
      setTimeout(() => {
        navigate('/student/mentorships');
      }, 2000);
    } catch (err) {
      setError(err.message);
    } finally {
      setRequesting(false);
    }
  };

  if (loading) return <div className="page-content">Loading mentor profile...</div>;
  if (!mentor) return <div className="page-content" style={{ color: '#ef4444' }}>{error || 'Mentor not found.'}</div>;

  return (
    <div className="page-content">
      <BackLink to="/student/mentor">Back to Find Mentors</BackLink>
      <PageHeader title="Mentor profile" subtitle="Learn about this mentor before you send a mentorship request." crumbs={[{ label: 'Dashboard', to: '/student/dashboard' }, { label: 'Find mentors', to: '/student/mentor' }, { label: 'Mentor profile' }]} />

      <div className="glass-card" style={{ padding: '3rem 2rem', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
        <div style={{ 
          width: '80px', height: '80px', borderRadius: '50%', background: 'linear-gradient(135deg, #6366f1 0%, #a855f7 100%)', 
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '2rem', color: 'white', marginBottom: '1.5rem', fontWeight: 'bold' 
        }}>
          {mentor.user?.name?.charAt(0).toUpperCase()}
        </div>
        
        <h2 style={{ margin: '0 0 0.5rem 0', fontSize: '1.8rem', color: 'var(--text-primary)' }}>{mentor.user?.name}</h2>
        <div style={{ color: 'var(--accent-primary)', fontSize: '1rem', fontWeight: 600, marginBottom: '1.5rem' }}>{mentor.expertise || 'General Mentor'}</div>

        <div style={{ display: 'flex', gap: '1.5rem', marginBottom: '2rem', flexWrap: 'wrap', justifyContent: 'center' }}>
          <div style={{ background: 'rgba(255,255,255,0.05)', padding: '1rem', borderRadius: '8px', minWidth: '120px' }}>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>Experience</div>
            <div style={{ fontSize: '1.2rem', fontWeight: 'bold', color: 'var(--text-primary)' }}>{mentor.experience ? `${mentor.experience} yrs` : '-'}</div>
          </div>
          <div style={{ background: 'rgba(255,255,255,0.05)', padding: '1rem', borderRadius: '8px', minWidth: '120px' }}>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>Hourly Rate</div>
            <div style={{ fontSize: '1.2rem', fontWeight: 'bold', color: 'var(--text-primary)' }}>{mentor.hourlyRate ? `$${mentor.hourlyRate}/hr` : '-'}</div>
          </div>
          <div style={{ background: 'rgba(255,255,255,0.05)', padding: '1rem', borderRadius: '8px', minWidth: '120px' }}>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>Status</div>
            <div style={{ fontSize: '1.1rem', fontWeight: 'bold', color: mentor.isAvailable ? '#10b981' : '#6b7280' }}>
              {mentor.isAvailable ? 'Available' : 'Unavailable'}
            </div>
          </div>
        </div>

        {mentor.bio && (
          <div style={{ maxWidth: '600px', margin: '0 auto 2.5rem', textAlign: 'left' }}>
            <h3 style={{ fontSize: '1.1rem', marginBottom: '0.75rem', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '0.5rem' }}>About Me</h3>
            <p style={{ color: 'var(--text-secondary)', lineHeight: 1.6, fontSize: '0.95rem' }}>
              {mentor.bio}
            </p>
          </div>
        )}

        {success && <div style={{ color: '#10b981', marginBottom: '1rem', fontWeight: 'bold' }}>{success}</div>}
        {error && <div style={{ color: '#ef4444', marginBottom: '1rem' }}>{error}</div>}

        <button 
          onClick={handleStartMentorship} 
          disabled={!mentor.isAvailable || requesting || success} 
          className="btn btn-primary" 
          style={{ padding: '0.75rem 2rem', fontSize: '1rem', minWidth: '200px' }}
        >
          {requesting ? 'Requesting...' : success ? 'Started!' : 'Start Mentorship'}
        </button>
      </div>
    </div>
  );
}
