import { useAuth } from '../context/AuthContext';
import NotificationBell from './NotificationBell';
import ProfileMenu from './ProfileMenu';

export default function Header() {
  const { user, logout } = useAuth();
  return (
    <div className="app-header">
      <span className="portal-label">{user?.role?.toLowerCase()} workspace</span>
      <div className="header-actions">
        <NotificationBell />
        <ProfileMenu />
      </div>
    </div>
  );
}
