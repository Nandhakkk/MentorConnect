import { useState, useEffect } from 'react';
import {
  fetchMyStudentProfile,
  updateMyStudentProfile,
  uploadStudentProfileImage,
  requestEmailChange,
  verifyEmailChange,
  resendEmailChangeOtp,
  cancelEmailChange
} from '../../services/studentService';
import { useAuth } from '../../context/AuthContext';
import ImageCropper from '../../components/ImageCropper';
import GuardianSetupCard from '../../components/GuardianSetupCard';

const isMinor = (dobString) => {
  if (!dobString) return false;
  const dob = new Date(dobString);
  const today = new Date();
  let age = today.getFullYear() - dob.getFullYear();
  const m = today.getMonth() - dob.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) {
    age--;
  }
  return age < 18;
};

const calculateAge = (dobString) => {
  if (!dobString) return null;
  const dob = new Date(dobString);
  const today = new Date();
  let age = today.getFullYear() - dob.getFullYear();
  const m = today.getMonth() - dob.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) {
    age--;
  }
  return age;
};

export default function StudentProfileForm() {
  const { user, refreshUser } = useAuth();
  const [profile, setProfile] = useState({
    bio: '',
    education: '',
    skills: '',
    interests: '',
    careerGoal: ''
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [cropImageSrc, setCropImageSrc] = useState(null);

  // Student Email Verification & Change State
  const [showEmailChangeModal, setShowEmailChangeModal] = useState(false);
  const [newEmailInput, setNewEmailInput] = useState('');
  const [emailOtpInput, setEmailOtpInput] = useState('');
  const [emailActionLoading, setEmailActionLoading] = useState(false);
  const [emailActionMsg, setEmailActionMsg] = useState({ type: '', text: '' });
  const [emailCooldown, setEmailCooldown] = useState(0);

  useEffect(() => {
    const loadProfile = async () => {
      try {
        setLoading(true);
        const data = await fetchMyStudentProfile();
        setProfile({
          bio: data.bio || '',
          education: data.education || '',
          skills: data.skills || '',
          interests: data.interests || '',
          careerGoal: data.careerGoal || ''
        });
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    loadProfile();
  }, []);

  // Countdown timer for email OTP resend
  useEffect(() => {
    if (emailCooldown <= 0) return;
    const timer = setInterval(() => {
      setEmailCooldown(c => (c > 1 ? c - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [emailCooldown]);

  const handleSave = async (e) => {
    e.preventDefault();
    try {
      setSaving(true);
      setMessage('');
      setError('');
      await updateMyStudentProfile(profile);
      setMessage('Profile updated successfully.');
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!['image/jpeg', 'image/png', 'image/jpg'].includes(file.type)) {
      setError('Please upload a PNG or JPEG image.');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setCropImageSrc(reader.result);
      e.target.value = '';
    };
    reader.readAsDataURL(file);
  };

  const handleCropConfirm = async (croppedBlob) => {
    setCropImageSrc(null);
    try {
      setSaving(true);
      setError('');
      setMessage('');
      const fileToUpload = new File([croppedBlob], 'profile.jpg', { type: 'image/jpeg' });
      await uploadStudentProfileImage(fileToUpload);
      window.location.reload();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleCropCancel = () => setCropImageSrc(null);

  // Email Change Workflow Handlers
  const handleRequestEmailChange = async (e) => {
    if (e) e.preventDefault();
    if (!newEmailInput || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmailInput.trim())) {
      setEmailActionMsg({ type: 'error', text: 'Please enter a valid new email address.' });
      return;
    }

    if (newEmailInput.trim().toLowerCase() === user?.email?.toLowerCase()) {
      setEmailActionMsg({ type: 'error', text: 'The new email address cannot be the same as your current email.' });
      return;
    }

    setEmailActionLoading(true);
    setEmailActionMsg({ type: '', text: '' });

    try {
      const res = await requestEmailChange(newEmailInput.trim());
      setEmailCooldown(res.cooldownSeconds || 60);
      setEmailActionMsg({ type: 'success', text: res.message || 'Verification code sent to your new email.' });
      setShowEmailChangeModal(false);
      setNewEmailInput('');
      if (refreshUser) await refreshUser();
    } catch (err) {
      setEmailActionMsg({ type: 'error', text: err.message || 'Failed to request email change.' });
    } finally {
      setEmailActionLoading(false);
    }
  };

  const handleVerifyEmailOtp = async (e) => {
    if (e) e.preventDefault();
    if (!emailOtpInput || emailOtpInput.trim().length !== 6) {
      setEmailActionMsg({ type: 'error', text: 'Please enter the 6-digit verification code.' });
      return;
    }

    setEmailActionLoading(true);
    setEmailActionMsg({ type: '', text: '' });

    try {
      const res = await verifyEmailChange(emailOtpInput.trim());
      if (res.token) {
        localStorage.setItem('mentorconnect_token', res.token);
      }
      setEmailActionMsg({ type: 'success', text: res.message || 'Email address successfully updated and verified!' });
      setEmailOtpInput('');
      if (refreshUser) await refreshUser();
    } catch (err) {
      setEmailActionMsg({ type: 'error', text: err.message || 'Invalid or expired verification code.' });
    } finally {
      setEmailActionLoading(false);
    }
  };

  const handleResendEmailOtp = async () => {
    setEmailActionLoading(true);
    setEmailActionMsg({ type: '', text: '' });

    try {
      const res = await resendEmailChangeOtp();
      setEmailCooldown(res.cooldownSeconds || 60);
      setEmailActionMsg({ type: 'success', text: res.message || 'New verification code dispatched.' });
    } catch (err) {
      setEmailActionMsg({ type: 'error', text: err.message || 'Failed to resend verification code.' });
    } finally {
      setEmailActionLoading(false);
    }
  };

  const handleCancelEmailChange = async () => {
    if (!window.confirm('Are you sure you want to cancel the pending email change?')) return;
    setEmailActionLoading(true);
    setEmailActionMsg({ type: '', text: '' });

    try {
      const res = await cancelEmailChange();
      setEmailActionMsg({ type: 'success', text: res.message || 'Pending email change cancelled.' });
      setEmailOtpInput('');
      if (refreshUser) await refreshUser();
    } catch (err) {
      setEmailActionMsg({ type: 'error', text: err.message || 'Failed to cancel email change.' });
    } finally {
      setEmailActionLoading(false);
    }
  };

  if (loading) return <div className="page-content">Loading profile...</div>;

  return (
    <div className="page-content">
      {cropImageSrc && (
        <ImageCropper
          imageSrc={cropImageSrc}
          onCrop={handleCropConfirm}
          onCancel={handleCropCancel}
        />
      )}
      <div className="page-header">
        <div>
          <h2 className="page-title">My Profile</h2>
          <p className="page-subtitle">Update your student details and career aspirations.</p>
        </div>
      </div>

      <div className="profile-grid">
        {/* Profile Sidebar */}
        <div className="profile-sidebar">
          <div className="glass-card profile-header-card">
            <div className="profile-large-avatar" style={{ position: 'relative' }}>
              {user?.profileImage ? (
                <img src={user.profileImage} alt="Profile" style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
              ) : (
                user?.name?.charAt(0)?.toUpperCase() || 'U'
              )}
            </div>

            <label className="btn btn-secondary" style={{ cursor: 'pointer', display: 'inline-block', marginTop: '1rem', marginBottom: '0.5rem', fontSize: '0.8rem', padding: '0.4rem 0.8rem' }}>
              {saving ? 'Uploading...' : 'Change Photo'}
              <input type="file" accept="image/png, image/jpeg, image/jpg" onChange={handleImageUpload} disabled={saving} style={{ display: 'none' }} />
            </label>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>PNG or JPEG only.</div>

            <h3 style={{ fontSize: '1.25rem', marginBottom: '0.25rem' }}>{user?.name}</h3>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '1rem' }}>Student</p>
            <div style={{ textAlign: 'left', marginTop: '1.5rem', paddingTop: '1.5rem', borderTop: '1px solid var(--border-subtle)' }}>

              {/* Account Email Info Item */}
              <div className="info-item" style={{ marginBottom: '1rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
                  <span className="info-label">Email</span>
                  {user?.emailVerificationPending ? (
                    <span style={{
                      fontSize: '0.65rem',
                      padding: '2px 6px',
                      borderRadius: '4px',
                      background: 'var(--warning-subtle)',
                      color: 'var(--warning)',
                      border: '1px solid var(--warning)',
                      fontWeight: 700
                    }}>
                      Verification Pending
                    </span>
                  ) : (
                    <span style={{
                      fontSize: '0.65rem',
                      padding: '2px 6px',
                      borderRadius: '4px',
                      background: 'var(--success-subtle)',
                      color: 'var(--success)',
                      border: '1px solid var(--success)',
                      fontWeight: 700
                    }}>
                      ✓ Verified
                    </span>
                  )}
                </div>
                <span className="info-value" style={{ wordBreak: 'break-all', display: 'block', fontSize: '0.9rem' }}>
                  {user?.email}
                </span>

                <button
                  type="button"
                  className="btn btn-secondary"
                  style={{ fontSize: '0.75rem', padding: '0.35rem 0.65rem', marginTop: '0.5rem', width: '100%' }}
                  onClick={() => {
                    setShowEmailChangeModal(true);
                    setEmailActionMsg({ type: '', text: '' });
                  }}
                  id="change-account-email-btn"
                >
                  ✉️ Change Email
                </button>
              </div>

              {user?.dateOfBirth && (
                <>
                  <div className="info-item" style={{ marginBottom: '0.75rem' }}>
                    <span className="info-label">Date of Birth</span>
                    <span className="info-value">{new Date(user.dateOfBirth).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                  </div>
                  <div className="info-item" style={{ marginBottom: '0.75rem' }}>
                    <span className="info-label">Age</span>
                    <span className="info-value">{calculateAge(user.dateOfBirth)} years</span>
                  </div>
                  <div className="info-item" style={{ marginBottom: '0.75rem' }}>
                    <span className="info-label">Status</span>
                    <span className="info-value">
                      {isMinor(user.dateOfBirth) ? (
                        <span className="badge badge-warning">Minor</span>
                      ) : (
                        <span className="badge badge-success">Adult</span>
                      )}
                    </span>
                  </div>
                </>
              )}
              <div className="info-item">
                <span className="info-label">Role</span>
                <span className="info-value">Student</span>
              </div>
            </div>
          </div>
        </div>

        {/* Profile Main Content */}
        <div className="profile-main">

          {/* Email Verification Pending Banner */}
          {user?.emailVerificationPending && (
            <div style={{
              padding: '1.25rem',
              borderRadius: 'var(--radius-md)',
              background: 'var(--warning-subtle)',
              border: '1px solid var(--warning)',
              marginBottom: '1.5rem'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                <span style={{ fontSize: '1.2rem' }}>✉️</span>
                <h4 style={{ margin: 0, fontSize: '1rem', color: 'var(--warning)', fontWeight: 700 }}>
                  Account Email Verification Pending
                </h4>
              </div>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-primary)', margin: '0 0 0.75rem 0', lineHeight: 1.5 }}>
                You requested to change your account email to <strong>{user.pendingEmail}</strong>.
                Enter the 6-digit verification code to complete the update. Your active login email (<strong>{user.email}</strong>) remains unchanged until verification is complete.
              </p>

              {emailActionMsg.text && (
                <div style={{
                  padding: '0.65rem 0.85rem',
                  borderRadius: 'var(--radius-sm)',
                  marginBottom: '0.75rem',
                  fontSize: '0.85rem',
                  background: emailActionMsg.type === 'error' ? 'var(--error-subtle)' : 'var(--success-subtle)',
                  color: emailActionMsg.type === 'error' ? 'var(--error)' : 'var(--success)',
                  border: `1px solid ${emailActionMsg.type === 'error' ? 'var(--error)' : 'var(--success)'}`
                }}>
                  {emailActionMsg.text}
                </div>
              )}



              <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
                <input
                  type="text"
                  className="form-input"
                  placeholder="123456"
                  maxLength={6}
                  value={emailOtpInput}
                  onChange={(e) => setEmailOtpInput(e.target.value.replace(/\D/g, ''))}
                  disabled={emailActionLoading}
                  style={{ width: '160px', textAlign: 'center', letterSpacing: '3px', fontWeight: 700, fontSize: '1.1rem' }}
                  id="student-email-otp-input"
                />

                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={handleVerifyEmailOtp}
                  disabled={emailActionLoading || emailOtpInput.length !== 6}
                  id="student-verify-email-btn"
                >
                  {emailActionLoading ? 'Verifying...' : 'Verify Code'}
                </button>

                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={handleResendEmailOtp}
                  disabled={emailActionLoading || emailCooldown > 0}
                  id="student-resend-email-btn"
                >
                  {emailCooldown > 0 ? `Resend (${emailCooldown}s)` : 'Resend Code'}
                </button>

                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={handleCancelEmailChange}
                  disabled={emailActionLoading}
                  id="student-cancel-email-btn"
                >
                  Cancel Change
                </button>
              </div>
            </div>
          )}

          {/* Change Email Modal / Inline Card */}
          {showEmailChangeModal && (
            <div style={{
              padding: '1.25rem',
              borderRadius: 'var(--radius-md)',
              background: 'var(--bg-secondary)',
              border: '1px solid var(--accent-primary)',
              marginBottom: '1.5rem'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                <h4 style={{ margin: 0, fontSize: '1rem', fontWeight: 700 }}>
                  Change Account Email Address
                </h4>
                <button
                  type="button"
                  onClick={() => setShowEmailChangeModal(false)}
                  style={{ background: 'none', border: 'none', fontSize: '1.2rem', cursor: 'pointer', color: 'var(--text-secondary)' }}
                >
                  ✕
                </button>
              </div>

              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
                A verification code will be sent to the new email address. Your account email and login credentials will only be updated after successful verification.
              </p>

              {emailActionMsg.text && (
                <div style={{
                  padding: '0.65rem 0.85rem',
                  borderRadius: 'var(--radius-sm)',
                  marginBottom: '1rem',
                  fontSize: '0.85rem',
                  background: emailActionMsg.type === 'error' ? 'var(--error-subtle)' : 'var(--success-subtle)',
                  color: emailActionMsg.type === 'error' ? 'var(--error)' : 'var(--success)',
                  border: `1px solid ${emailActionMsg.type === 'error' ? 'var(--error)' : 'var(--success)'}`
                }}>
                  {emailActionMsg.text}
                </div>
              )}

              <form onSubmit={handleRequestEmailChange} style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
                <div style={{ flex: '1', minWidth: '240px' }}>
                  <label className="form-label" style={{ fontSize: '0.85rem', marginBottom: '0.35rem' }}>
                    New Email Address
                  </label>
                  <input
                    type="email"
                    required
                    className="form-input"
                    placeholder="student_new@example.com"
                    value={newEmailInput}
                    onChange={(e) => setNewEmailInput(e.target.value)}
                    disabled={emailActionLoading}
                    id="new-account-email-input"
                  />
                </div>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={emailActionLoading || !newEmailInput.trim()}
                  id="submit-email-change-btn"
                >
                  {emailActionLoading ? 'Sending Code...' : 'Send Verification Code'}
                </button>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowEmailChangeModal(false)}
                  disabled={emailActionLoading}
                >
                  Cancel
                </button>
              </form>
            </div>
          )}

          {/* Profile Details Card */}
          <div className="glass-card profile-section">
            <h3>Profile Details</h3>
            <form onSubmit={handleSave}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.25rem' }}>
                <div>
                  <label className="form-label">Career Goal</label>
                  <input
                    type="text"
                    className="form-input"
                    value={profile.careerGoal}
                    onChange={e => setProfile({...profile, careerGoal: e.target.value})}
                    placeholder="e.g. Become a Full-Stack Developer"
                  />
                </div>
                <div>
                  <label className="form-label">Education</label>
                  <input
                    type="text"
                    className="form-input"
                    value={profile.education}
                    onChange={e => setProfile({...profile, education: e.target.value})}
                    placeholder="e.g. MCA at XYZ University"
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.25rem' }}>
                <div>
                  <label className="form-label">Skills</label>
                  <input
                    type="text"
                    className="form-input"
                    value={profile.skills}
                    onChange={e => setProfile({...profile, skills: e.target.value})}
                    placeholder="e.g. JavaScript, React, SQL"
                  />
                </div>
                <div>
                  <label className="form-label">Interests</label>
                  <input
                    type="text"
                    className="form-input"
                    value={profile.interests}
                    onChange={e => setProfile({...profile, interests: e.target.value})}
                    placeholder="e.g. Web Development, AI"
                  />
                </div>
              </div>

              <div style={{ marginBottom: '1.5rem' }}>
                <label className="form-label">Bio</label>
                <textarea
                  className="form-input"
                  value={profile.bio}
                  onChange={e => setProfile({...profile, bio: e.target.value})}
                  rows="4"
                  placeholder="Tell mentors about yourself..."
                />
              </div>

              {message && <div style={{ padding: '0.75rem', background: 'var(--success-subtle)', color: 'var(--success)', border: '1px solid var(--success)', borderRadius: 'var(--radius-md)', marginBottom: '1rem' }}>{message}</div>}
              {error && <div style={{ padding: '0.75rem', background: 'var(--error-subtle)', color: 'var(--error)', border: '1px solid var(--error)', borderRadius: 'var(--radius-md)', marginBottom: '1rem' }}>{error}</div>}

              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? 'Saving...' : 'Save Profile'}
                </button>
              </div>
            </form>
          </div>

          {/* Guardian Monitoring & Safeguarding Component (Under-18 Minors Only) */}
          {isMinor(user?.dateOfBirth) && <GuardianSetupCard />}
        </div>
      </div>
    </div>
  );
}
