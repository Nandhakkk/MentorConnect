const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';

const getAuthHeaders = () => {
  const token = localStorage.getItem('mentorconnect_token');
  return {
    'Content-Type': 'application/json',
    ...(token && { Authorization: `Bearer ${token}` })
  };
};

/**
 * Ask the AI Learning Assistant a question.
 * @param {string} question - The student's question
 * @param {string|null} goalId - Optional goal ID for focused context
 */
export async function askAI(question, goalId = null) {
  const body = { question };
  if (goalId) body.goalId = goalId;

  const response = await fetch(`${API_BASE_URL}/ai/assist`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(body)
  });

  const data = await response.json();
  if (!response.ok || !data.success) {
    const error = new Error(data.error || 'Failed to get AI response');
    error.status = response.status;
    throw error;
  }
  return data.answer;
}

/**
 * Get AI mentor recommendations.
 */
export async function getMentorRecommendations() {
  const response = await fetch(`${API_BASE_URL}/ai/mentor-recommendations`, {
    method: 'POST',
    headers: getAuthHeaders(),
  });

  const data = await response.json();
  if (!response.ok || !data.success) {
    const error = new Error(data.error || data.message || 'Failed to get recommendations');
    error.status = response.status;
    throw error;
  }
  return data;
}
