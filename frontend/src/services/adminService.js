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

export async function fetchAdminMentors() {
  const response = await fetch(`${API_BASE_URL}/admin/mentors`, {
    headers: getAuthHeaders(),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || 'Failed to fetch mentors');
  return data.mentors;
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
