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
import BookSession from './pages/student/BookSession';
import StudentSessions from './pages/student/StudentSessions';
import LiveSession from './pages/student/LiveSession';
import ReviewSession from './pages/student/ReviewSession';
import ReportSession from './pages/shared/ReportSession';
import MyComplaints from './pages/shared/MyComplaints';
import StudentAssignments from './pages/student/StudentAssignments';
import AssignmentDetails from './pages/student/AssignmentDetails';
import StudentMessages from './pages/student/StudentMessages';
import StudentAIAssistant from './pages/student/StudentAIAssistant';
import AIMentorRecommendations from './pages/student/AIMentorRecommendations';
import StudentProfileForm from './pages/student/StudentProfileForm';
import StudentOnboarding from './pages/student/StudentOnboarding';
import PeerMentorApplication from './pages/student/PeerMentorApplication';
import MentorDashboard from './pages/mentor/MentorDashboard';
import MentorProfileForm from './pages/mentor/MentorProfileForm';
import MentorStudentsList from './pages/mentor/MentorStudentsList';
import MentorApplication from './pages/mentor/MentorApplication';
import MentorSessions from './pages/mentor/MentorSessions';
import ReviewStudent from './pages/mentor/ReviewStudent';
import MentorAssignments from './pages/mentor/MentorAssignments';
import CreateAssignment from './pages/mentor/CreateAssignment';
import ReviewAssignment from './pages/mentor/ReviewAssignment';
import MentorAvailability from './pages/mentor/MentorAvailability';
import MentorMessages from './pages/mentor/MentorMessages';
import AdminDashboard from './pages/admin/AdminDashboard';
import AdminUsers from './pages/admin/AdminUsers';
import AdminMentors from './pages/admin/AdminMentors';
import AdminMentorships from './pages/admin/AdminMentorships';
import AdminComplaints from './pages/admin/AdminComplaints';
import AdminComplaintReview from './pages/admin/AdminComplaintReview';
import AdminMentorApplications from './pages/admin/AdminMentorApplications';
import AdminMentorApplicationReview from './pages/admin/AdminMentorApplicationReview';
import GuardianDashboard from './pages/guardian/GuardianDashboard';

// Placeholder pages for upcoming features
// (None currently required)

// Root redirect → role-specific dashboard
function RootRedirect() {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (!user) return <Navigate to="/login" replace />;
  if (user.role === 'STUDENT') {
    if (user.studentProfile && !user.studentProfile.onboardingCompleted) {
      return <Navigate to="/student/onboarding" replace />;
    }
    return <Navigate to="/student/dashboard" replace />;
  }
  if (user.role === 'MENTOR') return <Navigate to="/mentor/dashboard" replace />;
  if (user.role === 'ADMIN') return <Navigate to="/admin/dashboard" replace />;
  if (user.role === 'GUARDIAN') return <Navigate to="/guardian/dashboard" replace />;
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
            <Route path="mentorships/:id/book" element={<BookSession />} />
            <Route path="sessions" element={<StudentSessions />} />
            <Route path="sessions/:id/live" element={<LiveSession />} />
            <Route path="sessions/:id/review" element={<ReviewSession />} />
            <Route path="sessions/:id/report" element={<ReportSession />} />
            <Route path="complaints" element={<MyComplaints />} />
            <Route path="assignments" element={<StudentAssignments />} />
            <Route path="assignments/:id" element={<AssignmentDetails />} />
            <Route path="messages" element={<StudentMessages />} />
            <Route path="ai" element={<StudentAIAssistant />} />
            <Route path="ai-mentors" element={<AIMentorRecommendations />} />
            <Route path="profile" element={<StudentProfileForm />} />
            <Route path="onboarding" element={<StudentOnboarding />} />
            <Route path="peer-mentor/apply" element={<PeerMentorApplication />} />
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
            <Route path="sessions/:id/live" element={<LiveSession />} />
            <Route path="sessions/:id/review" element={<ReviewStudent />} />
            <Route path="sessions/:id/report" element={<ReportSession />} />
            <Route path="complaints" element={<MyComplaints />} />
            <Route path="assignments" element={<MentorAssignments />} />
            <Route path="assignments/create" element={<CreateAssignment />} />
            <Route path="assignments/:id/review" element={<ReviewAssignment />} />
            <Route path="messages" element={<MentorMessages />} />
            <Route path="availability" element={<MentorAvailability />} />
            <Route path="profile" element={<MentorProfileForm />} />
            <Route path="application" element={<MentorApplication />} />
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
            <Route path="mentor-applications" element={<AdminMentorApplications />} />
            <Route path="mentor-applications/:id" element={<AdminMentorApplicationReview />} />
            <Route path="mentorships" element={<AdminMentorships />} />
            <Route path="complaints" element={<AdminComplaints />} />
            <Route path="complaints/:id" element={<AdminComplaintReview />} />
            <Route index element={<Navigate to="dashboard" replace />} />
          </Route>

          {/* ─── GUARDIAN Routes ─── */}
          <Route
            path="/guardian"
            element={
              <RoleRoute allowedRoles={['GUARDIAN']}>
                <DashboardLayout title="Guardian Dashboard" />
              </RoleRoute>
            }
          >
            <Route path="dashboard" element={<GuardianDashboard />} />
            <Route index element={<Navigate to="dashboard" replace />} />
          </Route>

          {/* ─── Fallback ─── */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
