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

export async function uploadStudentProfileImage(file) {
  const formData = new FormData();
  formData.append('image', file);

  const token = localStorage.getItem('mentorconnect_token');
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;

  const response = await fetch(`${API_BASE_URL}/students/me/profile-image`, {
    method: 'POST',
    headers,
    body: formData
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || 'Failed to upload profile image');
  return data.profileImage;
}

export async function requestEmailChange(newEmail) {
  const response = await fetch(`${API_BASE_URL}/students/email/change`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ newEmail }),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || 'Failed to request email change');
  return data;
}

export async function verifyEmailChange(otp) {
  const response = await fetch(`${API_BASE_URL}/students/email/verify`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ otp }),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || 'Failed to verify email change');
  return data;
}

export async function resendEmailChangeOtp() {
  const response = await fetch(`${API_BASE_URL}/students/email/resend`, {
    method: 'POST',
    headers: getAuthHeaders(),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || 'Failed to resend verification code');
  return data;
}

export async function cancelEmailChange() {
  const response = await fetch(`${API_BASE_URL}/students/email/cancel`, {
    method: 'POST',
    headers: getAuthHeaders(),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || 'Failed to cancel email change');
  return data;
}
