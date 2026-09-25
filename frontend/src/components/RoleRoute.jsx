import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export const getDashboardForRole = (role) => {
  switch (role) {
    case 'STUDENT':
      return '/student/dashboard';
    case 'MENTOR':
      return '/mentor/dashboard';
    case 'ADMIN':
      return '/admin/dashboard';
    case 'GUARDIAN':
      return '/guardian/dashboard';
    default:
      return '/login';
  }
};

export default function RoleRoute({ allowedRoles, children }) {
  const { user, token, loading } = useAuth();

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '60vh',
        color: 'var(--text-secondary)'
      }}>
        <div style={{ textAlign: 'center' }}>
          <div className="badge badge-warning" style={{ marginBottom: '1rem' }}>
            <span className="badge-dot" /> Loading profile...
          </div>
          <p>Verifying access permissions...</p>
        </div>
      </div>
    );
  }

  // Not authenticated -> redirect to login
  if (!token || !user) {
    return <Navigate to="/login" replace />;
  }

  // Unauthorized role -> redirect to their own dashboard
  if (!allowedRoles.includes(user.role)) {
    return <Navigate to={getDashboardForRole(user.role)} replace />;
  }

  // Student onboarding check
  const location = useLocation();
  if (user.role === 'STUDENT' && user.studentProfile && !user.studentProfile.onboardingCompleted) {
    if (location.pathname !== '/student/onboarding') {
      return <Navigate to="/student/onboarding" replace />;
    }
  } else if (user.role === 'STUDENT' && user.studentProfile?.onboardingCompleted) {
    // If completed but trying to access onboarding, send to dashboard
    if (location.pathname === '/student/onboarding') {
      return <Navigate to="/student/dashboard" replace />;
    }
  }

  return children;
}
