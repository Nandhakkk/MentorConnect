import { createContext, useContext, useState, useEffect } from 'react';
import { loginUser, registerUser, getMe } from '../services/authService';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(() => localStorage.getItem('mentorconnect_token'));
  const [loading, setLoading] = useState(true);

  // Initialize and verify user on mount or when token changes
  useEffect(() => {
    const initializeAuth = async () => {
      const savedToken = localStorage.getItem('mentorconnect_token');
      if (savedToken) {
        try {
          const res = await getMe(savedToken);
          setUser(res.user);
          setToken(savedToken);
        } catch (err) {
          console.warn('[AuthContext] Stored token invalid or expired:', err.message);
          localStorage.removeItem('mentorconnect_token');
          setUser(null);
          setToken(null);
        }
      }
      setLoading(false);
    };

    initializeAuth();
  }, []);

  const login = async (email, password) => {
    const res = await loginUser(email, password);
    localStorage.setItem('mentorconnect_token', res.token);
    setToken(res.token);
    setUser(res.user);
    return res.user;
  };

  const register = async (name, email, password, role) => {
    const res = await registerUser(name, email, password, role);
    localStorage.setItem('mentorconnect_token', res.token);
    setToken(res.token);
    setUser(res.user);
    return res.user;
  };

  const logout = () => {
    localStorage.removeItem('mentorconnect_token');
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, token, loading, login, register, logout, isAuthenticated: !!user }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
