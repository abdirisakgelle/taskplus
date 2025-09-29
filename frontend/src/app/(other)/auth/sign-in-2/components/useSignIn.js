import { yupResolver } from '@hookform/resolvers/yup';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate, useSearchParams } from 'react-router-dom';
import * as yup from 'yup';
import { useAuth } from '@/lib/simpleAuth';
import { useNotificationContext } from '@/context/useNotificationContext';
const useSignIn = () => {
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const {
    login: authLogin,
    getDefaultRoute
  } = useAuth();
  const [searchParams] = useSearchParams();
  const {
    showNotification
  } = useNotificationContext();
  const loginFormSchema = yup.object({
    email: yup.string().required('Please enter your username or email'),
    password: yup.string().required('Please enter your password')
  });
  const {
    control,
    handleSubmit
  } = useForm({
    resolver: yupResolver(loginFormSchema),
    defaultValues: {
      email: 'admin',
      password: 'Passw0rd!'
    }
  });
  const redirectUser = (userData) => {
    const redirectLink = searchParams.get('redirectTo');
    if (redirectLink) {
      navigate(redirectLink);
    } else if (userData?.homeRoute) {
      navigate(userData.homeRoute);
    } else {
      // Use the homeRoute from userData or fallback to dashboard
      navigate(userData?.homeRoute || '/dashboard/admin');
    }
  };
  
  const login = handleSubmit(async values => {
    setLoading(true);
    try {
      const userData = await authLogin(values.email, values.password);
      
      showNotification({
        message: 'Successfully logged in. Redirecting....',
        variant: 'success'
      });
      
      setTimeout(() => redirectUser(userData), 500);
    } catch (error) {
      showNotification({
        message: error.message,
        variant: 'danger'
      });
    } finally {
      setLoading(false);
    }
  });
  return {
    loading,
    login,
    control
  };
};
export default useSignIn;