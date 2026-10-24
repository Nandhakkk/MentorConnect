const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';

/**
 * Fetch guardian setup status for the authenticated student
 */
export async function fetchGuardianStatus(token) {
  const authToken = token || localStorage.getItem('mentorconnect_token');
  const response = await fetch(`${API_BASE_URL}/guardian/status`, {
    headers: {
      Authorization: `Bearer ${authToken}`
    }
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || 'Failed to fetch guardian status.');
  return data.data;
}

/**
 * Save or update guardian contact details
 */
export async function saveGuardianContact(contactData, token) {
  const authToken = token || localStorage.getItem('mentorconnect_token');
  const response = await fetch(`${API_BASE_URL}/guardian/contact`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${authToken}`
    },
    body: JSON.stringify(contactData)
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || 'Failed to save guardian contact.');
  return data;
}

/**
 * Record student consent for guardian notifications
 */
export async function recordGuardianConsent(consentGranted, policyVersion = '1.0', token) {
  const authToken = token || localStorage.getItem('mentorconnect_token');
  const response = await fetch(`${API_BASE_URL}/guardian/consent`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${authToken}`
    },
    body: JSON.stringify({ consentGranted, policyVersion })
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || 'Failed to record consent.');
  return data;
}

/**
 * Send contact verification email (magic link)
 */
export async function sendGuardianVerification(token) {
  const authToken = token || localStorage.getItem('mentorconnect_token');
  const response = await fetch(`${API_BASE_URL}/guardian/verify/send`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${authToken}`
    }
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || 'Failed to send verification email.');
  return data;
}

/**
 * Send OTP verification code to Guardian contact (method: 'EMAIL' | 'PHONE')
 */
export async function sendGuardianOtp(method = 'EMAIL', token) {
  const authToken = token || localStorage.getItem('mentorconnect_token');
  const response = await fetch(`${API_BASE_URL}/guardian/otp/send`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${authToken}`
    },
    body: JSON.stringify({ method })
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || 'Failed to send OTP verification code.');
  return data;
}

/**
 * Verify OTP code entered by student or guardian
 */
export async function verifyGuardianOtp(otp, method = 'EMAIL', token) {
  const authToken = token || localStorage.getItem('mentorconnect_token');
  const response = await fetch(`${API_BASE_URL}/guardian/otp/verify`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${authToken}`
    },
    body: JSON.stringify({ otp, method })
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || 'Failed to verify code.');
  return data;
}

/**
 * Confirm contact verification via raw token (Public endpoint)
 */
export async function confirmGuardianVerification(rawToken) {
  const response = await fetch(`${API_BASE_URL}/guardian/verify/${rawToken}`);
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || 'Verification failed.');
  return data;
}

/**
 * Generate a 24-hour expiring read-only summary link
 */
export async function generateGuardianSummaryLink(token) {
  const authToken = token || localStorage.getItem('mentorconnect_token');
  const response = await fetch(`${API_BASE_URL}/guardian/summary-link`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${authToken}`
    }
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || 'Failed to generate summary link.');
  return data;
}

/**
 * Fetch allowlisted summary using valid token (Public endpoint)
 */
export async function fetchGuardianSummary(rawToken) {
  const response = await fetch(`${API_BASE_URL}/guardian/summary/${rawToken}`);
  const data = await response.json();
  if (!response.ok) {
    const error = new Error(data.message || 'Failed to access summary.');
    error.status = response.status;
    error.code = data.code;
    throw error;
  }
  return data.data;
}

/**
 * Update guardian notification preferences
 */
export async function updateNotificationPreferences(preferences, token) {
  const authToken = token || localStorage.getItem('mentorconnect_token');
  const response = await fetch(`${API_BASE_URL}/guardian/notifications/preferences`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${authToken}`
    },
    body: JSON.stringify(preferences)
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || 'Failed to update preferences.');
  return data;
}

/**
 * Revoke guardian access
 */
export async function revokeGuardianAccess(reason, token) {
  const authToken = token || localStorage.getItem('mentorconnect_token');
  const response = await fetch(`${API_BASE_URL}/guardian/access/revoke`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${authToken}`
    },
    body: JSON.stringify({ reason })
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || 'Failed to revoke access.');
  return data;
}

// ── Legacy Compatibility Functions ──
export async function getLinkedLearners(token) {
  const response = await fetch(`${API_BASE_URL}/guardian/learners`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || 'Failed to fetch learners.');
  return data.learners;
}

export async function getLearnerSessions(learnerId, token) {
  const response = await fetch(`${API_BASE_URL}/guardian/sessions/${learnerId}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || 'Failed to fetch sessions.');
  return data.sessions;
}

export async function getLearnerProgress(learnerId, token) {
  const response = await fetch(`${API_BASE_URL}/guardian/progress/${learnerId}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || 'Failed to fetch progress.');
  return data.progress;
}

export async function linkGuardian(guardianEmail, relationship, token) {
  return saveGuardianContact({ email: guardianEmail, relationship, name: guardianEmail.split('@')[0] }, token);
}
