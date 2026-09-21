export default function DashboardCard({ title, value, subtitle, icon, color = 'var(--accent-primary)' }) {
  return (
    <div className="glass-card dashboard-stat-card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
        <div>
          <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            {title}
          </span>
          <div style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--text-primary)', marginTop: '0.25rem' }}>
            {value}
          </div>
        </div>
        {icon && (
          <div style={{
            width: '42px',
            height: '42px',
            borderRadius: '12px',
            background: `rgba(${color === 'var(--accent-primary)' ? '99, 102, 241, 0.15' : '16, 185, 129, 0.15'})`,
            border: `1px solid ${color === 'var(--accent-primary)' ? 'rgba(99, 102, 241, 0.3)' : 'rgba(16, 185, 129, 0.3)'}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: color
          }}>
            {icon}
          </div>
        )}
      </div>
      {subtitle && (
        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
          {subtitle}
        </div>
      )}
    </div>
  );
}
