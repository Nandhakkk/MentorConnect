import DashboardCard from '../../components/DashboardCard';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useState, useEffect } from 'react';
import { fetchMentorMentorships } from '../../services/mentorService';

export default function MentorDashboard() {
  const { user } = useAuth();
  const isAvailable = user?.profile?.isAvailable ?? true;
  const [mentorships, setMentorships] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const data = await fetchMentorMentorships();
        setMentorships(data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const activeMentorshipsCount = mentorships.filter(m => m.status === 'ACTIVE').length;
  const totalStudents = new Set(mentorships.map(m => m.studentId)).size;

  return (
    <div className="page-content">
      {/* Welcome Banner */}
      <div className="page-header">
        <div>
          <h2 className="page-title">Welcome back, {user?.name?.split(' ')[0]}! 👋</h2>
          <p className="page-subtitle">Manage your students, sessions, and availability.</p>
        </div>
        <Link to="/mentor/availability" className="btn btn-primary">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
          </svg>
          Set Availability
        </Link>
      </div>

      {/* Stat Cards */}
      <div className="stats-grid">
        <DashboardCard
          title="Total Students"
          value={loading ? "..." : totalStudents.toString()}
          subtitle="Unique students mentored"
          icon={
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
              <circle cx="9" cy="7" r="4"/>
              <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
            </svg>
          }
        />
        <DashboardCard
          title="Active Mentorships"
          value={loading ? "..." : activeMentorshipsCount.toString()}
          subtitle="Currently ongoing"
          icon={
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
              <line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
            </svg>
          }
          color="#f59e0b"
        />
        <DashboardCard
          title="Availability Status"
          value={isAvailable ? 'Open' : 'Closed'}
          subtitle={isAvailable ? 'Accepting new students' : 'Not accepting students'}
          icon={
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
              <polyline points="22 4 12 14.01 9 11.01"/>
            </svg>
          }
          color={isAvailable ? '#10b981' : '#6b7280'}
        />
      </div>

      {/* Quick Actions & Empty State */}
      <div className="dashboard-grid-2col">
        <div className="glass-card">
          <h3 className="card-section-title">Quick Actions</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {[
              { label: 'Manage availability', to: '/mentor/availability', icon: '🕐' },
              { label: 'View my students', to: '/mentor/students', icon: '👩‍🎓' },
              { label: 'Upcoming sessions', to: '/mentor/sessions', icon: '📅' },
              { label: 'Open messages', to: '/mentor/messages', icon: '💬' },
              { label: 'Update profile', to: '/mentor/profile', icon: '👤' },
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
          <h3 className="card-section-title">Recent Sessions</h3>
          <div className="empty-list-state">
            <div className="empty-list-icon">📅</div>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '1rem' }}>
              No sessions have been scheduled yet.
            </p>
            <Link to="/mentor/availability" className="btn btn-primary" style={{ fontSize: '0.8rem', padding: '0.5rem 1rem' }}>
              Set your availability
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
