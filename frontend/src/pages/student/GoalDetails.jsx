import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { fetchGoalById, updateGoal, deleteGoal, createMilestone, updateMilestone, deleteMilestone } from '../../services/goalService';
import BackLink from '../../components/BackLink';
import PageHeader from '../../components/PageHeader';

export default function GoalDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  
  const [goal, setGoal] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Edit Goal State
  const [isEditingGoal, setIsEditingGoal] = useState(false);
  const [editGoalData, setEditGoalData] = useState({ title: '', description: '', targetDate: '', status: '' });

  // Add Milestone State
  const [showMilestoneForm, setShowMilestoneForm] = useState(false);
  const [newMilestone, setNewMilestone] = useState({ title: '', description: '', dueDate: '' });

  const loadGoal = async () => {
    try {
      setLoading(true);
      const data = await fetchGoalById(id);
      setGoal(data);
      setEditGoalData({
        title: data.title,
        description: data.description || '',
        targetDate: data.targetDate ? data.targetDate.split('T')[0] : '',
        status: data.status
      });
      setError('');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadGoal();
  }, [id]);

  // Goal Actions
  const handleUpdateGoal = async (e) => {
    e.preventDefault();
    try {
      await updateGoal(id, editGoalData);
      setIsEditingGoal(false);
      await loadGoal();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleDeleteGoal = async () => {
    if (!window.confirm('Are you sure you want to delete this goal? All milestones will be lost.')) return;
    try {
      await deleteGoal(id);
      navigate('/student/goals');
    } catch (err) {
      alert(err.message);
    }
  };

  const handleMarkComplete = async () => {
    try {
      await updateGoal(id, { status: 'COMPLETED' });
      await loadGoal();
    } catch (err) {
      alert(err.message);
    }
  };

  // Milestone Actions
  const handleAddMilestone = async (e) => {
    e.preventDefault();
    try {
      await createMilestone(id, newMilestone);
      setShowMilestoneForm(false);
      setNewMilestone({ title: '', description: '', dueDate: '' });
      await loadGoal();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleToggleMilestone = async (milestone) => {
    const newStatus = milestone.status === 'COMPLETED' ? 'PENDING' : 'COMPLETED';
    try {
      await updateMilestone(milestone.id, { status: newStatus });
      await loadGoal();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleDeleteMilestone = async (milestoneId) => {
    if (!window.confirm('Delete this milestone?')) return;
    try {
      await deleteMilestone(milestoneId);
      await loadGoal();
    } catch (err) {
      alert(err.message);
    }
  };

  if (loading) return <div className="page-content">Loading goal details...</div>;
  if (error) return <div className="page-content" style={{ color: '#ef4444' }}>{error}</div>;
  if (!goal) return <div className="page-content">Goal not found.</div>;

  const total = goal.milestones?.length || 0;
  const completed = goal.milestones?.filter(m => m.status === 'COMPLETED').length || 0;
  const progress = total === 0 ? 0 : Math.round((completed / total) * 100);

  return (
    <div className="page-content">
      <BackLink to="/student/goals">Back to Goals</BackLink>
      <PageHeader title={goal.title} subtitle="Review progress, manage milestones, and keep your plan on track." crumbs={[{ label: 'Dashboard', to: '/student/dashboard' }, { label: 'Goals', to: '/student/goals' }, { label: 'Goal details' }]} />

      <div className="glass-card" style={{ padding: '2rem', marginBottom: '2rem' }}>
        {isEditingGoal ? (
          <form onSubmit={handleUpdateGoal}>
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem' }}>Goal Title *</label>
              <input 
                type="text" 
                value={editGoalData.title} 
                onChange={e => setEditGoalData({...editGoalData, title: e.target.value})}
                required 
                style={{ width: '100%', padding: '0.75rem', borderRadius: '4px', border: '1px solid var(--border-subtle)', background: 'rgba(0,0,0,0.2)', color: 'white' }}
              />
            </div>
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem' }}>Description</label>
              <textarea 
                value={editGoalData.description} 
                onChange={e => setEditGoalData({...editGoalData, description: e.target.value})}
                rows="3"
                style={{ width: '100%', padding: '0.75rem', borderRadius: '4px', border: '1px solid var(--border-subtle)', background: 'rgba(0,0,0,0.2)', color: 'white' }}
              />
            </div>
            <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem' }}>
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem' }}>Target Date</label>
                <input 
                  type="date" 
                  value={editGoalData.targetDate} 
                  onChange={e => setEditGoalData({...editGoalData, targetDate: e.target.value})}
                  style={{ width: '100%', padding: '0.75rem', borderRadius: '4px', border: '1px solid var(--border-subtle)', background: 'rgba(0,0,0,0.2)', color: 'white' }}
                />
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem' }}>Status</label>
                <select 
                  value={editGoalData.status} 
                  onChange={e => setEditGoalData({...editGoalData, status: e.target.value})}
                  style={{ width: '100%', padding: '0.75rem', borderRadius: '4px', border: '1px solid var(--border-subtle)', background: 'rgba(0,0,0,0.2)', color: 'white' }}
                >
                  <option value="ACTIVE">ACTIVE</option>
                  <option value="COMPLETED">COMPLETED</option>
                  <option value="CANCELLED">CANCELLED</option>
                </select>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '1rem' }}>
              <button type="submit" className="btn btn-primary">Save Changes</button>
              <button type="button" onClick={() => setIsEditingGoal(false)} style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}>Cancel</button>
            </div>
          </form>
        ) : (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
              <div>
                <h2 style={{ margin: '0 0 0.5rem 0', color: 'var(--text-primary)' }}>{goal.title}</h2>
                <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                  <span style={{ 
                    fontSize: '0.8rem', padding: '0.2rem 0.6rem', borderRadius: '12px', 
                    background: goal.status === 'COMPLETED' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(99, 102, 241, 0.1)',
                    color: goal.status === 'COMPLETED' ? '#10b981' : '#818cf8'
                  }}>
                    {goal.status}
                  </span>
                  {goal.targetDate && (
                    <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                      Target: {new Date(goal.targetDate).toLocaleDateString()}
                    </span>
                  )}
                </div>
              </div>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                {goal.status !== 'COMPLETED' && (
                  <button onClick={handleMarkComplete} className="btn btn-primary" style={{ padding: '0.5rem 1rem', fontSize: '0.85rem' }}>
                    Mark Complete
                  </button>
                )}
                <button onClick={() => setIsEditingGoal(true)} style={{ background: 'rgba(255,255,255,0.1)', border: 'none', color: 'white', padding: '0.5rem 1rem', borderRadius: '4px', cursor: 'pointer', fontSize: '0.85rem' }}>
                  Edit
                </button>
                <button onClick={handleDeleteGoal} style={{ background: 'rgba(239,68,68,0.2)', border: 'none', color: '#ef4444', padding: '0.5rem 1rem', borderRadius: '4px', cursor: 'pointer', fontSize: '0.85rem' }}>
                  Delete
                </button>
              </div>
            </div>
            {goal.description && (
              <p style={{ marginTop: '1.5rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                {goal.description}
              </p>
            )}
            
            <div style={{ marginTop: '2rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '0.5rem', color: 'var(--text-secondary)' }}>
                <span>Overall Progress ({completed}/{total})</span>
                <span>{progress}%</span>
              </div>
              <div style={{ width: '100%', height: '8px', background: 'rgba(255,255,255,0.1)', borderRadius: '4px', overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${progress}%`, background: 'var(--accent-primary)', transition: 'width 0.3s ease' }}></div>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Milestones Section */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <h3 style={{ margin: 0 }}>Milestones</h3>
          <button onClick={() => setShowMilestoneForm(!showMilestoneForm)} style={{ background: 'none', border: 'none', color: 'var(--accent-primary)', cursor: 'pointer', fontSize: '0.9rem', fontWeight: 600 }}>
            {showMilestoneForm ? '- Cancel' : '+ Add Milestone'}
          </button>
        </div>

        {showMilestoneForm && (
          <div className="glass-card" style={{ padding: '1.5rem', marginBottom: '1.5rem', borderLeft: '4px solid var(--accent-primary)' }}>
            <form onSubmit={handleAddMilestone}>
              <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                <div style={{ flex: '1 1 200px' }}>
                  <input 
                    type="text" 
                    placeholder="Milestone title *" 
                    value={newMilestone.title} 
                    onChange={e => setNewMilestone({...newMilestone, title: e.target.value})}
                    required 
                    style={{ width: '100%', padding: '0.75rem', borderRadius: '4px', border: '1px solid var(--border-subtle)', background: 'rgba(0,0,0,0.2)', color: 'white', marginBottom: '0.5rem' }}
                  />
                  <input 
                    type="date" 
                    value={newMilestone.dueDate} 
                    onChange={e => setNewMilestone({...newMilestone, dueDate: e.target.value})}
                    style={{ width: '100%', padding: '0.75rem', borderRadius: '4px', border: '1px solid var(--border-subtle)', background: 'rgba(0,0,0,0.2)', color: 'white' }}
                  />
                </div>
                <div style={{ flex: '2 1 300px', display: 'flex', flexDirection: 'column' }}>
                  <textarea 
                    placeholder="Description (optional)" 
                    value={newMilestone.description} 
                    onChange={e => setNewMilestone({...newMilestone, description: e.target.value})}
                    rows="2"
                    style={{ flex: 1, width: '100%', padding: '0.75rem', borderRadius: '4px', border: '1px solid var(--border-subtle)', background: 'rgba(0,0,0,0.2)', color: 'white', marginBottom: '0.5rem' }}
                  />
                  <button type="submit" className="btn btn-primary" style={{ alignSelf: 'flex-start' }}>Save Milestone</button>
                </div>
              </div>
            </form>
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {(!goal.milestones || goal.milestones.length === 0) ? (
            <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
              No milestones yet. Break down your goal into smaller steps!
            </div>
          ) : (
            goal.milestones.map(milestone => (
              <div key={milestone.id} className="glass-card" style={{ padding: '1rem', display: 'flex', alignItems: 'flex-start', gap: '1rem' }}>
                <input 
                  type="checkbox" 
                  checked={milestone.status === 'COMPLETED'} 
                  onChange={() => handleToggleMilestone(milestone)}
                  style={{ width: '1.2rem', height: '1.2rem', marginTop: '0.2rem', cursor: 'pointer' }}
                />
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <h4 style={{ 
                      margin: '0 0 0.25rem 0', 
                      color: milestone.status === 'COMPLETED' ? 'var(--text-muted)' : 'var(--text-primary)',
                      textDecoration: milestone.status === 'COMPLETED' ? 'line-through' : 'none'
                    }}>
                      {milestone.title}
                    </h4>
                    <button onClick={() => handleDeleteMilestone(milestone.id)} style={{ background: 'none', border: 'none', color: '#ef4444', opacity: 0.7, cursor: 'pointer', fontSize: '0.8rem' }}>
                      Delete
                    </button>
                  </div>
                  {milestone.description && (
                    <p style={{ margin: '0 0 0.5rem 0', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{milestone.description}</p>
                  )}
                  {milestone.dueDate && (
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      Due: {new Date(milestone.dueDate).toLocaleDateString()}
                    </span>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
