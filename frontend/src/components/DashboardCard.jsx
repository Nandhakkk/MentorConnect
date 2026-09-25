const iconBackgrounds = { '#10b981': '#ecfdf3', '#f59e0b': '#fffaeb', '#a855f7': '#f4f3ff', '#6b7280': '#f2f4f7' };

export default function DashboardCard({ title, value, subtitle, icon, color = '#4f46e5' }) {
  return (
    <div className="glass-card dashboard-stat-card">
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem' }}>
        <div>
          <div style={{ color: 'var(--text-muted)', fontSize: '.76rem', fontWeight: 700, letterSpacing: '.04em', textTransform: 'uppercase' }}>{title}</div>
          <div style={{ color: 'var(--text-primary)', fontSize: '1.8rem', fontWeight: 750, lineHeight: 1.2, marginTop: '.35rem' }}>{value}</div>
        </div>
        {icon && <div style={{ display: 'grid', placeItems: 'center', width: '38px', height: '38px', flexShrink: 0, borderRadius: '9px', background: iconBackgrounds[color] || '#eef2ff', color }}>{icon}</div>}
      </div>
      {subtitle && <p style={{ fontSize: '.82rem', marginTop: '.7rem' }}>{subtitle}</p>}
    </div>
  );
}
