import { useState, useRef, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { NavLink } from 'react-router-dom';

export default function ProfileMenu() {
  const { user, logout } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef(null);

  // Close when clicking outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (!user) return null;

  const getProfileLink = () => {
    switch (user.role) {
      case 'STUDENT':
        return '/student/profile';
      case 'MENTOR':
        return '/mentor/profile';
      case 'ADMIN':
        return '/admin/dashboard';
      case 'GUARDIAN':
        return '/guardian/dashboard';
      default:
        return '/';
    }
  };

  const getBasePath = () => {
    switch (user.role) {
      case 'STUDENT': return '/student';
      case 'MENTOR': return '/mentor';
      case 'ADMIN': return '/admin';
      case 'GUARDIAN': return '/guardian';
      default: return '';
    }
  };

  return (
    <div className="profile-menu-container" ref={menuRef}>
      <button
        className="profile-menu-trigger"
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
        aria-haspopup="true"
      >
        <span className="profile-avatar">{user.profileImage ? <img src={user.profileImage} alt="" style={{width:'100%',height:'100%',borderRadius:'50%',objectFit:'cover'}}/> : (user.name?.charAt(0)?.toUpperCase() || 'U')}</span>
        <span className="profile-name">{user.name}</span>
        <span className="profile-caret">▾</span>
      </button>

      {isOpen && (
        <div className="profile-dropdown-menu">
          <div className="profile-dropdown-header">
            <span className="dropdown-avatar">{user.profileImage ? <img src={user.profileImage} alt="" style={{width:'100%',height:'100%',borderRadius:'50%',objectFit:'cover'}}/> : (user.name?.charAt(0)?.toUpperCase() || 'U')}</span>
            <div className="dropdown-user-info">
              <span className="dropdown-name">{user.name}</span>
              <span className="dropdown-role">{user.role?.toLowerCase()}</span>
            </div>
          </div>

          <div className="profile-dropdown-body">
            {user.role === 'ADMIN' ? (
              <>
                <NavLink
                  to={`${getBasePath()}/account`}
                  className="dropdown-item"
                  onClick={() => setIsOpen(false)}
                >
                  <span className="dropdown-icon" aria-hidden="true">⚙️</span> Account Settings
                </NavLink>
                <div className="dropdown-divider"></div>
                <button className="dropdown-item dropdown-logout" onClick={logout}>
                  <span className="dropdown-icon" aria-hidden="true">🚪</span> Logout
                </button>
              </>
            ) : (
              <>
                <NavLink
                  to={getProfileLink()}
                  className="dropdown-item"
                  onClick={() => setIsOpen(false)}
                >
                  <span className="dropdown-icon" aria-hidden="true">👤</span> Profile
                </NavLink>

                <NavLink
                  to={`${getBasePath()}/account`}
                  className="dropdown-item"
                  onClick={() => setIsOpen(false)}
                >
                  <span className="dropdown-icon" aria-hidden="true">🔐</span> Account & Privacy
                </NavLink>

                <NavLink
                  to={`${getBasePath()}/complaints`}
                  className="dropdown-item"
                  onClick={() => setIsOpen(false)}
                >
                  <span className="dropdown-icon" aria-hidden="true">⚠</span> My Complaints
                </NavLink>

                <NavLink
                  to={`${getBasePath()}/help`}
                  className="dropdown-item"
                  onClick={() => setIsOpen(false)}
                >
                  <span className="dropdown-icon" aria-hidden="true">❓</span> Help & Support
                </NavLink>

                <NavLink
                  to={`${getBasePath()}/about`}
                  className="dropdown-item"
                  onClick={() => setIsOpen(false)}
                >
                  <span className="dropdown-icon" aria-hidden="true">ℹ️</span> About MentorConnect
                </NavLink>

                <div className="dropdown-divider"></div>

                <button className="dropdown-item dropdown-logout" onClick={logout}>
                  <span className="dropdown-icon" aria-hidden="true">🚪</span> Logout
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
