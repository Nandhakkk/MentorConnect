import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Landing() {
  const { user, loading } = useAuth();

  if (loading) return null;

  // Redirect authenticated users
  if (user) {
    if (user.role === 'ADMIN') return <Navigate to="/admin/dashboard" replace />;
    if (user.role === 'GUARDIAN') return <Navigate to="/guardian/dashboard" replace />;
    if (user.role === 'MENTOR') return <Navigate to="/mentor/dashboard" replace />;
    if (user.role === 'STUDENT') {
      if (!user.studentProfile) return <Navigate to="/student/onboarding" replace />;
      return <Navigate to="/student/dashboard" replace />;
    }
  }

  return (
    <div className="landing-page">
      <nav className="app-header" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
        <div className="sidebar-brand">
          <div className="brand-mark">M</div>
          <span>MentorConnect</span>
        </div>
        <div className="header-actions">
          <Link to="/login" className="btn btn-text">Login</Link>
          <Link to="/register" className="btn btn-primary">Get Started</Link>
        </div>
      </nav>

      <main>
        <section className="landing-hero">
          <div className="landing-hero-content">
            <h1>Learn with the right mentor.<br/>Grow toward your goals.</h1>
            <p>Connect with professional mentors and experienced peers to accelerate your learning journey with personalized guidance and structured assignments.</p>
            <div className="landing-actions">
              <Link to="/register" className="btn btn-primary">Create Account</Link>
              <Link to="/login" className="btn btn-secondary">Login to Platform</Link>
            </div>
          </div>
        </section>

        <section className="landing-section">
          <h2 className="landing-section-title">Why MentorConnect</h2>
          <div className="features-grid">
            <div className="feature-card">
              <div className="feature-icon">🎯</div>
              <h3>Goal-Based Mentoring</h3>
              <p>Define your career or learning goals and let us match you with the perfect mentor to help you get there.</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">🤖</div>
              <h3>AI Recommendations</h3>
              <p>Our intelligent system analyzes your profile, skills, and goals to suggest the most relevant mentors.</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">📹</div>
              <h3>Live Sessions</h3>
              <p>Book and attend live 1-on-1 video mentoring sessions integrated seamlessly into the platform.</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">📝</div>
              <h3>Structured Assignments</h3>
              <p>Mentors can provide file-based assignments, and you can submit your work for actionable feedback.</p>
            </div>
          </div>
        </section>

        <section className="landing-section" style={{ background: '#f9fafb', borderRadius: '1rem' }}>
          <h2 className="landing-section-title">Mentorship Designed for You</h2>
          <div className="features-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))' }}>
            <div className="feature-card" style={{ background: '#fff' }}>
              <div className="feature-icon">👨‍🏫</div>
              <h3>Professional Mentors</h3>
              <p>Experienced and verified industry professionals who provide structured, high-level guidance for your career and advanced technical skills.</p>
            </div>
            <div className="feature-card" style={{ background: '#fff' }}>
              <div className="feature-icon">🎓</div>
              <h3>Peer Mentors</h3>
              <p>Approved learners with demonstrated experience who offer relatable, practical help and study support based on their recent successes.</p>
            </div>
          </div>
        </section>
      </main>

      <footer className="landing-footer">
        <div className="sidebar-brand" style={{ color: '#fff', justifyContent: 'center', marginBottom: '1.5rem' }}>
          <div className="brand-mark">M</div>
          <span>MentorConnect</span>
        </div>
        <p style={{ color: '#9ca3af', marginBottom: '1.5rem' }}>Empowering learners through structured, safe, and professional mentorship.</p>
        <div style={{ display: 'flex', justifyContent: 'center', gap: '2rem' }}>
          <Link to="/login" style={{ color: '#fff', textDecoration: 'none' }}>Login</Link>
          <Link to="/register" style={{ color: '#fff', textDecoration: 'none' }}>Register</Link>
        </div>
      </footer>
    </div>
  );
}
