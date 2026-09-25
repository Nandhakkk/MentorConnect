import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import BackLink from '../../components/BackLink';
import PageHeader from '../../components/PageHeader';
import { bookSession } from '../../services/sessionService';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';
const getAuthHeaders = () => {
  const token = localStorage.getItem('mentorconnect_token');
  return { 'Content-Type': 'application/json', ...(token && { Authorization: `Bearer ${token}` }) };
};

export default function BookSession() {
  const { id } = useParams(); // Mentorship ID
  const navigate = useNavigate();

  const [mentorship, setMentorship] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  const [selectedTopic, setSelectedTopic] = useState('');
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedTime, setSelectedTime] = useState('');
  const [duration, setDuration] = useState(60);
  
  const [bookingLoading, setBookingLoading] = useState(false);
  const [bookingError, setBookingError] = useState('');

  useEffect(() => {
    const fetchMentorship = async () => {
      try {
        setLoading(true);
        const res = await fetch(`${API_BASE_URL}/mentorships/${id}`, {
          headers: getAuthHeaders()
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || 'Failed to fetch mentorship');
        setMentorship(data.mentorship);
        
        if (data.mentorship.mentor.topics?.length > 0) {
          setSelectedTopic(data.mentorship.mentor.topics[0].topic.name);
        }
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchMentorship();
  }, [id]);

  const handleBook = async (e) => {
    e.preventDefault();
    setBookingError('');
    
    if (!selectedDate || !selectedTime || !selectedTopic) {
      setBookingError('Please fill in all fields.');
      return;
    }
    
    try {
      setBookingLoading(true);
      // Combine date and time for backend (Assumed local timezone sending to UTC)
      const scheduledAt = new Date(`${selectedDate}T${selectedTime}:00`).toISOString();
      
      await bookSession({
        mentorshipId: id,
        topic: selectedTopic,
        scheduledAt,
        duration: parseInt(duration, 10)
      });
      
      alert('Session selected — payment required. Redirecting to sessions...');
      navigate('/student/sessions');
    } catch (err) {
      setBookingError(err.message);
    } finally {
      setBookingLoading(false);
    }
  };

  if (loading) return <div className="page-content">Loading mentorship details...</div>;
  if (error || !mentorship) return <div className="page-content" style={{ color: '#ef4444' }}>{error || 'Not found'}</div>;

  const mentor = mentorship.mentor;
  const fee = mentor.sessionFee || 0;
  const totalAmount = (fee * duration) / 60;

  return (
    <div className="page-content">
      <BackLink to="/student/mentorships">Back to My Mentors</BackLink>
      <PageHeader title={`Book Session with ${mentor.user.name}`} subtitle="Select a topic, date, and time that fits within the mentor's availability." />

      <div style={{ display: 'flex', gap: '2rem', flexWrap: 'wrap' }}>
        
        {/* Booking Form */}
        <div className="glass-card" style={{ flex: '1 1 400px', padding: '2rem' }}>
          <form onSubmit={handleBook}>
            
            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-secondary)' }}>Session Topic</label>
              <select 
                value={selectedTopic} 
                onChange={e => setSelectedTopic(e.target.value)}
                style={{ width: '100%', padding: '0.75rem', borderRadius: '4px', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--border-subtle)', color: 'white' }}
                required
              >
                <option value="">Select a topic</option>
                {mentor.topics?.map(t => (
                  <option key={t.topicId} value={t.topic.name}>{t.topic.name}</option>
                ))}
              </select>
            </div>

            <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem' }}>
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-secondary)' }}>Date</label>
                <input 
                  type="date" 
                  value={selectedDate} 
                  onChange={e => setSelectedDate(e.target.value)}
                  min={new Date().toISOString().split('T')[0]}
                  style={{ width: '100%', padding: '0.75rem', borderRadius: '4px', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--border-subtle)', color: 'white' }}
                  required
                />
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-secondary)' }}>Start Time (Local)</label>
                <input 
                  type="time" 
                  value={selectedTime} 
                  onChange={e => setSelectedTime(e.target.value)}
                  style={{ width: '100%', padding: '0.75rem', borderRadius: '4px', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--border-subtle)', color: 'white' }}
                  required
                />
              </div>
            </div>

            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-secondary)' }}>Duration (minutes)</label>
              <select 
                value={duration} 
                onChange={e => setDuration(Number(e.target.value))}
                style={{ width: '100%', padding: '0.75rem', borderRadius: '4px', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--border-subtle)', color: 'white' }}
              >
                <option value={30}>30 mins</option>
                <option value={60}>60 mins</option>
                <option value={90}>90 mins</option>
                <option value={120}>120 mins</option>
              </select>
            </div>

            {bookingError && <div style={{ color: '#ef4444', marginBottom: '1rem', padding: '0.75rem', background: 'rgba(239, 68, 68, 0.1)', borderRadius: '4px' }}>{bookingError}</div>}

            <button type="submit" disabled={bookingLoading} className="btn btn-primary" style={{ width: '100%', padding: '1rem', fontSize: '1.1rem' }}>
              {bookingLoading ? 'Processing...' : 'Continue to Payment'}
            </button>
          </form>
        </div>

        {/* Sidebar Info */}
        <div style={{ flex: '1 1 300px', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          
          <div className="glass-card" style={{ padding: '1.5rem' }}>
            <h3 style={{ margin: '0 0 1rem 0' }}>Booking Summary</h3>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', color: 'var(--text-secondary)' }}>
              <span>Duration</span>
              <span style={{ color: 'white' }}>{duration} mins</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem', color: 'var(--text-secondary)' }}>
              <span>Hourly Rate</span>
              <span style={{ color: 'white' }}>${fee.toFixed(2)}/hr</span>
            </div>
            <div style={{ height: '1px', background: 'var(--border-subtle)', margin: '1rem 0' }}></div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', fontSize: '1.2rem', color: 'var(--accent-primary)' }}>
              <span>Total Amount</span>
              <span>${totalAmount.toFixed(2)}</span>
            </div>
          </div>

          <div className="glass-card" style={{ padding: '1.5rem' }}>
            <h3 style={{ margin: '0 0 1rem 0' }}>Mentor Availability</h3>
            {mentor.availabilities?.length === 0 ? (
              <p style={{ color: 'var(--text-secondary)' }}>No schedule provided.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {mentor.availabilities.filter(a => a.isActive).map(a => (
                  <div key={a.id} style={{ display: 'flex', justifyContent: 'space-between', background: 'rgba(0,0,0,0.2)', padding: '0.5rem', borderRadius: '4px' }}>
                    <span style={{ fontWeight: 'bold', color: 'var(--text-secondary)' }}>{a.dayOfWeek}</span>
                    <span style={{ fontFamily: 'monospace' }}>{a.startTime} - {a.endTime}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>

      </div>
    </div>
  );
}
