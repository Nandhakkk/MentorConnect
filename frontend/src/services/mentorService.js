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
  return { profile: data.profile, isReady: data.isReady };
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

export async function fetchAvailableMentors(searchParams = {}) {
  const query = new URLSearchParams();
  if (searchParams.search) query.append('search', searchParams.search);
  if (searchParams.expertise) query.append('expertise', searchParams.expertise);
  if (searchParams.minFee) query.append('minFee', searchParams.minFee);
  if (searchParams.maxFee) query.append('maxFee', searchParams.maxFee);
  if (searchParams.mentorType) query.append('mentorType', searchParams.mentorType);
  
  const url = `${API_BASE_URL}/mentors?${query.toString()}`;
  const response = await fetch(url, {
    method: 'GET',
    headers: getAuthHeaders()
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || 'Failed to fetch mentors');
  return data.mentors;
}

export async function addMentorAvailability(availabilityData) {
  const response = await fetch(`${API_BASE_URL}/mentors/me/availability`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(availabilityData)
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || 'Failed to add availability');
  return data.availability;
}

export async function removeMentorAvailability(id) {
  const response = await fetch(`${API_BASE_URL}/mentors/me/availability/${id}`, {
    method: 'DELETE',
    headers: getAuthHeaders()
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || 'Failed to remove availability');
  return data;
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

async function updateMentorshipRequest(id, action) {
  const response = await fetch(`${API_BASE_URL}/mentorships/${id}/${action}`, {
    method: 'PUT',
    headers: getAuthHeaders()
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || `Failed to ${action} mentorship request`);
  return data.mentorship;
}

export function acceptMentorship(id) {
  return updateMentorshipRequest(id, 'accept');
}

export function rejectMentorship(id) {
  return updateMentorshipRequest(id, 'reject');
}
