import DashboardCard from '../../components/DashboardCard';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

export default function StudentDashboard() {
  const { user } = useAuth();

  return (
    <div className="page-content">
      {/* Welcome Banner */}
      <div className="page-header">
        <div>
          <h2 className="page-title">Welcome back, {user?.name?.split(' ')[0]}! 👋</h2>
          <p className="page-subtitle">Here's a summary of your mentoring journey so far.</p>
        </div>
        <Link to="/student/goals" className="btn btn-primary">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>
          </svg>
          Create Goal
        </Link>
      </div>

      {/* Stat Cards */}
      <div className="stats-grid">
        <DashboardCard
          title="Total Goals"
          value="0"
          subtitle="No goals created yet"
          icon={
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>
            </svg>
          }
        />
        <DashboardCard
          title="Active Mentorships"
          value="0"
          subtitle="Not yet connected to a mentor"
          icon={
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
              <circle cx="9" cy="7" r="4"/>
              <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
            </svg>
          }
          color="#10b981"
        />
        <DashboardCard
          title="Upcoming Sessions"
          value="0"
          subtitle="No sessions scheduled"
          icon={
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
              <line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
            </svg>
          }
          color="#f59e0b"
        />
      </div>

      {/* Quick Actions & Empty State */}
      <div className="dashboard-grid-2col">
        <div className="glass-card">
          <h3 className="card-section-title">Quick Actions</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {[
              { label: 'Set a new goal', to: '/student/goals', icon: '🎯' },
              { label: 'Find a mentor', to: '/student/mentor', icon: '🔍' },
              { label: 'My mentors', to: '/student/mentorships', icon: '👩‍🏫' },
              { label: 'View sessions', to: '/student/sessions', icon: '📅' },
              { label: 'Open messages', to: '/student/messages', icon: '💬' },
              { label: 'Update profile', to: '/student/profile', icon: '👤' },
            ].map((action) => (
              <Link key={action.to} to={action.to} className="quick-action-link">
                <span>{action.icon}</span>
                <span>{action.label}</span>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginLeft: 'auto', opacity: 0.5 }}>
                  <polyline points="9 18 15 12 9 6"/>
                </svg>
              </Link>
            ))}
          </div>
        </div>

        <div className="glass-card">
          <h3 className="card-section-title">Recent Goals</h3>
          <div className="empty-list-state">
            <div className="empty-list-icon">🎯</div>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '1rem' }}>
              You haven't created any goals yet.
            </p>
            <Link to="/student/goals" className="btn btn-primary" style={{ fontSize: '0.8rem', padding: '0.5rem 1rem' }}>
              Create your first goal
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
