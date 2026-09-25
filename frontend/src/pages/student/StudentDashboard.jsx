import { Link } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import DashboardCard from '../../components/DashboardCard';
import { fetchGoals } from '../../services/goalService';
import { fetchStudentMentorships } from '../../services/mentorService';
import { fetchSessions } from '../../services/sessionService';

export default function StudentDashboard() {
  const { user } = useAuth();
  const [data, setData] = useState({ goals: [], mentorships: [], sessions: [], loading: true });
  useEffect(() => { Promise.all([fetchGoals(), fetchStudentMentorships(), fetchSessions()]).then(([goals, mentorships, sessions]) => setData({ goals, mentorships, sessions, loading: false })).catch(() => setData((current) => ({ ...current, loading: false }))); }, []);
  const activeGoals = data.goals.filter((goal) => goal.status === 'ACTIVE');
  const activeMentorship = data.mentorships.find((item) => item.status === 'ACTIVE');
  const upcoming = data.sessions.filter((item) => item.status === 'SCHEDULED' && new Date(item.scheduledAt) >= new Date()).sort((a, b) => new Date(a.scheduledAt) - new Date(b.scheduledAt))[0];
  const count = (value) => data.loading ? '—' : value.toString();

  return <div className="page-content">
    <div className="page-header"><div><h2 className="page-title">Welcome back, {user?.name?.split(' ')[0]}</h2><p className="page-subtitle">Keep your learning plan moving forward, one milestone at a time.</p></div><Link to="/student/goals" className="btn btn-primary">Create a goal</Link></div>
    <div className="stats-grid">
      <DashboardCard title="Active goals" value={count(activeGoals.length)} subtitle="Goals currently in progress" icon="◎" />
      <DashboardCard title="Mentorships" value={count(data.mentorships.filter((item) => item.status === 'ACTIVE').length)} subtitle="Active mentor connections" icon="↔" color="#10b981" />
      <DashboardCard title="Upcoming sessions" value={count(data.sessions.filter((item) => item.status === 'SCHEDULED' && new Date(item.scheduledAt) >= new Date()).length)} subtitle="Sessions on your calendar" icon="◷" color="#f59e0b" />
    </div>
    <div className="dashboard-grid-2col">
      <section className="glass-card"><h3 className="card-section-title">Your learning focus</h3>{activeGoals.length ? activeGoals.slice(0, 3).map((goal) => <Link key={goal.id} to={`/student/goals/${goal.id}`} className="quick-action-link"><span>◎</span><span>{goal.title}</span><span style={{ marginLeft: 'auto', color: 'var(--text-muted)' }}>{goal.milestones?.filter((m) => m.status === 'COMPLETED').length || 0}/{goal.milestones?.length || 0}</span></Link>) : <div className="empty-list-state"><p>Set a goal to create a focused learning plan.</p><Link className="btn btn-secondary" to="/student/goals">Browse goals</Link></div>}</section>
      <section className="glass-card"><h3 className="card-section-title">Next step</h3>{upcoming ? <><h4>{new Date(upcoming.scheduledAt).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}</h4><p style={{ margin: '.5rem 0 1rem' }}>Session with {upcoming.mentorship?.mentor?.user?.name || 'your mentor'}.</p><Link className="btn btn-secondary" to="/student/sessions">View sessions</Link></> : activeMentorship ? <><p style={{ marginBottom: '1rem' }}>You are connected with {activeMentorship.mentor?.user?.name || 'a mentor'}. Book time when you are ready.</p><Link className="btn btn-secondary" to="/student/sessions">Book a session</Link></> : <><p style={{ marginBottom: '1rem' }}>Find an approved mentor who can help you reach your goals.</p><Link className="btn btn-primary" to="/student/mentor">Find a mentor</Link></>}</section>
    </div>
    <section className="glass-card ai-dashboard-entry" style={{ marginTop: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}><div><span className="ai-card-kicker">MentorConnect AI</span><h3>Turn your goals into your next best step.</h3><p>Get personalized guidance based on your current goal and milestones.</p></div><Link to="/student/ai" className="btn btn-primary">Ask MentorConnect AI</Link></section>
  </div>;
}
