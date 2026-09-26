import { NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const icons = { Dashboard: '▦', Goals: '◎', 'Find Mentor': '⌕', 'My Mentors': '↔', Sessions: '◷', Messages: '□', Assignments: '▤', 'AI Assistant': '✦', Profile: '◉', Students: '♙', Availability: '◴', Users: '♧', Mentors: '♢', Mentorships: '⛓', 'Peer Mentor': '🎓', 'Peer Apps': '🎓', 'My Students': '♙', 'Mentor Sessions': '◷', 'Mentor Assignments': '▤', 'Mentor Availability': '◴', 'Mentor Profile': '◉', 'Mentor Messages': '□', 'Mentor Reviews': '★' };

export default function Sidebar() {
  const { user } = useAuth();
  
  // Capability-based: detect approved peer mentor
  const isPeerMentor = user?.role === 'STUDENT' && user?.mentorProfile && user.mentorProfile.mentorType === 'PEER' && user.mentorProfile.status === 'APPROVED';

  // Base student links
  const studentLinks = [
    ['Dashboard', '/student/dashboard'], 
    ['Goals', '/student/goals'], 
    ['Find Mentor', '/student/mentor'], 
    ['My Mentors', '/student/mentorships'], 
    ['Sessions', '/student/sessions'], 
    ['Assignments', '/student/assignments'], 
    ['Messages', '/student/messages'], 
    ['AI Assistant', '/student/ai'], 
    ['Peer Mentor', '/student/peer-mentor/apply'],
    ['Profile', '/student/profile']
  ];

  // Peer mentor capability links — added only for approved peer mentors
  const peerMentorLinks = isPeerMentor ? [
    ['My Students', '/student/mentor-dashboard/students'],
    ['Mentor Sessions', '/student/mentor-dashboard/sessions'],
    ['Mentor Assignments', '/student/mentor-dashboard/assignments'],
    ['Mentor Availability', '/student/mentor-dashboard/availability'],
    ['Mentor Profile', '/student/mentor-dashboard/profile'],
  ] : [];

  const linksByRole = {
    STUDENT: [...studentLinks, ...peerMentorLinks],
    MENTOR: [['Dashboard', '/mentor/dashboard'], ['Students', '/mentor/students'], ['Sessions', '/mentor/sessions'], ['Assignments', '/mentor/assignments'], ['Availability', '/mentor/availability'], ['Messages', '/mentor/messages'], ['Profile', '/mentor/profile']],
    ADMIN: [['Dashboard', '/admin/dashboard'], ['Users', '/admin/users'], ['Mentors', '/admin/mentors'], ['Mentorships', '/admin/mentorships'], ['Peer Apps', '/admin/peer-mentor-applications']]
  };
  const navLinks = linksByRole[user?.role] || [];

  return (
    <header className="app-sidebar">
      <NavLink to={navLinks[0]?.[1] || '/'} className="sidebar-brand" aria-label="MentorConnect home">
        <span className="brand-mark" aria-hidden="true">M</span><span>MentorConnect</span>
      </NavLink>
      <nav className="sidebar-nav" aria-label="Primary navigation">
        {isPeerMentor && peerMentorLinks.length > 0 && (
          <div style={{ padding: '0.5rem 1rem 0.25rem', fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', marginTop: '0.5rem', opacity: 0.7 }}>
            {/* This separator appears before peer mentor links in the list */}
          </div>
        )}
        {navLinks.map(([label, to], i) => (
          <NavLink key={to} to={to} end={to.endsWith('dashboard')} className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}>
            {/* Show a divider before peer mentor section */}
            <span className="sidebar-link-icon" aria-hidden="true">{icons[label] || '•'}</span><span>{label}</span>
          </NavLink>
        ))}
      </nav>
      <div className="sidebar-footer" title={user?.email}><span className="user-avatar">{user?.name?.charAt(0)?.toUpperCase() || 'U'}</span><span className="sidebar-user-name">{user?.name}</span></div>
    </header>
  );
}
