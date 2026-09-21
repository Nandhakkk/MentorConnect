import EmptyState from '../components/EmptyState';
import { useLocation, useMatch, useMatches } from 'react-router-dom';

const PAGE_LABELS = {
  // Student
  '/student/goals': { title: 'My Goals', desc: 'Goal creation and tracking will be available here.', dash: '/student/dashboard' },
  '/student/mentor': { title: 'My Mentor', desc: 'Browse and connect with mentors here.', dash: '/student/dashboard' },
  '/student/sessions': { title: 'My Sessions', desc: 'Scheduled and past sessions will appear here.', dash: '/student/dashboard' },
  '/student/messages': { title: 'Messages', desc: 'Real-time chat with your mentor will be available here.', dash: '/student/dashboard' },
  '/student/profile': { title: 'My Profile', desc: 'Edit your profile, bio, skills, and career goals here.', dash: '/student/dashboard' },
  // Mentor
  '/mentor/students': { title: 'My Students', desc: 'Manage and view your current mentees here.', dash: '/mentor/dashboard' },
  '/mentor/sessions': { title: 'My Sessions', desc: 'Scheduled and completed sessions will appear here.', dash: '/mentor/dashboard' },
  '/mentor/messages': { title: 'Messages', desc: 'Real-time chat with students will be available here.', dash: '/mentor/dashboard' },
  '/mentor/availability': { title: 'Availability', desc: 'Set your weekly schedule and time slots here.', dash: '/mentor/dashboard' },
  '/mentor/profile': { title: 'My Profile', desc: 'Edit your mentor profile and expertise here.', dash: '/mentor/dashboard' },
  // Admin
  '/admin/users': { title: 'User Management', desc: 'View, search, and manage all platform users here.', dash: '/admin/dashboard' },
  '/admin/mentors': { title: 'Mentor Management', desc: 'Approve, view, and manage mentor profiles here.', dash: '/admin/dashboard' },
  '/admin/mentorships': { title: 'Mentorship Management', desc: 'View and manage all student–mentor connections.', dash: '/admin/dashboard' },
};

export default function PlaceholderPage() {
  const { pathname } = useLocation();
  const meta = PAGE_LABELS[pathname] || {
    title: 'Coming Soon',
    desc: 'This feature is part of an upcoming development phase.',
    dash: '/'
  };

  return (
    <div className="page-content">
      <div className="page-header">
        <h2 className="page-title">{meta.title}</h2>
      </div>
      <EmptyState
        title={meta.title}
        description={meta.desc}
        dashboardLink={meta.dash}
      />
    </div>
  );
}
