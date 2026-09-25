import { useAuth } from '../context/AuthContext';
import NotificationBell from './NotificationBell';

export default function Header() {
  const { user, logout } = useAuth();
  return (
    <div className="app-header">
      <span className="portal-label">{user?.role?.toLowerCase()} workspace</span>
      <div className="header-actions">
        <NotificationBell />
        <span className="header-user">{user?.name}</span>
        <button onClick={logout} className="logout-button" id="header-logout-btn" aria-label="Sign out of MentorConnect">Sign out</button>
      </div>
    </div>
  );
}
