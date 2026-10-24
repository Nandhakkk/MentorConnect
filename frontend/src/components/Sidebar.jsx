import { NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import NotificationBell from './NotificationBell';
import ProfileMenu from './ProfileMenu';

const icons = { Dashboard: '▦', Goals: '◎', 'Find Mentor': '⌕', 'My Mentors': '↔', Sessions: '◷', Messages: '□', Assignments: '▤', 'AI Assistant': '✦', Profile: '◉', Students: '♙', Availability: '◴', Learners: '♧', Mentors: '♢', 'Mentor Apps': '🛡️', Mentorships: '⛓', 'Peer Mentor': '🎓', 'Peer Apps': '🎓', 'My Students': '♙', 'Mentor Sessions': '◷', 'Mentor Assignments': '▤', 'Mentor Availability': '◴', 'Mentor Profile': '◉', 'Mentor Messages': '□', 'Mentor Reviews': '★', Earnings: '₹', 'Mentor Earnings': '₹', Finance: '₹', Complaints: '⚠', Verification: '🛡️' };

export default function Sidebar() {
  const { user } = useAuth();

  // Capability-based: detect approved peer mentor
  const isPeerMentor = user?.role === 'STUDENT' && user?.mentorProfile && user.mentorProfile.mentorType === 'PEER' && user.mentorProfile.status === 'APPROVED';

  // Base student links
  const studentLinks = [
    ['Goals', '/student/goals'],
    ['Find Mentor', '/student/mentor'],
    ['My Mentors', '/student/mentorships'],
    ['Sessions', '/student/sessions'],
    ['Assignments', '/student/assignments'],
    ['Messages', '/student/messages'],
    ['AI Assistant', '/student/ai'],
    ...(isPeerMentor ? [] : [['Peer Mentor', '/student/peer-mentor/apply']])
  ];

  // Peer mentor capability links — separated with clear heading for approved peer mentors
  const peerMentorLinks = isPeerMentor ? [
    ['Peer Hub', '/student/peer-mentor/apply'],
    ['My Students', '/student/mentor-dashboard/students'],
    ['Mentor Sessions', '/student/mentor-dashboard/sessions'],
    ['Mentor Assignments', '/student/mentor-dashboard/assignments'],
    ['Availability', '/student/mentor-dashboard/availability'],
    ['Earnings', '/student/mentor-dashboard/earnings']
  ] : [];

  const getDashboardLink = () => {
    if (!user) return '/';
    switch (user.role) {
      case 'STUDENT': return '/student/dashboard';
      case 'MENTOR': return '/mentor/dashboard';
      case 'ADMIN': return '/admin/dashboard';
      case 'GUARDIAN': return '/guardian/dashboard';
      default: return '/';
    }
  };

  const mentorLinks = [
    ...(user?.mentorProfile?.status !== 'APPROVED' ? [['Verification', '/mentor/application']] : []),
    ['Students', '/mentor/students'],
    ['Sessions', '/mentor/sessions'],
    ['Assignments', '/mentor/assignments'],
    ['Availability', '/mentor/availability'],
    ['Messages', '/mentor/messages'],
    ['Earnings', '/mentor/earnings'],
    ['AI Assistant', '/mentor/ai']
  ];

  const adminLinks = [
    ['Verification', '/admin/verification-requests'],
    ['Learners', '/admin/users'],
    ['Mentors', '/admin/mentors'],
    ['Mentorships', '/admin/mentorships'],
    ['Finance', '/admin/finance'],
    ['Complaints', '/admin/complaints']
  ];

  return (
    <header className="app-sidebar">
      <NavLink to={getDashboardLink()} className="sidebar-brand" aria-label="MentorConnect home">
        <span className="brand-mark" aria-hidden="true">M</span><span>MentorConnect</span>
      </NavLink>
      <nav className="sidebar-nav" aria-label="Primary navigation">
        {user?.role === 'STUDENT' ? (
          <>
            {studentLinks.map(([label, to]) => (
              <NavLink key={to} to={to} end={to.endsWith('dashboard')} className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}>
                <span className="sidebar-link-icon" aria-hidden="true">{icons[label] || '•'}</span><span>{label}</span>
              </NavLink>
            ))}

            {isPeerMentor && peerMentorLinks.length > 0 && (
              <>
                <div style={{ height: '22px', width: '1px', background: 'var(--border-subtle)', margin: '0 0.5rem', opacity: 0.8 }} aria-hidden="true" />
                <span style={{ fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--purple, #a855f7)', fontWeight: 800, padding: '0 0.25rem', whiteSpace: 'nowrap' }}>
                  Peer Mentor
                </span>
                {peerMentorLinks.map(([label, to]) => (
                  <NavLink key={to} to={to} className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`} style={({ isActive }) => ({ borderLeft: isActive ? '2px solid var(--purple, #a855f7)' : undefined })}>
                    <span className="sidebar-link-icon" aria-hidden="true">{icons[label] || '•'}</span><span>{label}</span>
                  </NavLink>
                ))}
              </>
            )}
          </>
        ) : (
          (user?.role === 'MENTOR' ? mentorLinks : adminLinks).map(([label, to]) => (
            <NavLink key={to} to={to} end={to.endsWith('dashboard')} className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}>
              <span className="sidebar-link-icon" aria-hidden="true">{icons[label] || '•'}</span><span>{label}</span>
            </NavLink>
          ))
        )}
      </nav>
      <div className="sidebar-footer">
        <NotificationBell />
        <ProfileMenu />
      </div>
    </header>
  );
}
