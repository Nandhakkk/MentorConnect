import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import MinorStudentOnboarding from './MinorStudentOnboarding';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';

export default function StudentOnboarding() {
  const { user, token } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [checkingAge, setCheckingAge] = useState(true);
  const [isMinorStudent, setIsMinorStudent] = useState(() => {
    if (user?.dateOfBirth) {
      const dob = new Date(user.dateOfBirth);
      const today = new Date();
      let age = today.getFullYear() - dob.getFullYear();
      const m = today.getMonth() - dob.getMonth();
      if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) {
        age--;
      }
      return age < 18;
    }
    return false;
  });
  const [error, setError] = useState('');

  // Synchronize strictly with backend calculation
  useEffect(() => {
    async function checkAgeFromBackend() {
      try {
        const response = await fetch(`${API_BASE_URL}/guardian/status`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        const data = await response.json();
        if (data.status === 'success' && data.data) {
          setIsMinorStudent(Boolean(data.data.isMinor));
        }
      } catch (err) {
        console.warn('Backend age status check:', err.message);
      } finally {
        setCheckingAge(false);
      }
    }

    if (token) {
      checkAgeFromBackend();
    } else {
      setCheckingAge(false);
    }
  }, [token]);

  const [formData, setFormData] = useState({
    education: '',
    experienceLevel: '',
    skills: '',
    interests: '',
    careerGoal: user?.studentProfile?.careerGoal || '',
    preferredLearningStyle: '',
    preferredLanguage: 'English',
    budget: '',
    studyAvailability: ''
  });

  useEffect(() => {
    if (user?.studentProfile?.careerGoal && !formData.careerGoal) {
      setFormData(prev => ({ ...prev, careerGoal: user.studentProfile.careerGoal }));
    }
  }, [user]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleNext = () => setStep(prev => prev + 1);
  const handleBack = () => setStep(prev => prev - 1);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await fetch(`${API_BASE_URL}/students/onboarding`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(formData)
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || 'Failed to complete onboarding');
      }

      window.location.href = '/student/dashboard';
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  };

  if (checkingAge) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh', color: 'var(--text-secondary)' }}>
        <p>Loading onboarding experience...</p>
      </div>
    );
  }

  // Under-18 students follow the dedicated Minor Student Onboarding workflow
  if (isMinorStudent) {
    return <MinorStudentOnboarding />;
  }

  return (
    <div className="page-content" style={{ display: 'flex', justifyContent: 'center' }}>
      <div className="centered-form-layout" style={{ width: '100%' }}>
        <div className="centered-form-header">
          <h2>Complete Your Profile</h2>
          <p>We use this information to understand your learning goals and recommend suitable mentors and learning paths.</p>
        </div>

        {error && (
          <div style={{ padding: '1rem', background: 'var(--error-subtle)', color: 'var(--error)', border: '1px solid var(--error)', borderRadius: 'var(--radius-md)', marginBottom: '1.5rem' }}>
            {error}
          </div>
        )}

        {/* Progress Indicator */}
        <div className="form-progress">
          Step {step} of 5
          <div className="form-progress-bar">
            <div className="form-progress-fill" style={{ width: `${(step / 5) * 100}%` }}></div>
          </div>
        </div>

        <form onSubmit={step === 5 ? handleSubmit : (e) => { e.preventDefault(); handleNext(); }}>
          {step === 1 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              <h3 style={{ fontSize: '1.25rem' }}>Step 1: Education & Experience</h3>
              <div>
                <label className="form-label">Current Education or Degree</label>
                <input required type="text" name="education" className="form-input" value={formData.education} onChange={handleChange} placeholder="e.g. B.Sc. Computer Science" />
              </div>
              <div>
                <label className="form-label">Experience Level</label>
                <select required name="experienceLevel" className="form-input" value={formData.experienceLevel} onChange={handleChange}>
                  <option value="">Select level...</option>
                  <option value="BEGINNER">Beginner</option>
                  <option value="INTERMEDIATE">Intermediate</option>
                  <option value="ADVANCED">Advanced</option>
                </select>
              </div>
            </div>
          )}

          {step === 2 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              <h3 style={{ fontSize: '1.25rem' }}>Step 2: Skills & Interests</h3>
              <div>
                <label className="form-label">Current Skills (comma separated)</label>
                <input required type="text" name="skills" className="form-input" value={formData.skills} onChange={handleChange} placeholder="e.g. HTML, CSS, Basic Python" />
              </div>
              <div>
                <label className="form-label">Interests & Topics (comma separated)</label>
                <input required type="text" name="interests" className="form-input" value={formData.interests} onChange={handleChange} placeholder="e.g. Web Development, AI, Data Science" />
              </div>
            </div>
          )}

          {step === 3 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              <h3 style={{ fontSize: '1.25rem' }}>Step 3: Learning Goal & Preferences</h3>
              <div>
                <label className="form-label">Main Career / Learning Goal</label>
                <textarea required name="careerGoal" className="form-input" value={formData.careerGoal} onChange={handleChange} placeholder="e.g. I want to become a Full Stack Developer within a year." rows={3} />
              </div>
              <div>
                <label className="form-label">Preferred Learning Style</label>
                <select required name="preferredLearningStyle" className="form-input" value={formData.preferredLearningStyle} onChange={handleChange}>
                  <option value="">Select style...</option>
                  <option value="VISUAL">Visual (diagrams, videos)</option>
                  <option value="HANDS_ON">Hands-on (projects, coding)</option>
                  <option value="THEORETICAL">Theoretical (reading, lectures)</option>
                </select>
              </div>
            </div>
          )}

          {step === 4 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              <h3 style={{ fontSize: '1.25rem' }}>Step 4: Language & Availability</h3>
              <div>
                <label className="form-label">Preferred Mentorship Language</label>
                <input required type="text" name="preferredLanguage" className="form-input" value={formData.preferredLanguage} onChange={handleChange} placeholder="e.g. English, Spanish" />
              </div>
              <div>
                <label className="form-label">Weekly Study Availability</label>
                <input required type="text" name="studyAvailability" className="form-input" value={formData.studyAvailability} onChange={handleChange} placeholder="e.g. Weekends only, 10 hours/week" />
              </div>
            </div>
          )}

          {step === 5 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              <h3 style={{ fontSize: '1.25rem' }}>Step 5: Budget & Confirmation</h3>
              <div>
                <label className="form-label">Session Budget (Approx INR / hour)</label>
                <input required type="number" min="0" step="0.01" name="budget" className="form-input" value={formData.budget} onChange={handleChange} placeholder="e.g. 15.00" />
                <small style={{ color: 'var(--text-secondary)', display: 'block', marginTop: '0.5rem' }}>Set to 0 if looking for free peer mentorship.</small>
              </div>
            </div>
          )}

          <div className="form-actions">
            {step > 1 ? (
              <button type="button" className="btn btn-secondary" onClick={handleBack} disabled={loading}>
                Previous
              </button>
            ) : <div />}
            
            {step < 5 ? (
              <button type="submit" className="btn btn-primary">
                Continue
              </button>
            ) : (
              <button type="submit" className="btn btn-primary" disabled={loading}>
                {loading ? 'Saving...' : 'Complete Profile'}
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
