const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';

const getAuthHeaders = () => {
  const token = localStorage.getItem('mentorconnect_token');
  return {
    'Content-Type': 'application/json',
    ...(token && { Authorization: `Bearer ${token}` })
  };
};

// ========================
// Goals
// ========================

export async function fetchGoals() {
  const response = await fetch(`${API_BASE_URL}/goals`, {
    method: 'GET',
    headers: getAuthHeaders()
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || 'Failed to fetch goals');
  return data.goals;
}

export async function fetchGoalById(id) {
  const response = await fetch(`${API_BASE_URL}/goals/${id}`, {
    method: 'GET',
    headers: getAuthHeaders()
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || 'Failed to fetch goal');
  return data.goal;
}

export async function createGoal(goalData) {
  const response = await fetch(`${API_BASE_URL}/goals`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(goalData)
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || 'Failed to create goal');
  return data.goal;
}

export async function updateGoal(id, goalData) {
  const response = await fetch(`${API_BASE_URL}/goals/${id}`, {
    method: 'PUT',
    headers: getAuthHeaders(),
    body: JSON.stringify(goalData)
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || 'Failed to update goal');
  return data.goal;
}

export async function deleteGoal(id) {
  const response = await fetch(`${API_BASE_URL}/goals/${id}`, {
    method: 'DELETE',
    headers: getAuthHeaders()
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || 'Failed to delete goal');
  return data;
}

// ========================
// Milestones
// ========================

export async function createMilestone(goalId, milestoneData) {
  const response = await fetch(`${API_BASE_URL}/goals/${goalId}/milestones`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(milestoneData)
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || 'Failed to create milestone');
  return data.milestone;
}

export async function updateMilestone(id, milestoneData) {
  const response = await fetch(`${API_BASE_URL}/milestones/${id}`, {
    method: 'PUT',
    headers: getAuthHeaders(),
    body: JSON.stringify(milestoneData)
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || 'Failed to update milestone');
  return data.milestone;
}

export async function deleteMilestone(id) {
  const response = await fetch(`${API_BASE_URL}/milestones/${id}`, {
    method: 'DELETE',
    headers: getAuthHeaders()
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || 'Failed to delete milestone');
  return data;
}
