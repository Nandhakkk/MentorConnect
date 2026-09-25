import { NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const icons = { Dashboard: '▦', Goals: '◎', 'Find Mentor': '⌕', 'My Mentors': '↔', Sessions: '◷', Messages: '□', Assignments: '▤', 'AI Assistant': '✦', Profile: '◉', Students: '♙', Availability: '◴', Users: '♧', Mentors: '♢', Mentorships: '⛓' };

export default function Sidebar() {
  const { user } = useAuth();
  const linksByRole = {
    STUDENT: [['Dashboard', '/student/dashboard'], ['Goals', '/student/goals'], ['Find Mentor', '/student/mentor'], ['My Mentors', '/student/mentorships'], ['Sessions', '/student/sessions'], ['Assignments', '/student/assignments'], ['Messages', '/student/messages'], ['AI Assistant', '/student/ai'], ['Profile', '/student/profile']],
    MENTOR: [['Dashboard', '/mentor/dashboard'], ['Students', '/mentor/students'], ['Sessions', '/mentor/sessions'], ['Assignments', '/mentor/assignments'], ['Availability', '/mentor/availability'], ['Messages', '/mentor/messages'], ['Profile', '/mentor/profile']],
    ADMIN: [['Dashboard', '/admin/dashboard'], ['Users', '/admin/users'], ['Mentors', '/admin/mentors'], ['Mentorships', '/admin/mentorships']]
  };
  const navLinks = linksByRole[user?.role] || [];

  return (
    <header className="app-sidebar">
      <NavLink to={navLinks[0]?.[1] || '/'} className="sidebar-brand" aria-label="MentorConnect home">
        <span className="brand-mark" aria-hidden="true">M</span><span>MentorConnect</span>
      </NavLink>
      <nav className="sidebar-nav" aria-label="Primary navigation">
        {navLinks.map(([label, to]) => (
          <NavLink key={to} to={to} end={to.endsWith('dashboard')} className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}>
            <span className="sidebar-link-icon" aria-hidden="true">{icons[label]}</span><span>{label}</span>
          </NavLink>
        ))}
      </nav>
      <div className="sidebar-footer" title={user?.email}><span className="user-avatar">{user?.name?.charAt(0)?.toUpperCase() || 'U'}</span><span className="sidebar-user-name">{user?.name}</span></div>
    </header>
  );
}
