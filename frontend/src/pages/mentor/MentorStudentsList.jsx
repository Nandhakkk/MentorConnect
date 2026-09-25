import { useState, useEffect } from 'react';
import { acceptMentorship, fetchMentorMentorships, rejectMentorship } from '../../services/mentorService';
import DashboardCard from '../../components/DashboardCard';

export default function MentorStudentsList() {
  const [mentorships, setMentorships] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actioningId, setActioningId] = useState(null);

  const loadMentorships = async () => {
    try {
      setLoading(true);
      const data = await fetchMentorMentorships();
      setMentorships(data);
      setError('');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMentorships();
  }, []);

  const handleRequestAction = async (id, action) => {
    try {
      setActioningId(id);
      setError('');
      const updated = action === 'accept' ? await acceptMentorship(id) : await rejectMentorship(id);
      setMentorships((current) => current.map((mentorship) => mentorship.id === updated.id ? updated : mentorship));
    } catch (err) {
      setError(err.message);
    } finally {
      setActioningId(null);
    }
  };

  if (loading) return <div className="page-content">Loading your students...</div>;

  const pendingRequests = mentorships.filter((mentorship) => mentorship.status === 'PENDING');
  const activeMentorships = mentorships.filter((mentorship) => mentorship.status === 'ACTIVE');

  const mentorshipCard = (mentorship, isPending = false) => (
    <div key={mentorship.id} className="glass-card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'var(--accent-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 'bold' }}>
            {mentorship.student?.user?.name?.charAt(0).toUpperCase()}
          </div>
          <div>
            <h3 style={{ margin: '0 0 0.25rem 0', color: 'var(--text-primary)', fontSize: '1.1rem' }}>{mentorship.student?.user?.name}</h3>
            <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>{mentorship.student?.careerGoal || 'Student'}</div>
          </div>
        </div>
        <span className={`badge ${isPending ? 'badge-warning' : 'badge-success'}`}>{mentorship.status}</span>
      </div>

      <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>
        <strong>Education:</strong> {mentorship.student?.education || 'Not specified'}
      </div>
      <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1.5rem' }}>
        {isPending ? 'Requested' : 'Started'}: {new Date(isPending ? mentorship.createdAt : mentorship.startedAt).toLocaleDateString()}
      </div>

      {isPending && (
        <div style={{ display: 'flex', gap: '0.75rem', marginTop: 'auto' }}>
          <button type="button" className="btn btn-primary" disabled={actioningId === mentorship.id} onClick={() => handleRequestAction(mentorship.id, 'accept')}>
            {actioningId === mentorship.id ? 'Updating...' : 'Accept'}
          </button>
          <button
            type="button"
            disabled={actioningId === mentorship.id}
            onClick={() => handleRequestAction(mentorship.id, 'reject')}
            style={{ padding: '0.65rem 1rem', borderRadius: 'var(--radius-md)', border: '1px solid #ef4444', background: 'transparent', color: '#f87171', cursor: actioningId === mentorship.id ? 'not-allowed' : 'pointer', fontWeight: 600 }}
          >
            Reject
          </button>
        </div>
      )}
    </div>
  );

  return (
    <div className="page-content">
      <div className="page-header">
        <div>
          <h2 className="page-title">My Students</h2>
          <p className="page-subtitle">Review mentorship requests and manage your active students.</p>
        </div>
      </div>

      {error && <div style={{ color: '#ef4444', marginBottom: '1rem' }}>{error}</div>}

      <div className="stats-grid stats-grid-4">
        <DashboardCard title="Pending Requests" value={pendingRequests.length.toString()} subtitle="Awaiting your review" color="#f59e0b" icon="⏳" />
        <DashboardCard title="Active Students" value={activeMentorships.length.toString()} subtitle="Currently enrolled" color="#10b981" icon="👩‍🎓" />
      </div>

      <section style={{ marginBottom: '2.5rem' }}>
        <h3 style={{ marginBottom: '1rem' }}>Pending Requests</h3>
        {pendingRequests.length === 0 ? (
          <p style={{ color: 'var(--text-muted)' }}>No pending mentorship requests.</p>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', gap: '1.5rem' }}>
            {pendingRequests.map((mentorship) => mentorshipCard(mentorship, true))}
          </div>
        )}
      </section>

      <section>
        <h3 style={{ marginBottom: '1rem' }}>Active Students</h3>
        {activeMentorships.length === 0 ? (
          <p style={{ color: 'var(--text-muted)' }}>You do not have any active students yet.</p>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', gap: '1.5rem' }}>
            {activeMentorships.map((mentorship) => mentorshipCard(mentorship))}
          </div>
        )}
      </section>
    </div>
  );
}
