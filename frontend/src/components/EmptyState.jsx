import { Link } from 'react-router-dom';

export default function EmptyState({
  title = 'Feature Coming Next',
  description = 'This section is currently being scaffolded as part of the next project phase.',
  dashboardLink = '/student/dashboard',
  icon
}) {
  return (
    <div className="glass-card" style={{ textAlign: 'center', padding: '4rem 2rem', maxWidth: '600px', margin: '2rem auto' }}>
      <div style={{
        width: '64px',
        height: '64px',
        borderRadius: '20px',
        background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.2) 0%, rgba(168, 85, 247, 0.2) 100%)',
        border: '1px solid var(--border-active)',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: '1.5rem',
        color: 'var(--accent-primary)'
      }}>
        {icon || (
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="2" y="3" width="20" height="14" rx="2" ry="2"/>
            <line x1="8" y1="21" x2="16" y2="21"/>
            <line x1="12" y1="17" x2="12" y2="21"/>
          </svg>
        )}
      </div>

      <div style={{ marginBottom: '1rem' }}>
        <span className="badge badge-warning" style={{ fontSize: '0.75rem' }}>
          Feature coming next
        </span>
      </div>

      <h2 style={{ fontSize: '1.5rem', marginBottom: '0.5rem', fontWeight: 700 }}>{title}</h2>
      <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '2rem', maxWidth: '420px', margin: '0 auto 2rem' }}>
        {description}
      </p>

      <Link to={dashboardLink} className="btn btn-primary">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M19 12H5M12 19l-7-7 7-7"/>
        </svg>
        Return to Dashboard
      </Link>
    </div>
  );
}
