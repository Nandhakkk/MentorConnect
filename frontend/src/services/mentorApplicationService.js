const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';

export async function getMyApplication(token) {
  const response = await fetch(`${API_BASE_URL}/mentor-applications/me`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  const data = await response.json();
  if (response.status === 404) return null; // No application found
  if (!response.ok) {
    const detailMsg = data.details ? `: ${data.details}` : '';
    throw new Error(`${data.message || 'Failed to fetch mentor application.'}${detailMsg}`);
  }
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
  if (!response.ok) {
    const detailMsg = data.details ? `: ${data.details}` : '';
    throw new Error(`${data.message || 'Failed to create mentor application.'}${detailMsg}`);
  }
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
  if (!response.ok) {
    const detailMsg = data.details ? `: ${data.details}` : '';
    throw new Error(`${data.message || 'Failed to update mentor application.'}${detailMsg}`);
  }
  return data.application;
}

export async function screenApplication(token) {
  const response = await fetch(`${API_BASE_URL}/mentor-applications/me/screen`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`
    }
  });
  const data = await response.json();
  if (!response.ok) {
    const detailMsg = data.details ? `: ${data.details}` : '';
    throw new Error(`${data.message || 'Failed to run AI screening.'}${detailMsg}`);
  }
  return data.screeningResult;
}

export async function uploadCredential(formData, token) {
  const response = await fetch(`${API_BASE_URL}/mentor-applications/me/credentials`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`
    },
    body: formData // sending FormData directly, do not stringify
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || 'Failed to upload credential.');
  return data.credential;
}

export async function deleteCredential(credentialId, token) {
  const response = await fetch(`${API_BASE_URL}/mentor-applications/me/credentials/${credentialId}`, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${token}`
    }
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || 'Failed to delete credential.');
  return data;
}
