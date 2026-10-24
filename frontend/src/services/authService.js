/**
 * Authentication API Service Client
 */

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';

/**
 * Register a new user
 */
export async function registerUser(name, email, password, role, dateOfBirth, goal) {
  const payload = { name, email, password, role, dateOfBirth };
  if (goal && typeof goal === 'string' && goal.trim()) {
    payload.goal = goal.trim();
    payload.careerGoal = goal.trim();
  }
  const response = await fetch(`${API_BASE_URL}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.message || 'Registration failed.');
  }

  return data;
}

/**
 * Login an existing user
 */
export async function loginUser(email, password) {
  const response = await fetch(`${API_BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.message || 'Login failed.');
  }

  return data;
}

/**
 * Fetch current authenticated user's details and profile
 */
export async function getMe(token) {
  const response = await fetch(`${API_BASE_URL}/auth/me`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`
    }
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.message || 'Session expired or invalid.');
  }

  return data;
}
