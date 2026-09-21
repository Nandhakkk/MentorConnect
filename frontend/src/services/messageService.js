const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';

const getAuthHeaders = () => {
  const token = localStorage.getItem('mentorconnect_token');
  return {
    'Content-Type': 'application/json',
    ...(token && { Authorization: `Bearer ${token}` })
  };
};

export async function getMessages(mentorshipId) {
  const response = await fetch(`${API_BASE_URL}/messages/${mentorshipId}`, {
    method: 'GET',
    headers: getAuthHeaders()
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || 'Failed to fetch messages');
  return data.messages;
}

export async function sendMessage(mentorshipId, content) {
  const response = await fetch(`${API_BASE_URL}/messages/${mentorshipId}`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ content })
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || 'Failed to send message');
  return data.message;
}
