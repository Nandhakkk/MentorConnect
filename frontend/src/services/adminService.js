const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';

const getAuthHeaders = () => {
  const token = localStorage.getItem('mentorconnect_token');
  return {
    'Content-Type': 'application/json',
    ...(token && { Authorization: `Bearer ${token}` })
  };
};

export async function fetchAdminDashboardStats() {
  const response = await fetch(`${API_BASE_URL}/admin/dashboard-stats`, {
    headers: getAuthHeaders(),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || 'Failed to fetch admin stats');
  return data.stats;
}

export async function fetchAdminUsers(role = 'ALL', search = '') {
  let url = `${API_BASE_URL}/admin/users?role=${role}`;
  if (search) url += `&search=${encodeURIComponent(search)}`;

  const response = await fetch(url, {
    headers: getAuthHeaders(),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || 'Failed to fetch users');
  return data.users;
}

export async function fetchAdminMentors(type = '') {
  let url = `${API_BASE_URL}/admin/mentors`;
  if (type) url += `?type=${type}`;

  const response = await fetch(url, {
    headers: getAuthHeaders(),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || 'Failed to fetch mentors');
  return data.mentors;
}

export async function fetchMentorApplications(status = 'ALL', queue = '') {
  let url = `${API_BASE_URL}/admin/mentor-applications`;
  const params = [];
  if (queue) params.push(`queue=${encodeURIComponent(queue)}`);
  else if (status && status !== 'ALL') params.push(`status=${encodeURIComponent(status)}`);
  if (params.length > 0) url += `?${params.join('&')}`;

  const response = await fetch(url, { headers: getAuthHeaders() });
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || 'Failed to fetch mentor applications');
  return data.applications;
}

export async function fetchMentorApplicationById(id) {
  const response = await fetch(`${API_BASE_URL}/admin/mentor-applications/${id}`, { headers: getAuthHeaders() });
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || 'Failed to fetch mentor application');
  return data.application;
}

export async function updateMentorApplicationStatus(id, updateData) {
  const response = await fetch(`${API_BASE_URL}/admin/mentor-applications/${id}/status`, {
    method: 'PUT',
    headers: getAuthHeaders(),
    body: JSON.stringify(updateData)
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || 'Failed to update application status');
  return data.application;
}

export async function reconsiderMentorApplication(id, reason = '') {
  const response = await fetch(`${API_BASE_URL}/admin/mentor-applications/${id}/reconsider`, {
    method: 'PUT',
    headers: getAuthHeaders(),
    body: JSON.stringify({ reason })
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || 'Failed to reconsider application');
  return data;
}

export async function fetchAdminMentorships(status = 'ALL') {
  let url = `${API_BASE_URL}/admin/mentorships?status=${status}`;
  const response = await fetch(url, {
    headers: getAuthHeaders(),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || 'Failed to fetch mentorships');
  return data.mentorships;
}

export async function fetchPeerMentorApplications(status = 'ALL', queue = '') {
  let url = `${API_BASE_URL}/admin/peer-mentor-applications`;
  const params = [];
  if (queue) params.push(`queue=${encodeURIComponent(queue)}`);
  else if (status && status !== 'ALL') params.push(`status=${encodeURIComponent(status)}`);
  if (params.length > 0) url += `?${params.join('&')}`;

  const response = await fetch(url, { headers: getAuthHeaders() });
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || 'Failed to fetch peer mentor applications');
  return data.applications;
}

export async function fetchPeerMentorApplicationById(id) {
  const response = await fetch(`${API_BASE_URL}/admin/peer-mentor-applications/${id}`, { headers: getAuthHeaders() });
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || 'Failed to fetch peer mentor application');
  return data.application;
}

export async function updatePeerMentorApplicationStatus(id, updateData) {
  const response = await fetch(`${API_BASE_URL}/admin/peer-mentor-applications/${id}/status`, {
    method: 'PUT',
    headers: getAuthHeaders(),
    body: JSON.stringify(updateData)
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || 'Failed to update peer mentor application status');
  return data.application;
}

export async function reconsiderPeerMentorApplication(id, reason = '') {
  const response = await fetch(`${API_BASE_URL}/admin/peer-mentor-applications/${id}/reconsider`, {
    method: 'PUT',
    headers: getAuthHeaders(),
    body: JSON.stringify({ reason })
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || 'Failed to reconsider peer application');
  return data;
}

export async function generateMentorPortfolio(id) {
  const response = await fetch(`${API_BASE_URL}/admin/mentor-applications/${id}/generate-portfolio`, {
    method: 'POST',
    headers: getAuthHeaders()
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || 'Failed to generate portfolio');
  return data.portfolio;
}

export async function fetchVerificationRequests(status = 'ALL') {
  let url = `${API_BASE_URL}/admin/verification-requests`;
  if (status && status !== 'ALL') {
    url += `?status=${status}`;
  }
  const response = await fetch(url, { headers: getAuthHeaders() });
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || 'Failed to fetch verification requests');
  return data.requests;
}

export async function updateVerificationRequestStatus(id, updateData) {
  const response = await fetch(`${API_BASE_URL}/admin/verification-requests/${id}/status`, {
    method: 'PUT',
    headers: getAuthHeaders(),
    body: JSON.stringify(updateData)
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || 'Failed to update verification request status');
  return data.request;
}
