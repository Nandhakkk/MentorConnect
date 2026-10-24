import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { confirmGuardianVerification } from '../../services/guardianService';

export default function GuardianVerify() {
  const { token } = useParams();
  const [loading, setLoading] = useState(true);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  const [studentName, setStudentName] = useState('');

  useEffect(() => {
    const runVerification = async () => {
      if (!token) {
        setError('No verification token provided.');
        setLoading(false);
        return;
      }
      try {
        const res = await confirmGuardianVerification(token);
        setSuccess(true);
        setStudentName(res.studentName || 'the student');
      } catch (err) {
        setError(err.message || 'Verification link is invalid or expired.');
      } finally {
        setLoading(false);
      }
    };
    runVerification();
  }, [token]);

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '2rem',
      backgroundColor: 'var(--bg-primary)',
      color: 'var(--text-primary)'
    }}>
      <div className="glass-card" style={{ maxWidth: '540px', width: '100%', padding: '2.5rem', textAlign: 'center' }}>
        <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>
          {loading ? '⏳' : success ? '🛡️' : '⚠️'}
        </div>

        <h2 style={{ fontSize: '1.5rem', marginBottom: '0.75rem', color: 'var(--text-primary)' }}>
          {loading ? 'Verifying Guardian Contact...' : success ? 'Contact Successfully Verified!' : 'Verification Notice'}
        </h2>

        {loading && (
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>
            Please wait while we validate your secure token...
          </p>
        )}

        {!loading && success && (
          <div>
            <div style={{
              background: 'var(--success-bg)',
              border: '1px solid var(--border-subtle)',
              borderRadius: '8px',
              padding: '1.25rem',
              marginBottom: '1.5rem',
              textAlign: 'left'
            }}>
              <p style={{ margin: '0 0 0.5rem', fontWeight: 600, color: 'var(--success)' }}>
                ✓ Monitoring updates are now active for {studentName}.
              </p>
              <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: '1.5' }}>
                You will receive email notifications for confirmed mentoring sessions, milestone completions, payment receipts, and authorized safety updates.
              </p>
            </div>

            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1.5rem' }}>
              Whenever you wish to view {studentName}&apos;s learning progress and calendar, request a secure 24-hour summary link from the learner. No password or separate account is required.
            </p>

            <Link to="/" className="btn btn-primary" style={{ display: 'inline-block' }}>
              Return to MentorConnect Home
            </Link>
          </div>
        )}

        {!loading && !success && (
          <div>
            <div style={{
              background: 'var(--error-bg)',
              border: '1px solid var(--border-subtle)',
              borderRadius: '8px',
              padding: '1.25rem',
              marginBottom: '1.5rem',
              color: 'var(--error)',
              fontSize: '0.9rem'
            }}>
              {error}
            </div>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>
              Verification links are single-use and expire within 24 hours. If this link has expired, please ask the student to resend a verification email from their profile.
            </p>
            <Link to="/" className="btn btn-secondary" style={{ display: 'inline-block' }}>
              Go to Home Page
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
