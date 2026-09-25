const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';

const getAuthHeaders = () => {
  const token = localStorage.getItem('mentorconnect_token');
  return {
    'Content-Type': 'application/json',
    ...(token && { Authorization: `Bearer ${token}` })
  };
};

export async function createComplaint(dataPayload) {
  const response = await fetch(`${API_BASE_URL}/complaints`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(dataPayload)
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || 'Failed to create complaint');
  return data.data;
}

export async function getMyComplaints() {
  const response = await fetch(`${API_BASE_URL}/complaints/my`, {
    method: 'GET',
    headers: getAuthHeaders()
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || 'Failed to fetch complaints');
  return data.data;
}

export async function getComplaint(id) {
  const response = await fetch(`${API_BASE_URL}/complaints/${id}`, {
    method: 'GET',
    headers: getAuthHeaders()
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || 'Failed to fetch complaint');
  return data.data;
}

export async function getAdminComplaints() {
  const response = await fetch(`${API_BASE_URL}/admin/complaints`, {
    method: 'GET',
    headers: getAuthHeaders()
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || 'Failed to fetch complaints');
  return data.data;
}

export async function getAdminComplaint(id) {
  const response = await fetch(`${API_BASE_URL}/admin/complaints/${id}`, {
    method: 'GET',
    headers: getAuthHeaders()
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || 'Failed to fetch complaint');
  return data.data;
}

export async function updateComplaintStatus(id, payload) {
  const response = await fetch(`${API_BASE_URL}/admin/complaints/${id}/status`, {
    method: 'PUT',
    headers: getAuthHeaders(),
    body: JSON.stringify(payload)
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || 'Failed to update complaint');
  return data.data;
}

export async function suspendUser(userId) {
  const response = await fetch(`${API_BASE_URL}/admin/users/${userId}/suspend`, {
    method: 'PUT',
    headers: getAuthHeaders()
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || 'Failed to suspend user');
  return data.data;
}
