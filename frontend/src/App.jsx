import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { useAuth } from './context/AuthContext';

// Layouts
import DashboardLayout from './layouts/DashboardLayout';

// Route guards
import RoleRoute from './components/RoleRoute';
import ProtectedRoute from './components/ProtectedRoute';

// Auth pages
import Login from './pages/Login';
import Register from './pages/Register';

// Dashboards
import StudentDashboard from './pages/student/StudentDashboard';
import StudentGoals from './pages/student/StudentGoals';
import GoalDetails from './pages/student/GoalDetails';
import MentorDiscovery from './pages/student/MentorDiscovery';
import PublicMentorProfile from './pages/student/PublicMentorProfile';
import StudentMentors from './pages/student/StudentMentors';
import StudentSessions from './pages/student/StudentSessions';
import StudentMessages from './pages/student/StudentMessages';
import StudentAIAssistant from './pages/student/StudentAIAssistant';
import StudentProfileForm from './pages/student/StudentProfileForm';
import MentorDashboard from './pages/mentor/MentorDashboard';
import MentorProfileForm from './pages/mentor/MentorProfileForm';
import MentorStudentsList from './pages/mentor/MentorStudentsList';
import MentorSessions from './pages/mentor/MentorSessions';
import MentorAvailability from './pages/mentor/MentorAvailability';
import MentorMessages from './pages/mentor/MentorMessages';
import AdminDashboard from './pages/admin/AdminDashboard';
import AdminUsers from './pages/admin/AdminUsers';
import AdminMentors from './pages/admin/AdminMentors';
import AdminMentorships from './pages/admin/AdminMentorships';

// Placeholder pages for upcoming features
// (None currently required)

// Root redirect → role-specific dashboard
function RootRedirect() {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (!user) return <Navigate to="/login" replace />;
  if (user.role === 'STUDENT') return <Navigate to="/student/dashboard" replace />;
  if (user.role === 'MENTOR') return <Navigate to="/mentor/dashboard" replace />;
  if (user.role === 'ADMIN') return <Navigate to="/admin/dashboard" replace />;
  return <Navigate to="/login" replace />;
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          {/* ─── Public Routes ─── */}
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />

          {/* ─── Root redirect ─── */}
          <Route path="/" element={<RootRedirect />} />

          {/* ─── STUDENT Routes ─── */}
          <Route
            path="/student"
            element={
              <RoleRoute allowedRoles={['STUDENT']}>
                <DashboardLayout title="Student Dashboard" />
              </RoleRoute>
            }
          >
            <Route path="dashboard" element={<StudentDashboard />} />
            <Route path="goals" element={<StudentGoals />} />
            <Route path="goals/:id" element={<GoalDetails />} />
            <Route path="mentor" element={<MentorDiscovery />} />
            <Route path="mentor/:id" element={<PublicMentorProfile />} />
            <Route path="mentorships" element={<StudentMentors />} />
            <Route path="sessions" element={<StudentSessions />} />
            <Route path="messages" element={<StudentMessages />} />
            <Route path="ai" element={<StudentAIAssistant />} />
            <Route path="profile" element={<StudentProfileForm />} />
            <Route index element={<Navigate to="dashboard" replace />} />
          </Route>

          {/* ─── MENTOR Routes ─── */}
          <Route
            path="/mentor"
            element={
              <RoleRoute allowedRoles={['MENTOR']}>
                <DashboardLayout title="Mentor Dashboard" />
              </RoleRoute>
            }
          >
            <Route path="dashboard" element={<MentorDashboard />} />
            <Route path="students" element={<MentorStudentsList />} />
            <Route path="sessions" element={<MentorSessions />} />
            <Route path="messages" element={<MentorMessages />} />
            <Route path="availability" element={<MentorAvailability />} />
            <Route path="profile" element={<MentorProfileForm />} />
            <Route index element={<Navigate to="dashboard" replace />} />
          </Route>

          {/* ─── ADMIN Routes ─── */}
          <Route
            path="/admin"
            element={
              <RoleRoute allowedRoles={['ADMIN']}>
                <DashboardLayout title="Admin Dashboard" />
              </RoleRoute>
            }
          >
            <Route path="dashboard" element={<AdminDashboard />} />
            <Route path="users" element={<AdminUsers />} />
            <Route path="mentors" element={<AdminMentors />} />
            <Route path="mentorships" element={<AdminMentorships />} />
            <Route index element={<Navigate to="dashboard" replace />} />
          </Route>

          {/* ─── Fallback ─── */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
