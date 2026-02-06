import React, { createContext, useState, useContext, useEffect } from 'react';
import api from '../utils/api';

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

const loadCachedUser = () => {
  try {
    const cached = localStorage.getItem('user');
    return cached ? JSON.parse(cached) : null;
  } catch (error) {
    return null;
  }
};

const cacheUser = (nextUser) => {
  try {
    if (nextUser) {
      localStorage.setItem('user', JSON.stringify(nextUser));
    } else {
      localStorage.removeItem('user');
    }
  } catch (error) {
    // Ignore localStorage failures
  }
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => loadCachedUser());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadUser = async () => {
      const token = localStorage.getItem('token');
      if (token) {
        try {
          const response = await api.get('/auth/me');
          setUser(response.data.data);
          cacheUser(response.data.data);
        } catch (error) {
          const status = error?.response?.status;
          if (status === 401 || status === 403) {
            localStorage.removeItem('token');
            setUser(null);
            cacheUser(null);
          }
        }
      } else {
        setUser(null);
        cacheUser(null);
      }
      setLoading(false);
    };
    loadUser();
  }, []);

  const login = async (email, password) => {
    const response = await api.post('/auth/login', { email, password });
    const { token, ...userData } = response.data.data;
    localStorage.setItem('token', token);
    setUser(userData);
    cacheUser(userData);
    return response.data;
  };

  const signup = async (userData) => {
    const response = await api.post('/auth/signup', userData);
    const { token, ...user } = response.data.data;
    localStorage.setItem('token', token);
    setUser(user);
    cacheUser(user);
    return response.data;
  };

  const logout = () => {
    localStorage.removeItem('token');
    cacheUser(null);
    setUser(null);
  };

  const value = {
    user,
    loading,
    login,
    signup,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
