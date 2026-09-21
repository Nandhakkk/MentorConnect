import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { fetchAvailableMentors } from '../../services/mentorService';

export default function MentorDiscovery() {
  const [mentors, setMentors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');

  const loadMentors = async (query = '') => {
    try {
      setLoading(true);
      const data = await fetchAvailableMentors(query);
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
    loadMentors(search);
  };

  return (
    <div className="page-content">
      <div className="page-header">
        <div>
          <h2 className="page-title">Find a Mentor</h2>
          <p className="page-subtitle">Search for mentors by name or expertise to guide your journey.</p>
        </div>
      </div>

      <div className="glass-card" style={{ padding: '1.5rem', marginBottom: '2rem' }}>
        <form onSubmit={handleSearch} style={{ display: 'flex', gap: '1rem' }}>
          <input
            type="text"
            placeholder="Search mentors by name or expertise..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ flex: 1, padding: '0.75rem', borderRadius: '4px', border: '1px solid var(--border-subtle)', background: 'rgba(0,0,0,0.2)', color: 'white' }}
          />
          <button type="submit" className="btn btn-primary" style={{ padding: '0.75rem 1.5rem' }}>Search</button>
          {search && (
            <button 
              type="button" 
              onClick={() => { setSearch(''); loadMentors(''); }} 
              style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}
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
                
                {mentor.bio && (
                  <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '1rem', flex: 1, display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                    {mentor.bio}
                  </p>
                )}

                <div style={{ display: 'flex', gap: '1rem', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '1.5rem' }}>
                  {mentor.experience && <span>Experience: {mentor.experience} yrs</span>}
                  {mentor.hourlyRate && <span>Rate: ${mentor.hourlyRate}/hr</span>}
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
