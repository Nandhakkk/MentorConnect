const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';

const getAuthHeaders = () => {
  const token = localStorage.getItem('mentorconnect_token');
  return {
    'Content-Type': 'application/json',
    ...(token && { Authorization: `Bearer ${token}` })
  };
};

// ========================
// Mentor Availability
// ========================

export async function fetchAvailability() {
  const response = await fetch(`${API_BASE_URL}/availability`, {
    method: 'GET',
    headers: getAuthHeaders()
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || 'Failed to fetch availability');
  return data.availabilities;
}

export async function createAvailability(availabilityData) {
  const response = await fetch(`${API_BASE_URL}/availability`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(availabilityData)
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || 'Failed to create availability');
  return data.availability;
}

export async function updateAvailability(id, availabilityData) {
  const response = await fetch(`${API_BASE_URL}/availability/${id}`, {
    method: 'PUT',
    headers: getAuthHeaders(),
    body: JSON.stringify(availabilityData)
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || 'Failed to update availability');
  return data.availability;
}

export async function deleteAvailability(id) {
  const response = await fetch(`${API_BASE_URL}/availability/${id}`, {
    method: 'DELETE',
    headers: getAuthHeaders()
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || 'Failed to delete availability');
  return data;
}
