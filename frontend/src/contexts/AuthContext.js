import React, { createContext, useState, useContext, useEffect, useCallback } from 'react';
import api from '../utils/api';
import { setupPushNotifications, removePushSubscription } from '../utils/pushManager';

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
  const [notificationPermission, setNotificationPermission] = useState(() => {
    if (typeof window === 'undefined' || !('Notification' in window)) return 'unsupported';
    return Notification.permission;
  });
  
  const refreshNotificationPermission = useCallback(() => {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      setNotificationPermission('unsupported');
      return;
    }
    setNotificationPermission(Notification.permission);
  }, []);

  const ensurePushPermissionForUser = useCallback(async ({ requestPermission = false } = {}) => {
    try {
      const result = await setupPushNotifications({ requestPermission });
      refreshNotificationPermission();
      return result;
    } catch (error) {
      refreshNotificationPermission();
      console.error('Push setup error:', error);
      return null;
    }
  }, [refreshNotificationPermission]);

  useEffect(() => {
    const loadUser = async () => {
      const token = localStorage.getItem('token');
      if (token) {
        try {
          const response = await api.get('/auth/me');
          setUser(response.data.data);
          cacheUser(response.data.data);
          await ensurePushPermissionForUser({ requestPermission: false });
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
      refreshNotificationPermission();
      setLoading(false);
    };
    loadUser();
  }, [ensurePushPermissionForUser, refreshNotificationPermission]);

  const login = async (email, password) => {
    const response = await api.post('/auth/login', { email, password });
    const { token, ...userData } = response.data.data;
    localStorage.setItem('token', token);
    setUser(userData);
    cacheUser(userData);
    await ensurePushPermissionForUser({ requestPermission: true });
    return response.data;
  };

  const signup = async (userData) => {
    const response = await api.post('/auth/signup', userData);
    const { token, ...user } = response.data.data;
    localStorage.setItem('token', token);
    setUser(user);
    cacheUser(user);
    await ensurePushPermissionForUser({ requestPermission: true });
    return response.data;
  };

  const enableNotifications = async () => {
    return ensurePushPermissionForUser({ requestPermission: true });
  };

  const logout = async () => {
    try {
      await removePushSubscription();
    } catch (error) {
      console.error('Push unsubscribe error:', error);
    }
    localStorage.removeItem('token');
    cacheUser(null);
    setUser(null);
    refreshNotificationPermission();
  };

  const value = {
    user,
    loading,
    notificationPermission,
    enableNotifications,
    login,
    signup,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
