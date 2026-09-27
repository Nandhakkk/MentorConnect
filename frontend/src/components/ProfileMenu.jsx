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

  return (
    <div className="profile-menu-container" ref={menuRef}>
      <button 
        className="profile-menu-trigger" 
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
        aria-haspopup="true"
      >
        <span className="profile-avatar">{user.name?.charAt(0)?.toUpperCase() || 'U'}</span>
        <span className="profile-name">{user.name}</span>
        <span className="profile-caret">▾</span>
      </button>

      {isOpen && (
        <div className="profile-dropdown-menu">
          <div className="profile-dropdown-header">
            <span className="dropdown-avatar">{user.name?.charAt(0)?.toUpperCase() || 'U'}</span>
            <div className="dropdown-user-info">
              <span className="dropdown-name">{user.name}</span>
              <span className="dropdown-role">{user.role?.toLowerCase()}</span>
            </div>
          </div>
          
          <div className="profile-dropdown-body">
            <NavLink 
              to={getProfileLink()} 
              className="dropdown-item"
              onClick={() => setIsOpen(false)}
            >
              My Profile
            </NavLink>
            <button className="dropdown-item dropdown-logout" onClick={logout}>
              Sign Out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
