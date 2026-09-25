const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';

const getAuthHeaders = () => {
  const token = localStorage.getItem('mentorconnect_token');
  return {
    'Content-Type': 'application/json',
    ...(token && { Authorization: `Bearer ${token}` })
  };
};

export async function createAssignment(data) {
  const response = await fetch(`${API_BASE_URL}/assignments`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(data)
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.message || 'Failed to create assignment');
  return result.data;
}

export async function getMentorAssignments() {
  const response = await fetch(`${API_BASE_URL}/assignments/mentor`, {
    headers: getAuthHeaders()
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.message || 'Failed to fetch assignments');
  return result.data;
}

export async function getStudentAssignments() {
  const response = await fetch(`${API_BASE_URL}/assignments/student`, {
    headers: getAuthHeaders()
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.message || 'Failed to fetch assignments');
  return result.data;
}

export async function getAssignment(id) {
  const response = await fetch(`${API_BASE_URL}/assignments/${id}`, {
    headers: getAuthHeaders()
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.message || 'Failed to fetch assignment details');
  return result.data;
}

export async function submitAssignment(id, data) {
  const response = await fetch(`${API_BASE_URL}/assignments/${id}/submission`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(data)
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.message || 'Failed to submit assignment');
  return result.data;
}

export async function reviewAssignment(id, data) {
  const response = await fetch(`${API_BASE_URL}/assignments/${id}/review`, {
    method: 'PUT',
    headers: getAuthHeaders(),
    body: JSON.stringify(data)
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.message || 'Failed to review assignment');
  return result;
}
