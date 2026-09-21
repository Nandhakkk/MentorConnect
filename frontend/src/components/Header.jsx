import { useAuth } from '../context/AuthContext';

export default function Header({ pageTitle = 'Dashboard' }) {
  const { user, logout } = useAuth();

  const isStudent = user?.role === 'STUDENT';
  const isMentor = user?.role === 'MENTOR';

  return (
    <header className="app-header">
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
        <h1 style={{ fontSize: '1.35rem', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
          {pageTitle}
        </h1>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
        {/* Role Badge */}
        <span
          className="badge"
          style={{
            background: isStudent
              ? 'rgba(99, 102, 241, 0.15)'
              : isMentor
              ? 'rgba(168, 85, 247, 0.15)'
              : 'rgba(16, 185, 129, 0.15)',
            color: isStudent ? '#818cf8' : isMentor ? '#c084fc' : '#34d399',
            border: `1px solid ${
              isStudent
                ? 'rgba(99, 102, 241, 0.3)'
                : isMentor
                ? 'rgba(168, 85, 247, 0.3)'
                : 'rgba(16, 185, 129, 0.3)'
            }`
          }}
        >
          <span className="badge-dot" />
          {user?.role}
        </span>

        {/* User display */}
        <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)' }}>
          {user?.name}
        </span>

        {/* Sign Out Button */}
        <button
          onClick={logout}
          className="btn"
          style={{
            padding: '0.45rem 0.9rem',
            fontSize: '0.8rem',
            background: 'rgba(239, 68, 68, 0.12)',
            color: '#ef4444',
            border: '1px solid rgba(239, 68, 68, 0.25)',
            cursor: 'pointer'
          }}
          id="header-logout-btn"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
            <polyline points="16 17 21 12 16 7"/>
            <line x1="21" y1="12" x2="9" y2="12"/>
          </svg>
          Sign Out
        </button>
      </div>
    </header>
  );
}
