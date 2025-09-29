import { Navigate, Route, Routes } from 'react-router-dom';
import AuthLayout from '@/layouts/AuthLayout';
import { useAuth } from '@/lib/simpleAuth';
import { appRoutes, authRoutes } from '@/routes/index';
import AdminLayout from '@/layouts/AdminLayout';
const AppRouter = props => {
  const {
    isAuthenticated,
    loading
  } = useAuth();
  // Show loading state while determining authentication
  if (loading) {
    return null; // Let the splash screen continue showing
  }

  return <Routes>
      {(authRoutes || []).map((route, idx) => <Route key={idx + route.name} path={route.path} element={<AuthLayout {...props}>{route.element}</AuthLayout>} />)}

      {(appRoutes || []).map((route, idx) => <Route key={idx + route.name} path={route.path} element={isAuthenticated ? <AdminLayout {...props}>{route.element}</AdminLayout> : <Navigate to={{
      pathname: '/auth/sign-in',
      search: 'redirectTo=' + route.path
    }} />} />)}
    </Routes>;
};
export default AppRouter;