
import { useState, useEffect } from 'react';

export default function SessionCountdown({ scheduledAt, duration, status }) {
  const [timeLeft, setTimeLeft] = useState('');
  const [sessionState, setSessionState] = useState('');

  useEffect(() => {
    if (!scheduledAt) return;
    
    if (status === 'CANCELLED') {
      setSessionState('Cancelled');
      setTimeLeft('');
      return;
    }
    if (status === 'COMPLETED') {
      setSessionState('Completed');
      setTimeLeft('');
      return;
    }

    const start = new Date(scheduledAt).getTime();
    if (isNaN(start)) {
      setSessionState('Invalid Date');
      setTimeLeft('');
      return;
    }
    const end = start + duration * 60000;

    const updateCountdown = () => {
      const now = new Date().getTime();
      if (now > end) {
        setSessionState('Session Ended');
        setTimeLeft('');
      } else if (now >= start) {
        setSessionState('Live Now');
        setTimeLeft('');
      } else {
        const diff = start - now;
        
        const days = Math.floor(diff / (1000 * 60 * 60 * 24));
        const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((diff % (1000 * 60)) / 1000);
        
        let formatted = '';
        if (days > 0) {
          formatted = `${days}d ${hours.toString().padStart(2, '0')}h ${minutes.toString().padStart(2, '0')}m`;
        } else if (hours > 0) {
          formatted = `${hours.toString().padStart(2, '0')}h ${minutes.toString().padStart(2, '0')}m ${seconds.toString().padStart(2, '0')}s`;
        } else {
          formatted = `${minutes.toString().padStart(2, '0')}m ${seconds.toString().padStart(2, '0')}s`;
        }
        
        setSessionState('Starts in');
        setTimeLeft(formatted);
      }
    };

    updateCountdown();
    const intervalId = setInterval(updateCountdown, 1000);

    return () => clearInterval(intervalId);
  }, [scheduledAt, duration, status]);

  if (!scheduledAt) return null;

  let stateColor = 'var(--text-secondary)';
  if (sessionState === 'Live Now') stateColor = 'var(--success)';
  else if (sessionState === 'Cancelled') stateColor = 'var(--error)';
  else if (sessionState === 'Session Ended' || sessionState === 'Completed') stateColor = 'var(--text-muted)';

  return (
    <div style={{ padding: '0.75rem', background: 'var(--bg-surface-elevated)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-sm)', textAlign: 'center' }}>
      <div style={{ fontSize: '0.85rem', color: stateColor, marginBottom: timeLeft ? '0.25rem' : '0', fontWeight: sessionState === 'Live Now' ? 'bold' : 'normal' }}>
        {sessionState}
      </div>
      {timeLeft && (
        <div style={{ fontSize: '1.25rem', fontWeight: 'bold', fontFamily: 'monospace', color: 'var(--accent-primary)' }}>
          {timeLeft}
        </div>
      )}
    </div>
  );
}
