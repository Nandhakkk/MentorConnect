/**
 * API Service Client
 * Centralized fetch wrapper for communicating with the Express backend
 */

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';

/**
 * Fetch health status of the backend
 */
export async function checkBackendHealth() {
  try {
    const response = await fetch(`${API_BASE_URL}/health`);
    if (!response.ok) {
      throw new Error(`HTTP Error: ${response.status} ${response.statusText}`);
    }
    return await response.json();
  } catch (error) {
    return {
      status: 'error',
      message: error.message || 'Unable to connect to backend server'
    };
  }
}
