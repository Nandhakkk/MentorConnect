const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';

const getAuthHeaders = () => {
  const token = localStorage.getItem('mentorconnect_token');
  return {
    'Content-Type': 'application/json',
    ...(token && { Authorization: `Bearer ${token}` })
  };
};

// ========================
// Sessions
// ========================

export async function fetchSessions() {
  const response = await fetch(`${API_BASE_URL}/sessions`, {
    method: 'GET',
    headers: getAuthHeaders()
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || 'Failed to fetch sessions');
  return data.sessions;
}

export async function bookSession(sessionData) {
  const response = await fetch(`${API_BASE_URL}/sessions`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(sessionData)
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || 'Failed to book session');
  return data.session;
}

export async function cancelSession(id) {
  const response = await fetch(`${API_BASE_URL}/sessions/${id}/cancel`, {
    method: 'PUT',
    headers: getAuthHeaders()
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || 'Failed to cancel session');
  return data.session;
}

export async function completeSession(id) {
  const response = await fetch(`${API_BASE_URL}/sessions/${id}/complete`, {
    method: 'PUT',
    headers: getAuthHeaders()
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || 'Failed to complete session');
  return data.session;
}
