import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getMentorAssignments } from '../../services/assignmentService';

export default function MentorAssignments() {
  const [assignments, setAssignments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const loadData = async () => {
      try {
        const data = await getMentorAssignments();
        setAssignments(data);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

  if (loading) return <div className="page-content">Loading assignments...</div>;
  if (error) return <div className="page-content" style={{ color: '#ef4444' }}>{error}</div>;

  return (
    <div className="page-content">
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 className="page-title">Assignments</h2>
          <p className="page-subtitle">Manage assignments given to your students.</p>
        </div>
        <Link to="/mentor/assignments/create" className="btn btn-primary" style={{ textDecoration: 'none' }}>
          Create Assignment
        </Link>
      </div>

      {assignments.length === 0 ? (
        <div style={{ color: 'var(--text-muted)' }}>No assignments created yet.</div>
      ) : (
        <div style={{ display: 'grid', gap: '1rem', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))' }}>
          {assignments.map(a => (
            <div key={a.id} className="glass-card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <h4 style={{ margin: 0, color: 'white', fontSize: '1.2rem' }}>{a.title}</h4>
                <span style={{
                  padding: '0.2rem 0.6rem', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 'bold',
                  background: a.status === 'ASSIGNED' ? 'rgba(255, 255, 255, 0.1)' : a.status === 'SUBMITTED' ? 'rgba(234, 179, 8, 0.1)' : 'rgba(16, 185, 129, 0.1)',
                  color: a.status === 'ASSIGNED' ? 'white' : a.status === 'SUBMITTED' ? '#eab308' : '#10b981'
                }}>
                  {a.status === 'SUBMITTED' ? 'NEEDS REVIEW' : a.status}
                </span>
              </div>
              <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Student: {a.student?.user?.name}</p>
              {a.dueDate && (
                <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                  Due: {new Date(a.dueDate).toLocaleDateString()}
                </p>
              )}
              <div style={{ marginTop: 'auto', paddingTop: '1rem' }}>
                <Link to={`/mentor/assignments/${a.id}/review`} className="btn btn-primary" style={{ display: 'block', textAlign: 'center', textDecoration: 'none', background: a.status === 'SUBMITTED' ? '#eab308' : 'var(--accent-primary)', color: a.status === 'SUBMITTED' ? 'black' : 'white' }}>
                  {a.status === 'SUBMITTED' ? 'Review Submission' : 'View Details'}
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
