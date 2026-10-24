import { useState, useEffect } from 'react';
import DashboardCard from '../../components/DashboardCard';
import { Link } from 'react-router-dom';
import { fetchAdminDashboardStats } from '../../services/adminService';

export default function AdminDashboard() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const loadStats = async () => {
      try {
        setLoading(true);
        const data = await fetchAdminDashboardStats();
        setStats(data);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    loadStats();
  }, []);

  if (loading) return <div className="page-content">Loading dashboard...</div>;
  if (error) return <div className="page-content" style={{ color: 'var(--error)' }}>Error: {error}</div>;

  return (
    <div className="page-content">
      {/* Header */}
      <div className="page-header">
        <div>
          <h2 className="page-title">Admin Overview 🛡️</h2>
          <p className="page-subtitle">Platform-wide statistics and management tools.</p>
        </div>
        <span className="badge badge-success">
          <span className="badge-dot" /> Platform Online
        </span>
      </div>

      {/* Stat Cards */}
      <div className="stats-grid stats-grid-4">
        <DashboardCard
          title="Total Users"
          value={stats.totalUsers}
          subtitle="Registered accounts"
          icon={
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
              <circle cx="9" cy="7" r="4"/>
              <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
            </svg>
          }
        />
        <DashboardCard
          title="Total Students"
          value={stats.totalStudents}
          subtitle="Active student accounts"
          icon={
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M22 10v6M2 10l10-5 10 5-10 5z"/>
              <path d="M6 12v5c3 3 9 3 12 0v-5"/>
            </svg>
          }
          color="var(--success)"
        />
        <DashboardCard
          title="Total Mentors"
          value={stats.totalMentors}
          subtitle="Active mentor accounts"
          icon={
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
              <circle cx="12" cy="7" r="4"/>
            </svg>
          }
          color="var(--purple)"
        />
        <DashboardCard
          title="Total Mentorships"
          value={stats.activeMentorships}
          subtitle="Active connections"
          icon={
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
              <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
            </svg>
          }
          color="var(--warning)"
        />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginTop: '2rem' }}>
        {/* Recent Users List */}
        <div className="glass-card">
          <h3 className="card-section-title">Recent Users</h3>
          {stats.recentUsers.length === 0 ? (
            <p style={{ color: 'var(--text-muted)' }}>No users found.</p>
          ) : (
            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {stats.recentUsers.map(user => (
                <li key={user.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem 0', borderBottom: '1px solid var(--border-subtle)' }}>
                  <div>
                    <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{user.name}</div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{user.email}</div>
                  </div>
                  <span className={`badge ${user.role === 'ADMIN' ? 'badge-danger' : user.role === 'MENTOR' ? 'badge-purple' : 'badge-success'}`}>
                    {user.role}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Admin Quick Nav */}
        <div className="glass-card">
          <h3 className="card-section-title">Platform Management</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '1rem', marginTop: '1rem' }}>
            {[
              { label: 'Manage Users', to: '/admin/users', icon: '👥', desc: 'View and manage all registered users' },
              { label: 'Manage Mentors', to: '/admin/mentors', icon: '🎓', desc: 'Oversee mentor profiles and approvals' },
              { label: 'Manage Mentorships', to: '/admin/mentorships', icon: '🔗', desc: 'View all student–mentor connections' },
            ].map((item) => (
              <Link key={item.to} to={item.to} className="admin-nav-card" style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <div style={{ fontSize: '1.75rem' }}>{item.icon}</div>
                <div>
                  <div style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: '0.95rem' }}>{item.label}</div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{item.desc}</div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
