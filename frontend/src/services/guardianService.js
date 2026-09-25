const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';

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
  const response = await fetch(`${API_BASE_URL}/students/link-guardian`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify({ guardianEmail, relationship })
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || 'Failed to link guardian.');
  return data;
}
