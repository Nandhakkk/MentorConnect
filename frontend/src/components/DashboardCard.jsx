export default function DashboardCard({ title, value, subtitle, icon, color = 'var(--accent-primary)' }) {
  return (
    <div className="glass-card dashboard-stat-card">
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem' }}>
        <div>
          <div style={{ color: 'var(--text-muted)', fontSize: '.76rem', fontWeight: 700, letterSpacing: '.04em', textTransform: 'uppercase' }}>{title}</div>
          <div style={{ color: 'var(--text-primary)', fontSize: '1.8rem', fontWeight: 750, lineHeight: 1.2, marginTop: '.35rem' }}>{value}</div>
        </div>
        {icon && (
          <div style={{
            display: 'grid',
            placeItems: 'center',
            width: '38px',
            height: '38px',
            flexShrink: 0,
            borderRadius: '9px',
            background: 'var(--bg-surface-elevated)',
            border: '1px solid var(--border-subtle)',
            color: color || 'var(--accent-primary)'
          }}>
            {icon}
          </div>
        )}
      </div>
      {subtitle && <p style={{ fontSize: '.82rem', marginTop: '.7rem', color: 'var(--text-secondary)' }}>{subtitle}</p>}
    </div>
  );
}
