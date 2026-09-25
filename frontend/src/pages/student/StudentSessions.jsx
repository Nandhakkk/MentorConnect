import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { fetchSessions, bookSession, cancelSession } from '../../services/sessionService';
import { fetchStudentMentorships } from '../../services/mentorService';
import DashboardCard from '../../components/DashboardCard';

export default function StudentSessions() {
  const [sessions, setSessions] = useState([]);
  const [mentorships, setMentorships] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Booking Modal State
  const [showBookingModal, setShowBookingModal] = useState(false);
  const [bookingData, setBookingData] = useState({ mentorshipId: '', scheduledAtDate: '', scheduledAtTime: '', duration: '60' });
  const [bookingError, setBookingError] = useState('');
  const [bookingSuccess, setBookingSuccess] = useState('');

  const loadData = async () => {
    try {
      setLoading(true);
      const [sessionsData, mentorshipsData] = await Promise.all([
        fetchSessions(),
        fetchStudentMentorships()
      ]);
      const activeMentorships = mentorshipsData.filter(m => m.status === 'ACTIVE');
      setSessions(sessionsData);
      setMentorships(activeMentorships);
      if (activeMentorships.length > 0 && !bookingData.mentorshipId) {
        setBookingData(prev => ({ ...prev, mentorshipId: activeMentorships[0].id }));
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCancelSession = async (id) => {
    if (!window.confirm('Are you sure you want to cancel this session?')) return;
    try {
      await cancelSession(id);
      await loadData();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleBookSession = async (e) => {
    e.preventDefault();
    try {
      setBookingError('');
      setBookingSuccess('');
      const combinedDateTime = new Date(`${bookingData.scheduledAtDate}T${bookingData.scheduledAtTime}`);
      await bookSession({
        mentorshipId: bookingData.mentorshipId,
        scheduledAt: combinedDateTime.toISOString(),
        duration: bookingData.duration
      });
      setBookingSuccess('Session booked successfully!');
      setTimeout(() => {
        setShowBookingModal(false);
        setBookingSuccess('');
        loadData();
      }, 1500);
    } catch (err) {
      setBookingError(err.message);
    }
  };

  if (loading) return <div className="page-content">Loading sessions...</div>;

  const now = new Date();
  const upcoming = sessions.filter(s => new Date(s.scheduledAt) >= now && s.status === 'SCHEDULED');
  const past = sessions.filter(s => new Date(s.scheduledAt) < now || s.status !== 'SCHEDULED');

  return (
    <div className="page-content">
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 className="page-title">My Sessions</h2>
          <p className="page-subtitle">Manage your mentoring sessions.</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowBookingModal(true)}>
          Book New Session
        </button>
      </div>

      {showBookingModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div className="glass-card" style={{ padding: '2rem', width: '100%', maxWidth: '500px' }}>
            <h3 style={{ marginTop: 0, marginBottom: '1.5rem' }}>Book a Session</h3>
            
            {mentorships.length === 0 ? (
              <p style={{ color: 'var(--text-secondary)' }}>You don't have any active mentorships to book a session with.</p>
            ) : (
              <form onSubmit={handleBookSession}>
                <div style={{ marginBottom: '1rem' }}>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem' }}>Select Mentor</label>
                  <select 
                    value={bookingData.mentorshipId} 
                    onChange={e => setBookingData({...bookingData, mentorshipId: e.target.value})}
                    required
                    style={{ width: '100%', padding: '0.75rem', borderRadius: '4px', border: '1px solid var(--border-subtle)', background: 'rgba(0,0,0,0.2)', color: 'white' }}
                  >
                    {mentorships.map(m => (
                      <option key={m.id} value={m.id}>{m.mentor?.user?.name}</option>
                    ))}
                  </select>
                </div>
                <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem' }}>
                  <div style={{ flex: 1 }}>
                    <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem' }}>Date</label>
                    <input 
                      type="date" 
                      value={bookingData.scheduledAtDate} 
                      onChange={e => setBookingData({...bookingData, scheduledAtDate: e.target.value})}
                      required
                      style={{ width: '100%', padding: '0.75rem', borderRadius: '4px', border: '1px solid var(--border-subtle)', background: 'rgba(0,0,0,0.2)', color: 'white' }}
                    />
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem' }}>Time</label>
                    <input 
                      type="time" 
                      value={bookingData.scheduledAtTime} 
                      onChange={e => setBookingData({...bookingData, scheduledAtTime: e.target.value})}
                      required
                      style={{ width: '100%', padding: '0.75rem', borderRadius: '4px', border: '1px solid var(--border-subtle)', background: 'rgba(0,0,0,0.2)', color: 'white' }}
                    />
                  </div>
                </div>
                <div style={{ marginBottom: '1.5rem' }}>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem' }}>Duration (minutes)</label>
                  <select 
                    value={bookingData.duration} 
                    onChange={e => setBookingData({...bookingData, duration: e.target.value})}
                    required
                    style={{ width: '100%', padding: '0.75rem', borderRadius: '4px', border: '1px solid var(--border-subtle)', background: 'rgba(0,0,0,0.2)', color: 'white' }}
                  >
                    <option value="30">30 minutes</option>
                    <option value="45">45 minutes</option>
                    <option value="60">1 hour</option>
                    <option value="90">1.5 hours</option>
                  </select>
                </div>
                
                {bookingError && <div style={{ color: '#ef4444', marginBottom: '1rem' }}>{bookingError}</div>}
                {bookingSuccess && <div style={{ color: '#10b981', marginBottom: '1rem', fontWeight: 'bold' }}>{bookingSuccess}</div>}

                <div style={{ display: 'flex', gap: '1rem' }}>
                  <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>Book Now</button>
                  <button type="button" onClick={() => setShowBookingModal(false)} style={{ background: 'rgba(255,255,255,0.1)', border: 'none', color: 'white', padding: '0.75rem', borderRadius: '4px', cursor: 'pointer' }}>Cancel</button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {error && <div style={{ color: '#ef4444', marginBottom: '1rem' }}>{error}</div>}

      <div style={{ marginBottom: '3rem' }}>
        <h3 style={{ borderBottom: '1px solid var(--border-subtle)', paddingBottom: '0.5rem', marginBottom: '1.5rem' }}>Upcoming Sessions</h3>
        {upcoming.length === 0 ? (
          <p style={{ color: 'var(--text-muted)' }}>No upcoming sessions scheduled.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {upcoming.map(session => (
              <div key={session.id} className="glass-card" style={{ padding: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h4 style={{ margin: '0 0 0.5rem 0', color: 'var(--accent-primary)', fontSize: '1.2rem' }}>
                    {new Date(session.scheduledAt).toLocaleString([], { dateStyle: 'full', timeStyle: 'short' })}
                  </h4>
                  <div style={{ color: 'var(--text-primary)', marginBottom: '0.5rem' }}>
                    Mentor: <strong>{session.mentorship?.mentor?.user?.name}</strong>
                  </div>
                  <div style={{ display: 'flex', gap: '1.5rem', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                    <span>Duration: {session.duration} min</span>
                  </div>
                </div>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', alignItems: 'flex-end' }}>
                  {new Date() >= new Date(new Date(session.scheduledAt).getTime() - 10 * 60000) ? (
                    <Link to={`/student/sessions/${session.id}/live`} className="btn btn-primary" style={{ padding: '0.5rem 1rem', textDecoration: 'none', textAlign: 'center' }}>
                      Join Session
                    </Link>
                  ) : (
                    <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                      Available 10 mins before
                    </span>
                  )}
                  <button onClick={() => handleCancelSession(session.id)} style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.3)', padding: '0.5rem 1rem', borderRadius: '4px', cursor: 'pointer' }}>
                    Cancel
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div>
        <h3 style={{ borderBottom: '1px solid var(--border-subtle)', paddingBottom: '0.5rem', marginBottom: '1.5rem' }}>Past & Cancelled Sessions</h3>
        {past.length === 0 ? (
          <p style={{ color: 'var(--text-muted)' }}>No past sessions.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {past.map(session => (
              <div key={session.id} className="glass-card" style={{ padding: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', opacity: 0.8 }}>
                <div>
                  <h4 style={{ margin: '0 0 0.5rem 0', color: 'var(--text-primary)', fontSize: '1.1rem' }}>
                    {new Date(session.scheduledAt).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}
                  </h4>
                  <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                    Mentor: {session.mentorship?.mentor?.user?.name} | {session.duration} min
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', alignItems: 'flex-end' }}>
                  <span style={{ 
                    padding: '0.25rem 0.75rem', borderRadius: '12px', fontSize: '0.8rem', fontWeight: 'bold',
                    background: session.status === 'COMPLETED' ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)',
                    color: session.status === 'COMPLETED' ? '#10b981' : '#ef4444'
                  }}>
                    {session.status}
                  </span>
                  {session.status === 'COMPLETED' && (
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <Link to={`/student/sessions/${session.id}/review`} style={{ fontSize: '0.85rem', color: 'var(--accent-primary)', textDecoration: 'underline' }}>
                        Rate Session
                      </Link>
                      <Link to={`/student/sessions/${session.id}/report`} style={{ fontSize: '0.85rem', color: '#ef4444', textDecoration: 'underline' }}>
                        Report
                      </Link>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
