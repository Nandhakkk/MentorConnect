import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getDashboardForRole } from '../components/RoleRoute';

export default function Register() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [role, setRole] = useState('STUDENT'); // 'STUDENT' or 'MENTOR'
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const { register } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!name.trim() || !email.trim() || !password) {
      setError('Please fill in all fields.');
      return;
    }

    if (role === 'STUDENT' && !dateOfBirth) {
      setError('Date of birth is required for students.');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters long.');
      return;
    }

    setSubmitting(true);
    try {
      const regUser = await register(name, email, password, role, dateOfBirth || undefined);
      navigate(getDashboardForRole(regUser.role));
    } catch (err) {
      setError(err.message || 'Registration failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="auth-page-wrapper">
    <div style={{ maxWidth: '480px', margin: '3rem auto', width: '100%' }}>
      <div className="glass-card" style={{ padding: '2.5rem' }}>
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div style={{
            width: '44px',
            height: '44px',
            borderRadius: '12px',
            background: 'linear-gradient(135deg, #6366f1 0%, #a855f7 100%)',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: '0.75rem',
            boxShadow: '0 4px 16px rgba(99, 102, 241, 0.4)'
          }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
              <circle cx="8.5" cy="7" r="4"/>
              <line x1="20" y1="8" x2="20" y2="14"/>
              <line x1="23" y1="11" x2="17" y2="11"/>
            </svg>
          </div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 800, marginBottom: '0.25rem' }}>Join MentorConnect</h1>
          <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
            Create an account to start your mentoring journey
          </p>
        </div>

        {error && (
          <div style={{
            backgroundColor: 'var(--error-bg)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            borderRadius: 'var(--radius-md)',
            padding: '0.75rem 1rem',
            marginBottom: '1.5rem',
            color: 'var(--error)',
            fontSize: '0.875rem'
          }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.5rem', color: 'var(--text-primary)' }}>
              Full Name
            </label>
            <input
              type="text"
              className="form-input"
              placeholder="e.g. Alex Morgan"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              disabled={submitting}
              id="register-name"
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.5rem', color: 'var(--text-primary)' }}>
              Email Address
            </label>
            <input
              type="email"
              className="form-input"
              placeholder="e.g. alex@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={submitting}
              id="register-email"
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.5rem', color: 'var(--text-primary)' }}>
              Password (min 6 characters)
            </label>
            <input
              type="password"
              className="form-input"
              placeholder="Create a strong password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              disabled={submitting}
              id="register-password"
            />
          </div>

          {role === 'STUDENT' && (
            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.5rem', color: 'var(--text-primary)' }}>
                Date of Birth
              </label>
              <input
                type="date"
                className="form-input"
                value={dateOfBirth}
                onChange={(e) => setDateOfBirth(e.target.value)}
                required
                disabled={submitting}
                max={new Date().toISOString().split("T")[0]}
                id="register-dob"
              />
            </div>
          )}

          <div>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.5rem', color: 'var(--text-primary)' }}>
              I am joining as a:
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              <button
                type="button"
                className={`role-choice-btn ${role === 'STUDENT' ? 'active' : ''}`}
                onClick={() => setRole('STUDENT')}
                disabled={submitting}
              >
                <span style={{ fontSize: '1.25rem', display: 'block', marginBottom: '0.25rem' }}>🎓</span>
                <span style={{ fontWeight: 700 }}>Student</span>
                <span style={{ fontSize: '0.75rem', opacity: 0.8, display: 'block' }}>Find mentors & achieve goals</span>
              </button>

              <button
                type="button"
                className={`role-choice-btn ${role === 'MENTOR' ? 'active' : ''}`}
                onClick={() => setRole('MENTOR')}
                disabled={submitting}
              >
                <span style={{ fontSize: '1.25rem', display: 'block', marginBottom: '0.25rem' }}>💼</span>
                <span style={{ fontWeight: 700 }}>Mentor</span>
                <span style={{ fontSize: '0.75rem', opacity: 0.8, display: 'block' }}>Guide students & share expertise</span>
              </button>
            </div>
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            disabled={submitting}
            style={{ width: '100%', marginTop: '0.5rem' }}
            id="register-submit-btn"
          >
            {submitting ? 'Creating account...' : `Register as ${role === 'STUDENT' ? 'Student' : 'Mentor'}`}
          </button>
        </form>

        <div style={{ marginTop: '2rem', textAlign: 'center', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
          Already have an account?{' '}
          <Link to="/login" style={{ color: 'var(--accent-primary)', fontWeight: 600, textDecoration: 'none' }}>
            Sign In
          </Link>
        </div>
      </div>
    </div>
    </div>
  );
}
