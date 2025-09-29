import { Navigate } from 'react-router-dom';
import { useAuth } from '@/lib/simpleAuth';
import { Spinner } from 'react-bootstrap';

export const RequireAuth = ({ children }) => {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <div className="d-flex justify-content-center align-items-center" style={{ minHeight: '200px' }}>
        <Spinner />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/auth/sign-in" replace />;
  }

  return children;
};

export const RequirePerm = ({ perm, children, fallback = null }) => {
  const { hasPermission, loading, isAuthenticated } = useAuth();

  if (loading) {
    return (
      <div className="d-flex justify-content-center align-items-center" style={{ minHeight: '200px' }}>
        <Spinner />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/auth/sign-in" replace />;
  }

  if (!hasPermission(perm)) {
    if (fallback) return fallback;
    return (
      <div className="text-center p-4">
        <h4>Access Denied</h4>
        <p>You don't have permission to view this page.</p>
      </div>
    );
  }

  return children;
};

export const RequireAnyPerm = ({ perms, children, fallback = null }) => {
  const { hasAnyPermission, loading, isAuthenticated } = useAuth();

  if (loading) {
    return (
      <div className="d-flex justify-content-center align-items-center" style={{ minHeight: '200px' }}>
        <Spinner />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/auth/sign-in" replace />;
  }

  if (!hasAnyPermission(perms)) {
    if (fallback) return fallback;
    return (
      <div className="text-center p-4">
        <h4>Access Denied</h4>
        <p>You don't have permission to view this page.</p>
      </div>
    );
  }

  return children;
};
