import { useState, useEffect } from 'react';
import { fetchMyMentorProfile, updateMyMentorProfile, fetchVerificationRequests, createVerificationRequest, uploadProfileImage } from '../../services/mentorService';
import { useAuth } from '../../context/AuthContext';
import ImageCropper from '../../components/ImageCropper';

export default function MentorProfileForm() {
  const { user } = useAuth();
  const [profile, setProfile] = useState({
    bio: '',
    expertise: '',
    experience: '',
    language: '',
    linkedinUrl: '',
    teachingExperience: '',
    sessionFee: '',
    topics: '',
    isAvailable: true
  });
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  // Modals / forms state
  const [showRequestForm, setShowRequestForm] = useState(false);
  const [requestType, setRequestType] = useState('NEW_TEACHING_TOPIC');
  const [requestTitle, setRequestTitle] = useState('');
  const [requestDesc, setRequestDesc] = useState('');
  const [requestFiles, setRequestFiles] = useState(null);
  const [requestLink, setRequestLink] = useState('');
  const [requestSubmitting, setRequestSubmitting] = useState(false);
  const [cropImageSrc, setCropImageSrc] = useState(null);

  const isApprovedProfessional = user?.mentorProfile?.status === 'APPROVED' && user?.mentorProfile?.mentorType === 'PROFESSIONAL';

  useEffect(() => {
    const loadProfile = async () => {
      try {
        setLoading(true);
        const [data, reqData] = await Promise.all([
          fetchMyMentorProfile(),
          isApprovedProfessional ? fetchVerificationRequests() : Promise.resolve([])
        ]);

        setProfile({
          bio: data.profile.bio || '',
          expertise: data.profile.expertise || '',
          experience: data.profile.experience || '',
          language: data.profile.language || '',
          linkedinUrl: data.profile.linkedinUrl || '',
          teachingExperience: data.profile.teachingExperience || '',
          sessionFee: data.profile.sessionFee || '',
          topics: data.profile.topics ? data.profile.topics.map(t => t.topic.name).join(', ') : '',
          isAvailable: data.profile.isAvailable
        });
        setRequests(reqData);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    loadProfile();
  }, [isApprovedProfessional]);

  const handleSave = async (e) => {
    e.preventDefault();
    try {
      setSaving(true);
      setMessage('');
      setError('');

      const payload = { ...profile };

      // If approved professional, don't send restricted fields, they are ignored by backend anyway
      if (isApprovedProfessional) {
        delete payload.experience;
        delete payload.teachingExperience;
        delete payload.topics;
      } else {
        payload.topics = profile.topics ? profile.topics.split(',').map(t => t.trim()).filter(Boolean) : [];
      }

      await updateMyMentorProfile(payload);
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
      await uploadProfileImage(fileToUpload);
      window.location.reload();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleCropCancel = () => setCropImageSrc(null);

  const handleRequestSubmit = async (e) => {
    e.preventDefault();
    try {
      setRequestSubmitting(true);
      setError('');

      const formData = new FormData();
      formData.append('type', requestType);
      formData.append('title', requestTitle);
      formData.append('description', requestDesc);

      if (requestFiles) {
        formData.append('evidenceFiles', requestFiles);
      }
      if (requestLink) {
        formData.append('evidenceLinks', requestLink);
      }

      const newReq = await createVerificationRequest(formData);
      setRequests([newReq, ...requests]);
      setShowRequestForm(false);
      setRequestTitle('');
      setRequestDesc('');
      setRequestFiles(null);
      setRequestLink('');
    } catch (err) {
      setError(err.message);
    } finally {
      setRequestSubmitting(false);
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
          <p className="page-subtitle">Update your mentor details.</p>
        </div>
      </div>

      <div className="glass-card" style={{ maxWidth: '800px', padding: '2rem', marginBottom: '2rem' }}>
        <h3 className="card-section-title">Profile Information</h3>
        <form onSubmit={handleSave}>
          <div style={{ display: 'flex', gap: '1.5rem', marginBottom: '1.5rem', alignItems: 'center' }}>
            <div>
              {user?.profileImage ? (
                <img src={user.profileImage} alt="Profile" style={{ width: '80px', height: '80px', borderRadius: '50%', objectFit: 'cover', border: '2px solid var(--border-subtle)' }} />
              ) : (
                <div style={{ width: '80px', height: '80px', borderRadius: '50%', background: 'var(--accent-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '2rem', color: '#FFFFFF', fontWeight: 700 }}>
                  {user?.name?.charAt(0) || 'U'}
                </div>
              )}
            </div>
            <div>
              <label className="btn btn-secondary" style={{ cursor: 'pointer', display: 'inline-block' }}>
                {saving ? 'Uploading...' : 'Change Profile Picture'}
                <input type="file" accept="image/png, image/jpeg, image/jpg" onChange={handleImageUpload} disabled={saving} style={{ display: 'none' }} />
              </label>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.5rem' }}>PNG or JPEG only.</div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem' }}>
            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Full Name</label>
              <input type="text" value={user?.name || ''} disabled className="form-input" style={{ color: 'var(--text-muted)' }} />
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Email</label>
              <input type="email" value={user?.email || ''} disabled className="form-input" style={{ color: 'var(--text-muted)' }} />
            </div>
          </div>

          <div style={{ marginBottom: '1.5rem' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', color: 'var(--text-primary)' }}>Expertise (e.g., React, Node.js)</label>
            <input type="text" className="form-input" value={profile.expertise} onChange={e => setProfile({...profile, expertise: e.target.value})} />
          </div>

          <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem' }}>
            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', color: 'var(--text-primary)' }}>Experience (Years) {isApprovedProfessional && '🔒'}</label>
              <input type="number" min="0" className="form-input" value={profile.experience} disabled={isApprovedProfessional} onChange={e => setProfile({...profile, experience: e.target.value})} style={isApprovedProfessional ? { color: 'var(--text-muted)' } : {}} />
              {isApprovedProfessional && <small style={{color: 'var(--text-muted)'}}>Verified. Request update below.</small>}
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', color: 'var(--text-primary)' }}>Session Fee (₹/hr)</label>
              <input type="number" min="0" step="0.01" className="form-input" value={profile.sessionFee} onChange={e => setProfile({...profile, sessionFee: e.target.value})} />
            </div>
          </div>

          <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem' }}>
            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', color: 'var(--text-primary)' }}>Language</label>
              <input type="text" placeholder="e.g. English, Spanish" className="form-input" value={profile.language} onChange={e => setProfile({...profile, language: e.target.value})} />
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', color: 'var(--text-primary)' }}>Teaching Exp (Years) {isApprovedProfessional && '🔒'}</label>
              <input type="number" min="0" className="form-input" value={profile.teachingExperience} disabled={isApprovedProfessional} onChange={e => setProfile({...profile, teachingExperience: e.target.value})} style={isApprovedProfessional ? { color: 'var(--text-muted)' } : {}} />
              {isApprovedProfessional && <small style={{color: 'var(--text-muted)'}}>Verified. Request update below.</small>}
            </div>
          </div>

          <div style={{ marginBottom: '1.5rem' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', color: 'var(--text-primary)' }}>Topics {isApprovedProfessional && '🔒'}</label>
            <input type="text" placeholder="e.g. React, Career Growth, Interview Prep" className="form-input" value={profile.topics} disabled={isApprovedProfessional} onChange={e => setProfile({...profile, topics: e.target.value})} style={isApprovedProfessional ? { color: 'var(--text-muted)' } : {}} />
            {isApprovedProfessional && <small style={{color: 'var(--text-muted)'}}>Verified. Add new topics via verification requests.</small>}
          </div>

          <div style={{ marginBottom: '1.5rem' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', color: 'var(--text-primary)' }}>LinkedIn URL</label>
            <input type="url" className="form-input" value={profile.linkedinUrl} onChange={e => setProfile({...profile, linkedinUrl: e.target.value})} />
          </div>

          <div style={{ marginBottom: '1.5rem' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', color: 'var(--text-primary)' }}>Bio</label>
            <textarea className="form-input" value={profile.bio} onChange={e => setProfile({...profile, bio: e.target.value})} rows="4" />
          </div>

          <div style={{ marginBottom: '2rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <input type="checkbox" id="isAvailable" checked={profile.isAvailable} onChange={e => setProfile({...profile, isAvailable: e.target.checked})} style={{ width: '1.2rem', height: '1.2rem', cursor: 'pointer' }} />
            <label htmlFor="isAvailable" style={{ fontSize: '0.9rem', cursor: 'pointer', color: 'var(--text-primary)' }}>I am currently available to take on new students</label>
          </div>

          {message && <div style={{ color: 'var(--success)', marginBottom: '1rem', fontWeight: 'bold' }}>{message}</div>}
          {error && <div style={{ color: 'var(--error)', marginBottom: '1rem' }}>{error}</div>}

          <button type="submit" className="btn btn-primary" disabled={saving} style={{ padding: '0.75rem 2rem' }}>
            {saving ? 'Saving...' : 'Save Profile'}
          </button>
        </form>
      </div>

      {isApprovedProfessional && (
        <div className="glass-card" style={{ maxWidth: '800px', padding: '2rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
            <h3 className="card-section-title" style={{ margin: 0 }}>Verification Requests</h3>
            <button className="btn btn-secondary" onClick={() => setShowRequestForm(!showRequestForm)}>
              {showRequestForm ? 'Cancel Request' : '+ New Request'}
            </button>
          </div>

          {showRequestForm && (
            <div style={{ background: 'var(--bg-surface-elevated)', padding: '1.5rem', borderRadius: '8px', marginBottom: '1.5rem', border: '1px solid var(--border-subtle)' }}>
              <form onSubmit={handleRequestSubmit}>
                <div style={{ marginBottom: '1rem' }}>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', color: 'var(--text-primary)' }}>Request Type</label>
                  <select value={requestType} onChange={e => setRequestType(e.target.value)} className="form-input">
                    <option value="NEW_TEACHING_TOPIC">Add Teaching Topic</option>
                    <option value="NEW_CERTIFICATE">Add Certificate</option>
                    <option value="NEW_EXPERIENCE">Add Experience</option>
                  </select>
                </div>
                <div style={{ marginBottom: '1rem' }}>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', color: 'var(--text-primary)' }}>Title/Topic</label>
                  <input required type="text" value={requestTitle} onChange={e => setRequestTitle(e.target.value)} className="form-input" />
                </div>
                <div style={{ marginBottom: '1rem' }}>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', color: 'var(--text-primary)' }}>Description & Explanation</label>
                  <textarea value={requestDesc} onChange={e => setRequestDesc(e.target.value)} rows="3" className="form-input" />
                </div>

                <div style={{ marginBottom: '1.5rem', padding: '1rem', border: '1px dashed var(--border-subtle)', borderRadius: '8px', background: 'var(--bg-card)' }}>
                  <h4 style={{ marginBottom: '0.5rem', fontSize: '1rem', color: 'var(--text-primary)' }}>Supporting Evidence <span style={{color: 'var(--text-muted)'}}>(Required)</span></h4>
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
                    You must provide a document/image, a supporting link, or both.
                  </p>

                  <div style={{ marginBottom: '1rem' }}>
                    <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Upload Certificate / Document / Image</label>
                    <input
                      type="file"
                      accept=".pdf, .png, .jpg, .jpeg"
                      onChange={e => setRequestFiles(e.target.files[0])}
                      style={{ width: '100%', padding: '0.5rem', color: 'var(--text-secondary)' }}
                    />
                    <small style={{ color: 'var(--text-muted)' }}>Accepted: PDF, PNG, JPG</small>
                  </div>

                  <div>
                    <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Supporting Link (Optional)</label>
                    <input
                      type="url"
                      placeholder="e.g. https://linkedin.com/..."
                      value={requestLink}
                      onChange={e => setRequestLink(e.target.value)}
                      className="form-input"
                    />
                  </div>
                </div>

                <button type="submit" className="btn btn-primary" disabled={requestSubmitting || (!requestFiles && !requestLink)}>
                  {requestSubmitting ? 'Submitting...' : 'Submit Request'}
                </button>
              </form>
            </div>
          )}

          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Type</th>
                  <th>Title</th>
                  <th>Status</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                {requests.length === 0 ? (
                  <tr><td colSpan="4" style={{ textAlign: 'center', color: 'var(--text-muted)' }}>No verification requests yet.</td></tr>
                ) : (
                  requests.map(req => (
                    <tr key={req.id}>
                      <td>{req.type.replace(/_/g, ' ')}</td>
                      <td>{req.title}</td>
                      <td>
                        <span className={`status-badge ${req.status.toLowerCase()}`}>
                          {req.status.replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td>{new Date(req.submittedAt).toLocaleDateString()}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
