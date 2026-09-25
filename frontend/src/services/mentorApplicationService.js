const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';

export async function getMyApplication(token) {
  const response = await fetch(`${API_BASE_URL}/mentor-applications/me`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  const data = await response.json();
  if (response.status === 404) return null; // No application found
  if (!response.ok) throw new Error(data.message || 'Failed to fetch mentor application.');
  return data.application;
}

export async function createApplication(applicationData, token) {
  const response = await fetch(`${API_BASE_URL}/mentor-applications`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify(applicationData)
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || 'Failed to create mentor application.');
  return data.application;
}

export async function updateMyApplication(applicationData, token) {
  const response = await fetch(`${API_BASE_URL}/mentor-applications/me`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify(applicationData)
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || 'Failed to update mentor application.');
  return data.application;
}
