import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { getNotifications, markNotificationRead, markAllNotificationsRead } from '../services/notificationService';
import { useAuth } from '../context/AuthContext';
import { getNotificationDestination } from '../utils/notificationNavigation';

export default function NotificationBell() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef(null);

  const fetchNotifs = async () => {
    try {
      const data = await getNotifications();
      setNotifications(data.notifications);
      setUnreadCount(data.unreadCount);
    } catch (err) {
      console.error('Failed to load notifications:', err);
    }
  };

  useEffect(() => {
    fetchNotifs();
    // Poll every 30 seconds
    const interval = setInterval(fetchNotifs, 30000);
    return () => clearInterval(interval);
  }, []);

  // Close dropdown if clicked outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowDropdown(false);
      }
    };
    if (showDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showDropdown]);

  const handleNotificationClick = async (notif) => {
    // 1. Close dropdown
    setShowDropdown(false);

    // 2. Mark as read if unread
    if (!notif.isRead) {
      try {
        await markNotificationRead(notif.id);
        fetchNotifs();
      } catch (err) {
        console.error(err);
      }
    }

    // 3. Navigate
    const destination = getNotificationDestination(notif, user);
    if (destination) {
      navigate(destination);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await markAllNotificationsRead();
      fetchNotifs();
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div style={{ position: 'relative' }} ref={dropdownRef}>
      <button 
        onClick={() => setShowDropdown(!showDropdown)}
        style={{
          background: 'transparent',
          border: 'none',
          color: 'var(--text-primary)',
          cursor: 'pointer',
          position: 'relative',
          padding: '0.5rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
          <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
        </svg>
        {unreadCount > 0 && (
          <span style={{
            position: 'absolute',
            top: 0,
            right: 0,
            background: '#ef4444',
            color: 'white',
            borderRadius: '50%',
            padding: '0.1rem 0.35rem',
            fontSize: '0.7rem',
            fontWeight: 'bold'
          }}>
            {unreadCount}
          </span>
        )}
      </button>

      {showDropdown && (
        <div style={{
          position: 'absolute',
          top: '100%',
          right: 0,
          width: '320px',
          maxHeight: '400px',
          overflowY: 'auto',
          background: 'var(--bg-card)',
          border: '1px solid var(--border-subtle)',
          borderRadius: '8px',
          boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.25)',
          zIndex: 50,
          marginTop: '0.5rem',
          display: 'flex',
          flexDirection: 'column'
        }}>
          <div style={{ padding: '1rem', borderBottom: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h4 style={{ margin: 0, color: 'var(--text-primary)' }}>Notifications</h4>
            {unreadCount > 0 && (
              <button onClick={handleMarkAllRead} style={{ background: 'transparent', border: 'none', color: 'var(--accent-primary)', fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer' }}>
                Mark all read
              </button>
            )}
          </div>
          
          <div style={{ flex: 1, padding: '0.5rem' }}>
            {notifications.length === 0 ? (
              <div style={{ padding: '1rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                No notifications yet.
              </div>
            ) : (
              notifications.map(notif => (
                <div 
                  key={notif.id} 
                  onClick={() => handleNotificationClick(notif)}
                  style={{
                    padding: '0.75rem',
                    borderRadius: '6px',
                    marginBottom: '0.5rem',
                    background: notif.isRead ? 'transparent' : 'var(--info-bg)',
                    cursor: 'pointer',
                    transition: 'background 0.2s',
                    position: 'relative',
                    border: notif.isRead ? '1px solid transparent' : '1px solid var(--info-border)'
                  }}
                  className="notification-item-hover"
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                    <strong style={{ color: 'var(--text-primary)', fontSize: '0.9rem' }}>{notif.title}</strong>
                    {!notif.isRead && <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--accent-primary)', display: 'inline-block' }}></span>}
                  </div>
                  <p style={{ margin: '0 0 0.25rem 0', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{notif.message}</p>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{new Date(notif.createdAt).toLocaleDateString()} {new Date(notif.createdAt).toLocaleTimeString([], {timeStyle: 'short'})}</span>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
