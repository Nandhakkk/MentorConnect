const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';

const getAuthHeaders = () => {
  const token = localStorage.getItem('mentorconnect_token');
  return {
    'Content-Type': 'application/json',
    ...(token && { Authorization: `Bearer ${token}` })
  };
};

export const fetchRefundEligibility = async (sessionId) => {
  const response = await fetch(`${API_BASE_URL}/refunds/eligibility/${sessionId}`, {
    method: 'GET',
    headers: getAuthHeaders()
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || 'Failed to fetch refund eligibility');
  return data.data;
};

export const cancelSessionWithRefund = async (sessionId, reason = '') => {
  const response = await fetch(`${API_BASE_URL}/refunds/cancel-session/${sessionId}`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ reason })
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || 'Failed to cancel session');
  return data.data;
};

export const reportMentorNoShow = async (sessionId, notes = '') => {
  const response = await fetch(`${API_BASE_URL}/refunds/report-no-show/${sessionId}`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ notes })
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || 'Failed to report mentor no-show');
  return data.data;
};

export const fetchMyRefunds = async () => {
  const response = await fetch(`${API_BASE_URL}/refunds/my`, {
    method: 'GET',
    headers: getAuthHeaders()
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || 'Failed to fetch refunds');
  return data.data;
};

export const fetchAdminRefunds = async (status = 'ALL') => {
  const url = status && status !== 'ALL'
    ? `${API_BASE_URL}/refunds/admin?status=${status}`
    : `${API_BASE_URL}/refunds/admin`;
  const response = await fetch(url, {
    method: 'GET',
    headers: getAuthHeaders()
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || 'Failed to fetch admin refunds');
  return data.data;
};

export const processAdminRefundDecision = async (id, decision, amount, adminNotes = '') => {
  const response = await fetch(`${API_BASE_URL}/refunds/admin/${id}/decision`, {
    method: 'PUT',
    headers: getAuthHeaders(),
    body: JSON.stringify({ decision, amount, adminNotes })
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || 'Failed to process refund decision');
  return data;
};

export const createAdminManualRefund = async (paymentId, amount, reason = '', adminNotes = '') => {
  const response = await fetch(`${API_BASE_URL}/refunds/admin/manual`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ paymentId, amount, reason, adminNotes })
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || 'Failed to create manual refund');
  return data;
};

export const retryFailedRefund = async (id) => {
  const response = await fetch(`${API_BASE_URL}/refunds/admin/${id}/retry`, {
    method: 'POST',
    headers: getAuthHeaders()
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || 'Failed to retry refund');
  return data;
};
