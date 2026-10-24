import { useState, useEffect } from 'react';
import { getMyApplication, createApplication, updateMyApplication, screenApplication, uploadCredential, deleteCredential } from '../../services/mentorApplicationService';
import { useAuth } from '../../context/AuthContext';
import { useNavigate, Link } from 'react-router-dom';
import { uploadProfileImage } from '../../services/mentorService';
import ImageCropper from '../../components/ImageCropper';

export default function MentorApplication() {
  const { user, token } = useAuth();
  const navigate = useNavigate();

  const [application, setApplication] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    dateOfBirth: '',
    profileImage: '',
    bio: '',
    professionalSummary: '',
    expertise: '',
    topics: '',
    experience: '',
    teachingExperience: '',
    employmentHistory: '',
    teachingExperienceDetails: '',
    education: '',
    skills: '',
    certifications: '',
    achievements: '',
    otherInfo: '',
    linkedinUrl: '',
    languages: '',
    proposedSessionFee: ''
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [screening, setScreening] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [activeStep, setActiveStep] = useState(1);
  const [cropImageSrc, setCropImageSrc] = useState(null);

  useEffect(() => {
    const fetchApp = async () => {
      try {
        setLoading(true);
        const appData = await getMyApplication(token);
        if (appData) {
          setApplication(appData);
          const mentorUser = appData.mentor?.user || user || {};
          const mentorProfile = appData.mentor || {};

          setFormData({
            name: mentorUser.name || '',
            dateOfBirth: mentorUser.dateOfBirth ? mentorUser.dateOfBirth.split('T')[0] : '',
            profileImage: mentorUser.profileImage || mentorProfile.profileImage || '',
            bio: mentorProfile.bio || appData.professionalSummary || '',
            professionalSummary: appData.professionalSummary || mentorProfile.bio || '',
            expertise: appData.expertise || mentorProfile.expertise || '',
            topics: appData.topics || '',
            experience: appData.experience?.toString() || mentorProfile.experience?.toString() || '',
            teachingExperience: appData.teachingExperience?.toString() || mentorProfile.teachingExperience?.toString() || '',
            employmentHistory: appData.employmentHistory || mentorProfile.employmentHistory || '',
            teachingExperienceDetails: appData.teachingExperienceDetails || mentorProfile.teachingEvidence || '',
            education: appData.education || '',
            skills: appData.skills || '',
            certifications: appData.certifications || '',
            achievements: appData.achievements || '',
            otherInfo: appData.otherInfo || '',
            linkedinUrl: appData.linkedinUrl || mentorProfile.linkedinUrl || '',
            languages: appData.languages || mentorProfile.language || '',
            proposedSessionFee: appData.proposedSessionFee?.toString() || mentorProfile.sessionFee?.toString() || ''
          });
        } else if (user) {
          setFormData(prev => ({
            ...prev,
            name: user.name || '',
            dateOfBirth: user.dateOfBirth ? user.dateOfBirth.split('T')[0] : ''
          }));
        }
      } catch (err) {
        if (err.message !== 'No application found.') {
          setError(err.message);
        }
      } finally {
        setLoading(false);
      }
    };
    if (token) fetchApp();
  }, [token]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setError('');
      setSuccess('');

      let updatedApp;
      if (application) {
        updatedApp = await updateMyApplication(formData, token);
        setSuccess('Application progress saved.');
      } else {
        updatedApp = await createApplication(formData, token);
        setSuccess('Application started.');
      }
      setApplication(updatedApp);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const validateStep = (step) => {
    if (step === 1) {
      if (!formData.name) return 'Please enter your Full Legal Name.';
      if (!formData.dateOfBirth) return 'Please enter your Date of Birth.';
      if (!formData.profileImage) return 'Please upload your profile image.';
      if (!formData.languages) return 'Please enter your preferred languages.';
      if (!formData.professionalSummary) return 'Please enter your professional summary.';
    } else if (step === 2) {
      if (!formData.education) return 'Please enter your Education details.';
      if (getCredentialsByClaimType('EDUCATION').length === 0) return 'Please upload supporting evidence for Education.';
      if (!formData.teachingExperienceDetails) return 'Please enter your Teaching Experience details.';
      if (!formData.teachingExperience) return 'Please enter your Teaching Experience years.';
      if (getCredentialsByClaimType('TEACHING_EXPERIENCE').length === 0) return 'Please upload supporting evidence for Teaching Experience.';

      if (formData.employmentHistory || formData.experience) {
        if (!formData.employmentHistory) return 'Please enter your Employment History details if you are claiming experience.';
        if (!formData.experience) return 'Please enter your Total Industry Experience years if you are claiming employment history.';
        if (getCredentialsByClaimType('EMPLOYMENT_HISTORY').length === 0) return 'Please upload supporting evidence for Employment History.';
      }
    } else if (step === 3) {
      if (!formData.expertise) return 'Please enter your Primary Expertise.';
      if (!formData.skills) return 'Please enter your Key Professional Skills.';
      if (!formData.topics) return 'Please enter your Teaching Topics.';
      if (getCredentialsByClaimType('OTHER').length === 0) return 'Please upload supporting evidence for Teaching Topics.';
    } else if (step === 4) {
      if (!formData.proposedSessionFee) return 'Please enter your Proposed Session Fee.';
    }
    return null;
  };

  const handleNextStep = async () => {
    const errorMsg = validateStep(activeStep);
    if (errorMsg) {
      setError(errorMsg);
      return;
    }

    await handleSave();
    if (!error) {
      setActiveStep(prev => prev + 1);
      window.scrollTo(0, 0);
    }
  };

  const handlePrevStep = () => {
    setActiveStep(prev => prev - 1);
    window.scrollTo(0, 0);
  };

  const handleScreening = async () => {
    await handleSave(); // Ensure latest data is saved
    try {
      setScreening(true);
      setError('');
      setSuccess('');
      const screeningResult = await screenApplication(token);
      setApplication(prev => ({
        ...prev,
        status: 'AI_SCREENED',
        aiScreening: screeningResult
      }));
      setSuccess('AI Document Verification completed. Ready for admin review.');
    } catch (err) {
      setError(err.message);
    } finally {
      setScreening(false);
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
      e.target.value = ''; // Reset input
    };
    reader.readAsDataURL(file);
  };

  const handleCropConfirm = async (croppedBlob) => {
    setCropImageSrc(null);
    try {
      setSaving(true);
      setError('');
      const fileToUpload = new File([croppedBlob], 'profile.jpg', { type: 'image/jpeg' });
      const secureUrl = await uploadProfileImage(fileToUpload);
      setFormData(prev => ({ ...prev, profileImage: secureUrl }));
      setSuccess('Profile image updated successfully.');
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleCropCancel = () => {
    setCropImageSrc(null);
  };

  if (loading) return <div className="page-content">Loading mentor verification workflow...</div>;

  const isReadOnly = application && application.status !== 'PENDING' && application.status !== 'REJECTED';

  const getCredentialsByClaimType = (claimType) => {
    return application?.credentials?.filter(c => c.claimType === claimType) || [];
  };

  return (
    <div className="page-content">
      {cropImageSrc && (
        <ImageCropper
          imageSrc={cropImageSrc}
          onCrop={handleCropConfirm}
          onCancel={handleCropCancel}
        />
      )}
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h2 className="page-title">Professional Mentor Verification</h2>
          <p className="page-subtitle">Submit detailed professional credentials and supporting evidence for admin verification.</p>
        </div>
        {application && application.status === 'APPROVED' && (
          <Link to={`/student/mentor/${application.mentorId}`} className="btn btn-secondary">
            View Live Student Portfolio
          </Link>
        )}
      </div>

      {application && (
        <div className="glass-card" style={{ marginBottom: '2rem', padding: '1.5rem', borderLeft: application.status === 'APPROVED' ? '4px solid var(--success)' : application.status === 'REJECTED' ? '4px solid var(--error)' : '4px solid var(--warning)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
            <div>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Current Verification Status</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginTop: '0.25rem' }}>
                <span className={`badge ${application.status === 'APPROVED' ? 'badge-success' : application.status === 'REJECTED' ? 'badge-danger' : 'badge-warning'}`}>
                  {application.status.replace(/_/g, ' ')}
                </span>
              </div>
            </div>
          </div>
          {application.status === 'REJECTED' && application.rejectionReason && (
            <div style={{ marginTop: '1rem', padding: '1rem', background: 'var(--error-subtle)', color: 'var(--error)', borderRadius: '4px', border: '1px solid var(--error)' }}>
              <strong>Admin Rejection Reason:</strong> {application.rejectionReason}
            </div>
          )}
        </div>
      )}

      {error && <div style={{ padding: '1rem', background: 'var(--error-subtle)', color: 'var(--error)', borderRadius: 'var(--radius-md)', marginBottom: '1.5rem', border: '1px solid var(--error)' }}>{error}</div>}
      {success && <div style={{ padding: '1rem', background: 'var(--success-subtle)', color: 'var(--success)', borderRadius: 'var(--radius-md)', marginBottom: '1.5rem', border: '1px solid var(--success)' }}>{success}</div>}

      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
        {[1, 2, 3, 4, 5].map(step => (
          <button
            key={step}
            type="button"
            onClick={() => setActiveStep(step)}
            className={`btn ${activeStep === step ? 'btn-primary' : 'btn-secondary'}`}
            style={{ padding: '0.5rem 1rem' }}
          >
            Step {step}
          </button>
        ))}
      </div>

      <div className="glass-card" style={{ maxWidth: '900px', padding: '2rem' }}>

        {/* STEP 1 */}
        {activeStep === 1 && (
          <div>
            <h3 style={{ fontSize: '1.25rem', marginBottom: '1rem', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '0.5rem' }}>Step 1 — Personal Information</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '1.5rem' }}>
              <div>
                <label className="form-label">Full Legal Name *</label>
                <input type="text" name="name" className="form-input" value={formData.name} onChange={handleChange} disabled={isReadOnly} required />
              </div>
              <div>
                <label className="form-label">Date of Birth *</label>
                <input type="date" name="dateOfBirth" className="form-input" value={formData.dateOfBirth} onChange={handleChange} disabled={isReadOnly} max={new Date().toISOString().split("T")[0]} required />
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '1.5rem' }}>
              <div>
                <label className="form-label">Profile Image (PNG/JPEG) *</label>
                <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
                  {formData.profileImage ? (
                    <img src={formData.profileImage} alt="Profile Preview" style={{ width: '80px', height: '80px', borderRadius: '50%', objectFit: 'cover', border: '2px solid var(--border-subtle)' }} />
                  ) : (
                    <div style={{ width: '80px', height: '80px', borderRadius: '50%', background: 'var(--bg-surface-elevated)', border: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.8rem', color: 'var(--text-muted)', textAlign: 'center', fontWeight: 600 }}>No<br/>Image</div>
                  )}
                  <div style={{ flex: 1 }}>
                    {!isReadOnly && formData.profileImage && (
                      <div style={{ marginBottom: '0.5rem' }}>
                        <button type="button" className="btn btn-secondary" style={{ fontSize: '0.8rem', padding: '0.3rem 0.6rem' }} onClick={() => document.getElementById('profileImageUpload').click()}>Change Photo</button>
                      </div>
                    )}
                    <input id="profileImageUpload" type="file" accept="image/png, image/jpeg, image/jpg" onChange={handleImageUpload} disabled={isReadOnly} style={{ fontSize: '0.85rem', display: formData.profileImage ? 'none' : 'block' }} required={!formData.profileImage} />
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.5rem' }}>PNG or JPEG only. Image will be public.</div>
                  </div>
                </div>
              </div>
              <div>
                <label className="form-label">Preferred Languages Spoken *</label>
                <input type="text" name="languages" className="form-input" value={formData.languages} onChange={handleChange} disabled={isReadOnly} required />
              </div>
            </div>
            <div style={{ marginBottom: '1.5rem' }}>
              <label className="form-label">Professional Summary & Bio *</label>
              <textarea name="professionalSummary" className="form-input" rows="4" value={formData.professionalSummary} onChange={handleChange} disabled={isReadOnly} required />
            </div>
          </div>
        )}

        {/* STEP 2 */}
        {activeStep === 2 && (
          <div>
            <h3 style={{ fontSize: '1.25rem', marginBottom: '1rem', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '0.5rem' }}>Step 2 — Professional Background</h3>

            <div style={{ marginBottom: '2.5rem', padding: '1.5rem', background: 'rgba(255,255,255,0.02)', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
              <h4 style={{ margin: '0 0 1rem 0' }}>Education & Qualifications *</h4>
              <textarea name="education" className="form-input" rows="3" value={formData.education} onChange={handleChange} disabled={isReadOnly} required placeholder="e.g. Master of Science in Computer Science (Stanford, 2018)" style={{ marginBottom: '1rem' }} />
              <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>Upload your degree, diploma, academic certificate, or other official education evidence.</div>
              <EvidenceUploader application={application} claimType="EDUCATION" defaultType="DEGREE" isReadOnly={isReadOnly} token={token} setApplication={setApplication} setError={setError} setSuccess={setSuccess} />
            </div>

            <div style={{ marginBottom: '2.5rem', padding: '1.5rem', background: 'rgba(255,255,255,0.02)', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
              <h4 style={{ margin: '0 0 1rem 0' }}>Employment History (Optional)</h4>
              <textarea name="employmentHistory" className="form-input" rows="3" value={formData.employmentHistory} onChange={handleChange} disabled={isReadOnly} placeholder="e.g. Senior Software Engineer at Tech Corp (2021-2024)..." style={{ marginBottom: '1rem' }} />
              <div style={{ marginBottom: '1rem' }}>
                <label className="form-label">Total Industry Experience (Years)</label>
                <input type="number" name="experience" className="form-input" min="0" value={formData.experience} onChange={handleChange} disabled={isReadOnly} />
              </div>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>Optional. If provided, you may upload an employment/experience certificate or other supporting evidence.</div>
              <EvidenceUploader application={application} claimType="EMPLOYMENT_HISTORY" defaultType="EMPLOYMENT_EVIDENCE" isReadOnly={isReadOnly} token={token} setApplication={setApplication} setError={setError} setSuccess={setSuccess} required={false} />
            </div>

            <div style={{ marginBottom: '1.5rem', padding: '1.5rem', background: 'rgba(255,255,255,0.02)', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
              <h4 style={{ margin: '0 0 1rem 0' }}>Teaching Experience *</h4>
              <div style={{ marginBottom: '1rem' }}>
                <label className="form-label">Teaching Experience Details *</label>
                <textarea name="teachingExperienceDetails" className="form-input" rows="3" value={formData.teachingExperienceDetails} onChange={handleChange} disabled={isReadOnly} required placeholder="Detail your teaching roles, guest lectures, university courses..." />
              </div>
              <div style={{ marginBottom: '1rem' }}>
                <label className="form-label">Teaching / Mentoring Experience (Years) *</label>
                <input type="number" name="teachingExperience" className="form-input" min="0" value={formData.teachingExperience} onChange={handleChange} disabled={isReadOnly} required />
              </div>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>Upload an experience/teaching certificate, employment evidence, institution letter, or other document supporting your claimed teaching experience.</div>
              <EvidenceUploader application={application} claimType="TEACHING_EXPERIENCE" defaultType="EXPERIENCE_CERTIFICATE" isReadOnly={isReadOnly} token={token} setApplication={setApplication} setError={setError} setSuccess={setSuccess} />
            </div>
          </div>
        )}

        {/* STEP 3 */}
        {activeStep === 3 && (
          <div>
            <h3 style={{ fontSize: '1.25rem', marginBottom: '1rem', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '0.5rem' }}>Step 3 — Expertise & Teaching</h3>

            <div style={{ marginBottom: '2.5rem', padding: '1.5rem', background: 'rgba(255,255,255,0.02)', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
              <h4 style={{ margin: '0 0 1rem 0' }}>Primary Expertise & Skills *</h4>
              <div style={{ marginBottom: '1rem' }}>
                <label className="form-label">Primary Expertise *</label>
                <input type="text" name="expertise" className="form-input" value={formData.expertise} onChange={handleChange} disabled={isReadOnly} required placeholder="e.g. Full-Stack Cloud Architecture" />
              </div>
              <div style={{ marginBottom: '1rem' }}>
                <label className="form-label">Key Professional Skills *</label>
                <textarea name="skills" className="form-input" rows="2" value={formData.skills} onChange={handleChange} disabled={isReadOnly} required placeholder="e.g. JavaScript, Python, Distributed Systems" />
              </div>
            </div>

            <div style={{ marginBottom: '2.5rem', padding: '1.5rem', background: 'rgba(255,255,255,0.02)', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
              <h4 style={{ margin: '0 0 1rem 0' }}>Teaching Topics *</h4>
              <div style={{ marginBottom: '1rem' }}>
                <label className="form-label">Topics You Can Teach (Comma-separated) *</label>
                <input type="text" name="topics" className="form-input" value={formData.topics} onChange={handleChange} disabled={isReadOnly} required placeholder="e.g. React, Node.js, System Design" />
              </div>

              <div style={{ padding: '1rem', background: 'rgba(99, 102, 241, 0.05)', borderRadius: '6px', borderLeft: '3px solid #6366f1', marginBottom: '1.5rem', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                <p style={{ margin: '0 0 0.5rem 0', fontWeight: 'bold', color: 'var(--text-primary)' }}>Supporting Evidence for Teaching Topics</p>
                <p style={{ margin: '0 0 0.5rem 0' }}>Please upload a document that supports your qualification or experience in the topics you listed above.</p>
                <p style={{ margin: '0 0 0.5rem 0' }}>Accepted examples:</p>
                <ul style={{ margin: '0 0 0.5rem 0', paddingLeft: '1.5rem' }}>
                  <li>Relevant professional certification</li>
                  <li>Course completion certificate</li>
                  <li>Teaching certificate</li>
                  <li>Employment/experience certificate related to this topic</li>
                  <li>Degree/academic certificate related to this topic</li>
                  <li>Other relevant professional evidence</li>
                </ul>
                <p style={{ margin: 0 }}>You may also provide a relevant professional/credential link, such as LinkedIn or an official certification page.</p>
              </div>

              <EvidenceUploader application={application} claimType="OTHER" defaultType="OTHER" isReadOnly={isReadOnly} token={token} setApplication={setApplication} setError={setError} setSuccess={setSuccess} />
            </div>

            <div style={{ marginBottom: '1.5rem', padding: '1.5rem', background: 'rgba(255,255,255,0.02)', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
              <h4 style={{ margin: '0 0 1rem 0' }}>Certifications & Achievements</h4>
              <div style={{ marginBottom: '1rem' }}>
                <label className="form-label">Certifications</label>
                <textarea name="certifications" className="form-input" rows="2" value={formData.certifications} onChange={handleChange} disabled={isReadOnly} placeholder="e.g. AWS Solutions Architect Professional" />
              </div>
              <div style={{ marginBottom: '1rem' }}>
                <label className="form-label">Achievements & Honors</label>
                <textarea name="achievements" className="form-input" rows="2" value={formData.achievements} onChange={handleChange} disabled={isReadOnly} placeholder="e.g. Speaker at PyCon 2023" />
              </div>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>Upload the certificate or official credential proving this certification.</div>
              <EvidenceUploader application={application} claimType="CERTIFICATION" defaultType="CERTIFICATION" isReadOnly={isReadOnly} token={token} setApplication={setApplication} setError={setError} setSuccess={setSuccess} required={false} />
            </div>
          </div>
        )}

        {/* STEP 4 */}
        {activeStep === 4 && (
          <div>
            <h3 style={{ fontSize: '1.25rem', marginBottom: '1rem', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '0.5rem' }}>Step 4 — Session Information</h3>
            <div style={{ marginBottom: '1.5rem' }}>
              <label className="form-label">Proposed Session Fee (INR / hour) *</label>
              <input type="number" name="proposedSessionFee" className="form-input" min="0" step="1" value={formData.proposedSessionFee} onChange={handleChange} disabled={isReadOnly} required />
            </div>
            <div style={{ marginBottom: '1.5rem' }}>
              <label className="form-label">LinkedIn Profile URL</label>
              <input type="url" name="linkedinUrl" className="form-input" value={formData.linkedinUrl} onChange={handleChange} disabled={isReadOnly} placeholder="https://linkedin.com/in/username" />
            </div>
            <div style={{ marginBottom: '1.5rem' }}>
              <label className="form-label">Other Relevant Information</label>
              <textarea name="otherInfo" className="form-input" rows="3" value={formData.otherInfo} onChange={handleChange} disabled={isReadOnly} />
            </div>
          </div>
        )}

        {/* STEP 5 */}
        {activeStep === 5 && (() => {
          const s1Err = validateStep(1);
          const s2Err = validateStep(2);
          const s3Err = validateStep(3);
          const s4Err = validateStep(4);
          const isAllComplete = !s1Err && !s2Err && !s3Err && !s4Err;

          return (
            <div>
              <h3 style={{ fontSize: '1.25rem', marginBottom: '1rem', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '0.5rem' }}>Step 5 — Review & Submit</h3>
              <div style={{ marginBottom: '2rem' }}>
                <ReviewSummaryItem title="Personal Information" fields={[formData.name, formData.dateOfBirth, formData.profileImage, formData.languages, formData.professionalSummary]} onClick={() => setActiveStep(1)} error={s1Err} />
                <ReviewSummaryItem title="Professional Background" fields={[formData.education, formData.teachingExperienceDetails, formData.teachingExperience]} onClick={() => setActiveStep(2)} error={s2Err} />
                <ReviewSummaryItem title="Expertise & Teaching" fields={[formData.expertise, formData.skills, formData.topics]} onClick={() => setActiveStep(3)} error={s3Err} />
                <ReviewSummaryItem title="Session Information" fields={[formData.proposedSessionFee]} onClick={() => setActiveStep(4)} error={s4Err} />
              </div>

              {!isReadOnly && (
                <div style={{ padding: '1.5rem', background: 'rgba(99, 102, 241, 0.1)', border: '1px solid rgba(99, 102, 241, 0.3)', borderRadius: '8px' }}>
                  <h4 style={{ margin: '0 0 0.5rem 0' }}>Ready to submit?</h4>
                  <p style={{ margin: '0 0 1.5rem 0', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                    By submitting, you agree to our verification process. AI will pre-screen your application before an administrator performs the final review.
                  </p>
                  <button type="button" onClick={handleScreening} className="btn btn-primary" disabled={screening || !isAllComplete} style={{ padding: '0.75rem 2rem' }}>
                    {screening ? 'Running AI Verification...' : 'Submit Application & Run Verification'}
                  </button>
                </div>
              )}
            </div>
          );
        })()}

        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '2rem', paddingTop: '1rem', borderTop: '1px solid var(--border-subtle)' }}>
          <button type="button" onClick={handlePrevStep} className="btn btn-secondary" disabled={activeStep === 1 || isReadOnly}>
            Back
          </button>
          {activeStep < 5 && !isReadOnly && (
            <button type="button" onClick={handleNextStep} className="btn btn-primary" disabled={saving}>
              {saving ? 'Saving...' : 'Save & Next'}
            </button>
          )}
        </div>

      </div>
    </div>
  );
}

function ReviewSummaryItem({ title, onClick, error }) {
  const isComplete = !error;

  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem', background: 'var(--bg-surface-elevated)', borderRadius: '4px', marginBottom: '0.5rem', cursor: 'pointer', border: isComplete ? '1px solid var(--border-subtle)' : '1px solid var(--error)' }} onClick={onClick}>
      <div style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{title}</div>
      <div style={{ display: 'flex', gap: '1rem', fontSize: '0.85rem' }}>
        {isComplete ? (
          <span style={{ color: 'var(--success)' }}>✓ Complete</span>
        ) : (
          <span style={{ color: 'var(--error)' }}>⚠ {error}</span>
        )}
      </div>
    </div>
  );
}

function EvidenceUploader({ application, claimType, defaultType, isReadOnly, token, setApplication, setError, setSuccess, required = true }) {
  const [uploading, setUploading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [file, setFile] = useState(null);
  const [title, setTitle] = useState('');
  const [evidenceLink, setEvidenceLink] = useState('');

  const credentials = application?.credentials?.filter(c => c.claimType === claimType) || [];

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!application) {
      setError('Please Save & Next first before uploading documents.');
      return;
    }
    if (!file && !evidenceLink) {
      setError('Please provide a file or a professional evidence link.');
      return;
    }

    try {
      setUploading(true);
      setError('');
      setSuccess('');

      const form = new FormData();
      form.append('type', defaultType);
      form.append('title', title || `${claimType.replace(/_/g, ' ')} Evidence`);
      form.append('claimType', claimType);
      if (evidenceLink) form.append('description', `Professional Link: ${evidenceLink}`);
      if (file) form.append('file', file);
      else {
        // If only link is provided, create a dummy text file to satisfy the upload requirement or modify backend.
        // For now, we assume file is required by backend.
        if (!file) throw new Error("A document file is required by the current system.");
      }

      const newCred = await uploadCredential(form, token);
      setApplication(prev => ({
        ...prev,
        credentials: [...(prev.credentials || []), newCred]
      }));
      setSuccess('Evidence uploaded successfully.');
      setShowForm(false);
      setFile(null);
      setTitle('');
      setEvidenceLink('');
    } catch (err) {
      setError(err.message);
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (credId) => {
    if (!window.confirm('Delete this supporting document?')) return;
    try {
      setError('');
      setSuccess('');
      await deleteCredential(credId, token);
      setApplication(prev => ({
        ...prev,
        credentials: (prev.credentials || []).filter(c => c.id !== credId)
      }));
      setSuccess('Evidence removed.');
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div style={{ marginTop: '1rem', borderTop: '1px dashed var(--border-subtle)', paddingTop: '1rem' }}>
      <label className="form-label" style={{ color: 'var(--accent-primary)' }}>Supporting Evidence {required && '*'}</label>

      {credentials.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1rem' }}>
          {credentials.map(cred => (
            <div key={cred.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-surface-elevated)', padding: '0.5rem 1rem', borderRadius: '4px', border: '1px solid var(--border-subtle)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ color: 'var(--success)' }}>✓</span>
                <span style={{ fontSize: '0.9rem', color: 'var(--text-primary)' }}>{cred.title}</span>
              </div>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                {cred.fileReference && <a href={cred.fileReference} target="_blank" rel="noreferrer" style={{ fontSize: '0.8rem', color: 'var(--accent-primary)' }}>View</a>}
                {!isReadOnly && <button type="button" onClick={() => handleDelete(cred.id)} style={{ fontSize: '0.8rem', color: 'var(--error)', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}>[Remove]</button>}
              </div>
            </div>
          ))}
        </div>
      )}

      {!isReadOnly && !showForm && (
        <button type="button" onClick={() => setShowForm(true)} className="btn btn-secondary" style={{ fontSize: '0.85rem', padding: '0.4rem 0.8rem' }}>
          + {credentials.length > 0 ? 'Add another supporting document' : 'Upload Evidence'}
        </button>
      )}

      {showForm && (
        <form onSubmit={handleUpload} style={{ background: 'var(--bg-surface-elevated)', padding: '1rem', borderRadius: '4px', border: '1px solid var(--border-subtle)' }}>
          <div style={{ marginBottom: '0.75rem' }}>
            <label style={{ fontSize: '0.85rem', display: 'block', marginBottom: '0.25rem', color: 'var(--text-secondary)' }}>Document Title</label>
            <input type="text" value={title} onChange={e => setTitle(e.target.value)} required placeholder="e.g. Experience Letter" className="form-input" />
          </div>
          <div style={{ marginBottom: '0.75rem' }}>
            <label style={{ fontSize: '0.85rem', display: 'block', marginBottom: '0.25rem', color: 'var(--text-secondary)' }}>Document File (PDF/Image)</label>
            <input type="file" onChange={e => setFile(e.target.files[0])} required style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }} />
          </div>
          <div style={{ marginBottom: '1rem' }}>
            <label style={{ fontSize: '0.85rem', display: 'block', marginBottom: '0.25rem', color: 'var(--text-secondary)' }}>Professional Evidence Link (Optional)</label>
            <input type="url" value={evidenceLink} onChange={e => setEvidenceLink(e.target.value)} placeholder="https://..." className="form-input" />
          </div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button type="submit" className="btn btn-primary" disabled={uploading} style={{ fontSize: '0.85rem', padding: '0.4rem 0.8rem' }}>
              {uploading ? 'Uploading...' : 'Upload'}
            </button>
            <button type="button" onClick={() => setShowForm(false)} className="btn btn-secondary" style={{ fontSize: '0.85rem', padding: '0.4rem 0.8rem' }}>
              Cancel
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
