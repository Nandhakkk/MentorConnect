import { useAuth } from '../context/AuthContext';

export default function Header() {
  const { user, logout } = useAuth();
  return (
    <div className="app-header">
      <span className="portal-label">{user?.role?.toLowerCase()} workspace</span>
      <div className="header-actions">
        {/* Actions moved to global top bar */}
      </div>
    </div>
  );
}
