const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';

const getAuthHeaders = () => {
  const token = localStorage.getItem('mentorconnect_token');
  return {
    'Content-Type': 'application/json',
    ...(token && { Authorization: `Bearer ${token}` })
  };
};

export async function createPaymentOrder(sessionId) {
  const response = await fetch(`${API_BASE_URL}/payments/create-order`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ sessionId })
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || 'Failed to create payment order');
  return data;
}

export async function verifyPayment(paymentDetails) {
  const response = await fetch(`${API_BASE_URL}/payments/verify`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(paymentDetails)
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || 'Failed to verify payment');
  return data;
}
