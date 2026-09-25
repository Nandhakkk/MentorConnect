import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { fetchAvailableMentors } from '../../services/mentorService';

export default function MentorDiscovery() {
  const [mentors, setMentors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchParams, setSearchParams] = useState({ search: '', minFee: '', maxFee: '' });

  const loadMentors = async (params = searchParams) => {
    try {
      setLoading(true);
      const data = await fetchAvailableMentors(params);
      setMentors(data);
      setError('');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMentors();
  }, []);

  const handleSearch = (e) => {
    e.preventDefault();
    loadMentors(searchParams);
  };

  const handleClear = () => {
    const cleared = { search: '', minFee: '', maxFee: '' };
    setSearchParams(cleared);
    loadMentors(cleared);
  };

  return (
    <div className="page-content">
      <div className="page-header">
        <div>
          <h2 className="page-title">Find a Mentor</h2>
          <p className="page-subtitle">Discover approved professional mentors to guide your journey.</p>
        </div>
      </div>

      <div className="glass-card" style={{ padding: '1.5rem', marginBottom: '2rem' }}>
        <form onSubmit={handleSearch} style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
          <input
            type="text"
            placeholder="Search mentors by name or expertise..."
            value={searchParams.search}
            onChange={(e) => setSearchParams({ ...searchParams, search: e.target.value })}
            style={{ flex: '1 1 300px', padding: '0.75rem', borderRadius: '4px', border: '1px solid var(--border-subtle)', background: 'rgba(0,0,0,0.2)', color: 'white' }}
          />
          <input
            type="number"
            placeholder="Min Fee ($)"
            value={searchParams.minFee}
            onChange={(e) => setSearchParams({ ...searchParams, minFee: e.target.value })}
            style={{ width: '120px', padding: '0.75rem', borderRadius: '4px', border: '1px solid var(--border-subtle)', background: 'rgba(0,0,0,0.2)', color: 'white' }}
          />
          <input
            type="number"
            placeholder="Max Fee ($)"
            value={searchParams.maxFee}
            onChange={(e) => setSearchParams({ ...searchParams, maxFee: e.target.value })}
            style={{ width: '120px', padding: '0.75rem', borderRadius: '4px', border: '1px solid var(--border-subtle)', background: 'rgba(0,0,0,0.2)', color: 'white' }}
          />
          <button type="submit" className="btn btn-primary" style={{ padding: '0.75rem 1.5rem' }}>Search</button>
          {(searchParams.search || searchParams.minFee || searchParams.maxFee) && (
            <button 
              type="button" 
              onClick={handleClear} 
              style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: '0.75rem' }}
            >
              Clear
            </button>
          )}
        </form>
      </div>

      {loading ? (
        <div>Loading mentors...</div>
      ) : error ? (
        <div style={{ color: '#ef4444' }}>{error}</div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1.5rem' }}>
          {mentors.length === 0 ? (
            <div className="glass-card" style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '3rem' }}>
              <p style={{ color: 'var(--text-secondary)' }}>No mentors found matching your search.</p>
            </div>
          ) : (
            mentors.map(mentor => (
              <div key={mentor.id} className="glass-card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                  <div>
                    <h3 style={{ margin: '0 0 0.25rem 0', color: 'var(--text-primary)', fontSize: '1.1rem' }}>{mentor.user?.name}</h3>
                    <div style={{ color: 'var(--accent-primary)', fontSize: '0.85rem', fontWeight: 600 }}>{mentor.expertise || 'General Mentor'}</div>
                  </div>
                  <span style={{ fontSize: '0.75rem', padding: '0.2rem 0.5rem', borderRadius: '12px', background: 'rgba(16, 185, 129, 0.1)', color: '#10b981' }}>
                    Available
                  </span>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
                  {mentor.topics?.map(t => (
                    <span key={t.topicId} style={{ background: 'rgba(255,255,255,0.1)', padding: '0.2rem 0.6rem', borderRadius: '12px', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                      {t.topic?.name}
                    </span>
                  ))}
                </div>

                {mentor.bio && (
                  <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '1rem', flex: 1, display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                    {mentor.bio}
                  </p>
                )}

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '1.5rem' }}>
                  {mentor.experience && <div><strong>Industry:</strong> {mentor.experience} yrs</div>}
                  {mentor.teachingExperience && <div><strong>Teaching:</strong> {mentor.teachingExperience} yrs</div>}
                  {mentor.language && <div><strong>Lang:</strong> {mentor.language}</div>}
                  {mentor.sessionFee != null && <div style={{ color: 'var(--accent-primary)', fontWeight: 'bold' }}>Fee: ${mentor.sessionFee}/hr</div>}
                </div>

                <div style={{ display: 'flex', gap: '0.75rem', marginTop: 'auto' }}>
                  <Link to={`/student/mentor/${mentor.id}`} className="btn btn-primary" style={{ flex: 1, textAlign: 'center', padding: '0.5rem' }}>
                    View Profile
                  </Link>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
