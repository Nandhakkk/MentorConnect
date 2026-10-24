export function getNotificationDestination(notification, user) {
  if (!user || !notification) return null;
  const role = user.role;
  const { referenceType, referenceId, type } = notification;

  if (referenceType === 'SESSION') {
    if (role === 'STUDENT') return '/student/sessions';
    if (role === 'MENTOR') return '/mentor/sessions';
  }

  if (referenceType === 'ASSIGNMENT') {
    if (role === 'STUDENT') return referenceId ? `/student/assignments/${referenceId}` : '/student/assignments';
    if (role === 'MENTOR') return referenceId ? `/mentor/assignments/${referenceId}/review` : '/mentor/assignments';
  }

  if (referenceType === 'COMPLAINT') {
    if (role === 'ADMIN') return referenceId ? `/admin/complaints/${referenceId}` : '/admin/complaints';
    if (role === 'STUDENT') return referenceId ? `/student/complaints/${referenceId}` : '/student/complaints';
    if (role === 'MENTOR') return referenceId ? `/mentor/complaints/${referenceId}` : '/mentor/complaints';
  }

  if (referenceType === 'PAYOUT') {
    if (role === 'MENTOR') return '/mentor/earnings';
    if (role === 'ADMIN') return '/admin/finance';
  }

  if (referenceType === 'REVIEW') {
    if (role === 'STUDENT') return '/student/sessions';
    if (role === 'MENTOR') return '/mentor/sessions';
  }

  if (type === 'PAYMENT') {
    if (role === 'ADMIN') return '/admin/finance';
    if (role === 'MENTOR') return '/mentor/earnings';
    if (role === 'STUDENT') return '/student/sessions';
  }

  if (type === 'MENTORSHIP_REQUEST') {
    if (role === 'MENTOR') return '/mentor/students';
    if (role === 'STUDENT') return '/student/mentorships';
  }

  if (type === 'SESSION_REMINDER') {
    if (role === 'STUDENT') return '/student/sessions';
    if (role === 'MENTOR') return '/mentor/sessions';
  }

  // Fallbacks
  if (role === 'STUDENT') return '/student/dashboard';
  if (role === 'MENTOR') return '/mentor/dashboard';
  if (role === 'ADMIN') return '/admin/dashboard';
  if (role === 'GUARDIAN') return '/guardian/dashboard';

  return '/';
}
