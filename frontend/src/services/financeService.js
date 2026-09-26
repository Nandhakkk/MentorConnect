const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';

/**
 * Mentor: Get Earnings
 */
export async function fetchMentorEarnings(token) {
  const response = await fetch(`${API_BASE_URL}/finance/mentor/earnings`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || 'Failed to fetch earnings');
  return data;
}

/**
 * Admin: Get Finance Summary
 */
export async function fetchAdminFinanceSummary(token) {
  const response = await fetch(`${API_BASE_URL}/finance/admin/summary`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || 'Failed to fetch finance summary');
  return data;
}

/**
 * Admin: Get Payouts
 */
export async function fetchAdminPayouts(token, status = 'ALL') {
  const response = await fetch(`${API_BASE_URL}/finance/admin/payouts?status=${status}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || 'Failed to fetch payouts');
  return data.payouts;
}

/**
 * Admin: Process Payout
 */
export async function processPayout(token, id) {
  const response = await fetch(`${API_BASE_URL}/finance/admin/payouts/${id}/process`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${token}` }
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || 'Failed to process payout');
  return data.payout;
}

/**
 * Admin: Complete Payout
 */
export async function completePayout(token, id, status, providerId = null) {
  const response = await fetch(`${API_BASE_URL}/finance/admin/payouts/${id}/complete`, {
    method: 'PUT',
    headers: { 
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}` 
    },
    body: JSON.stringify({ status, providerId })
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || 'Failed to complete payout');
  return data.payout;
}
