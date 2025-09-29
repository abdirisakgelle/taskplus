import { ToastContainer } from 'react-toastify';
import { HelmetProvider } from 'react-helmet-async';
import { AuthProvider } from '@/lib/simpleAuth';
import { LayoutProvider } from '@/context/useLayoutContext';
import { NotificationProvider } from '@/context/useNotificationContext';
import ErrorBoundary from '@/components/ErrorBoundary';
const AppProvidersWrapper = ({
  children
}) => {
  return <HelmetProvider>
      <ErrorBoundary>
        <AuthProvider>
          <LayoutProvider>
            <NotificationProvider>
              {children}
              <ToastContainer theme="colored" />
            </NotificationProvider>
          </LayoutProvider>
        </AuthProvider>
      </ErrorBoundary>
    </HelmetProvider>;
};
export default AppProvidersWrapper;