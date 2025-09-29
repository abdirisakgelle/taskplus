import { createContext, useContext, useEffect, useState } from 'react';
import { authApi } from './api';

const AuthContext = createContext(null);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    // Return safe defaults if context is not available
    return {
      user: null,
      permissions: [],
      homeRoute: null,
      loading: true,
      error: null,
      login: async () => {},
      logout: async () => {},
      fetchMe: async () => {},
      hasPermission: () => false,
      hasAnyPermission: () => false,
      getDefaultRoute: () => '/dashboard/admin',
      isAuthenticated: false
    };
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [permissions, setPermissions] = useState([]);
  const [homeRoute, setHomeRoute] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const login = async (identifier, password) => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await authApi.login(identifier, password);
      const userData = response.data;
      
      setUser(userData);
      setPermissions(userData.permissions || []);
      setHomeRoute(userData.homeRoute);
      setLoading(false);
      
      return userData;
    } catch (error) {
      setLoading(false);
      setError(error.message);
      throw error;
    }
  };

  const logout = async () => {
    try {
      await authApi.logout();
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      setUser(null);
      setPermissions([]);
      setHomeRoute(null);
      setError(null);
    }
  };

  const fetchMe = async () => {
    try {
      setLoading(true);
      
      const response = await authApi.me();
      const userData = response.data;
      
      setUser(userData);
      setPermissions(userData.permissions || []);
      setHomeRoute(userData.homeRoute);
      setLoading(false);
      
      return userData;
    } catch (error) {
      // Don't treat 401 as an error - user is just not authenticated
      setUser(null);
      setPermissions([]);
      setHomeRoute(null);
      setLoading(false);
      setError(null);
    }
  };

  const hasPermission = (permission) => {
    return Array.isArray(permissions) && permissions.includes(permission);
  };

  const hasAnyPermission = (perms) => {
    return Array.isArray(permissions) && Array.isArray(perms) && 
           perms.some(permission => permissions.includes(permission));
  };

  const getDefaultRoute = () => {
    if (homeRoute) return homeRoute;
    
    if (!Array.isArray(permissions) || permissions.length === 0) {
      return '/dashboard/admin';
    }
    
    if (hasPermission('support.tickets')) return '/support/tickets';
    if (hasPermission('content.ideas')) return '/content/ideas';
    if (hasPermission('operations.view')) return '/operations/all';
    if (hasPermission('management.view')) return '/management/departments';
    if (hasPermission('dashboard.view')) return '/dashboard/admin';
    
    return '/dashboard/admin';
  };

  // Restore session on mount with error handling
  useEffect(() => {
    const initAuth = async () => {
      try {
        await fetchMe();
      } catch (error) {
        console.error('Initial auth check failed:', error);
        setLoading(false);
      }
    };

    const timer = setTimeout(initAuth, 100);
    return () => clearTimeout(timer);
  }, []);

  const value = {
    user,
    permissions,
    homeRoute,
    loading,
    error,
    login,
    logout,
    fetchMe,
    hasPermission,
    hasAnyPermission,
    getDefaultRoute,
    isAuthenticated: !!user
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
