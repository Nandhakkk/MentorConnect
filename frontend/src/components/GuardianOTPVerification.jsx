import React, { useState, useEffect } from 'react';
import { sendGuardianOtp, verifyGuardianOtp } from '../services/guardianService';

export default function GuardianOTPVerification({
  guardian,
  token,
  onVerified,
  disabled = false
}) {
  const [otp, setOtp] = useState('');
  const [codeSent, setCodeSent] = useState(false);
  const [recipientMasked, setRecipientMasked] = useState('');
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [cooldown, setCooldown] = useState(0);

  // Countdown timer for resend cooldown
  useEffect(() => {
    if (cooldown <= 0) return;
    const interval = setInterval(() => {
      setCooldown(c => (c > 1 ? c - 1 : 0));
    }, 1000);
    return () => clearInterval(interval);
  }, [cooldown]);

  const handleSendCode = async () => {
    setError('');
    setSuccessMsg('');

    if (!guardian?.email) {
      setError('Guardian email address is required for Email verification.');
      return;
    }

    setSending(true);

    try {
      const res = await sendGuardianOtp('EMAIL', token);
      setCodeSent(true);
      setRecipientMasked(res.recipient || guardian.email);
      setCooldown(res.cooldownSeconds || 60);
      setSuccessMsg(res.message || "A verification code has been sent to the Guardian's email address.");
    } catch (err) {
      setError(err.message || 'Failed to send verification code.');
    } finally {
      setSending(false);
    }
  };

  const handleVerify = async (e) => {
    if (e) e.preventDefault();
    if (!otp || otp.trim().length !== 6) {
      setError('Please enter the 6-digit verification code.');
      return;
    }

    setError('');
    setSuccessMsg('');
    setVerifying(true);

    try {
      const res = await verifyGuardianOtp(otp.trim(), 'EMAIL', token);
      setSuccessMsg(res.message || 'Guardian contact email successfully verified!');
      if (onVerified) {
        onVerified(res);
      }
    } catch (err) {
      setError(err.message || 'Invalid or expired verification code.');
    } finally {
      setVerifying(false);
    }
  };

  if (guardian?.isVerified) {
    return (
      <div style={{
        padding: '1.25rem',
        borderRadius: 'var(--radius-md)',
        background: 'var(--success-bg)',
        border: '1px solid var(--success-border)',
        display: 'flex',
        alignItems: 'center',
        gap: '0.75rem',
        marginTop: '1rem'
      }}>
        <div style={{
          width: '36px',
          height: '36px',
          borderRadius: '50%',
          background: 'var(--success)',
          color: '#fff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontWeight: 700,
          fontSize: '1.1rem'
        }}>✓</div>
        <div>
          <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>
            Guardian Contact Verified
          </div>
          <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
            Verified via Email ({guardian.email}). Guardian monitoring is active.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{
      padding: '1.5rem',
      borderRadius: 'var(--radius-md)',
      background: 'var(--bg-card)',
      border: '1px solid var(--border-subtle)',
      marginTop: '1.25rem'
    }}>
      <div style={{ marginBottom: '1rem' }}>
        <h4 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '0.25rem' }}>
          Step 4: Guardian Email OTP Verification
        </h4>
        <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: 0 }}>
          MentorConnect requires email verification of your parent or legal guardian's contact details before completing minor onboarding.
        </p>
      </div>

      {error && (
        <div style={{
          padding: '0.75rem 1rem',
          borderRadius: 'var(--radius-sm)',
          background: 'var(--error-bg)',
          color: 'var(--error)',
          fontSize: '0.85rem',
          marginBottom: '1rem',
          border: '1px solid var(--error-border)'
        }}>
          {error}
        </div>
      )}

      {successMsg && (
        <div style={{
          padding: '0.75rem 1rem',
          borderRadius: 'var(--radius-sm)',
          background: 'var(--success-bg)',
          color: 'var(--success)',
          fontSize: '0.85rem',
          marginBottom: '1rem',
          border: '1px solid var(--success-border)'
        }}>
          {successMsg}
        </div>
      )}

      {/* Target Email Display */}
      <div style={{
        marginBottom: '1.25rem',
        padding: '0.85rem 1rem',
        background: 'var(--bg-surface-elevated)',
        borderRadius: 'var(--radius-sm)',
        border: '1px solid var(--border-subtle)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between'
      }}>
        <div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Verification Target
          </div>
          <div style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-primary)' }}>
            ✉️ {guardian?.email || 'No email provided'}
          </div>
        </div>
        <span style={{
          fontSize: '0.75rem',
          padding: '0.2rem 0.6rem',
          borderRadius: '999px',
          background: 'var(--info-bg)',
          color: 'var(--info)',
          border: '1px solid var(--info-border)',
          fontWeight: 600
        }}>
          Email OTP
        </span>
      </div>

      {/* Code Request Action */}
      {!codeSent ? (
        <div>
          <button
            type="button"
            className="btn btn-primary"
            onClick={handleSendCode}
            disabled={disabled || sending || !guardian?.email}
            id="guardian-send-otp-btn"
          >
            {sending ? 'Sending Code...' : 'Send Verification Code via Email'}
          </button>
        </div>
      ) : (
        <div>
          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-end', flexWrap: 'wrap' }}>
            <div style={{ flex: '1', minWidth: '180px' }}>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.5rem' }}>
                Enter 6-Digit Code sent to {recipientMasked || guardian?.email || 'guardian'}
              </label>
              <input
                type="text"
                className="form-input"
                placeholder="123456"
                maxLength={6}
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                disabled={disabled || verifying}
                style={{ fontSize: '1.2rem', letterSpacing: '4px', textAlign: 'center', fontWeight: 700 }}
                id="guardian-otp-input"
              />
            </div>

            <button
              type="button"
              className="btn btn-primary"
              onClick={handleVerify}
              disabled={disabled || verifying || otp.length !== 6}
              id="guardian-verify-otp-btn"
            >
              {verifying ? 'Verifying...' : 'Verify Code'}
            </button>

            <button
              type="button"
              className="btn btn-secondary"
              onClick={handleSendCode}
              disabled={disabled || sending || cooldown > 0}
              id="guardian-resend-otp-btn"
            >
              {cooldown > 0 ? `Resend Code (${cooldown}s)` : 'Resend Code'}
            </button>
          </div>

          <div style={{ marginTop: '0.75rem' }}>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: 0 }}>
              Verification code expires in 10 minutes. Maximum 5 incorrect attempts before code is invalidated.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
