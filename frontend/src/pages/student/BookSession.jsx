import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import BackLink from '../../components/BackLink';
import PageHeader from '../../components/PageHeader';
import { bookSession } from '../../services/sessionService';
import { createPaymentOrder, verifyPayment } from '../../services/paymentService';
import { useAuth } from '../../context/AuthContext';
import { getAgeCategory } from '../../utils/ageHelper';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';
const getAuthHeaders = () => {
  const token = localStorage.getItem('mentorconnect_token');
  return { 'Content-Type': 'application/json', ...(token && { Authorization: `Bearer ${token}` }) };
};

export default function BookSession() {
  const { id } = useParams(); // Mentorship ID
  const navigate = useNavigate();
  const { user } = useAuth();

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
      const scheduledAt = new Date(`${selectedDate}T${selectedTime}:00`).toISOString();
      
      const session = await bookSession({
        mentorshipId: id,
        topic: selectedTopic,
        scheduledAt,
        duration: parseInt(duration, 10)
      });
      
      // Now that the session is booked (and Payment record created in CREATED state),
      // we initiate the Razorpay order
      setBookingError('Verifying session... Please wait for the payment gateway.');
      const orderRes = await createPaymentOrder(session.id);
      
      // Load Razorpay Script dynamically if needed (you might prefer to load it in index.html)
      // Here we assume window.Razorpay will be available, but let's dynamically load it just in case
      const loadRazorpay = () => new Promise((resolve) => {
        if (window.Razorpay) return resolve(true);
        const script = document.createElement('script');
        script.src = 'https://checkout.razorpay.com/v1/checkout.js';
        script.onload = () => resolve(true);
        script.onerror = () => resolve(false);
        document.body.appendChild(script);
      });

      const loaded = await loadRazorpay();
      if (!loaded) {
        setBookingError('Failed to load payment gateway. Please check your network.');
        setBookingLoading(false);
        return;
      }
      
      const options = {
        key: orderRes.key, 
        amount: orderRes.amount, 
        currency: orderRes.currency,
        name: "MentorConnect",
        description: `Session with ${mentor.user.name}`,
        order_id: orderRes.orderId,
        handler: async function (response) {
           try {
              setBookingError('Verifying payment... Please do not close the window.');
              await verifyPayment({
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
                sessionId: session.id
              });
              alert('Payment verified! Session scheduled.');
              navigate('/student/sessions');
           } catch (verifyErr) {
              setBookingError(verifyErr.message || 'Payment verification failed. Please try again.');
           }
        },
        prefill: {
          name: user?.name,
          email: user?.email
        },
        theme: {
          color: "#6366f1"
        }
      };

      const rzp = new window.Razorpay(options);
      rzp.on('payment.failed', function (response){
          setBookingError(response.error.description || 'Payment failed.');
      });
      rzp.open();
      
      setBookingError('');
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
                  min={new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })}
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

            {user?.dateOfBirth && getAgeCategory(user.dateOfBirth) !== 'ADULT' && (
              <div style={{ marginTop: '1.5rem', padding: '1rem', background: 'rgba(245, 158, 11, 0.1)', borderLeft: '4px solid #f59e0b', borderRadius: '4px' }}>
                <h4 style={{ margin: '0 0 0.5rem 0', color: '#f59e0b' }}>Safety Reminder for Minors</h4>
                <p style={{ margin: 0, color: 'var(--text-secondary)' }}>
                  {getAgeCategory(user.dateOfBirth) === 'YOUNGER_MINOR' 
                    ? "Please ensure a parent or guardian is aware of this session booking. Do not share any personal or contact information with your mentor. All payments must be authorized by an adult."
                    : "Please remember not to share personal contact info (like your phone number or home address) during your sessions. If you ever feel uncomfortable, you can report the issue immediately."}
                </p>
              </div>
            )}

            <button type="submit" disabled={bookingLoading} className="btn btn-primary" style={{ width: '100%', padding: '1rem', fontSize: '1.1rem', marginTop: '1rem' }}>
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
