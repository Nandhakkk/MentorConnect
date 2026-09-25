import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { fetchLiveSession } from '../../services/sessionService';
import { useAuth } from '../../context/AuthContext';
import BackLink from '../../components/BackLink';

export default function LiveSession() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const jitsiContainerStyle = { width: '100%', height: '600px', borderRadius: '8px', overflow: 'hidden', background: '#000' };

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [sessionData, setSessionData] = useState(null);
  
  const jitsiRef = useRef(null);
  const apiRef = useRef(null);

  useEffect(() => {
    let mounted = true;

    const init = async () => {
      try {
        setLoading(true);
        const data = await fetchLiveSession(id);
        if (mounted) {
          if (!data.joinAllowed) {
             setError(getErrorMessage(data.reason, data.joinAvailableAt));
          } else {
             setSessionData(data);
          }
        }
      } catch (err) {
        if (mounted) setError(err.message);
      } finally {
        if (mounted) setLoading(false);
      }
    };
    init();

    return () => {
      mounted = false;
      if (apiRef.current) {
        apiRef.current.dispose();
      }
    };
  }, [id]);

  useEffect(() => {
    if (sessionData && sessionData.joinAllowed && jitsiRef.current && !apiRef.current) {
      const loadJitsiScript = () => {
        return new Promise((resolve) => {
          if (window.JitsiMeetExternalAPI) {
            return resolve(true);
          }
          const script = document.createElement('script');
          script.src = 'https://meet.jit.si/external_api.js';
          script.onload = () => resolve(true);
          script.onerror = () => resolve(false);
          document.body.appendChild(script);
        });
      };

      loadJitsiScript().then(loaded => {
        if (!loaded) {
          setError('Failed to load Jitsi API. Please check your connection.');
          return;
        }

        const domain = 'meet.jit.si';
        const options = {
          roomName: sessionData.meetingLink,
          width: '100%',
          height: '100%',
          parentNode: jitsiRef.current,
          userInfo: {
            displayName: user?.name || 'Participant',
          },
          configOverwrite: { 
            prejoinPageEnabled: false,
            startWithAudioMuted: true,
            startWithVideoMuted: true
          }
        };

        apiRef.current = new window.JitsiMeetExternalAPI(domain, options);
      });
    }
  }, [sessionData, user]);

  const getErrorMessage = (reason, availableAt) => {
    switch(reason) {
      case 'TOO_EARLY':
        return `It is too early to join. You can join at ${new Date(availableAt).toLocaleTimeString()}.`;
      case 'SESSION_ENDED':
        return 'This session has already ended.';
      case 'PAYMENT_REQUIRED':
        return 'Payment is required before joining this session.';
      case 'SESSION_CANCELLED':
        return 'This session was cancelled.';
      default:
        return 'You are not allowed to join this session.';
    }
  };

  if (loading) return <div className="page-content">Loading live session details...</div>;
  if (error) return (
    <div className="page-content">
       <BackLink to="/student/sessions">Back to Sessions</BackLink>
       <div className="glass-card" style={{ padding: '2rem', textAlign: 'center', marginTop: '2rem' }}>
         <h2 style={{ color: '#ef4444' }}>Cannot Join Session</h2>
         <p style={{ color: 'var(--text-secondary)' }}>{error}</p>
         <button onClick={() => navigate('/student/sessions')} className="btn btn-primary" style={{ marginTop: '1.5rem' }}>View All Sessions</button>
       </div>
    </div>
  );

  return (
    <div className="page-content" style={{ maxWidth: '1200px' }}>
      <BackLink to="/student/sessions">Leave Session</BackLink>
      
      <div style={{ marginBottom: '1.5rem', padding: '1.5rem', background: 'rgba(99, 102, 241, 0.1)', border: '1px solid rgba(99,102,241,0.2)', borderRadius: '8px' }}>
        <h2 style={{ margin: '0 0 0.5rem 0', color: 'var(--text-primary)' }}>Live Session: {sessionData.sessionDetails.topic}</h2>
        <div style={{ display: 'flex', gap: '2rem', color: 'var(--text-secondary)', fontSize: '0.95rem' }}>
          <span>Mentor: <strong style={{ color: 'white' }}>{sessionData.sessionDetails.mentor.name}</strong></span>
          <span>Student: <strong style={{ color: 'white' }}>{sessionData.sessionDetails.student.name}</strong></span>
          <span>Time: <strong style={{ color: 'white' }}>{new Date(sessionData.sessionDetails.scheduledAt).toLocaleTimeString()}</strong></span>
        </div>
      </div>

      <div className="glass-card" style={{ padding: '1rem' }}>
         <div ref={jitsiRef} style={jitsiContainerStyle} />
      </div>
    </div>
  );
}
