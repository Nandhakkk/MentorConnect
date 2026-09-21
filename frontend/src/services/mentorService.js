const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';

const getAuthHeaders = () => {
  const token = localStorage.getItem('mentorconnect_token');
  return {
    'Content-Type': 'application/json',
    ...(token && { Authorization: `Bearer ${token}` })
  };
};

// ========================
// Mentor Profile & Discovery
// ========================

export async function fetchMyMentorProfile() {
  const response = await fetch(`${API_BASE_URL}/mentors/me`, {
    method: 'GET',
    headers: getAuthHeaders()
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || 'Failed to fetch profile');
  return data.profile;
}

export async function updateMyMentorProfile(profileData) {
  const response = await fetch(`${API_BASE_URL}/mentors/me`, {
    method: 'PUT',
    headers: getAuthHeaders(),
    body: JSON.stringify(profileData)
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || 'Failed to update profile');
  return data.profile;
}

export async function fetchAvailableMentors(searchQuery = '') {
  const url = searchQuery ? `${API_BASE_URL}/mentors?search=${encodeURIComponent(searchQuery)}` : `${API_BASE_URL}/mentors`;
  const response = await fetch(url, {
    method: 'GET',
    headers: getAuthHeaders()
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || 'Failed to fetch mentors');
  return data.mentors;
}

export async function fetchMentorById(id) {
  const response = await fetch(`${API_BASE_URL}/mentors/${id}`, {
    method: 'GET',
    headers: getAuthHeaders()
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || 'Failed to fetch mentor');
  return data.profile;
}

// ========================
// Mentorship Requests
// ========================

export async function createMentorship(mentorId) {
  const response = await fetch(`${API_BASE_URL}/mentorships`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ mentorId })
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || 'Failed to request mentorship');
  return data.mentorship;
}

export async function fetchStudentMentorships() {
  const response = await fetch(`${API_BASE_URL}/mentorships/student`, {
    method: 'GET',
    headers: getAuthHeaders()
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || 'Failed to fetch mentorships');
  return data.mentorships;
}

export async function cancelMentorship(id) {
  const response = await fetch(`${API_BASE_URL}/mentorships/${id}`, {
    method: 'DELETE',
    headers: getAuthHeaders()
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || 'Failed to cancel mentorship');
  return data;
}

export async function fetchMentorMentorships() {
  const response = await fetch(`${API_BASE_URL}/mentorships/mentor`, {
    method: 'GET',
    headers: getAuthHeaders()
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || 'Failed to fetch mentorships');
  return data.mentorships;
}
