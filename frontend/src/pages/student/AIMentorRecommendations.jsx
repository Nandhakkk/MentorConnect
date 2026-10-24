import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { getMentorRecommendations } from '../../services/aiService';
import BackLink from '../../components/BackLink';
import PageHeader from '../../components/PageHeader';

export default function AIMentorRecommendations() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);

  const fetchRecommendations = async () => {
    try {
      setLoading(true);
      setError('');
      setResult(null);
      
      const data = await getMentorRecommendations();
      setResult(data);
    } catch (err) {
      setError(err.message || 'Failed to fetch recommendations.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page-content">
      <BackLink to="/student/dashboard">Back to Dashboard</BackLink>
      <PageHeader 
        title="AI Mentor Recommendations" 
        subtitle="Discover mentors tailored to your specific goals, experience, and budget constraints." 
        crumbs={[
          { label: 'Dashboard', to: '/student/dashboard' },
          { label: 'AI Mentors' }
        ]} 
      />

      <div className="glass-card" style={{ marginBottom: '2rem', padding: '2rem', textAlign: 'center' }}>
        <div style={{
          width: '64px', height: '64px', borderRadius: '16px',
          background: 'linear-gradient(135deg, #a855f7 0%, #6366f1 100%)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          margin: '0 auto 1.5rem', color: 'white'
        }}>
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
          </svg>
        </div>
        <h2 style={{ margin: '0 0 1rem', color: 'var(--text-primary)' }}>Find Your Ideal Mentor</h2>
        <p style={{ color: 'var(--text-secondary)', maxWidth: '600px', margin: '0 auto 2rem', lineHeight: 1.6 }}>
          Our AI analyzes your active goals, budget, skills, and learning style to find the perfect professional mentors for you from our pool of approved experts.
        </p>

        {error && (
          <div style={{ color: 'var(--error)', marginBottom: '1.5rem', padding: '1rem', background: 'var(--error-subtle)', border: '1px solid var(--error)', borderRadius: '8px' }}>
            {error}
          </div>
        )}

        <button 
          onClick={fetchRecommendations} 
          disabled={loading} 
          className="btn btn-primary" 
          style={{ padding: '0.75rem 2.5rem', fontSize: '1.1rem' }}
        >
          {loading ? 'Analyzing Mentors...' : 'Generate AI Recommendations'}
        </button>
      </div>

      {result && result.recommendations && result.recommendations.length === 0 && (
        <div className="glass-card" style={{ padding: '2rem', textAlign: 'center' }}>
          <p style={{ color: 'var(--text-secondary)' }}>
            {result.message || 'No suitable mentors found matching your criteria.'}
          </p>
          <Link to="/student/mentor" className="btn btn-secondary" style={{ marginTop: '1rem' }}>
            Browse Mentors Manually
          </Link>
        </div>
      )}

      {result && result.recommendations && result.recommendations.length > 0 && (
        <div>
          <h3 style={{ marginBottom: '1.5rem' }}>Top Matches</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            {result.recommendations.map((rec, i) => {
              const mentor = result.candidates.find(m => m.id === rec.mentorId);
              if (!mentor) return null;

              return (
                <div key={i} className="glass-card" style={{ padding: '2rem', display: 'flex', gap: '2rem', flexWrap: 'wrap' }}>
                  
                  {/* Left Column: AI Recommendation Details */}
                  <div style={{ flex: '1 1 300px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
                      <div style={{ 
                        padding: '0.25rem 0.75rem', 
                        borderRadius: '16px', 
                        fontSize: '0.85rem', 
                        fontWeight: 'bold',
                        background: rec.compatibility === 'HIGH' ? 'var(--success-subtle)' : 'var(--warning-subtle)',
                        color: rec.compatibility === 'HIGH' ? 'var(--success)' : 'var(--warning)',
                        border: `1px solid ${rec.compatibility === 'HIGH' ? 'var(--success)' : 'var(--warning)'}`
                      }}>
                        {rec.compatibility} MATCH
                      </div>
                    </div>

                    <h4 style={{ margin: '0 0 0.75rem', color: 'var(--text-primary)' }}>Why this mentor?</h4>
                    <ul style={{ margin: 0, padding: '0 0 0 1.2rem', color: 'var(--text-secondary)', fontSize: '0.95rem' }}>
                      {rec.reasons?.map((r, idx) => (
                        <li key={idx} style={{ marginBottom: '0.5rem' }}>{r}</li>
                      ))}
                    </ul>

                    {rec.considerations && rec.considerations.length > 0 && (
                      <div style={{ marginTop: '1.5rem' }}>
                        <h4 style={{ margin: '0 0 0.5rem', color: 'var(--text-primary)', fontSize: '0.9rem' }}>Considerations:</h4>
                        <ul style={{ margin: 0, padding: '0 0 0 1.2rem', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                          {rec.considerations.map((c, idx) => (
                            <li key={idx}>{c}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>

                  {/* Right Column: Mentor Profile Summary */}
                  <div style={{ flex: '1 1 300px', background: 'var(--bg-surface-elevated)', border: '1px solid var(--border-subtle)', padding: '1.5rem', borderRadius: '12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
                      <div style={{ 
                        width: '50px', height: '50px', borderRadius: '50%', background: 'linear-gradient(135deg, #6366f1 0%, #a855f7 100%)', 
                        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.25rem', color: 'white', fontWeight: 'bold' 
                      }}>
                        {mentor.user.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <h3 style={{ margin: 0, fontSize: '1.25rem', color: 'var(--text-primary)' }}>{mentor.user.name}</h3>
                        <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>{mentor.expertise}</div>
                        <div style={{ marginTop: '0.25rem', fontSize: '0.85rem', color: 'var(--warning)' }}>
                          {mentor.reviewCount > 0 ? (
                            <>★ {mentor.averageRating} <span style={{ color: 'var(--text-muted)' }}>({mentor.reviewCount} reviews)</span></>
                          ) : (
                            <span style={{ color: 'var(--text-muted)' }}>No ratings yet</span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
                      {mentor.topics?.slice(0, 3).map((t, idx) => (
                        <span key={idx} style={{ background: 'var(--purple-subtle)', padding: '0.2rem 0.6rem', borderRadius: '12px', fontSize: '0.75rem', color: 'var(--purple)' }}>
                          {t.topic?.name}
                        </span>
                      ))}
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem', fontSize: '0.9rem' }}>
                      <div>
                        <span style={{ color: 'var(--text-muted)' }}>Experience:</span> <span style={{ color: 'var(--text-primary)' }}>{mentor.experience} yrs</span>
                      </div>
                      <div>
                        <span style={{ color: 'var(--text-muted)' }}>Fee:</span> <span style={{ color: 'var(--text-primary)' }}>${mentor.sessionFee}/hr</span>
                      </div>
                      <div>
                        <span style={{ color: 'var(--text-muted)' }}>Language:</span> <span style={{ color: 'var(--text-primary)' }}>{mentor.language || 'Any'}</span>
                      </div>
                    </div>

                    <Link to={`/student/mentors/${mentor.id}`} className="btn btn-primary" style={{ width: '100%', textAlign: 'center', padding: '0.5rem' }}>
                      View Mentor Profile
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
