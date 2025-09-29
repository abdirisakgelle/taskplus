import { createContext, useContext, useEffect, useState } from 'react';
import { authApi } from './api';

const AuthContext = createContext(null);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [state, setState] = useState({
    user: null,
    permissions: [],
    homeRoute: null,
    loading: true,
    error: null
  });

  const login = async (identifier, password) => {
    try {
      setState(prev => ({ ...prev, loading: true, error: null }));
      
      const response = await authApi.login(identifier, password);
      const userData = response.data;
      
      setState(prev => ({
        ...prev,
        user: userData,
        permissions: userData.permissions || [],
        homeRoute: userData.homeRoute,
        loading: false,
        error: null
      }));
      
      return userData;
    } catch (error) {
      setState(prev => ({
        ...prev,
        loading: false,
        error: error.message
      }));
      throw error;
    }
  };

  const logout = async () => {
    try {
      await authApi.logout();
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      setState({
        user: null,
        permissions: [],
        homeRoute: null,
        loading: false,
        error: null
      });
    }
  };

  const fetchMe = async () => {
    try {
      setState(prev => ({ ...prev, loading: true }));
      
      const response = await authApi.me();
      const userData = response.data;
      
      setState(prev => ({
        ...prev,
        user: userData,
        permissions: userData.permissions || [],
        homeRoute: userData.homeRoute,
        loading: false,
        error: null
      }));
      
      return userData;
    } catch (error) {
      // Don't treat 401 as an error - user is just not authenticated
      if (error.message.includes('401') || error.message.includes('Authentication')) {
        setState(prev => ({
          ...prev,
          user: null,
          permissions: [],
          homeRoute: null,
          loading: false,
          error: null
        }));
      } else {
        setState(prev => ({
          ...prev,
          loading: false,
          error: error.message
        }));
      }
    }
  };

  const hasPermission = (permission) => {
    return state.permissions && state.permissions.includes(permission);
  };

  const hasAnyPermission = (permissions) => {
    return state.permissions && permissions.some(permission => state.permissions.includes(permission));
  };

  const getDefaultRoute = () => {
    if (state.homeRoute) return state.homeRoute;
    
    // Only check permissions if they exist
    if (!state.permissions || state.permissions.length === 0) {
      return '/dashboard/admin';
    }
    
    // Priority order for default routes based on permissions
    if (hasPermission('support.tickets')) return '/support/tickets';
    if (hasPermission('content.ideas')) return '/content/ideas';
    if (hasPermission('operations.view')) return '/operations/all';
    if (hasPermission('management.view')) return '/management/departments';
    if (hasPermission('dashboard.view')) return '/dashboard/admin';
    
    // Fallback
    return '/dashboard/admin';
  };

  // Restore session on mount with a small delay to ensure everything is initialized
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchMe();
    }, 100);
    
    return () => clearTimeout(timer);
  }, []);

  const value = {
    user: state.user || null,
    permissions: state.permissions || [],
    homeRoute: state.homeRoute || null,
    loading: state.loading || false,
    error: state.error || null,
    login,
    logout,
    fetchMe,
    hasPermission,
    hasAnyPermission,
    getDefaultRoute,
    isAuthenticated: !!state.user
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
