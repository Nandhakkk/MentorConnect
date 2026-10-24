import { formatCurrency } from '../../utils/currency';
import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import BackLink from '../../components/BackLink';
import PageHeader from '../../components/PageHeader';
import { bookSession } from '../../services/sessionService';
import { createPaymentOrder, verifyPayment } from '../../services/paymentService';
import { useAuth } from '../../context/AuthContext';
import { getAgeCategory } from '../../utils/ageHelper';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';
const MIN_BOOKING_LEAD_HOURS = 6;
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
  const [bookingStatus, setBookingStatus] = useState('');

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
    setBookingStatus('');

    if (!selectedDate || !selectedTime || !selectedTopic) {
      setBookingError('Please fill in all fields.');
      return;
    }

    try {
      setBookingLoading(true);
      const scheduledAtObj = new Date(`${selectedDate}T${selectedTime}:00`);

      if (scheduledAtObj.getTime() - Date.now() < MIN_BOOKING_LEAD_HOURS * 60 * 60 * 1000) {
        setBookingError('Sessions must be booked at least 6 hours in advance.');
        setBookingLoading(false);
        return;
      }

      const scheduledAt = scheduledAtObj.toISOString();

      setBookingStatus('Booking session slot...');
      const session = await bookSession({
        mentorshipId: id,
        topic: selectedTopic,
        scheduledAt,
        duration: parseInt(duration, 10)
      });

      // Now that the session is booked (and Payment record created in CREATED state),
      // we initiate the Razorpay order
      setBookingStatus('Initializing payment gateway...');
      const orderRes = await createPaymentOrder(session.id);

      // Load Razorpay Script dynamically if needed
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
        setBookingStatus('');
        setBookingError('Failed to load payment gateway script. Please check your network connection.');
        setBookingLoading(false);
        return;
      }

      let paymentCompleted = false;

      const options = {
        key: orderRes.key,
        amount: orderRes.amount,
        currency: orderRes.currency,
        name: "MentorConnect",
        description: `Session with ${mentor.user.name}`,
        order_id: orderRes.orderId,
        handler: async function (response) {
           paymentCompleted = true;
           try {
              setBookingStatus('Verifying payment... Please do not close the window.');
              await verifyPayment({
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
                sessionId: session.id
              });
              setBookingStatus('');
              alert('Payment verified! Session scheduled.');
              navigate('/student/sessions');
           } catch (verifyErr) {
              setBookingStatus('');
              setBookingError(verifyErr.message || 'Payment verification failed. Please try again.');
           }
        },
        modal: {
          ondismiss: async function () {
            if (!paymentCompleted) {
              setBookingLoading(false);
              setBookingStatus('');
              setBookingError('Payment was not completed. Your session has not been confirmed.');
              try {
                await cancelSession(session.id);
              } catch (cancelErr) {
                console.warn('Auto-cancel unpaid session error:', cancelErr.message);
              }
            }
          }
        },
        prefill: {
          name: user?.name || '',
          email: user?.email || '',
          ...(user?.phone && typeof user.phone === 'string' && user.phone.replace(/\D/g, '').length >= 10
            ? { contact: user.phone.trim() }
            : {})
        },
        config: {
          display: {
            blocks: {
              upi: {
                name: "Pay via UPI",
                instruments: [
                  {
                    method: "upi",
                    flows: ["qr", "intent"]
                  }
                ]
              },
              other: {
                name: "Cards, Netbanking & Wallets",
                instruments: [
                  { method: "card" },
                  { method: "netbanking" },
                  { method: "wallet" }
                ]
              }
            },
            sequence: ["block.upi", "block.other"],
            preferences: {
              show_default_blocks: true
            }
          }
        },
        theme: {
          color: "#1D4ED8"
        }
      };

      const rzp = new window.Razorpay(options);
      rzp.on('payment.failed', async function (response){
          paymentCompleted = false;
          setBookingLoading(false);
          setBookingStatus('');
          const reason = response.error?.description || 'Payment was declined or failed.';
          setBookingError(`Payment failed: ${reason} Your session has not been confirmed.`);
          try {
            await cancelSession(session.id);
          } catch (cancelErr) {
            console.warn('Auto-cancel unpaid session on failure error:', cancelErr.message);
          }
      });
      rzp.open();
      setBookingStatus('Awaiting payment... Please complete payment in the Razorpay checkout window.');
    } catch (err) {
      setBookingStatus('');
      setBookingError(err.message || 'Failed to book session.');
    } finally {
      setBookingLoading(false);
    }
  };

  if (loading) return <div className="page-content">Loading mentorship details...</div>;
  if (error || !mentorship) return <div className="page-content" style={{ color: 'var(--error)' }}>{error || 'Not found'}</div>;

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
                className="form-input"
                value={selectedTopic}
                onChange={e => setSelectedTopic(e.target.value)}
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
                  className="form-input"
                  value={selectedDate}
                  onChange={e => setSelectedDate(e.target.value)}
                  min={new Date(Date.now() + MIN_BOOKING_LEAD_HOURS * 60 * 60 * 1000).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })}
                  required
                />
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-secondary)' }}>Start Time (Local)</label>
                <input
                  type="time"
                  className="form-input"
                  value={selectedTime}
                  onChange={e => setSelectedTime(e.target.value)}
                  required
                />
              </div>
            </div>

            <div style={{ marginBottom: '1.5rem', fontSize: '0.85rem', color: 'var(--text-secondary)', background: 'var(--info-bg)', border: '1px solid var(--border-subtle)', padding: '0.5rem', borderRadius: '4px' }}>
              ℹ️ Sessions must be booked at least 6 hours in advance.
            </div>

            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-secondary)' }}>Duration (minutes)</label>
              <select
                className="form-input"
                value={duration}
                onChange={e => setDuration(Number(e.target.value))}
              >
                <option value={30}>30 mins</option>
                <option value={60}>60 mins</option>
                <option value={90}>90 mins</option>
                <option value={120}>120 mins</option>
              </select>
            </div>

            {bookingStatus && !bookingError && (
              <div style={{ color: 'var(--info)', marginBottom: '1rem', padding: '0.75rem', background: 'var(--info-bg)', border: '1px solid var(--border-subtle)', borderRadius: '4px' }}>
                {bookingStatus}
              </div>
            )}
            {bookingError && <div style={{ color: 'var(--error)', marginBottom: '1rem', padding: '0.75rem', background: 'var(--error-bg)', border: '1px solid var(--border-subtle)', borderRadius: '4px' }}>{bookingError}</div>}

            {user?.dateOfBirth && getAgeCategory(user.dateOfBirth) !== 'ADULT' && (
              <div style={{ marginTop: '1.5rem', padding: '1rem', background: 'var(--warning-bg)', borderLeft: '4px solid var(--warning)', borderRadius: '4px' }}>
                <h4 style={{ margin: '0 0 0.5rem 0', color: 'var(--warning)' }}>Safety Reminder for Minors</h4>
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
            <h3 style={{ margin: '0 0 1rem 0', color: 'var(--text-primary)' }}>Booking Summary</h3>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', color: 'var(--text-secondary)' }}>
              <span>Duration</span>
              <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{duration} mins</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem', color: 'var(--text-secondary)' }}>
              <span>Hourly Rate</span>
              <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{formatCurrency(fee)}/hr</span>
            </div>
            <div style={{ height: '1px', background: 'var(--border-subtle)', margin: '1rem 0' }}></div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', fontSize: '1.2rem', color: 'var(--accent-primary)' }}>
              <span>Total Amount</span>
              <span>{formatCurrency(totalAmount)}</span>
            </div>
          </div>

          <div className="glass-card" style={{ padding: '1.5rem' }}>
            <h3 style={{ margin: '0 0 1rem 0', color: 'var(--text-primary)' }}>Mentor Availability</h3>
            {mentor.availabilities?.length === 0 ? (
              <p style={{ color: 'var(--text-secondary)' }}>No schedule provided.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {mentor.availabilities.filter(a => a.isActive).map(a => (
                  <div key={a.id} style={{ display: 'flex', justifyContent: 'space-between', background: 'var(--bg-surface-elevated)', border: '1px solid var(--border-subtle)', padding: '0.5rem', borderRadius: '4px' }}>
                    <span style={{ fontWeight: 'bold', color: 'var(--text-secondary)' }}>{a.dayOfWeek}</span>
                    <span style={{ fontFamily: 'monospace', color: 'var(--text-primary)' }}>{a.startTime} - {a.endTime}</span>
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
