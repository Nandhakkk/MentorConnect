const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';

const getAuthHeaders = () => {
  const token = localStorage.getItem('mentorconnect_token');
  return {
    'Content-Type': 'application/json',
    ...(token && { Authorization: `Bearer ${token}` })
  };
};

export async function fetchMyStudentProfile() {
  const response = await fetch(`${API_BASE_URL}/students/me`, {
    headers: getAuthHeaders(),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || 'Failed to fetch student profile');
  return data.profile;
}

export async function updateMyStudentProfile(profileData) {
  const response = await fetch(`${API_BASE_URL}/students/me`, {
    method: 'PUT',
    headers: getAuthHeaders(),
    body: JSON.stringify(profileData),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || 'Failed to update student profile');
  return data.profile;
}
