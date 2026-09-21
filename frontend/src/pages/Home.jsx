import { useAuth } from '../context/AuthContext';

export default function Home() {
  const { user, logout } = useAuth();

  const isStudent = user?.role === 'STUDENT';

  return (
    <div className="app-container" style={{ maxWidth: '800px' }}>
      {/* Header with Logout */}
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{
            width: '38px',
            height: '38px',
            borderRadius: '10px',
            background: 'linear-gradient(135deg, #6366f1 0%, #a855f7 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
              <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
            </svg>
          </div>
          <div>
            <h1 style={{ fontSize: '1.5rem', fontWeight: 800 }}>MentorConnect</h1>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Authenticated Session</p>
          </div>
        </div>

        <button onClick={logout} className="btn" style={{ background: 'rgba(239, 68, 68, 0.15)', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.3)' }} id="logout-btn">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
            <polyline points="16 17 21 12 16 7"/>
            <line x1="21" y1="12" x2="9" y2="12"/>
          </svg>
          Sign Out
        </button>
      </header>

      {/* User Welcome Card */}
      <div className="glass-card" style={{ marginBottom: '2rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.5rem' }}>
          <div>
            <span className="badge badge-success" style={{ marginBottom: '0.5rem' }}>
              <span className="badge-dot" /> Authenticated
            </span>
            <h2 style={{ fontSize: '1.5rem', marginTop: '0.25rem' }}>Welcome, {user?.name}!</h2>
            <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>{user?.email}</p>
          </div>

          <div style={{
            background: isStudent ? 'rgba(99, 102, 241, 0.15)' : 'rgba(168, 85, 247, 0.15)',
            border: `1px solid ${isStudent ? 'rgba(99, 102, 241, 0.3)' : 'rgba(168, 85, 247, 0.3)'}`,
            padding: '0.5rem 1rem',
            borderRadius: 'var(--radius-md)',
            textAlign: 'center'
          }}>
            <span style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', display: 'block' }}>
              Account Role
            </span>
            <span style={{ fontSize: '1.1rem', fontWeight: 800, color: isStudent ? '#818cf8' : '#c084fc' }}>
              {user?.role}
            </span>
          </div>
        </div>

        {/* Profile Information Block */}
        <div style={{ background: 'rgba(255, 255, 255, 0.03)', padding: '1.25rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
          <h3 style={{ fontSize: '0.95rem', color: 'var(--accent-primary)', marginBottom: '0.75rem' }}>
            Auto-Created {isStudent ? 'Student' : 'Mentor'} Profile
          </h3>
          <div className="code-box">
            <pre>{JSON.stringify(user?.profile || {}, null, 2)}</pre>
          </div>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.75rem' }}>
            Profile was initialized automatically upon registration with referential integrity linked to User ID <code>{user?.id}</code>.
          </p>
        </div>
      </div>
    </div>
  );
}
