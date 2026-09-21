import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { fetchGoals, createGoal } from '../../services/goalService';
import DashboardCard from '../../components/DashboardCard';

export default function StudentGoals() {
  const [goals, setGoals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [newGoal, setNewGoal] = useState({ title: '', description: '', targetDate: '' });
  const [creating, setCreating] = useState(false);

  const loadGoals = async () => {
    try {
      setLoading(true);
      const data = await fetchGoals();
      setGoals(data);
      setError('');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadGoals();
  }, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    setCreating(true);
    try {
      await createGoal(newGoal);
      setShowModal(false);
      setNewGoal({ title: '', description: '', targetDate: '' });
      await loadGoals();
    } catch (err) {
      alert(err.message);
    } finally {
      setCreating(false);
    }
  };

  if (loading) return <div className="page-content">Loading goals...</div>;

  return (
    <div className="page-content">
      <div className="page-header">
        <div>
          <h2 className="page-title">My Goals</h2>
          <p className="page-subtitle">Track your progress and set milestones.</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowModal(true)}>
          + Create Goal
        </button>
      </div>

      {error && <div style={{ color: '#ef4444', marginBottom: '1rem' }}>{error}</div>}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1.5rem' }}>
        {goals.length === 0 ? (
          <div className="glass-card" style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '3rem' }}>
            <p style={{ color: 'var(--text-secondary)' }}>You don't have any goals yet.</p>
          </div>
        ) : (
          goals.map(goal => {
            const total = goal.milestones?.length || 0;
            const completed = goal.milestones?.filter(m => m.status === 'COMPLETED').length || 0;
            const progress = total === 0 ? 0 : Math.round((completed / total) * 100);

            return (
              <Link key={goal.id} to={`/student/goals/${goal.id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
                <div className="glass-card" style={{ padding: '1.5rem', transition: 'transform 0.2s', cursor: 'pointer' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                    <h3 style={{ margin: 0, fontSize: '1.1rem', color: 'var(--text-primary)' }}>{goal.title}</h3>
                    <span style={{ 
                      fontSize: '0.75rem', 
                      padding: '0.2rem 0.5rem', 
                      borderRadius: '12px', 
                      background: goal.status === 'ACTIVE' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(107, 114, 128, 0.1)',
                      color: goal.status === 'ACTIVE' ? '#10b981' : '#9ca3af'
                    }}>
                      {goal.status}
                    </span>
                  </div>
                  
                  {goal.description && (
                    <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '1.5rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {goal.description}
                    </p>
                  )}
                  
                  <div style={{ marginBottom: '1rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: '0.25rem', color: 'var(--text-secondary)' }}>
                      <span>Progress: {completed} / {total} milestones</span>
                      <span>{progress}%</span>
                    </div>
                    <div style={{ width: '100%', height: '6px', background: 'rgba(255,255,255,0.1)', borderRadius: '3px', overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${progress}%`, background: 'var(--accent-primary)', transition: 'width 0.3s ease' }}></div>
                    </div>
                  </div>

                  {goal.targetDate && (
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                      Target: {new Date(goal.targetDate).toLocaleDateString()}
                    </div>
                  )}
                </div>
              </Link>
            );
          })
        )}
      </div>

      {showModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, 
          background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100
        }}>
          <div className="glass-card" style={{ width: '100%', maxWidth: '400px', padding: '2rem' }}>
            <h3 style={{ margin: '0 0 1.5rem 0' }}>Create New Goal</h3>
            <form onSubmit={handleCreate}>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem' }}>Goal Title *</label>
                <input 
                  type="text" 
                  value={newGoal.title} 
                  onChange={e => setNewGoal({...newGoal, title: e.target.value})}
                  required 
                  style={{ width: '100%', padding: '0.75rem', borderRadius: '4px', border: '1px solid var(--border-subtle)', background: 'rgba(0,0,0,0.2)', color: 'white' }}
                />
              </div>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem' }}>Description</label>
                <textarea 
                  value={newGoal.description} 
                  onChange={e => setNewGoal({...newGoal, description: e.target.value})}
                  rows="3"
                  style={{ width: '100%', padding: '0.75rem', borderRadius: '4px', border: '1px solid var(--border-subtle)', background: 'rgba(0,0,0,0.2)', color: 'white' }}
                />
              </div>
              <div style={{ marginBottom: '1.5rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem' }}>Target Date</label>
                <input 
                  type="date" 
                  value={newGoal.targetDate} 
                  onChange={e => setNewGoal({...newGoal, targetDate: e.target.value})}
                  style={{ width: '100%', padding: '0.75rem', borderRadius: '4px', border: '1px solid var(--border-subtle)', background: 'rgba(0,0,0,0.2)', color: 'white' }}
                />
              </div>
              <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
                <button type="button" onClick={() => setShowModal(false)} style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={creating}>
                  {creating ? 'Creating...' : 'Create Goal'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
