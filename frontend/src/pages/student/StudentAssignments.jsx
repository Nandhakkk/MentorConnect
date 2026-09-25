import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getStudentAssignments } from '../../services/assignmentService';

export default function StudentAssignments() {
  const [assignments, setAssignments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const loadData = async () => {
      try {
        const data = await getStudentAssignments();
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
      <div className="page-header">
        <div>
          <h2 className="page-title">My Assignments</h2>
          <p className="page-subtitle">Track and complete assignments from your mentors.</p>
        </div>
      </div>

      {assignments.length === 0 ? (
        <div style={{ color: 'var(--text-muted)' }}>No assignments found.</div>
      ) : (
        <div style={{ display: 'grid', gap: '1rem', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))' }}>
          {assignments.map(a => (
            <div key={a.id} className="glass-card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <h4 style={{ margin: 0, color: 'white', fontSize: '1.2rem' }}>{a.title}</h4>
                <span style={{
                  padding: '0.2rem 0.6rem', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 'bold',
                  background: a.status === 'ASSIGNED' ? 'rgba(59, 130, 246, 0.1)' : a.status === 'SUBMITTED' ? 'rgba(16, 185, 129, 0.1)' : a.status === 'RETURNED' ? 'rgba(239, 68, 68, 0.1)' : 'rgba(167, 139, 250, 0.1)',
                  color: a.status === 'ASSIGNED' ? '#3b82f6' : a.status === 'SUBMITTED' ? '#10b981' : a.status === 'RETURNED' ? '#ef4444' : '#a78bfa'
                }}>
                  {a.status}
                </span>
              </div>
              <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Mentor: {a.mentor?.user?.name}</p>
              {a.dueDate && (
                <p style={{ margin: 0, fontSize: '0.85rem', color: new Date(a.dueDate) < new Date() && a.status === 'ASSIGNED' ? '#ef4444' : 'var(--text-muted)' }}>
                  Due: {new Date(a.dueDate).toLocaleDateString()}
                </p>
              )}
              <div style={{ marginTop: 'auto', paddingTop: '1rem' }}>
                <Link to={`/student/assignments/${a.id}`} className="btn btn-primary" style={{ display: 'block', textAlign: 'center', textDecoration: 'none' }}>
                  {a.status === 'ASSIGNED' ? 'Start Assignment' : a.status === 'RETURNED' ? 'Resubmit' : 'View Details'}
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
