import { useState, useEffect } from 'react';
import { fetchMyMentorProfile, addMentorAvailability, removeMentorAvailability } from '../../services/mentorService';

const DAYS_OF_WEEK = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'];

export default function MentorAvailability() {
  const [availabilities, setAvailabilities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [newSlot, setNewSlot] = useState({
    dayOfWeek: 'MONDAY',
    startTime: '09:00',
    endTime: '17:00'
  });

  const loadAvailability = async () => {
    try {
      setLoading(true);
      const data = await fetchMyMentorProfile();
      setAvailabilities(data.profile.availabilities || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAvailability();
  }, []);

  const handleAddSlot = async (e) => {
    e.preventDefault();
    if (newSlot.startTime >= newSlot.endTime) {
      setError('Start time must be earlier than end time.');
      return;
    }

    const timeToMinutes = (t) => {
      const [h, m] = t.split(':').map(Number);
      return h * 60 + m;
    };

    const newStart = timeToMinutes(newSlot.startTime);
    const newEnd = timeToMinutes(newSlot.endTime);

    const overlap = availabilities.some(slot => {
      if (slot.dayOfWeek !== newSlot.dayOfWeek) return false;
      const sStart = timeToMinutes(slot.startTime);
      const sEnd = timeToMinutes(slot.endTime);
      return newStart < sEnd && newEnd > sStart;
    });

    if (overlap) {
      setError('This slot overlaps with an existing availability on the same day.');
      return;
    }

    try {
      setError('');
      await addMentorAvailability(newSlot);
      setNewSlot({ dayOfWeek: 'MONDAY', startTime: '09:00', endTime: '17:00' });
      await loadAvailability();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleDeleteSlot = async (id) => {
    if (!window.confirm('Delete this availability slot?')) return;
    try {
      await removeMentorAvailability(id);
      await loadAvailability();
    } catch (err) {
      alert(err.message);
    }
  };

  if (loading) return <div className="page-content">Loading availability...</div>;

  return (
    <div className="page-content">
      <div className="page-header">
        <div>
          <h2 className="page-title">Manage Availability</h2>
          <p className="page-subtitle">Set the days and times you are available for mentoring sessions.</p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '2rem', alignItems: 'start' }}>
        
        {/* Add Slot Form */}
        <div className="glass-card" style={{ padding: '1.5rem' }}>
          <h3 style={{ marginTop: 0, marginBottom: '1.5rem', color: 'var(--text-primary)' }}>Add Time Slot</h3>
          <form onSubmit={handleAddSlot}>
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem' }}>Day of Week</label>
              <select 
                value={newSlot.dayOfWeek} 
                onChange={e => setNewSlot({...newSlot, dayOfWeek: e.target.value})}
                style={{ width: '100%', padding: '0.75rem', borderRadius: '4px', border: '1px solid var(--border-subtle)', background: 'rgba(0,0,0,0.2)', color: 'white' }}
              >
                {DAYS_OF_WEEK.map(day => (
                  <option key={day} value={day}>{day}</option>
                ))}
              </select>
            </div>
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem' }}>Start Time</label>
              <input 
                type="time" 
                value={newSlot.startTime} 
                onChange={e => setNewSlot({...newSlot, startTime: e.target.value})}
                required
                style={{ width: '100%', padding: '0.75rem', borderRadius: '4px', border: '1px solid var(--border-subtle)', background: 'rgba(0,0,0,0.2)', color: 'white' }}
              />
            </div>
            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem' }}>End Time</label>
              <input 
                type="time" 
                value={newSlot.endTime} 
                onChange={e => setNewSlot({...newSlot, endTime: e.target.value})}
                required
                style={{ width: '100%', padding: '0.75rem', borderRadius: '4px', border: '1px solid var(--border-subtle)', background: 'rgba(0,0,0,0.2)', color: 'white' }}
              />
            </div>
            <button type="submit" className="btn btn-primary" style={{ width: '100%', padding: '0.75rem' }}>
              Add Availability
            </button>
          </form>
        </div>

        {/* Current Availability List */}
        <div className="glass-card" style={{ padding: '1.5rem' }}>
          <h3 style={{ marginTop: 0, marginBottom: '1.5rem', color: 'var(--text-primary)' }}>Your Weekly Schedule</h3>
          
          {error && <div style={{ color: '#ef4444', marginBottom: '1rem' }}>{error}</div>}
          
          {availabilities.length === 0 ? (
            <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
              No availability slots defined yet.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {DAYS_OF_WEEK.map(day => {
                const daySlots = availabilities.filter(a => a.dayOfWeek === day);
                if (daySlots.length === 0) return null;
                
                return (
                  <div key={day} style={{ background: 'rgba(255,255,255,0.05)', borderRadius: '8px', padding: '1rem' }}>
                    <h4 style={{ margin: '0 0 1rem 0', color: 'var(--accent-primary)' }}>{day}</h4>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      {daySlots.map(slot => (
                        <div key={slot.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.5rem', background: 'rgba(0,0,0,0.2)', borderRadius: '4px' }}>
                          <span style={{ fontFamily: 'monospace', fontSize: '1.1rem' }}>
                            {slot.startTime} - {slot.endTime}
                          </span>
                          <button 
                            onClick={() => handleDeleteSlot(slot.id)}
                            style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', opacity: 0.7 }}
                          >
                            Remove
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
