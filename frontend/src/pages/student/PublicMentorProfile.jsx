import { formatCurrency } from '../../utils/currency';
import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { fetchMentorById, createMentorship } from '../../services/mentorService';
import { getMentorReviews } from '../../services/reviewService';
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
  const [mentorStats, setMentorStats] = useState({ averageRating: 0, reviewCount: 0, recentReviews: [] });

  useEffect(() => {
    const loadMentor = async () => {
      try {
        setLoading(true);
        const data = await fetchMentorById(id);
        setMentor(data);

        // Fetch reviews
        try {
          const stats = await getMentorReviews(data.id);
          setMentorStats(stats);
        } catch (e) {
          console.error("Failed to fetch reviews", e);
        }
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
  if (!mentor) return <div className="page-content" style={{ color: 'var(--error)' }}>{error || 'Mentor not found.'}</div>;

  const portfolio = mentor.portfolio;
  const isProfessional = mentor.mentorType === 'PROFESSIONAL';

  return (
    <div className="page-content">
      <BackLink to="/student/mentor">Back to Find Mentors</BackLink>
      <PageHeader
        title={portfolio?.headline || `${mentor.user?.name}'s Profile`}
        subtitle="Explore verified credentials, mentoring philosophy, and experience."
        crumbs={[
          { label: 'Dashboard', to: '/student/dashboard' },
          { label: 'Find mentors', to: '/student/mentor' },
          { label: mentor.user?.name || 'Mentor' }
        ]}
      />

      {/* Main Portfolio Card */}
      <div className="glass-card" style={{ padding: '2.5rem', marginBottom: '2rem' }}>

        {/* Top Header Section */}
        <div style={{ display: 'flex', gap: '2rem', alignItems: 'center', marginBottom: '2rem', flexWrap: 'wrap' }}>
          <div style={{
            width: '100px', height: '100px', borderRadius: '50%', background: 'linear-gradient(135deg, #6366f1 0%, #a855f7 100%)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '2.5rem', color: 'white', fontWeight: 'bold',
            overflow: 'hidden', flexShrink: 0, boxShadow: '0 8px 24px rgba(99, 102, 241, 0.3)'
          }}>
            {mentor.user?.profileImage ? (
              <img src={mentor.user.profileImage} alt={mentor.user?.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : (
              mentor.user?.name?.charAt(0).toUpperCase() || 'M'
            )}
          </div>

          <div style={{ flex: 1, minWidth: '260px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '0.35rem' }}>
              <h2 style={{ margin: 0, fontSize: '1.9rem', color: 'var(--text-primary)' }}>{mentor.user?.name}</h2>
              {mentor.isVerified && (
                <span className="badge badge-success" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.85rem' }}>
                  ✓ Verified {isProfessional ? 'Professional' : 'Peer'} Mentor
                </span>
              )}
            </div>

            <div style={{ color: 'var(--accent-primary)', fontSize: '1.15rem', fontWeight: 600, marginBottom: '0.5rem' }}>
              {portfolio?.headline || mentor.expertise || 'Expert Mentor'}
            </div>

            {/* Rating Stars & Reviews */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
              {mentorStats.reviewCount > 0 ? (
                <>
                  <span style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: '1rem' }}>
                    {Number(mentorStats.averageRating || 0).toFixed(1)}
                  </span>
                  <div style={{ position: 'relative', color: 'var(--border-subtle)', display: 'inline-block', fontSize: '1.1rem', letterSpacing: '2px' }}>
                    ★★★★★
                    <div style={{ position: 'absolute', top: 0, left: 0, overflow: 'hidden', whiteSpace: 'nowrap', width: `${Math.max(0, Math.min(100, (Number(mentorStats.averageRating) || 0) * 20))}%`, color: 'var(--warning)' }}>
                      ★★★★★
                    </div>
                  </div>
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                    ({mentorStats.reviewCount} {mentorStats.reviewCount === 1 ? 'review' : 'reviews'})
                  </span>
                </>
              ) : (
                <span style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>New Mentor • No reviews yet</span>
              )}

              <span style={{ color: 'var(--text-muted)', margin: '0 0.25rem' }}>•</span>
              <span style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                {mentor.experience ? `${mentor.experience} yrs industry experience` : ''}
              </span>
              {mentor.teachingExperience && (
                <>
                  <span style={{ color: 'var(--text-muted)', margin: '0 0.25rem' }}>•</span>
                  <span style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                    {mentor.teachingExperience} yrs teaching
                  </span>
                </>
              )}
            </div>
          </div>

          {/* Quick Action Box */}
          <div style={{ padding: '1.25rem 1.75rem', background: 'var(--bg-surface-elevated)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)', textAlign: 'right', minWidth: '180px' }}>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Session Fee</div>
            <div style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--text-primary)', margin: '0.25rem 0 0.75rem 0' }}>
              {mentor.sessionFee != null ? `${formatCurrency(mentor.sessionFee)}/hr` : 'Free'}
            </div>
            <button
              onClick={handleStartMentorship}
              disabled={!mentor.isAvailable || requesting || success}
              className="btn btn-primary"
              style={{ width: '100%', padding: '0.6rem 1rem', fontSize: '0.9rem' }}
            >
              {requesting ? 'Connecting...' : success ? 'Connected!' : 'Start Mentorship'}
            </button>
          </div>
        </div>

        {/* Introduction */}
        {portfolio?.introduction && (
          <div style={{ padding: '1.25rem', background: 'var(--info-bg)', borderRadius: 'var(--radius-md)', borderLeft: '4px solid var(--accent-primary)', marginBottom: '2rem' }}>
            <p style={{ margin: 0, color: 'var(--text-primary)', fontSize: '1.05rem', lineHeight: 1.6, fontStyle: 'italic' }}>
              "{portfolio.introduction}"
            </p>
          </div>
        )}

        {/* Topics & Expertise Tags */}
        <div style={{ marginBottom: '2rem' }}>
          <h3 style={{ fontSize: '1.05rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', marginBottom: '0.75rem' }}>
            Topics & Areas of Guidance
          </h3>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            {mentor.topics?.map(t => (
              <span key={t.topicId} style={{ background: 'var(--purple-bg)', border: '1px solid var(--border-subtle)', padding: '0.35rem 0.9rem', borderRadius: '16px', fontSize: '0.85rem', color: 'var(--purple)', fontWeight: 500 }}>
                {t.topic?.name}
              </span>
            ))}
            {portfolio?.skills?.map((s, idx) => (
              <span key={`s-${idx}`} style={{ background: 'var(--bg-surface-elevated)', border: '1px solid var(--border-subtle)', padding: '0.35rem 0.9rem', borderRadius: '16px', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                {s}
              </span>
            ))}
          </div>
        </div>

        {/* About Narrative */}
        {(portfolio?.about || mentor.bio) && (
          <div style={{ marginBottom: '2rem' }}>
            <h3 style={{ fontSize: '1.2rem', marginBottom: '0.75rem', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '0.5rem', color: 'var(--text-primary)' }}>
              About Me
            </h3>
            <p style={{ color: 'var(--text-secondary)', lineHeight: 1.7, fontSize: '0.95rem', whiteSpace: 'pre-line' }}>
              {portfolio?.about || mentor.bio}
            </p>
          </div>
        )}

        {/* Teaching & Mentoring Approach */}
        {portfolio && (portfolio.teachingApproach || portfolio.mentoringApproach) && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
            {portfolio.teachingApproach && (
              <div style={{ padding: '1.25rem', background: 'var(--bg-surface-elevated)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
                <h4 style={{ margin: '0 0 0.5rem 0', color: 'var(--info)', fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span>🎯</span> Teaching Methodology
                </h4>
                <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: 1.6 }}>
                  {portfolio.teachingApproach}
                </p>
              </div>
            )}

            {portfolio.mentoringApproach && (
              <div style={{ padding: '1.25rem', background: 'var(--bg-surface-elevated)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
                <h4 style={{ margin: '0 0 0.5rem 0', color: 'var(--success)', fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span>🌱</span> Mentoring Philosophy
                </h4>
                <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: 1.6 }}>
                  {portfolio.mentoringApproach}
                </p>
              </div>
            )}
          </div>
        )}

        {/* Experience & Track Record */}
        {portfolio && (portfolio.experienceSummary || portfolio.teachingSummary) && (
          <div style={{ marginBottom: '2rem' }}>
            <h3 style={{ fontSize: '1.2rem', marginBottom: '0.75rem', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '0.5rem', color: 'var(--text-primary)' }}>
              Professional Background & Track Record
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.5rem' }}>
              {portfolio.experienceSummary && (
                <div>
                  <strong style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', display: 'block', marginBottom: '0.25rem' }}>Industry Experience</strong>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', lineHeight: 1.6, margin: 0 }}>
                    {portfolio.experienceSummary}
                  </p>
                </div>
              )}
              {portfolio.teachingSummary && (
                <div>
                  <strong style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', display: 'block', marginBottom: '0.25rem' }}>Teaching & Mentoring</strong>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', lineHeight: 1.6, margin: 0 }}>
                    {portfolio.teachingSummary}
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Verified Credentials Section */}
        {((portfolio?.certifications && portfolio.certifications.length > 0) || (mentor.credentials && mentor.credentials.length > 0)) && (
          <div style={{ marginBottom: '2rem' }}>
            <h3 style={{ fontSize: '1.2rem', marginBottom: '0.75rem', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '0.5rem', color: 'var(--text-primary)' }}>
              Verified Credentials & Certifications
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '1rem' }}>
              {(portfolio?.certifications || mentor.credentials || []).map((c, i) => (
                <div key={i} style={{ padding: '1rem', background: 'var(--bg-surface-elevated)', borderRadius: 'var(--radius-sm)', borderLeft: '3px solid var(--success)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{ color: 'var(--success)', fontSize: '0.9rem' }}>✓</span>
                    <strong style={{ color: 'var(--text-primary)', fontSize: '0.95rem' }}>{c.title}</strong>
                  </div>
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '0.25rem', paddingLeft: '1.2rem' }}>
                    {c.issuer || c.issuingOrganization || ''} {c.year ? `• ${c.year}` : ''}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Education & Achievements */}
        {portfolio && ((portfolio.education && portfolio.education.length > 0) || (portfolio.achievements && portfolio.achievements.length > 0)) && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
            {portfolio.education && portfolio.education.length > 0 && (
              <div>
                <h4 style={{ fontSize: '1.05rem', marginBottom: '0.5rem', color: 'var(--text-primary)' }}>Education</h4>
                <ul style={{ paddingLeft: '1.2rem', margin: 0, color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                  {portfolio.education.map((edu, idx) => (
                    <li key={idx} style={{ marginBottom: '0.35rem' }}>
                      <strong>{edu.degree}</strong> {edu.institution ? `— ${edu.institution}` : ''}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {portfolio.achievements && portfolio.achievements.length > 0 && (
              <div>
                <h4 style={{ fontSize: '1.05rem', marginBottom: '0.5rem', color: 'var(--text-primary)' }}>Achievements</h4>
                <ul style={{ paddingLeft: '1.2rem', margin: 0, color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                  {portfolio.achievements.map((ach, idx) => (
                    <li key={idx} style={{ marginBottom: '0.35rem' }}>{ach}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {/* Availability */}
        {mentor.availabilities && mentor.availabilities.length > 0 && (
          <div style={{ marginBottom: '2rem' }}>
            <h3 style={{ fontSize: '1.2rem', marginBottom: '0.75rem', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '0.5rem', color: 'var(--text-primary)' }}>
              Weekly Availability
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '0.75rem' }}>
              {mentor.availabilities.map(a => (
                <div key={a.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.75rem 1rem', background: 'var(--bg-surface-elevated)', borderRadius: '6px', border: '1px solid var(--border-subtle)' }}>
                  <span style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>{a.dayOfWeek}</span>
                  <span style={{ fontFamily: 'monospace', color: 'var(--text-primary)' }}>{a.startTime} - {a.endTime}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Reviews */}
        {mentorStats.recentReviews && mentorStats.recentReviews.length > 0 && (
          <div style={{ marginBottom: '2.5rem' }}>
            <h3 style={{ fontSize: '1.2rem', marginBottom: '1rem', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '0.5rem', color: 'var(--text-primary)' }}>
              Student Reviews ({mentorStats.reviewCount})
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {mentorStats.recentReviews.map(r => (
                <div key={r.id} style={{ padding: '1rem 1.25rem', background: 'var(--bg-surface-elevated)', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
                    <span style={{ color: 'var(--warning)', letterSpacing: '1px' }}>{'★'.repeat(r.rating)}{'☆'.repeat(5-r.rating)}</span>
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>{new Date(r.createdAt).toLocaleDateString()}</span>
                  </div>
                  {r.comment && <p style={{ margin: '0 0 0.5rem 0', color: 'var(--text-primary)', fontSize: '0.9rem', fontStyle: 'italic' }}>"{r.comment}"</p>}
                  <div style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>— Student Mentee</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Action Button */}
        {success && <div style={{ color: 'var(--success)', marginBottom: '1rem', fontWeight: 'bold' }}>{success}</div>}
        {error && <div style={{ color: 'var(--error)', marginBottom: '1rem' }}>{error}</div>}

        <div style={{ textAlign: 'center', paddingTop: '1.5rem', borderTop: '1px solid var(--border-subtle)' }}>
          <button
            onClick={handleStartMentorship}
            disabled={!mentor.isAvailable || requesting || success}
            className="btn btn-primary"
            style={{ padding: '0.85rem 3rem', fontSize: '1.05rem', minWidth: '240px' }}
          >
            {requesting ? 'Connecting...' : success ? 'Mentorship Active!' : 'Book Session with Mentor'}
          </button>
        </div>

      </div>
    </div>
  );
}
