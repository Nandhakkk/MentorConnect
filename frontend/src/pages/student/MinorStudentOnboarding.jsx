import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import GuardianOTPVerification from '../../components/GuardianOTPVerification';
import {
  fetchGuardianStatus,
  saveGuardianContact,
  recordGuardianConsent
} from '../../services/guardianService';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';

export default function MinorStudentOnboarding() {
  const { user, token } = useAuth();
  const navigate = useNavigate();

  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [savingGuardian, setSavingGuardian] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Minor Student Education & Interests Form
  const [formData, setFormData] = useState({
    phone: user?.phone || '',
    education: 'School student',
    gradeLevel: 'Class 10',
    schoolName: '',
    favoriteSubjects: '',
    interests: '',
    skills: '',
    careerGoal: user?.studentProfile?.careerGoal || '',
    experienceLevel: 'BEGINNER',
    preferredLearningStyle: 'HANDS_ON',
    preferredLanguage: 'English',
    studyAvailability: '5 hours/week',
    budget: '0'
  });

  useEffect(() => {
    if (user?.studentProfile?.careerGoal && !formData.careerGoal) {
      setFormData(prev => ({ ...prev, careerGoal: user.studentProfile.careerGoal }));
    }
  }, [user]);

  // Guardian Details
  const [guardianData, setGuardianData] = useState({
    name: '',
    relationship: 'Parent',
    email: '',
    phone: ''
  });

  const [consentGranted, setConsentGranted] = useState(false);
  const [guardianStatus, setGuardianStatus] = useState(null);

  // Fetch current guardian status if student is resuming incomplete onboarding
  useEffect(() => {
    async function loadStatus() {
      try {
        const data = await fetchGuardianStatus(token);
        if (data) {
          setGuardianStatus(data);
          if (data.guardian) {
            setGuardianData({
              name: data.guardian.name || '',
              relationship: data.guardian.relationship || 'Parent',
              email: data.guardian.email || '',
              phone: data.guardian.phone || ''
            });
            if (data.guardian.consentStatus === 'GRANTED') {
              setConsentGranted(true);
            }
          }
        }
      } catch (err) {
        console.warn('Could not fetch existing guardian status:', err.message);
      }
    }
    if (token) {
      loadStatus();
    }
  }, [token]);

  const handleFormChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleGuardianChange = (e) => {
    const { name, value } = e.target;
    setGuardianData(prev => ({ ...prev, [name]: value }));
  };

  // Step 3 Next handler: Save Guardian contact & record consent before proceeding to OTP verification
  const handleSaveGuardianAndProceed = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!guardianData.name.trim() || guardianData.name.trim().length < 2) {
      setError('Please enter a valid Guardian full name (at least 2 characters).');
      return;
    }

    if (!guardianData.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(guardianData.email.trim())) {
      setError('Please provide a valid Guardian email address for verification.');
      return;
    }

    if (guardianData.phone && guardianData.phone.trim()) {
      const cleanPhone = guardianData.phone.trim().replace(/[\s\-\(\)]/g, '');
      if (!/^\+?[1-9]\d{9,14}$/.test(cleanPhone)) {
        setError('Please enter a valid Guardian phone number with country code (e.g. +91 9876543210) or leave it blank.');
        return;
      }
    }

    if (!consentGranted) {
      setError('Parental / Guardian notification consent must be acknowledged to continue.');
      return;
    }

    setSavingGuardian(true);
    try {
      // 1. Save Guardian contact details
      const contactRes = await saveGuardianContact({
        name: guardianData.name.trim(),
        relationship: guardianData.relationship,
        email: guardianData.email ? guardianData.email.trim() : null,
        phone: guardianData.phone ? guardianData.phone.trim() : null
      }, token);

      // 2. Record consent
      await recordGuardianConsent(true, '1.0', token);

      // 3. Refresh status
      const updatedStatus = await fetchGuardianStatus(token);
      setGuardianStatus(updatedStatus);

      setSuccess('Guardian details and consent recorded. Please verify contact via OTP below.');
      setStep(4);
    } catch (err) {
      setError(err.message || 'Failed to save guardian information.');
    } finally {
      setSavingGuardian(false);
    }
  };

  const handleOtpVerified = async (verifyResult) => {
    setSuccess('Guardian contact verified! You can now finish completing your profile.');
    try {
      const updated = await fetchGuardianStatus(token);
      setGuardianStatus(updated);
    } catch (e) {
      // ignore
    }
  };

  // Final submission of student onboarding profile
  const handleFinalSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!guardianStatus?.guardian?.isVerified) {
      setError('Guardian contact OTP verification must be completed before completing onboarding.');
      return;
    }

    setLoading(true);
    try {
      const payload = {
        phone: formData.phone || undefined,
        education: formData.education,
        gradeLevel: formData.gradeLevel,
        schoolName: formData.schoolName || undefined,
        favoriteSubjects: formData.favoriteSubjects,
        skills: formData.skills,
        interests: formData.interests,
        careerGoal: formData.careerGoal,
        experienceLevel: formData.experienceLevel,
        preferredLearningStyle: formData.preferredLearningStyle,
        preferredLanguage: formData.preferredLanguage,
        studyAvailability: formData.studyAvailability,
        budget: formData.budget || '0'
      };

      const response = await fetch(`${API_BASE_URL}/students/onboarding`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });

      const resData = await response.json();
      if (!response.ok) {
        throw new Error(resData.message || 'Failed to complete onboarding');
      }

      // Successful completion -> redirect to student dashboard
      window.location.href = '/student/dashboard';
    } catch (err) {
      setError(err.message || 'Failed to complete onboarding.');
      setLoading(false);
    }
  };

  return (
    <div className="page-content" style={{ display: 'flex', justifyContent: 'center' }}>
      <div className="centered-form-layout" style={{ maxWidth: '640px', width: '100%' }}>
        <div className="centered-form-header">
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.5rem',
            background: 'rgba(99, 102, 241, 0.1)',
            padding: '0.4rem 0.85rem',
            borderRadius: '999px',
            color: 'var(--accent-primary)',
            fontSize: '0.85rem',
            fontWeight: 600,
            marginBottom: '0.75rem'
          }}>
            🛡️ Student Under 18 — Safe Learner Onboarding
          </div>
          <h2>Welcome to MentorConnect, {user?.name?.split(' ')[0]}!</h2>
          <p>
            Let's set up your learning preferences and connect your parent or guardian for safeguarding updates.
          </p>
        </div>

        {error && (
          <div style={{ padding: '0.9rem 1.2rem', background: 'var(--error-subtle)', color: 'var(--error)', border: '1px solid var(--error)', borderRadius: 'var(--radius-md)', marginBottom: '1.5rem', fontSize: '0.9rem' }}>
            {error}
          </div>
        )}

        {success && (
          <div style={{ padding: '0.9rem 1.2rem', background: 'var(--success-subtle)', color: 'var(--success)', border: '1px solid var(--success)', borderRadius: 'var(--radius-md)', marginBottom: '1.5rem', fontSize: '0.9rem' }}>
            {success}
          </div>
        )}

        {/* Progress Indicator */}
        <div className="form-progress">
          Step {step} of 4: {
            step === 1 ? 'School & Basic Details' :
            step === 2 ? 'Learning Goals' :
            step === 3 ? 'Guardian Setup & Consent' :
            'Guardian Email OTP Verification'
          }
          <div className="form-progress-bar">
            <div className="form-progress-fill" style={{ width: `${(step / 4) * 100}%` }}></div>
          </div>
        </div>

        {/* STEP 1: School & Basic Details */}
        {step === 1 && (
          <form onSubmit={(e) => { e.preventDefault(); setStep(2); }} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <h3 style={{ fontSize: '1.15rem', fontWeight: 700 }}>School Education</h3>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div>
                <label className="form-label">Full Name</label>
                <input type="text" className="form-input" value={user?.name || ''} disabled style={{ opacity: 0.8 }} />
              </div>
              <div>
                <label className="form-label">Date of Birth</label>
                <input type="text" className="form-input" value={user?.dateOfBirth ? new Date(user.dateOfBirth).toLocaleDateString() : 'Under 18'} disabled style={{ opacity: 0.8 }} />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div>
                <label className="form-label">Current Education Level</label>
                <select name="education" className="form-input" value={formData.education} onChange={handleFormChange} required>
                  <option value="School student">School student</option>
                  <option value="Higher Secondary student">Higher Secondary student (11th/12th)</option>
                  <option value="Diploma student">Diploma student</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              <div>
                <label className="form-label">Class / Grade</label>
                <select name="gradeLevel" className="form-input" value={formData.gradeLevel} onChange={handleFormChange} required>
                  <option value="Class 6">Class 6</option>
                  <option value="Class 7">Class 7</option>
                  <option value="Class 8">Class 8</option>
                  <option value="Class 9">Class 9</option>
                  <option value="Class 10">Class 10</option>
                  <option value="Class 11">Class 11</option>
                  <option value="Class 12">Class 12</option>
                  <option value="Diploma 1st Year">Diploma 1st Year</option>
                  <option value="Diploma 2nd Year">Diploma 2nd Year</option>
                  <option value="Other">Other</option>
                </select>
              </div>
            </div>

            <div>
              <label className="form-label">School or Institution Name (Optional)</label>
              <input type="text" name="schoolName" className="form-input" placeholder="e.g. Kendriya Vidyalaya, St. Joseph's" value={formData.schoolName} onChange={handleFormChange} />
            </div>

            <div>
              <label className="form-label">Strongest / Favourite Subjects</label>
              <input type="text" name="favoriteSubjects" className="form-input" placeholder="e.g. Science, Mathematics, Computer Science" value={formData.favoriteSubjects} onChange={handleFormChange} required />
            </div>

            <div>
              <label className="form-label">Your Mobile Phone (Optional)</label>
              <input type="tel" name="phone" className="form-input" placeholder="e.g. +91 9876543210" value={formData.phone} onChange={handleFormChange} />
            </div>

            <div className="form-actions" style={{ marginTop: '1rem' }}>
              <div />
              <button type="submit" className="btn btn-primary" id="minor-onboarding-step1-btn">
                Continue to Learning Goals
              </button>
            </div>
          </form>
        )}

        {/* STEP 2: Learning Goals & Preferences */}
        {step === 2 && (
          <form onSubmit={(e) => { e.preventDefault(); setStep(3); }} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <h3 style={{ fontSize: '1.15rem', fontWeight: 700 }}>Learning Goals & Interests</h3>

            <div>
              <label className="form-label">What topics do you want to learn?</label>
              <input type="text" name="interests" className="form-input" placeholder="e.g. Python coding, Robotics, Physics, Web Design" value={formData.interests} onChange={handleFormChange} required />
            </div>

            <div>
              <label className="form-label">Skills you want to develop</label>
              <input type="text" name="skills" className="form-input" placeholder="e.g. Problem solving, Programming logic, Public speaking" value={formData.skills} onChange={handleFormChange} required />
            </div>

            <div>
              <label className="form-label">Future Ambition or Career Interest</label>
              <textarea name="careerGoal" className="form-input" placeholder="e.g. I want to build software applications or explore Artificial Intelligence." value={formData.careerGoal} onChange={handleFormChange} rows={2} required />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div>
                <label className="form-label">Experience Level</label>
                <select name="experienceLevel" className="form-input" value={formData.experienceLevel} onChange={handleFormChange}>
                  <option value="BEGINNER">Beginner (starting fresh)</option>
                  <option value="INTERMEDIATE">Intermediate (some experience)</option>
                </select>
              </div>

              <div>
                <label className="form-label">Preferred Learning Style</label>
                <select name="preferredLearningStyle" className="form-input" value={formData.preferredLearningStyle} onChange={handleFormChange}>
                  <option value="HANDS_ON">Hands-on (projects & coding)</option>
                  <option value="VISUAL">Visual (videos & diagrams)</option>
                  <option value="THEORETICAL">Conceptual (reading & discussions)</option>
                </select>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div>
                <label className="form-label">Preferred Mentoring Language</label>
                <input type="text" name="preferredLanguage" className="form-input" value={formData.preferredLanguage} onChange={handleFormChange} required />
              </div>

              <div>
                <label className="form-label">Study Availability</label>
                <input type="text" name="studyAvailability" className="form-input" placeholder="e.g. 5 hours/week, Weekends" value={formData.studyAvailability} onChange={handleFormChange} required />
              </div>
            </div>

            <div className="form-actions" style={{ marginTop: '1rem' }}>
              <button type="button" className="btn btn-secondary" onClick={() => setStep(1)}>
                Previous
              </button>
              <button type="submit" className="btn btn-primary" id="minor-onboarding-step2-btn">
                Continue to Guardian Setup
              </button>
            </div>
          </form>
        )}

        {/* STEP 3: Guardian Details & Consent */}
        {step === 3 && (
          <form onSubmit={handleSaveGuardianAndProceed} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <h3 style={{ fontSize: '1.15rem', fontWeight: 700 }}>Guardian Information & Safeguarding Consent</h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: 0 }}>
              Because you are under 18, MentorConnect partners with your parent or legal guardian to ensure your safety.
              Your guardian does <strong>not</strong> need a password or login account.
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div>
                <label className="form-label">Guardian Full Name</label>
                <input
                  type="text"
                  name="name"
                  className="form-input"
                  placeholder="e.g. Priya Sharma"
                  value={guardianData.name}
                  onChange={handleGuardianChange}
                  required
                  id="guardian-name-input"
                />
              </div>

              <div>
                <label className="form-label">Relationship to Student</label>
                <select
                  name="relationship"
                  className="form-input"
                  value={guardianData.relationship}
                  onChange={handleGuardianChange}
                  required
                  id="guardian-rel-input"
                >
                  <option value="Parent">Parent</option>
                  <option value="Legal Guardian">Legal Guardian</option>
                  <option value="Family Member">Family Member</option>
                  <option value="Other">Other Responsible Adult</option>
                </select>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div>
                <label className="form-label">Guardian Email Address</label>
                <input
                  type="email"
                  name="email"
                  className="form-input"
                  placeholder="e.g. parent@example.com"
                  value={guardianData.email}
                  onChange={handleGuardianChange}
                  required
                  id="guardian-email-input"
                />
              </div>

              <div>
                <label className="form-label">Guardian Mobile Phone (Optional)</label>
                <input
                  type="tel"
                  name="phone"
                  className="form-input"
                  placeholder="e.g. +91 9876543210"
                  value={guardianData.phone}
                  onChange={handleGuardianChange}
                  id="guardian-phone-input"
                />
              </div>
            </div>

            {/* Information Sharing & Consent Notice */}
            <div style={{
              padding: '1.25rem',
              borderRadius: 'var(--radius-md)',
              background: 'rgba(99, 102, 241, 0.05)',
              border: '1px solid rgba(99, 102, 241, 0.2)'
            }}>
              <h4 style={{ fontSize: '0.9rem', fontWeight: 700, marginBottom: '0.5rem', color: 'var(--accent-primary)' }}>
                Information Sharing & Safeguarding Agreement
              </h4>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: '0.5rem' }}>
                Your guardian will receive authorized email notifications about:
              </p>
              <ul style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', paddingLeft: '1.2rem', margin: '0 0 0.75rem 0' }}>
                <li>Mentoring session bookings and schedules</li>
                <li>Payment confirmations and receipts</li>
                <li>Assignment due dates and completion</li>
                <li>Learning milestone progress</li>
                <li>Safeguarding notices and authorized complaint updates</li>
              </ul>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-primary)', background: 'var(--bg-primary)', padding: '0.65rem 0.85rem', borderRadius: 'var(--radius-sm)', borderLeft: '3px solid var(--success)' }}>
                🔒 <strong>Privacy Assurance:</strong> Guardians <strong>cannot</strong> read your private student-mentor chat messages or your private AI study discussions.
              </div>

              <div style={{ marginTop: '1rem', display: 'flex', alignItems: 'flex-start', gap: '0.65rem' }}>
                <input
                  type="checkbox"
                  id="guardian-consent-chk"
                  checked={consentGranted}
                  onChange={(e) => setConsentGranted(e.target.checked)}
                  style={{ marginTop: '0.2rem' }}
                />
                <label htmlFor="guardian-consent-chk" style={{ fontSize: '0.8rem', color: 'var(--text-primary)', fontWeight: 600, cursor: 'pointer' }}>
                  I acknowledge and authorize MentorConnect to share mentoring progress and safeguarding updates with my parent/guardian under Platform Policy v1.0.
                </label>
              </div>
            </div>

            <div className="form-actions" style={{ marginTop: '1rem' }}>
              <button type="button" className="btn btn-secondary" onClick={() => setStep(2)}>
                Previous
              </button>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={savingGuardian || !consentGranted}
                id="minor-onboarding-step3-btn"
              >
                {savingGuardian ? 'Saving Guardian Details...' : 'Save & Proceed to OTP Verification'}
              </button>
            </div>
          </form>
        )}

        {/* STEP 4: OTP Verification & Final Submit */}
        {step === 4 && (
          <div>
            <GuardianOTPVerification
              guardian={guardianStatus?.guardian}
              token={token}
              onVerified={handleOtpVerified}
            />

            <div className="form-actions" style={{ marginTop: '2rem' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setStep(3)}
                disabled={loading}
              >
                Edit Guardian Details
              </button>

              <button
                type="button"
                className="btn btn-primary"
                onClick={handleFinalSubmit}
                disabled={loading || !guardianStatus?.guardian?.isVerified}
                id="minor-complete-onboarding-btn"
              >
                {loading ? 'Completing Profile...' : 'Complete Onboarding & Go to Dashboard'}
              </button>
            </div>

            {!guardianStatus?.guardian?.isVerified && (
              <p style={{ textAlign: 'center', fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.75rem' }}>
                * Complete OTP verification above to activate your student account.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
