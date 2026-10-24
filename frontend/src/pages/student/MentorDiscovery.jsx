import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { fetchAvailableMentors } from '../../services/mentorService';
import { formatCurrency } from '../../utils/currency';

export default function MentorDiscovery() {
  const [mentors, setMentors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchParams, setSearchParams] = useState({ search: '', minFee: '', maxFee: '', mentorType: '' });

  const loadMentors = async (params = searchParams) => {
    try {
      setLoading(true);
      const data = await fetchAvailableMentors(params);

      let filtered = data;
      if (params.search) {
        const term = params.search.toLowerCase();
        filtered = filtered.filter(m =>
          m.user?.name?.toLowerCase().includes(term) ||
          m.expertise?.toLowerCase().includes(term) ||
          m.bio?.toLowerCase().includes(term)
        );
      }
      if (params.mentorType) {
        filtered = filtered.filter(m => m.mentorType === params.mentorType);
      }
      if (params.minFee) {
        filtered = filtered.filter(m => (m.sessionFee || 0) >= Number(params.minFee));
      }
      if (params.maxFee) {
        filtered = filtered.filter(m => (m.sessionFee || 0) <= Number(params.maxFee));
      }

      setMentors(filtered);
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
    const cleared = { search: '', minFee: '', maxFee: '', mentorType: '' };
    setSearchParams(cleared);
    loadMentors(cleared);
  };

  const getMentorTypeBadge = (mentorType) => {
    if (mentorType === 'PEER') {
      return { label: 'Peer Mentor', bg: 'var(--purple-bg)', color: 'var(--purple)', border: '1px solid var(--border-subtle)' };
    }
    return { label: 'Professional', bg: 'var(--success-bg)', color: 'var(--success)', border: '1px solid var(--border-subtle)' };
  };

  return (
    <div className="page-content">
      <div className="page-header">
        <div>
          <h2 className="page-title">Find a Mentor</h2>
          <p className="page-subtitle">Discover approved mentors to guide your journey — professional experts and peer mentors.</p>
        </div>
      </div>

      {/* AI Recommendations Banner */}
      <div className="glass-card" style={{ padding: '1.5rem', marginBottom: '2rem', background: 'var(--info-bg)', border: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h3 style={{ margin: '0 0 0.5rem 0', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            ✨ Let AI Find Your Perfect Match
          </h3>
          <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.95rem' }}>
            Don't want to search? Our AI can analyze your goals, budget, and experience to recommend the best mentors for you.
          </p>
        </div>
        <Link to="/student/ai-mentors" className="btn btn-primary" style={{ padding: '0.75rem 1.5rem' }}>
          Get AI Recommendations
        </Link>
      </div>

      <div className="glass-card" style={{ padding: '1.5rem', marginBottom: '2rem' }}>
        <form onSubmit={handleSearch} style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <input
            type="text"
            className="form-input"
            placeholder="Search mentors by name or expertise..."
            value={searchParams.search}
            onChange={(e) => setSearchParams({ ...searchParams, search: e.target.value })}
            style={{ flex: '1 1 300px' }}
          />
          <select
            className="form-input"
            value={searchParams.mentorType}
            onChange={(e) => setSearchParams({ ...searchParams, mentorType: e.target.value })}
            style={{ minWidth: '150px' }}
          >
            <option value="">All Types</option>
            <option value="PROFESSIONAL">Professional</option>
            <option value="PEER">Peer Mentor</option>
          </select>
          <input
            type="number"
            className="form-input"
            placeholder="Min Fee (₹)"
            value={searchParams.minFee}
            onChange={(e) => setSearchParams({ ...searchParams, minFee: e.target.value })}
            style={{ width: '120px' }}
          />
          <input
            type="number"
            className="form-input"
            placeholder="Max Fee (₹)"
            value={searchParams.maxFee}
            onChange={(e) => setSearchParams({ ...searchParams, maxFee: e.target.value })}
            style={{ width: '120px' }}
          />
          <button type="submit" className="btn btn-primary" style={{ padding: '0.75rem 1.5rem' }}>Search</button>
          {(searchParams.search || searchParams.minFee || searchParams.maxFee || searchParams.mentorType) && (
            <button
              type="button"
              className="btn btn-secondary"
              onClick={handleClear}
              style={{ padding: '0.75rem 1.25rem' }}
            >
              Clear
            </button>
          )}
        </form>
      </div>

      {loading ? (
        <div>Loading mentors...</div>
      ) : error ? (
        <div style={{ color: 'var(--error)' }}>{error}</div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1.5rem' }}>
          {mentors.length === 0 ? (
            <div className="glass-card" style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '3rem' }}>
              <p style={{ color: 'var(--text-secondary)' }}>No mentors found matching your search.</p>
            </div>
          ) : (
            mentors.map(mentor => {
              const badge = getMentorTypeBadge(mentor.mentorType);
              return (
                <div key={mentor.id} className="glass-card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column' }}>
                  <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start', marginBottom: '1rem' }}>
                    <div style={{ width: '50px', height: '50px', borderRadius: '50%', background: 'var(--accent-primary)', color: 'white', display: 'grid', placeItems: 'center', fontSize: '1.25rem', fontWeight: 'bold', flexShrink: 0, overflow: 'hidden' }}>
                      {mentor.user?.profileImage ? (
                        <img src={mentor.user.profileImage} alt={mentor.user?.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      ) : (
                        mentor.user?.name?.charAt(0).toUpperCase() || 'M'
                      )}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
                            <h3 style={{ margin: '0 0 0.15rem 0', color: 'var(--text-primary)', fontSize: '1.1rem' }}>{mentor.user?.name}</h3>
                            {mentor.isVerified && (
                              <span style={{ color: 'var(--success)', fontSize: '0.8rem', fontWeight: 600 }}>✓ Verified</span>
                            )}
                          </div>
                          <div style={{ color: 'var(--accent-primary)', fontSize: '0.85rem', fontWeight: 600 }}>
                            {mentor.portfolio?.headline || mentor.expertise || 'General Mentor'}
                          </div>
                        </div>
                        <span style={{
                          fontSize: '0.75rem', padding: '0.2rem 0.5rem', borderRadius: '12px',
                          background: badge.bg, color: badge.color, border: badge.border, fontWeight: 600
                        }}>
                          {badge.label}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
                    {mentor.topics?.map(t => (
                      <span key={t.topicId} style={{ background: 'var(--bg-surface-elevated)', border: '1px solid var(--border-subtle)', padding: '0.2rem 0.6rem', borderRadius: '12px', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                        {t.topic?.name}
                      </span>
                    ))}
                  </div>

                  {(mentor.portfolio?.introduction || mentor.bio) && (
                    <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '1rem', flex: 1, display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                      {mentor.portfolio?.introduction || mentor.bio}
                    </p>
                  )}

                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
                    {mentor.reviewCount > 0 ? (
                      <>
                        <span style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.9rem' }}>
                          {Number(mentor.averageRating || 0).toFixed(1)} / 5
                        </span>
                        <div style={{ position: 'relative', color: 'var(--border-subtle)', display: 'inline-block', fontSize: '1rem', letterSpacing: '2px' }}>
                          ★★★★★
                          <div style={{ position: 'absolute', top: 0, left: 0, overflow: 'hidden', whiteSpace: 'nowrap', width: `${Math.max(0, Math.min(100, (Number(mentor.averageRating) || 0) * 20))}%`, color: 'var(--warning)' }}>
                            ★★★★★
                          </div>
                        </div>
                        <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>({mentor.reviewCount} {mentor.reviewCount === 1 ? 'review' : 'reviews'})</span>
                      </>
                    ) : (
                      <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>No reviews yet</span>
                    )}
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '1.5rem' }}>
                    {mentor.experience && <div><strong>Industry:</strong> {mentor.experience} yrs</div>}
                    {mentor.teachingExperience && <div><strong>Teaching:</strong> {mentor.teachingExperience} yrs</div>}
                    {mentor.language && <div><strong>Lang:</strong> {mentor.language}</div>}
                    {mentor.sessionFee != null && <div style={{ color: 'var(--accent-primary)', fontWeight: 'bold' }}>Fee: {formatCurrency(mentor.sessionFee)}/hr</div>}
                  </div>

                  <div style={{ display: 'flex', gap: '0.75rem', marginTop: 'auto' }}>
                    <Link to={`/student/mentor/${mentor.id}`} className="btn btn-primary" style={{ flex: 1, textAlign: 'center', padding: '0.5rem' }}>
                      View Portfolio
                    </Link>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
