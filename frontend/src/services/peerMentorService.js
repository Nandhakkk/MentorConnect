const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';

const getAuthHeaders = () => {
  const token = localStorage.getItem('mentorconnect_token');
  return {
    'Content-Type': 'application/json',
    ...(token && { Authorization: `Bearer ${token}` })
  };
};

export async function getEligibility() {
  const response = await fetch(`${API_BASE_URL}/peer-mentor/apply/eligibility`, {
    method: 'GET',
    headers: getAuthHeaders()
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || 'Failed to fetch eligibility');
  return data.data;
}

export async function createApplication(dataPayload) {
  const response = await fetch(`${API_BASE_URL}/peer-mentor/apply`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(dataPayload)
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || 'Failed to create application');
  return data.data;
}

export async function getMyApplication() {
  const response = await fetch(`${API_BASE_URL}/peer-mentor/application`, {
    method: 'GET',
    headers: getAuthHeaders()
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || 'Failed to fetch application');
  return data.data;
}

export async function updateApplication(dataPayload) {
  const response = await fetch(`${API_BASE_URL}/peer-mentor/apply`, {
    method: 'PUT',
    headers: getAuthHeaders(),
    body: JSON.stringify(dataPayload)
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || 'Failed to update application');
  return data.data;
}

export async function screenApplication() {
  const response = await fetch(`${API_BASE_URL}/peer-mentor/apply/screen`, {
    method: 'POST',
    headers: getAuthHeaders()
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || 'Failed to screen application');
  return data.data;
}
