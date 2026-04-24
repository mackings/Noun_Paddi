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

  const syncUser = useCallback((nextUser) => {
    setUser(nextUser);
    cacheUser(nextUser);
  }, []);

  const refreshUser = useCallback(async () => {
    const response = await api.get('/auth/me');
    const nextUser = response.data.data;
    syncUser(nextUser);
    return nextUser;
  }, [syncUser]);
  
  const refreshNotificationPermission = useCallback(() => {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      setNotificationPermission('unsupported');
      return;
    }
    setNotificationPermission(Notification.permission);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;

    const syncPermission = () => {
      refreshNotificationPermission();
    };

    window.addEventListener('focus', syncPermission);
    document.addEventListener('visibilitychange', syncPermission);

    let permissionStatus;

    const bindPermissionsListener = async () => {
      if (!navigator.permissions?.query) return;

      try {
        permissionStatus = await navigator.permissions.query({ name: 'notifications' });
        if (permissionStatus?.addEventListener) {
          permissionStatus.addEventListener('change', syncPermission);
        } else if (permissionStatus?.onchange !== undefined) {
          permissionStatus.onchange = syncPermission;
        }
      } catch (error) {
        // Ignore unsupported Permissions API cases.
      }
    };

    bindPermissionsListener();

    return () => {
      window.removeEventListener('focus', syncPermission);
      document.removeEventListener('visibilitychange', syncPermission);
      if (permissionStatus?.removeEventListener) {
        permissionStatus.removeEventListener('change', syncPermission);
      } else if (permissionStatus?.onchange !== undefined) {
        permissionStatus.onchange = null;
      }
    };
  }, [refreshNotificationPermission]);

  const ensurePushPermissionForUser = useCallback(async ({ requestPermission = false } = {}) => {
    try {
      const result = await setupPushNotifications({ requestPermission });
      if (result?.supported === false) {
        setNotificationPermission('unsupported');
        return result;
      }
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
      try {
        await refreshUser();
        await ensurePushPermissionForUser({ requestPermission: false });
      } catch (error) {
        const status = error?.response?.status;
        if (status === 401 || status === 403 || token) {
          localStorage.removeItem('token');
        }
        syncUser(null);
      }
      refreshNotificationPermission();
      setLoading(false);
    };
    loadUser();
  }, [ensurePushPermissionForUser, refreshNotificationPermission, refreshUser, syncUser]);

  const login = async (email, password) => {
    const response = await api.post('/auth/login', { email, password });
    const { token, ...userData } = response.data.data;
    localStorage.setItem('token', token);
    syncUser(userData);
    await ensurePushPermissionForUser({ requestPermission: true });
    return response.data;
  };

  const signup = async (userData) => {
    const response = await api.post('/auth/signup', userData);
    const { token, ...user } = response.data.data;
    localStorage.setItem('token', token);
    syncUser(user);
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
    try {
      await api.post('/auth/logout');
    } catch (error) {
      console.error('Logout endpoint error:', error);
    }
    localStorage.removeItem('token');
    syncUser(null);
    refreshNotificationPermission();
  };

  const value = {
    user,
    loading,
    syncUser,
    refreshUser,
    notificationPermission,
    enableNotifications,
    login,
    signup,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
