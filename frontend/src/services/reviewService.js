const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';

const getAuthHeaders = () => {
  const token = localStorage.getItem('mentorconnect_token');
  return {
    'Content-Type': 'application/json',
    ...(token && { Authorization: `Bearer ${token}` })
  };
};

export async function createReview(data) {
  const response = await fetch(`${API_BASE_URL}/reviews`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(data)
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.message || 'Failed to submit review');
  return result.data;
}

export async function getSessionReviews(sessionId) {
  const response = await fetch(`${API_BASE_URL}/reviews/session/${sessionId}`, {
    headers: getAuthHeaders()
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.message || 'Failed to fetch session reviews');
  return result.data;
}

export async function getMyReviews() {
  const response = await fetch(`${API_BASE_URL}/reviews/my`, {
    headers: getAuthHeaders()
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.message || 'Failed to fetch reviews');
  return result.data;
}

export async function getMentorReviews(mentorId) {
  const response = await fetch(`${API_BASE_URL}/reviews/mentor/${mentorId}`, {
    headers: getAuthHeaders()
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.message || 'Failed to fetch mentor rating');
  return result.data;
}
