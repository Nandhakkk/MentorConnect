import { useState, useEffect } from 'react';
import {
  fetchGuardianStatus,
  saveGuardianContact,
  recordGuardianConsent,
  sendGuardianVerification,
  generateGuardianSummaryLink,
  revokeGuardianAccess
} from '../services/guardianService';

export default function GuardianSetupCard() {
  const [loading, setLoading] = useState(true);
  const [statusData, setStatusData] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    relationship: 'Parent',
    email: '',
    phone: ''
  });
  const [consentGranted, setConsentGranted] = useState(false);

  const [savingContact, setSavingContact] = useState(false);
  const [recordingConsent, setRecordingConsent] = useState(false);
  const [sendingVerify, setSendingVerify] = useState(false);
  const [generatingLink, setGeneratingLink] = useState(false);
  const [revoking, setRevoking] = useState(false);

  const [summaryLink, setSummaryLink] = useState('');
  const [summaryExpiresAt, setSummaryExpiresAt] = useState(null);
  const [copied, setCopied] = useState(false);

  const [msg, setMsg] = useState({ type: '', text: '' });

  const loadStatus = async () => {
    try {
      setLoading(true);
      const data = await fetchGuardianStatus();
      setStatusData(data);
      if (data.guardian) {
        setFormData({
          name: data.guardian.name || '',
          relationship: data.guardian.relationship || 'Parent',
          email: data.guardian.email || '',
          phone: data.guardian.phone || ''
        });
        setConsentGranted(data.guardian.consentStatus === 'GRANTED');
      }
    } catch (err) {
      setMsg({ type: 'error', text: err.message });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStatus();
  }, []);

  const handleSaveContact = async (e) => {
    e.preventDefault();
    setSavingContact(true);
    setMsg({ type: '', text: '' });
    try {
      const res = await saveGuardianContact(formData);
      setMsg({ type: 'success', text: res.message || 'Guardian contact details saved.' });
      await loadStatus();
    } catch (err) {
      setMsg({ type: 'error', text: err.message });
    } finally {
      setSavingContact(false);
    }
  };

  const handleConsentSubmit = async () => {
    setRecordingConsent(true);
    setMsg({ type: '', text: '' });
    try {
      const res = await recordGuardianConsent(consentGranted);
      setMsg({ type: 'success', text: res.message || 'Consent updated successfully.' });
      await loadStatus();
    } catch (err) {
      setMsg({ type: 'error', text: err.message });
    } finally {
      setRecordingConsent(false);
    }
  };

  const handleSendVerification = async () => {
    setSendingVerify(true);
    setMsg({ type: '', text: '' });
    try {
      const res = await sendGuardianVerification();
      setMsg({ type: 'success', text: res.message || 'Verification email dispatched.' });
      await loadStatus();
    } catch (err) {
      setMsg({ type: 'error', text: err.message });
    } finally {
      setSendingVerify(false);
    }
  };

  const handleGenerateSummaryLink = async () => {
    setGeneratingLink(true);
    setMsg({ type: '', text: '' });
    try {
      const res = await generateGuardianSummaryLink();
      setSummaryLink(res.summaryUrl);
      setSummaryExpiresAt(res.expiresAt);
      setMsg({ type: 'success', text: 'Secure 24-hour summary link generated.' });
    } catch (err) {
      setMsg({ type: 'error', text: err.message });
    } finally {
      setGeneratingLink(false);
    }
  };

  const handleCopyLink = () => {
    if (!summaryLink) return;
    navigator.clipboard.writeText(summaryLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };


  const handleRevoke = async () => {
    if (!window.confirm('Are you sure you want to revoke guardian monitoring access? Active links will expire immediately.')) {
      return;
    }
    setRevoking(true);
    setMsg({ type: '', text: '' });
    try {
      await revokeGuardianAccess('REVOKED_BY_STUDENT');
      setMsg({ type: 'success', text: 'Guardian monitoring access has been revoked.' });
      setSummaryLink('');
      await loadStatus();
    } catch (err) {
      setMsg({ type: 'error', text: err.message });
    } finally {
      setRevoking(false);
    }
  };

  if (loading) {
    return (
      <div className="glass-card" style={{ padding: '2rem', textAlign: 'center' }}>
        <p style={{ color: 'var(--text-secondary)' }}>Loading guardian monitoring status...</p>
      </div>
    );
  }

  // Adult student state: do not render any guardian UI for 18+ adult learners
  if (!statusData?.isMinor) {
    return null;
  }

  const guardian = statusData.guardian;
  const isVerified = guardian?.isVerified;
  const isMonitoringActive = guardian?.isMonitoringActive;
  const isConsentGranted = guardian?.consentStatus === 'GRANTED';

  return (
    <div className="glass-card" style={{ padding: '2rem', marginTop: '1.5rem' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.25rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ fontSize: '1.5rem' }}>🛡️</span>
            <h3 style={{ margin: 0, fontSize: '1.25rem' }}>Guardian Safeguarding & Monitoring</h3>
          </div>
          <p style={{ margin: '0.25rem 0 0', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
            Under-18 Learner (Age {statusData?.age}) · Parental & Responsible Adult Oversight
          </p>
        </div>

        {/* Badges */}
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <span style={{
            padding: '4px 10px',
            borderRadius: '12px',
            fontSize: '0.75rem',
            fontWeight: 600,
            background: isVerified ? 'var(--success-bg)' : 'var(--warning-bg)',
            color: isVerified ? 'var(--success)' : 'var(--warning)',
            border: '1px solid var(--border-subtle)'
          }}>
            {isVerified ? '✓ Contact Verified' : '⚠ Verification Pending'}
          </span>

          <span style={{
            padding: '4px 10px',
            borderRadius: '12px',
            fontSize: '0.75rem',
            fontWeight: 600,
            background: isConsentGranted ? 'var(--info-bg)' : 'var(--error-bg)',
            color: isConsentGranted ? 'var(--info)' : 'var(--error)',
            border: '1px solid var(--border-subtle)'
          }}>
            {isConsentGranted ? 'Consent Recorded' : 'Consent Pending'}
          </span>
        </div>
      </div>

      {/* Global Message */}
      {msg.text && (
        <div style={{
          padding: '0.75rem 1rem',
          borderRadius: 'var(--radius-md)',
          marginBottom: '1.25rem',
          fontSize: '0.9rem',
          background: msg.type === 'error' ? 'var(--error-bg)' : 'var(--success-bg)',
          color: msg.type === 'error' ? 'var(--error)' : 'var(--success)',
          border: '1px solid var(--border-subtle)'
        }}>
          {msg.text}
        </div>
      )}

      {/* Privacy Notice Banner */}
      <div style={{ background: 'var(--info-bg)', borderLeft: '4px solid var(--info)', padding: '1rem', borderRadius: '4px', marginBottom: '1.5rem' }}>
        <h4 style={{ margin: '0 0 0.5rem', fontSize: '0.95rem', color: 'var(--info)' }}>Safeguarding & Information Sharing Policy</h4>
        <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: '1.5' }}>
          Your verified guardian will receive updates for booked mentoring sessions, milestone completions, payment receipts, and authorized complaint updates.
          <strong> Private 1-on-1 student-mentor chat messages and private AI conversations are strictly confidential and will never be shared with your guardian.</strong>
        </p>
      </div>

      {/* Step 1: Contact Form */}
      <form onSubmit={handleSaveContact} style={{ marginBottom: '1.5rem' }}>
        <h4 style={{ fontSize: '1rem', marginBottom: '1rem', color: 'var(--text-primary)' }}>1. Guardian Contact Details</h4>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem', marginBottom: '1rem' }}>
          <div>
            <label className="form-label">Guardian Full Name *</label>
            <input
              type="text"
              required
              className="form-input"
              placeholder="e.g. Eleanor Vance"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            />
          </div>

          <div>
            <label className="form-label">Relationship *</label>
            <select
              className="form-input"
              value={formData.relationship}
              onChange={(e) => setFormData({ ...formData, relationship: e.target.value })}
            >
              <option value="Parent">Parent</option>
              <option value="Legal Guardian">Legal Guardian</option>
              <option value="Family Member">Family Member</option>
              <option value="Other">Other</option>
            </select>
          </div>

          <div>
            <label className="form-label">Guardian Email *</label>
            <input
              type="email"
              required
              className="form-input"
              placeholder="e.g. guardian@example.com"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            />
          </div>

          <div>
            <label className="form-label">Mobile Phone (Optional)</label>
            <input
              type="tel"
              className="form-input"
              placeholder="+91 98765 43210"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
            />
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
          <button type="submit" className="btn btn-primary" disabled={savingContact}>
            {savingContact ? 'Saving...' : (guardian ? 'Update Contact Details' : 'Save Guardian Contact')}
          </button>
        </div>
      </form>

      {/* Step 2: Consent & Verification (Visible once guardian contact is saved) */}
      {guardian && (
        <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '1.5rem', marginBottom: '1.5rem' }}>
          <h4 style={{ fontSize: '1rem', marginBottom: '1rem', color: 'var(--text-primary)' }}>2. Student Consent & Contact Verification</h4>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.25rem' }}>
            {/* Consent Box */}
            <div style={{ background: 'var(--bg-surface-elevated)', padding: '1rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
              <h5 style={{ margin: '0 0 0.5rem', fontSize: '0.9rem', color: 'var(--text-primary)' }}>Guardian Data Sharing Consent</h5>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.75rem' }}>
                I acknowledge and authorize MentorConnect to share authorized session dates, learning milestones, and payment receipts with my registered guardian.
              </p>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', cursor: 'pointer', marginBottom: '0.75rem', color: 'var(--text-primary)' }}>
                <input
                  type="checkbox"
                  checked={consentGranted}
                  onChange={(e) => setConsentGranted(e.target.checked)}
                />
                <span>I grant consent for guardian monitoring (Policy v1.0)</span>
              </label>
              <button
                type="button"
                className="btn btn-secondary"
                style={{ fontSize: '0.8rem', padding: '6px 12px' }}
                disabled={recordingConsent}
                onClick={handleConsentSubmit}
              >
                {recordingConsent ? 'Recording...' : 'Update Consent'}
              </button>
            </div>

            {/* Email Verification Box */}
            <div style={{ background: 'var(--bg-surface-elevated)', padding: '1rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
              <h5 style={{ margin: '0 0 0.5rem', fontSize: '0.9rem', color: 'var(--text-primary)' }}>Email Verification</h5>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.75rem' }}>
                {isVerified ? (
                  <span style={{ color: 'var(--success)', fontWeight: 500 }}>
                    ✓ Contact confirmed on {new Date(guardian.emailVerifiedAt).toLocaleDateString()}. Updates are active.
                  </span>
                ) : (
                  <span>
                    A single-use link must be verified by your guardian before monitoring emails are dispatched.
                  </span>
                )}
              </p>
              <button
                type="button"
                className="btn btn-primary"
                style={{ fontSize: '0.8rem', padding: '6px 12px' }}
                disabled={sendingVerify || !formData.email}
                onClick={handleSendVerification}
              >
                {sendingVerify ? 'Dispatching...' : (isVerified ? 'Resend Verification Link' : 'Send Verification Email')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Step 3: Secure Summary Link Generator (Visible when verified) */}
      {guardian && isVerified && (
        <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '1.5rem', marginBottom: '1.5rem' }}>
          <h4 style={{ fontSize: '1rem', marginBottom: '0.5rem', color: 'var(--text-primary)' }}>3. Secure 24-Hour Summary Link</h4>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
            Generate a random, read-only link your guardian can open without requiring a login or password. Links automatically expire after 24 hours.
          </p>

          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center', marginBottom: '1rem' }}>
            <button
              type="button"
              className="btn btn-secondary"
              disabled={generatingLink || !isMonitoringActive}
              onClick={handleGenerateSummaryLink}
            >
              {generatingLink ? 'Generating...' : 'Generate New 24-Hour Link'}
            </button>
          </div>

          {summaryLink && (
            <div style={{ background: 'var(--bg-surface-elevated)', padding: '1rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
              <div style={{ fontSize: '0.8rem', color: 'var(--success)', fontWeight: 500, marginBottom: '0.5rem' }}>
                ✓ Link active until: {new Date(summaryExpiresAt).toLocaleString()}
              </div>
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <input
                  type="text"
                  readOnly
                  value={summaryLink}
                  className="form-input"
                  style={{ fontSize: '0.85rem' }}
                />
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={handleCopyLink}
                  style={{ whiteSpace: 'nowrap' }}
                >
                  {copied ? 'Copied!' : 'Copy Link'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Revoke Monitoring Access (Visible when monitoring is active) */}
      {guardian && isMonitoringActive && (
        <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '1.25rem', marginTop: '1.5rem', display: 'flex', justifyContent: 'flex-end' }}>
          <button
            type="button"
            className="btn btn-outline"
            style={{ borderColor: 'var(--error, #ef4444)', color: 'var(--error, #ef4444)' }}
            disabled={revoking}
            onClick={handleRevoke}
          >
            {revoking ? 'Revoking...' : 'Revoke Monitoring Access'}
          </button>
        </div>
      )}
    </div>
  );
}
